import { NextRequest } from 'next/server';
import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { buildQueryAnalysisPrompt } from '@/lib/prompt';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
    try {
        const { question } = await req.json();
        
        if (!question || typeof question !== 'string') {
            return new Response('Question is required and must be a string', { status: 400 });
        }

        const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!googleApiKey) {
            return new Response('Missing Google API key', { status: 500 });
        }

        // Ensure the AI SDK picks up the key via the expected env var
        if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.GOOGLE_API_KEY) {
            process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_API_KEY;
        }

        // Build the analysis prompt
        const analysisPrompt = buildQueryAnalysisPrompt(question);

        console.log('Analyzing query:', question);

        // Use Gemini to analyze the query
        const result = await streamText({
            model: google('gemini-1.5-flash'),
            system: 'You are an expert at analyzing query complexity and recommending search parameters. Always respond with valid JSON.',
            messages: [
                { role: 'user', content: analysisPrompt }
            ],
        });

        // Return the streaming response
        return result.toTextStreamResponse();
    } catch (error) {
        console.error('Query analysis error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new Response(`Error: ${message}`, { status: 500 });
    }
}
