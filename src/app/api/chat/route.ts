import { NextRequest } from 'next/server';
import { google } from '@ai-sdk/google';
import { embed, streamText } from 'ai';
import { searchQdrant } from '@/lib/qdrant';
import { buildRagPrompt, buildConversationPrompt, SYSTEM_PROMPT } from '@/lib/prompt';
import { logChatEvent } from '@/lib/supabase';

export const runtime = 'edge';

export async function GET() {
    return new Response('Chat API endpoint - use POST to send messages', { status: 200 });
}

export async function POST(req: NextRequest) {
    try {
        console.log('API route called');
        console.log('Environment check:', {
            hasGoogleKey: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
            hasGoogleApiKey: !!process.env.GOOGLE_API_KEY,
            hasQdrantUrl: !!process.env.QDRANT_URL,
            hasQdrantKey: !!process.env.QDRANT_API_KEY,
            hasQdrantCollection: !!process.env.QDRANT_COLLECTION
        });

        const { messages, topK, similarityThreshold, useSystemPrompt, systemPrompt: customSystemPrompt } = (await req.json()) as { 
            messages: Array<{ role: 'user' | 'assistant'; content: string }>;
            topK?: number;
            similarityThreshold?: number;
            useSystemPrompt?: boolean;
            systemPrompt?: string;
        };
        
        console.log('Messages received:', messages);
        console.log('Parameters:', { topK, similarityThreshold, useSystemPrompt, customSystemPrompt });

        if (!messages || messages.length === 0) {
            return new Response('No messages provided', { status: 400 });
        }

        const userMessage = messages[messages.length - 1]?.content || '';
        console.log('User message:', userMessage);

        if (!userMessage) {
            return new Response('No user message provided', { status: 400 });
        }

        const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!googleApiKey) {
            return new Response('Missing Google API key (set GOOGLE_GENERATIVE_AI_API_KEY or GOOGLE_API_KEY)', { status: 500 });
        }
        
        // Ensure the AI SDK picks up the key via the expected env var
        if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.GOOGLE_API_KEY) {
            process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_API_KEY;
        }

        let context = '';
        let sources: Array<{ pageContent: string; metadata: { source: string; score: number; [key: string]: any } }> = [];

        // Try to get context from Qdrant if available
        try {
            if (process.env.QDRANT_URL && process.env.QDRANT_API_KEY && process.env.QDRANT_COLLECTION) {
                console.log('Qdrant configured, attempting RAG search...');
                
                // Create embedding using Gemini
                const embeddingModel = google.embedding('text-embedding-004');
                const embeddingRes = await embed({
                    model: embeddingModel,
                    value: userMessage,
                });
                const vector = embeddingRes.embedding;

                // Determine Top-K value
                const finalTopK = topK || 15; // Increased default for better coverage
                const finalThreshold = similarityThreshold || 0.05; // More permissive threshold for broader recall
                
                console.log(`Using Top-K: ${finalTopK}, Threshold: ${finalThreshold}`);

                // Qdrant similarity search with enhanced parameters
                // First, search without threshold to get all sources for display
                const allHits = await searchQdrant(vector, {
                    collection: process.env.QDRANT_COLLECTION,
                    limit: finalTopK * 2, // Get more results initially for better filtering
                    // No score threshold here - we want to see all retrieved sources
                });
                
                console.log(`Retrieved ${allHits.length} total sources with scores:`, allHits.map(h => h.score));
                
                // Then filter by threshold for context generation
                const filteredHits = allHits.filter(h => h.score >= finalThreshold);
                console.log(`Filtered to ${filteredHits.length} sources above threshold ${finalThreshold}`);
                
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
            console.warn('Qdrant search failed, continuing without context:', qdrantError);
            context = '';
        }

        // Convert messages to the format expected by streamText
        const aiMessages = messages.map((msg) => ({
            role: msg.role,
            content: msg.content
        }));

        // If we have context, use RAG prompt, otherwise use direct conversation
        if (context) {
            // Check if we have conversation history
            if (messages.length > 1) {
                const conversationHistory = messages.slice(0, -1);
                const fullPrompt = buildConversationPrompt(context, userMessage, conversationHistory, useSystemPrompt !== false);
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
                        conversationLength: messages.length
                    },
                });
            },
        });

        console.log('Gemini response received, returning stream');

        // Create a custom stream that includes sources
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Stream the AI response
                    for await (const chunk of result.textStream) {
                        controller.enqueue(encoder.encode(chunk));
                    }
                    
                    // Add sources metadata at the end
                    if (sources && sources.length > 0) {
                        const sourcesMetadata = JSON.stringify({
                            type: 'sources_metadata',
                            sources: sources.map(s => ({
                                source: s.metadata.source,
                                score: s.metadata.score,
                                used: s.metadata.used
                            }))
                        });
                        
                        controller.enqueue(encoder.encode('\n\n---\n' + sourcesMetadata));
                    }
                    
                    controller.close();
                } catch (error) {
                    console.error('Stream error:', error);
                    controller.error(error);
                }
            }
        });

        // Return the custom stream with sources
        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
            },
        });
    } catch (err) {
        // Narrow error typing safely
        const message = err instanceof Error ? err.message : 'unknown error';
        console.error('API Error:', err);
        return new Response(`Error: ${message}`, { status: 500 });
    }
}


