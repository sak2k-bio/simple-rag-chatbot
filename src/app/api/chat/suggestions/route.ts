import { NextRequest } from 'next/server';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { samplePayloadSnippets } from '@/lib/qdrant';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const count = Math.min(10, Math.max(1, Number(url.searchParams.get('count') || '5')));

        // Default seed questions in case we cannot generate dynamically
        const seedFallback: string[] = [
            'What can you help me with?',
            'Give me a brief overview of the key topics in this knowledge base.',
            'Summarize the most important points from the docs.',
            'Where should I start if I am new?',
            'List common issues and their quick fixes.'
        ];

        try {
            const snippets = await samplePayloadSnippets(30, 300);
            if (!snippets || snippets.length === 0) {
                console.warn('Suggestions: No Qdrant snippets available, returning fallback questions.');
                return new Response(
                    JSON.stringify({ success: true, questions: seedFallback.slice(0, count) }),
                    { headers: { 'Content-Type': 'application/json' } }
                );
            }

            const context = snippets
                .slice(0, 15)
                .map((s, i) => `[#${i + 1}] ${s.text}`)
                .join('\n');
            const prompt = `You are to generate ${count} user-friendly sample questions that a user might ask based on the following knowledge snippets. Questions should be concise (max 18 words), helpful, and varied. Output as a JSON array of strings only, with no extra commentary or code fences.

Snippets:\n${context}`;

            const res = await generateText({ model: google('gemini-1.5-flash'), prompt });

            // Robust parsing: handle code fences and extra text
            const raw = (res.text || '').trim();
            let parsed: string[] = [];
            const sanitize = (s: string) => {
                return s
                    .replace(/^```json\s*/i, '')
                    .replace(/^```\s*/i, '')
                    .replace(/```\s*$/i, '')
                    .replace(/[“”]/g, '"')
                    .replace(/[‘’]/g, "'")
                    // remove trailing commas before closing array bracket
                    .replace(/,(\s*\])/g, '$1')
                    .trim();
            };
            const tryParse = (s: string) => {
                try {
                    const obj = JSON.parse(s);
                    return Array.isArray(obj) ? obj : [];
                } catch {
                    return [];
                }
            };

            // 1) Direct parse
            parsed = tryParse(sanitize(raw));
            // 2) Extract first JSON array substring and sanitize
            if (parsed.length === 0) {
                const start = raw.indexOf('[');
                const end = raw.lastIndexOf(']');
                if (start !== -1 && end !== -1 && end > start) {
                    parsed = tryParse(sanitize(raw.slice(start, end + 1)));
                }
            }

            let questions = (parsed || [])
                .filter((q) => typeof q === 'string')
                .map((q) => q.trim())
                .filter((q) => q.length >= 6)
                .slice(0, count);

            // Fallback to seeds if model output was unusable
            if (questions.length === 0) {
                console.warn('Suggestions: Model returned unparsable or empty output. Using fallback. Raw:', raw);
                questions = seedFallback.slice(0, count);
            }

            return new Response(JSON.stringify({ success: true, questions }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (qdrantError) {
            console.warn('Suggestions: Qdrant not available or failed. Using fallback questions.', qdrantError);
            return new Response(
                JSON.stringify({ success: true, questions: seedFallback.slice(0, count) }),
                { headers: { 'Content-Type': 'application/json' } }
            );
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error('Suggestions API error:', err);
        return new Response(JSON.stringify({ success: false, error: msg }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}


