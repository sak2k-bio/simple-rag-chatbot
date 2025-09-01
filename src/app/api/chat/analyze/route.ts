import { NextRequest } from 'next/server';
import { analyzeSimilarityScores } from '@/lib/qdrant';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
    try {
        const { query, limit = 20 } = await req.json();
        
        if (!query) {
            return new Response('Query is required', { status: 400 });
        }

        console.log(`Analyzing similarity scores for query: "${query}"`);

        const analysis = await analyzeSimilarityScores(query, { limit });

        return new Response(JSON.stringify({
            success: true,
            query,
            analysis
        }), {
            headers: {
                'Content-Type': 'application/json',
            },
        });

    } catch (error) {
        console.error('Analysis error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new Response(JSON.stringify({ 
            success: false, 
            error: message 
        }), { 
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}
