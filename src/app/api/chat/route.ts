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
                const finalTopK = topK || 5;
                const finalThreshold = similarityThreshold || 0.7;
                
                console.log(`Using Top-K: ${finalTopK}, Threshold: ${finalThreshold}`);

                // Qdrant similarity search with enhanced parameters
                // First, search without threshold to get all sources for display
                const allHits = await searchQdrant(vector, {
                    collection: process.env.QDRANT_COLLECTION,
                    limit: finalTopK,
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
                    
                    // Remove common prefixes from source names for cleaner display
                    const prefixesToRemove = [
                        'C:\\Users\\User\\Desktop\\github projects\\pulmo-superbot\\assets\\split 11\\',
                        'C:/Users/User/Desktop/github projects/pulmo-superbot/assets/split 11/',
                        '/Users/User/Desktop/github projects/pulmo-superbot/assets/split 11/',
                        'C:\\\\Users\\\\User\\\\Desktop\\\\github projects\\\\pulmo-superbot\\\\assets\\\\split 11\\\\'
                    ];
                    
                    for (const prefix of prefixesToRemove) {
                        if (sourceName.startsWith(prefix)) {
                            sourceName = sourceName.substring(prefix.length);
                            console.log('Cleaned source name:', sourceName);
                            break;
                        }
                    }
                    
                    return {
                        pageContent: h.payload?.text || h.payload?.content || JSON.stringify(h.payload),
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
                    
                    return {
                        pageContent: h.payload?.text || h.payload?.content || JSON.stringify(h.payload),
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
                    
                    // Add sources information at the end if we have sources
                    if (sources && sources.length > 0) {
                        const sourcesText = `\n\n---\n**Sources Used:**\n${sources.map((s, i) => `${i + 1}. ${s.metadata.source} (similarity: ${s.metadata.score.toFixed(3)})`).join('\n')}`;
                        controller.enqueue(encoder.encode(sourcesText));
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


