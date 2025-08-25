import { QdrantClient } from '@qdrant/js-client-rest';

export function getQdrantClient() {
    const url = process.env.QDRANT_URL;
    const apiKey = process.env.QDRANT_API_KEY;
    if (!url) throw new Error('QDRANT_URL is not set');
    if (!apiKey) throw new Error('QDRANT_API_KEY is not set');
    return new QdrantClient({ url, apiKey });
}

export async function searchQdrant(
    vector: number[],
    opts?: { collection?: string; limit?: number; scoreThreshold?: number }
) {
    const client = getQdrantClient();
    const collection = opts?.collection || process.env.QDRANT_COLLECTION;
    if (!collection) throw new Error('QDRANT_COLLECTION is not set');

    const res = await client.search(collection, {
        vector,
        limit: opts?.limit ?? 5,
        with_payload: true,
        score_threshold: opts?.scoreThreshold,
    });

    return (res || []).map((p: any) => ({
        score: p.score as number,
        payload: p.payload as Record<string, any>,
    }));
}


