import { QdrantClient } from '@qdrant/js-client-rest';

export function getQdrantClient() {
    const url = process.env.QDRANT_URL;
    const apiKey = process.env.QDRANT_API_KEY;
    if (!url) throw new Error('QDRANT_URL is not set');
    if (!apiKey) throw new Error('QDRANT_API_KEY is not set');
    return new QdrantClient({ url, apiKey });
}

export interface QdrantPointPayload {
    [key: string]: unknown;
    text?: string;
    content?: string;
}

export interface QdrantSearchHit {
    score: number;
    payload: QdrantPointPayload;
}

export async function searchQdrant(
    vector: number[],
    opts?: { collection?: string; limit?: number; scoreThreshold?: number }
): Promise<QdrantSearchHit[]> {
    const client = getQdrantClient();
    const collection = opts?.collection || process.env.QDRANT_COLLECTION;
    if (!collection) throw new Error('QDRANT_COLLECTION is not set');

    const res = await client.search(collection, {
        vector,
        limit: opts?.limit ?? 5,
        with_payload: true,
        score_threshold: opts?.scoreThreshold,
    }) as unknown;

    // Normalize different client response shapes (Edge fetch vs Node runtime)
    type SearchPoint = { score: number; payload: QdrantPointPayload };
    type SearchEnvelope = { result?: SearchPoint[] };
    const points: SearchPoint[] = Array.isArray(res)
        ? (res as SearchPoint[])
        : (((res as SearchEnvelope)?.result as SearchPoint[] | undefined) ?? []);

    return (points || []).map((p) => ({
        score: p.score,
        payload: p.payload,
    }));
}


