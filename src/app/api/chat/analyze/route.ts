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

        // Derive practical recommendations
        const wordCount = (query.trim().match(/\S+/g) || []).length;
        let recommendedTopK = wordCount <= 5 ? 6 : wordCount <= 12 ? 8 : 12;
        recommendedTopK = Math.max(3, Math.min(20, recommendedTopK));

        // Clamp threshold to cosine-friendly range
        const rawThreshold = analysis.statistics.recommendedThreshold;
        const recommendedThreshold = Math.max(0.60, Math.min(0.95, rawThreshold));

        return new Response(JSON.stringify({
            success: true,
            query,
            analysis,
            recommendedTopK,
            recommendedThreshold
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
