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

        const { messages, topK, similarityThreshold, useSystemPrompt, systemPrompt: customSystemPrompt, hydeEnabled, autoTuneEnabled, structuredStreamEnabled, cragEnabled, hybridEnabled, mmrEnabled, crossEncoderEnabled } = (await req.json()) as {
            messages: Array<{ role: 'user' | 'assistant'; content: string }>;
            topK?: number;
            similarityThreshold?: number;
            useSystemPrompt?: boolean;
            systemPrompt?: string;
            hydeEnabled?: boolean;
            autoTuneEnabled?: boolean;
            structuredStreamEnabled?: boolean;
            cragEnabled?: boolean;
            hybridEnabled?: boolean;
            mmrEnabled?: boolean;
            crossEncoderEnabled?: boolean;
        };

        console.log('Messages received:', messages);
        console.log('Parameters:', { topK, similarityThreshold, useSystemPrompt, customSystemPrompt, hybridEnabled, mmrEnabled, crossEncoderEnabled });

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
                                scoreThreshold: Math.max(finalThreshold, 0.08),
                                withVectors: mmrEnabled === true,
                            });
                            console.log(`HyDE search returned ${hydeHits.length} hits`);

                            const userHits = await searchQdrant(userVector, {
                                collection: process.env.QDRANT_COLLECTION,
                                limit: finalTopK,
                                scoreThreshold: Math.max(finalThreshold, 0.08),
                                withVectors: mmrEnabled === true,
                            });
                            console.log(`User-query search returned ${userHits.length} hits`);

                            allHits = dedupBySource([...hydeHits, ...userHits]);
                        } else {
                            console.log('HyDE generation empty - falling back to user embedding search');
                            allHits = await searchQdrant(userVector, {
                                collection: process.env.QDRANT_COLLECTION,
                                limit: finalTopK * 2,
                                scoreThreshold: Math.max(finalThreshold, 0.08),
                                withVectors: mmrEnabled === true,
                            });
                        }
                    } catch (hydeError) {
                        console.warn('HyDE failed, using user embedding search:', hydeError);
                        allHits = await searchQdrant(userVector, {
                            collection: process.env.QDRANT_COLLECTION,
                            limit: finalTopK * 2,
                            scoreThreshold: Math.max(finalThreshold, 0.08),
                            withVectors: mmrEnabled === true,
                        });
                    }
                } else {
                    // Standard retrieval without HyDE
                    allHits = await searchQdrant(userVector, {
                        collection: process.env.QDRANT_COLLECTION,
                        limit: finalTopK * 2,
                        scoreThreshold: Math.max(finalThreshold, 0.08),
                        withVectors: mmrEnabled === true,
                    });
                }

                console.log(`Retrieved ${allHits.length} total sources with scores:`, allHits.map(h => h.score));

                // 1) Filter to only optimized chunks to avoid mixed-model/older embeddings
                const preFilterCount = allHits.length;
                allHits = allHits.filter(h => {
                    const p = h?.payload || {};
                    return p.optimized === true || p?.metadata?.optimized === true;
                });
                if (preFilterCount !== allHits.length) {
                    console.log(`Filtered non-optimized chunks: ${preFilterCount} -> ${allHits.length}`);
                }

                // 2) Heuristic re-ranking to penalize reference sections and boost keyword overlap (hybrid)
                const queryText = retrievalQuery || userMessage;
                const queryTerms = (queryText || '')
                    .toLowerCase()
                    .replace(/[^a-z0-9\s]/g, ' ')
                    .split(/\s+/)
                    .filter(t => t.length > 2);
                // Detect potential acronyms/proper nouns from raw query (upper-case tokens)
                const rawTokens = (queryText || '').split(/\s+/).filter(Boolean);
                const acronyms = rawTokens.filter(t => /^(?:[A-Z]{2,5}|[A-Z]{2,}[0-9]*)$/.test(t));

                function keywordOverlapScore(text: string): number {
                    if (!text) return 0;
                    const lower = text.toLowerCase();
                    let hits = 0;
                    for (const t of queryTerms) {
                        if (lower.includes(t)) hits++;
                    }
                    return hits / Math.max(1, queryTerms.length);
                }

                // Simple BM25-like keyword scoring leveraging term frequencies and length normalization
                function bm25ishScore(text: string): number {
                    if (!text) return 0;
                    const tokens = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
                    if (tokens.length === 0) return 0;
                    const tf: Record<string, number> = {};
                    for (const tok of tokens) tf[tok] = (tf[tok] || 0) + 1;
                    let sum = 0;
                    for (const q of queryTerms) {
                        const f = tf[q] || 0;
                        if (f > 0) sum += Math.log(1 + f);
                    }
                    // Length norm prefers concise chunks
                    const lengthNorm = 1 + (tokens.length / 500);
                    return sum / lengthNorm;
                }

                function referencesPenalty(text: string): number {
                    if (!text) return 0;
                    // Penalize citation-heavy content
                    const patterns = [
                        /et\s+al\./gi,
                        /\b(JAMA|Chest\.|N\s?Engl\s?J\s?Med|Lancet|Radiol\.|Am\sJ\sRespir|Thorax)\b/gi,
                        /\b(19|20)\d{2}\b/g,
                        /\d+\s*\./g // numbered lists typical of references
                    ];
                    let count = 0;
                    for (const p of patterns) {
                        const m = text.match(p);
                        if (m) count += m.length;
                    }
                    // Map count to [0,1] with diminishing returns
                    return Math.min(1, count / 8); // Increased reference penalty
                }

                const reranked = allHits.map(h => {
                    const t = (h?.payload?.text as string)
                        || (h?.payload?.content as string)
                        || (h?.payload?.pageContent as string)
                        || '';
                    const kw = keywordOverlapScore(t);
                    const bm25 = hybridEnabled ? bm25ishScore(t) : 0;
                    const pen = referencesPenalty(t);
                    const metaTitle = ((h?.payload?.metadata?.title as string) || (h?.payload?.title as string) || (h?.payload?.metadata?.section as string) || '').toString();
                    const metaBoost = metaTitle ? (keywordOverlapScore(metaTitle) * 0.25) : 0;
                    // If query includes acronyms and the text contains them exactly, add a small boost
                    const acronymBoost = acronyms.some(a => t.includes(a)) ? 0.10 : 0;
                    // Weighted combination
                    // If hybrid is enabled, give more weight to keyword/BM25 terms
                    const combined = (hybridEnabled ? 0.65 : 0.75) * h.score
                        + (hybridEnabled ? 0.35 : 0.18) * kw
                        + (hybridEnabled ? 0.20 : 0.00) * bm25
                        + metaBoost
                        + acronymBoost
                        - 0.35 * pen; // increase reference penalty
                    return { ...h, _kw: kw, _bm25: bm25, _pen: pen, _metaBoost: metaBoost, _acr: acronymBoost, _combined: combined } as any;
                })
                .sort((a, b) => (b._combined ?? 0) - (a._combined ?? 0));

                // 3) Dynamic threshold relative to the best candidate to drop the tail
                const topCombined = reranked.length ? (reranked[0]._combined ?? 0) : 0;
                const absoluteThreshold = finalThreshold; // user/system provided absolute threshold (cosine)
                const relativeThreshold = topCombined * 0.85; // keep items within 85% of best combined score (tighter)
                const cosineFloor = Math.max(absoluteThreshold, 0.10); // cut the tail of weak cosine matches (raised)
                const minKwOverlap = hybridEnabled ? 0.15 : 0.05; // require some lexical grounding, more when hybrid

                // Keep items that either have decent vector score or survive combined cutoff AND meet min keyword overlap
                let filteredByDynamic = reranked.filter(h => {
                    const keepByCosine = h.score >= cosineFloor;
                    const keepByCombined = h._combined >= relativeThreshold;
                    const keepByKw = (h._kw ?? 0) >= minKwOverlap;
                    return (keepByCosine || keepByCombined) && keepByKw;
                });
                console.log(`Dynamic filter: topCombined=${topCombined.toFixed(4)}, rel>=${relativeThreshold.toFixed(4)}, cosineFloor>=${cosineFloor.toFixed(4)}, minKw>=${minKwOverlap}. Kept ${filteredByDynamic.length}/${reranked.length}`);

                // Optional cross-encoder-like reranking using LLM to score relevance of top candidates
                if (crossEncoderEnabled && filteredByDynamic.length > 0) {
                    try {
                        const maxCe = Math.min(50, filteredByDynamic.length);
                        const sample = filteredByDynamic.slice(0, maxCe);
                        const cePrompt = `You are a ranking model. Given a query and a list of snippets, assign each snippet a relevance score from 0.0 to 1.0. Output a compact JSON array of objects: [{"id": <index>, "score": <0..1>}]. Do not include any text before or after the JSON.\n\nQuery: ${queryText}\n\nSnippets:\n` + sample.map((h, i) => {
                            const text = ((h?.payload?.text as string) || (h?.payload?.content as string) || (h?.payload?.pageContent as string) || '').slice(0, 800);
                            return `#${i}: ${text}`;
                        }).join('\n');
                        const ceRes = await generateText({ model: google('gemini-1.5-flash'), prompt: cePrompt });
                        const ceText = (ceRes.text || '').trim();
                        let scores: Array<{ id: number; score: number }> = [];
                        try { scores = JSON.parse(ceText); } catch {}
                        if (Array.isArray(scores) && scores.length > 0) {
                            const map = new Map<number, number>();
                            for (const s of scores) if (typeof s?.id === 'number' && typeof s?.score === 'number') map.set(s.id, s.score);
                            filteredByDynamic = sample
                                .map((h, i) => ({ ...h, _ce: map.get(i) ?? 0 }))
                                .sort((a, b) => (b._ce ?? 0) - (a._ce ?? 0))
                                .concat(filteredByDynamic.slice(maxCe));
                            console.log('Applied cross-encoder reranking to', maxCe, 'items');
                        }
                    } catch (e) {
                        console.warn('Cross-encoder rerank failed; continuing with vector ranking');
                    }
                }

                // 4) Optional MMR selection using candidate vectors
                function cosineSim(a: number[], b: number[]): number {
                    let dot = 0, na = 0, nb = 0;
                    const n = Math.min(a.length, b.length);
                    for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
                    if (na === 0 || nb === 0) return 0;
                    return dot / (Math.sqrt(na) * Math.sqrt(nb));
                }

                let diversified: any[] = [];
                if (mmrEnabled) {
                    // Ensure vectors exist on candidates
                    const candidatesWithVec = filteredByDynamic.filter(h => (h as any).vector && Array.isArray((h as any).vector));
                    if (candidatesWithVec.length >= 2) {
                        const lambda = 0.7; // trade-off relevance vs diversity
                        const selected: any[] = [];
                        const remaining = [...candidatesWithVec];
                        while (selected.length < finalTopK && remaining.length > 0) {
                            let bestIdx = 0; let bestScore = -Infinity;
                            for (let i = 0; i < remaining.length; i++) {
                                const h = remaining[i];
                                const simToQuery = cosineSim((h as any).vector as number[], userVector as number[]);
                                let maxSimToSelected = 0;
                                for (const s of selected) {
                                    const sim = cosineSim(((h as any).vector as number[]), ((s as any).vector as number[]));
                                    if (sim > maxSimToSelected) maxSimToSelected = sim;
                                }
                                const mmrScore = lambda * simToQuery - (1 - lambda) * maxSimToSelected;
                                if (mmrScore > bestScore) { bestScore = mmrScore; bestIdx = i; }
                            }
                            selected.push(remaining.splice(bestIdx, 1)[0]);
                        }
                        diversified = selected;
                        // Fill from any leftover (without vectors) if needed
                        if (diversified.length < finalTopK) {
                            for (const h of filteredByDynamic) {
                                if (diversified.length >= finalTopK) break;
                                if (!diversified.includes(h)) diversified.push(h);
                            }
                        }
                        console.log('Applied MMR selection, count:', diversified.length);
                    }
                }

                if (diversified.length === 0) {
                    // Fallback: Enforce source diversity: limit to 1 per source initially, then fill up to Top-K
                    const bySource = new Map<string, any[]>();
                    for (const h of filteredByDynamic) {
                        const src = (h?.payload?.metadata?.source as string) || (h?.payload?.source as string) || 'Unknown';
                        if (!bySource.has(src)) bySource.set(src, []);
                        bySource.get(src)!.push(h);
                    }
                    // First pass: take top 1 per source
                    for (const [_, arr] of bySource) {
                        arr.sort((a, b) => (b._combined ?? 0) - (a._combined ?? 0));
                        diversified.push(arr[0]);
                    }
                    // If we still have room, fill with remaining best
                    if (diversified.length < finalTopK) {
                        const rest = ([] as any[]).concat(...Array.from(bySource.values()).map(a => a.slice(1)));
                        rest.sort((a, b) => (b._combined ?? 0) - (a._combined ?? 0));
                        for (const h of rest) {
                            if (diversified.length >= finalTopK) break;
                            diversified.push(h);
                        }
                    }
                }

                // Trim to Top-K window used downstream and cap context size to avoid flooding the LLM
                const maxContextSources = Math.max(8, Math.min(10, finalTopK));
                const finalHits = diversified.slice(0, maxContextSources);
                console.log(`Post-rerank counts — optimized: ${allHits.length}, passing dynamic filter: ${filteredByDynamic.length}, diversified: ${diversified.length}, finalUsed: ${finalHits.length} (cap=${maxContextSources})`);

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

                // Then filter by threshold for context generation (use finalHits)
                const filteredHits = finalHits;
                console.log(`Filtered to ${filteredHits.length} sources at or above dynamic thresholding (abs=${finalThreshold}, rel≈${(topCombined*0.55).toFixed(3)})`);

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


