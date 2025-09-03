import { NextRequest } from 'next/server';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { samplePayloadSnippets } from '@/lib/qdrant';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const count = Math.min(10, Math.max(1, Number(url.searchParams.get('count') || '5')));

        try {
            const snippets = await samplePayloadSnippets(30, 300);
            if (!snippets || snippets.length === 0) {
                // Return empty array if no snippets available
                return new Response(JSON.stringify({ success: true, questions: [] }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const context = snippets.slice(0, 15).map((s, i) => `[#${i + 1}] ${s.text}`).join('\n');
            const prompt = `You are to generate ${count} user-friendly sample questions that a user might ask based on the following knowledge snippets. Questions should be concise (max 18 words), helpful, and varied. Output as a JSON array of strings only.

Snippets:
${context}`;

            const res = await generateText({ model: google('gemini-1.5-flash'), prompt });
            let questions: string[] = [];
            try {
                questions = JSON.parse((res.text || '').trim());
                if (!Array.isArray(questions)) questions = [];
            } catch {
                questions = [];
            }
            questions = questions.filter(q => typeof q === 'string' && q.trim().length >= 6).slice(0, count);

            return new Response(JSON.stringify({ success: true, questions }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (qdrantError) {
            console.warn('Qdrant not available:', qdrantError);
            // Return empty array when Qdrant is not available
            return new Response(JSON.stringify({ success: true, questions: [] }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error('Suggestions API error:', err);
        return new Response(JSON.stringify({ success: false, error: msg }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

