import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { google } from '@ai-sdk/google';
import { embed, streamText, generateText } from 'ai';
import { searchQdrant } from '@/lib/qdrant';
import { buildRagPrompt, buildConversationPrompt, SYSTEM_PROMPT, buildHydePrompt, buildHistorySummaryPrompt, buildQueryTranslationPrompt, buildDocsJudgePrompt, buildRefinementPrompt } from '@/lib/prompt';
import { logChatEvent } from '@/lib/supabase';

export const runtime = 'edge';

export async function GET() {
    return new Response('Chat API endpoint - use POST to send messages', { status: 200 });
}

// CORS helpers
function parseAllowedOrigins(): string[] {
    return (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

function buildCorsHeaders(origin: string | null): HeadersInit {
    const headers: Record<string, string> = {
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Vary': 'Origin',
    };
    const allowed = parseAllowedOrigins();
    if (!origin) return headers;
    if (allowed.length === 0 || allowed.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
    }
    return headers;
}

export async function OPTIONS(req: NextRequest) {
    const origin = req.headers.get('origin');
    const allowed = parseAllowedOrigins();
    if (allowed.length > 0 && origin && !allowed.includes(origin)) {
        return new Response(null, { status: 204, headers: { 'Vary': 'Origin' } });
    }
    return new Response(null, { status: 204, headers: buildCorsHeaders(origin) });
}

export async function POST(req: NextRequest) {
    try {
        const origin = req.headers.get('origin');
        const allowed = parseAllowedOrigins();
        if (allowed.length > 0 && origin && !allowed.includes(origin)) {
            return new Response('Origin not allowed', { status: 403, headers: { 'Vary': 'Origin' } });
        }
        // Rate limiting (Upstash Redis) - best-effort, only if configured
        try {
            const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
            const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
            if (upstashUrl && upstashToken) {
                const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
                const key = `rate:chat:${ip}`;
                const windowSec = 60;
                const maxReq = 60;
                // INCR
                const incrRes = await fetch(`${upstashUrl}/incr/${encodeURIComponent(key)}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${upstashToken}` },
                });
                const incrJson = await incrRes.json().catch(() => null);
                const count = typeof incrJson?.result === 'number' ? incrJson.result : 0;
                if (count === 1) {
                    // First hit: set expiration
                    await fetch(`${upstashUrl}/expire/${encodeURIComponent(key)}/${windowSec}`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${upstashToken}` },
                    }).catch(() => { });
                }
                if (count > maxReq) {
                    return new Response('Rate limit exceeded. Try again later.', { status: 429, headers: buildCorsHeaders(origin) });
                }
            }
        } catch { }
        console.log('API route called');
        console.log('Environment check:', {
            hasGoogleKey: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
            hasGoogleApiKey: !!process.env.GOOGLE_API_KEY,
            hasQdrantUrl: !!process.env.QDRANT_URL,
            hasQdrantKey: !!process.env.QDRANT_API_KEY,
            hasQdrantCollection: !!process.env.QDRANT_COLLECTION
        });

        const { messages, topK, similarityThreshold, useSystemPrompt, systemPrompt: customSystemPrompt, hydeEnabled, autoTuneEnabled, structuredStreamEnabled, cragEnabled } = (await req.json()) as {
            messages: Array<{ role: 'user' | 'assistant'; content: string }>;
            topK?: number;
            similarityThreshold?: number;
            useSystemPrompt?: boolean;
            systemPrompt?: string;
            hydeEnabled?: boolean;
            autoTuneEnabled?: boolean;
            structuredStreamEnabled?: boolean;
            cragEnabled?: boolean;
        };

        console.log('Messages received:', messages);
        console.log('Parameters:', { topK, similarityThreshold, useSystemPrompt, customSystemPrompt });

        if (!messages || messages.length === 0) {
            return new Response('No messages provided', { status: 400, headers: buildCorsHeaders(origin) });
        }

        const userMessage = messages[messages.length - 1]?.content || '';
        console.log('User message:', userMessage);

        if (!userMessage) {
            return new Response('No user message provided', { status: 400, headers: buildCorsHeaders(origin) });
        }

        const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!googleApiKey) {
            return new Response('Missing Google API key (set GOOGLE_GENERATIVE_AI_API_KEY or GOOGLE_API_KEY)', { status: 500, headers: buildCorsHeaders(origin) });
        }

        // Ensure the AI SDK picks up the key via the expected env var
        if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.GOOGLE_API_KEY) {
            process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_API_KEY;
        }

        let context = '';
        let sources: Array<{ pageContent: string; metadata: { source: string; score: number;[key: string]: any } }> = [];

        // Determine Top-K value and threshold (used throughout the function)
        const finalTopK = topK || 25; // Increased from 12 to 25 for better retrieval
        const finalThreshold = typeof similarityThreshold === 'number' ? similarityThreshold : 0.01; // Lowered from 0.1 to 0.01

        // Try to get context from Qdrant if available
        try {
            if (process.env.QDRANT_URL && process.env.QDRANT_API_KEY && process.env.QDRANT_COLLECTION) {
                console.log('Qdrant configured, attempting RAG search...');
                console.log(`Using Top-K: ${finalTopK}, Cosine threshold: ${finalThreshold}`);

                // Helper to deduplicate retrieved hits by source identifier
                const dedupBySource = (hits: Array<{ score: number; payload: any }>) => {
                    const seen = new Set<string>();
                    const result: Array<{ score: number; payload: any }> = [];
                    for (const h of hits) {
                        const raw = (h && h.payload && h.payload.metadata && h.payload.metadata.source) || JSON.stringify(h?.payload || {});
                        if (!seen.has(raw)) {
                            seen.add(raw);
                            result.push(h);
                        }
                    }
                    return result;
                };

                // Build embeddings (user + optional HyDE) and retrieve
                const embeddingModel = google.embedding('text-embedding-004');
                // Optionally run Corrective RAG (CRAG): translate -> retrieve -> judge -> refine -> retrieve
                let retrievalQuery = userMessage;
                if (cragEnabled) {
                    try {
                        const translated = await generateText({ model: google('gemini-1.5-flash'), prompt: buildQueryTranslationPrompt(userMessage) });
                        retrievalQuery = (translated.text || '').trim() || userMessage;
                    } catch { }
                }

                const userEmbedding = await embed({ model: embeddingModel, value: retrievalQuery });
                const userVector = userEmbedding.embedding;

                let allHits: Array<{ score: number; payload: any }> = [];

                if (hydeEnabled) {
                    console.log('HyDE enabled - generating hypothetical document');
                    try {
                        const hydePrompt = buildHydePrompt(userMessage);
                        const hydeGen = await generateText({ model: google('gemini-1.5-flash'), prompt: hydePrompt });
                        const hydeText = (hydeGen.text || '').trim();
                        console.log('HyDE text length:', hydeText.length);
                        if (hydeText) {
                            const hydeEmbedding = await embed({ model: embeddingModel, value: hydeText });
                            const hydeVector = hydeEmbedding.embedding;

                            const hydeHits = await searchQdrant(hydeVector, {
                                collection: process.env.QDRANT_COLLECTION,
                                limit: finalTopK * 2,
                            });
                            console.log(`HyDE search returned ${hydeHits.length} hits`);

                            const userHits = await searchQdrant(userVector, {
                                collection: process.env.QDRANT_COLLECTION,
                                limit: finalTopK,
                            });
                            console.log(`User-query search returned ${userHits.length} hits`);

                            allHits = dedupBySource([...hydeHits, ...userHits]);
                        } else {
                            console.log('HyDE generation empty - falling back to user embedding search');
                            allHits = await searchQdrant(userVector, {
                                collection: process.env.QDRANT_COLLECTION,
                                limit: finalTopK * 2,
                            });
                        }
                    } catch (hydeError) {
                        console.warn('HyDE failed, using user embedding search:', hydeError);
                        allHits = await searchQdrant(userVector, {
                            collection: process.env.QDRANT_COLLECTION,
                            limit: finalTopK * 2,
                        });
                    }
                } else {
                    // Standard retrieval without HyDE
                    allHits = await searchQdrant(userVector, {
                        collection: process.env.QDRANT_COLLECTION,
                        limit: finalTopK * 2,
                    });
                }

                console.log(`Retrieved ${allHits.length} total sources with scores:`, allHits.map(h => h.score));

                // If CRAG enabled, judge and possibly refine and re-retrieve
                if (cragEnabled && allHits.length > 0) {
                    try {
                        const snippets = allHits.slice(0, Math.min(8, allHits.length)).map((h) => ({
                            source: (h.payload?.metadata?.source as string) || 'Unknown',
                            score: h.score,
                            text: (h.payload?.text as string) || (h.payload?.content as string) || (h.payload?.pageContent as string) || ''
                        }));
                        const judgePrompt = buildDocsJudgePrompt(retrievalQuery, snippets);
                        const judgeRes = await generateText({ model: google('gemini-1.5-flash'), prompt: judgePrompt });
                        const judgeText = (judgeRes.text || '').trim();
                        const needsRefine = /"action"\s*:\s*"refine"/i.test(judgeText);
                        if (needsRefine) {
                            const hintMatch = judgeText.match(/"hint"\s*:\s*"([\s\S]*?)"/);
                            const hint = hintMatch ? hintMatch[1] : '';
                            if (hint) {
                                const refinePrompt = buildRefinementPrompt(retrievalQuery, hint);
                                const refineRes = await generateText({ model: google('gemini-1.5-flash'), prompt: refinePrompt });
                                const refinedQuery = (refineRes.text || '').trim();
                                if (refinedQuery) {
                                    const refinedEmbedding = await embed({ model: embeddingModel, value: refinedQuery });
                                    const refinedVector = refinedEmbedding.embedding;
                                    const refinedHits = await searchQdrant(refinedVector, {
                                        collection: process.env.QDRANT_COLLECTION,
                                        limit: finalTopK * 2,
                                    });
                                    // Merge with previous hits and dedupe
                                    allHits = dedupBySource([...refinedHits, ...allHits]).slice(0, finalTopK * 2);
                                    retrievalQuery = refinedQuery;
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('CRAG judge/refine failed, proceeding with initial retrieval');
                    }
                }

                // Then filter by threshold for context generation
                // Cosine similarity: higher is better; keep scores >= threshold
                const filteredHits = allHits.filter(h => h.score >= finalThreshold);
                console.log(`Filtered to ${filteredHits.length} sources at or above threshold ${finalThreshold}`);

                // Extract context from filtered sources (used for AI response)
                const contextSources = filteredHits.map((h) => {
                    let sourceName = h.payload?.metadata?.source || 'Unknown Source';

                    console.log('Original source name:', sourceName);

                    // Debug: Log the actual payload structure
                    console.log('🔍 Payload structure:', JSON.stringify(h.payload, null, 2).substring(0, 500));

                    // Remove common prefixes from source names for cleaner display
                    const prefixesToRemove = [
                        'C:\\Users\\User\\Desktop\\github projects\\pulmo-superbot\\assets\\split 11\\',
                        'C:/Users/User/Desktop/github projects\\pulmo-superbot/assets/split 11/',
                        '/Users/User/Desktop/github projects\\pulmo-superbot/assets/split 11/',
                        'C:\\\\Users\\\\User\\\\Desktop\\\\github projects\\\\pulmo-superbot\\\\assets\\\\split 11\\\\'
                    ];

                    for (const prefix of prefixesToRemove) {
                        if (sourceName.startsWith(prefix)) {
                            sourceName = sourceName.substring(prefix.length);
                            console.log('Cleaned source name:', sourceName);
                            break;
                        }
                    }

                    // Extract text content - prioritize actual text fields over JSON fallback
                    let textContent = '';
                    if (h.payload?.text && typeof h.payload.text === 'string') {
                        textContent = h.payload.text;
                    } else if (h.payload?.content && typeof h.payload.content === 'string') {
                        textContent = h.payload.content;
                    } else if (h.payload?.pageContent && typeof h.payload.pageContent === 'string') {
                        textContent = h.payload.pageContent;
                    } else {
                        // Fallback: try to extract meaningful text from payload
                        const payloadStr = JSON.stringify(h.payload);
                        // Only use JSON fallback if it's not too long and contains readable text
                        if (payloadStr.length < 1000 && payloadStr.includes(' ')) {
                            textContent = payloadStr;
                        } else {
                            textContent = 'Content not available in readable format';
                        }
                    }

                    console.log('🔍 Extracted text content (first 200 chars):', textContent.substring(0, 200));

                    return {
                        pageContent: textContent,
                        metadata: {
                            source: sourceName,
                            score: h.score,
                            // Don't spread the original metadata to avoid overwriting the cleaned source name
                            ...Object.fromEntries(
                                Object.entries(h.payload?.metadata || {}).filter(([key]) => key !== 'source')
                            )
                        }
                    };
                });

                // Use filtered sources for context generation
                context = contextSources
                    .map((s) => s.pageContent)
                    .join('\n---\n');

                // Add production guardrail for thin context
                if (context.length < 200) {
                    context = context + '\n---\n[Note: Retrieved context has limited direct coverage; answer with general medical knowledge.]';
                }

                // Add final safety net - ensure context always has guidance
                if (!context.includes('general medical knowledge') && !context.includes('comprehensive medical response')) {
                    context = context + '\n---\n[IMPORTANT: Always provide a comprehensive medical answer, even if the specific term is not directly mentioned in the retrieved context. Use general medical knowledge when needed.]';
                }

                // Debug: Log what's being sent to the AI
                console.log('🔍 Context being sent to AI (first 500 chars):', context.substring(0, 500));
                console.log('🔍 Context length:', context.length);
                console.log('🔍 Number of context sources:', contextSources.length);

                // Create all sources list for display (including unused ones)
                sources = allHits.map((h) => {
                    let sourceName = h.payload?.metadata?.source || 'Unknown Source';

                    // Remove common prefixes from source names for cleaner display
                    const prefixesToRemove = [
                        'C:\\Users\\User\\Desktop\\github projects\\pulmo-superbot\\assets\\split 11\\',
                        'C:/Users/User/Desktop/github projects\\pulmo-superbot/assets/split 11/',
                        '/Users/User/Desktop/github projects\\pulmo-superbot/assets/split 11/',
                        'C:\\\\Users\\\\User\\\\Desktop\\\\github projects\\\\pulmo-superbot\\\\assets\\\\split 11\\\\'
                    ];

                    for (const prefix of prefixesToRemove) {
                        if (sourceName.startsWith(prefix)) {
                            sourceName = sourceName.substring(prefix.length);
                            break;
                        }
                    }

                    // Extract text content for display - same logic as context extraction
                    let pageContent = '';
                    if (h.payload?.text && typeof h.payload.text === 'string') {
                        pageContent = h.payload.text;
                    } else if (h.payload?.content && typeof h.payload.content === 'string') {
                        pageContent = h.payload.content;
                    } else if (h.payload?.pageContent && typeof h.payload.pageContent === 'string') {
                        pageContent = h.payload.pageContent;
                    } else {
                        // Fallback: try to extract meaningful text from payload
                        const payloadStr = JSON.stringify(h.payload);
                        // Only use JSON fallback if it's not too long and contains readable text
                        if (payloadStr.length < 1000 && payloadStr.includes(' ')) {
                            pageContent = payloadStr;
                        } else {
                            pageContent = 'Content not available in readable format';
                        }
                    }

                    return {
                        pageContent: pageContent,
                        metadata: {
                            source: sourceName,
                            score: h.score,
                            used: h.score >= finalThreshold, // Whether this source was used in context
                            ...Object.fromEntries(
                                Object.entries(h.payload?.metadata || {}).filter(([key]) => key !== 'source')
                            )
                        }
                    };
                });

                console.log(`RAG context generated from ${filteredHits.length} sources above threshold ${finalThreshold}`);
                console.log(`Total sources retrieved: ${allHits.length}, Used in context: ${filteredHits.length}`);

                // If we have sources but none meet the threshold, create a minimal context
                if (allHits.length > 0 && filteredHits.length === 0) {
                    console.log('⚠️ Sources exist but none meet threshold - using minimal context with top sources');
                    // Use top 3 sources regardless of threshold for minimal context
                    const topSources = allHits.slice(0, 3).map((h) => {
                        let sourceName = h.payload?.metadata?.source || 'Unknown Source';

                        // Clean source name
                        const prefixesToRemove = [
                            'C:\\Users\\User\\Desktop\\github projects\\pulmo-superbot\\assets\\split 11\\',
                            'C:/Users/User/Desktop/github projects\\pulmo-superbot/assets/split 11/',
                            '/Users/User/Desktop/github projects\\pulmo-superbot/assets/split 11/',
                            'C:\\\\Users\\\\User\\\\Desktop\\\\github projects\\\\pulmo-superbot\\\\assets\\\\split 11\\\\'
                        ];

                        for (const prefix of prefixesToRemove) {
                            if (sourceName.startsWith(prefix)) {
                                sourceName = sourceName.substring(prefix.length);
                                break;
                            }
                        }

                        // Extract text content for fallback context - same logic as above
                        let pageContent = '';
                        if (h.payload?.text && typeof h.payload.text === 'string') {
                            pageContent = h.payload.text;
                        } else if (h.payload?.content && typeof h.payload.content === 'string') {
                            pageContent = h.payload.content;
                        } else if (h.payload?.pageContent && typeof h.payload.pageContent === 'string') {
                            pageContent = h.payload.pageContent;
                        } else {
                            // Fallback: try to extract meaningful text from payload
                            const payloadStr = JSON.stringify(h.payload);
                            // Only use JSON fallback if it's not too long and contains readable text
                            if (payloadStr.length < 1000 && payloadStr.includes(' ')) {
                                pageContent = payloadStr;
                            } else {
                                pageContent = 'Content not available in readable format';
                            }
                        }

                        return {
                            pageContent: pageContent,
                            metadata: {
                                source: sourceName,
                                score: h.score,
                                used: false, // Mark as not meeting threshold
                                ...Object.fromEntries(
                                    Object.entries(h.payload?.metadata || {}).filter(([key]) => key !== 'source')
                                )
                            }
                        };
                    });

                    // Create minimal context with warning
                    context = `[Note: Using sources below threshold for context]\n\n${topSources.map(s => s.pageContent).join('\n---\n')}`;

                    // Update sources list to mark these as used for context
                    sources = sources.map(s => ({
                        ...s,
                        used: s.metadata.score >= finalThreshold || topSources.some(ts => ts.metadata.source === s.metadata.source)
                    }));
                }
            } else {
                console.log('Qdrant not configured, using basic chat mode');
            }
        } catch (qdrantError) {
            Sentry.captureException(qdrantError);
            console.warn('Qdrant search failed, continuing without context:', qdrantError);
            context = '';
        }

        // Convert messages to the format expected by streamText (cap history to last 10 before current)
        const t0 = Date.now();
        const history = messages.slice(0, -1);
        const limitedHistory = history.length > 10 ? history.slice(-10) : history;
        const aiMessages = [...limitedHistory, messages[messages.length - 1]].map((msg) => ({
            role: msg.role,
            content: msg.content
        }));

        // If we have context, use RAG prompt, otherwise use direct conversation
        if (context) {
            // Check if we have conversation history
            if (messages.length > 1) {
                const conversationHistory = limitedHistory;
                // Summarize limited history (best-effort)
                let historySummary: string | undefined = undefined;
                try {
                    if (conversationHistory.length >= 6) {
                        const sumPrompt = buildHistorySummaryPrompt(conversationHistory);
                        const sum = await generateText({ model: google('gemini-1.5-flash'), prompt: sumPrompt });
                        historySummary = (sum.text || '').trim();
                    }
                } catch { }
                const fullPrompt = buildConversationPrompt(context, userMessage, conversationHistory, useSystemPrompt !== false, historySummary);
                aiMessages[aiMessages.length - 1] = { role: 'user', content: fullPrompt };
                console.log('Using conversation prompt with context and history');
            } else {
                const fullPrompt = buildRagPrompt(context, userMessage);
                aiMessages[aiMessages.length - 1] = { role: 'user', content: fullPrompt };
                console.log('Using RAG prompt with context');
            }
        } else {
            console.log('Using direct conversation mode');
        }

        // Determine system prompt based on user preference
        let finalSystemPrompt: string;
        if (useSystemPrompt === false) {
            finalSystemPrompt = 'You are a helpful AI assistant. Provide direct, factual answers based on the user\'s questions.';
        } else if (customSystemPrompt && customSystemPrompt.trim()) {
            finalSystemPrompt = customSystemPrompt;
        } else {
            finalSystemPrompt = SYSTEM_PROMPT;
        }

        console.log('Sending to Gemini with messages:', aiMessages.length);
        console.log('System prompt enabled:', useSystemPrompt !== false);
        console.log('Using system prompt:', finalSystemPrompt.substring(0, 100) + (finalSystemPrompt.length > 100 ? '...' : ''));

        const llmStart = Date.now();
        const result = await streamText({
            model: google('gemini-1.5-flash'),
            system: finalSystemPrompt,
            messages: aiMessages,
            onFinish: async ({ text }) => {
                // Fire-and-forget logging with full text
                void logChatEvent({
                    user_message: userMessage,
                    model: 'gemini-1.5-flash',
                    used_context: Boolean(context),
                    context_preview: context ? context.slice(0, 1000) : null,
                    response_preview: (text || '').slice(0, 2000),
                    metadata: {
                        topK: topK || 'auto',
                        similarityThreshold: similarityThreshold || 0.7,
                        useSystemPrompt: useSystemPrompt !== false,
                        customSystemPrompt: customSystemPrompt || null,
                        conversationLength: messages.length,
                        timings: {
                            totalMs: Date.now() - t0,
                            llmMs: Date.now() - llmStart
                        }
                    },
                });
            },
        });

        console.log('Gemini response received, returning stream');

        const encoder = new TextEncoder();

        if (structuredStreamEnabled) {
            // JSONL structured streaming: emit {type:"delta", text} and final {type:"sources", ...}
            const stream = new ReadableStream({
                async start(controller) {
                    try {
                        for await (const chunk of result.textStream) {
                            const line = JSON.stringify({ type: 'delta', text: chunk });
                            controller.enqueue(encoder.encode(line + '\n'));
                        }
                        const finalLine = JSON.stringify({
                            type: 'sources',
                            sources: sources.map(s => ({ source: s.metadata.source, score: s.metadata.score, used: s.metadata.used })),
                            topKUsed: finalTopK,
                            thresholdUsed: finalThreshold,
                            hydeEnabled: Boolean(hydeEnabled),
                            autoTuneEnabled: Boolean(autoTuneEnabled),
                            cragEnabled: Boolean(cragEnabled)
                        });
                        controller.enqueue(encoder.encode(finalLine + '\n'));
                        controller.close();
                    } catch (error) {
                        Sentry.captureException(error);
                        console.error('Stream error:', error);
                        controller.error(error);
                    }
                }
            });
            return new Response(stream, {
                headers: {
                    'Content-Type': 'application/x-ndjson',
                    'Transfer-Encoding': 'chunked',
                    ...buildCorsHeaders(origin),
                },
            });
        } else {
            // Plain text + trailing metadata (backward compatible)
            const stream = new ReadableStream({
                async start(controller) {
                    try {
                        for await (const chunk of result.textStream) {
                            controller.enqueue(encoder.encode(chunk));
                        }
                        if (sources && sources.length > 0) {
                            const sourcesMetadata = JSON.stringify({
                                type: 'sources_metadata',
                                sources: sources.map(s => ({ source: s.metadata.source, score: s.metadata.score, used: s.metadata.used })),
                                topKUsed: finalTopK,
                                thresholdUsed: finalThreshold,
                                hydeEnabled: Boolean(hydeEnabled),
                                autoTuneEnabled: Boolean(autoTuneEnabled),
                                cragEnabled: Boolean(cragEnabled)
                            });
                            controller.enqueue(encoder.encode('\n\n---\n' + sourcesMetadata));
                        }
                        controller.close();
                    } catch (error) {
                        Sentry.captureException(error);
                        console.error('Stream error:', error);
                        controller.error(error);
                    }
                }
            });
            return new Response(stream, {
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Transfer-Encoding': 'chunked',
                    ...buildCorsHeaders(origin),
                },
            });
        }
    } catch (err) {
        // Narrow error typing safely
        const message = err instanceof Error ? err.message : 'unknown error';
        Sentry.captureException(err);
        console.error('API Error:', err);
        return new Response(`Error: ${message}`, { status: 500 });
    }
}


