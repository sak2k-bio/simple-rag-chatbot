import { NextRequest } from 'next/server';
import { google } from '@ai-sdk/google';
import { embed, streamText } from 'ai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { searchQdrant } from '@/lib/qdrant';
import { buildRagPrompt } from '@/lib/prompt';

export const runtime = 'edge';

export async function GET() {
    return new Response('Chat API endpoint - use POST to send messages', { status: 200 });
}

export async function POST(req: NextRequest) {
    try {
        console.log('API route called');
        console.log('Environment check:', {
            hasGoogleKey: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
            hasQdrantUrl: !!process.env.QDRANT_URL,
            hasQdrantKey: !!process.env.QDRANT_API_KEY,
            hasQdrantCollection: !!process.env.QDRANT_COLLECTION
        });

        const { messages } = await req.json();
        console.log('Messages received:', messages);

        if (!messages || messages.length === 0) {
            return new Response('No messages provided', { status: 400 });
        }

        const userMessage = messages[messages.length - 1]?.content || '';
        console.log('User message:', userMessage);

        if (!userMessage) {
            return new Response('No user message provided', { status: 400 });
        }

        if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
            return new Response('Missing GOOGLE_GENERATIVE_AI_API_KEY', { status: 500 });
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
        const aiMessages = messages.map((msg: any) => ({
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
            system: 'You are a helpful AI assistant. Answer questions based on the provided context when available. Be conversational and helpful.',
            messages: aiMessages,
        });

        console.log('Gemini response received, returning stream');

        // Return the streaming response in the format expected by useChat v5
        return result.toTextStreamResponse();
    } catch (err: any) {
        console.error('API Error:', err);
        return new Response(`Error: ${err?.message || 'unknown error'}`, { status: 500 });
    }
}


