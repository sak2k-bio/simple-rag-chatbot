import { NextRequest } from 'next/server';
import { google } from '@ai-sdk/google';
import { embed, streamText } from 'ai';
import { searchQdrant } from '@/lib/qdrant';
import { buildRagPrompt, SYSTEM_PROMPT } from '@/lib/prompt';
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

        const { messages } = (await req.json()) as { messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> };
        console.log('Messages received:', messages);

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

                // Qdrant similarity search
                const hits = await searchQdrant(vector, {
                    collection: process.env.QDRANT_COLLECTION,
                    limit: 5,
                    scoreThreshold: 0.2,
                });
                context = hits
                    .map((h) => (h.payload?.text || h.payload?.content || JSON.stringify(h.payload)))
                    .join('\n---\n');
                console.log('RAG context found:', context ? 'Yes' : 'No');
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
            const fullPrompt = buildRagPrompt(context, userMessage);
            aiMessages[aiMessages.length - 1] = { role: 'user', content: fullPrompt };
            console.log('Using RAG prompt with context');
        } else {
            console.log('Using direct conversation mode');
        }

        console.log('Sending to Gemini with messages:', aiMessages.length);

        const result = await streamText({
            model: google('gemini-1.5-flash'),
            system: SYSTEM_PROMPT,
            messages: aiMessages,
            onFinish: async ({ text }) => {
                // Fire-and-forget logging with full text
                void logChatEvent({
                    user_message: userMessage,
                    model: 'gemini-1.5-flash',
                    used_context: Boolean(context),
                    context_preview: context ? context.slice(0, 1000) : null,
                    response_preview: (text || '').slice(0, 2000),
                    metadata: null,
                });
            },
        });

        console.log('Gemini response received, returning stream');

        // Return the streaming response in the format expected by useChat v5
        return result.toTextStreamResponse();
    } catch (err) {
        // Narrow error typing safely
        const message = err instanceof Error ? err.message : 'unknown error';
        console.error('API Error:', err);
        return new Response(`Error: ${message}`, { status: 500 });
    }
}


