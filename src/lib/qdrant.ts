import { QdrantClient } from '@qdrant/js-client-rest';

interface SearchParams {
    vector: number[];
    limit: number;
    score_threshold?: number;
    with_payload?: boolean;
    with_vectors?: boolean;
    filter?: {
        must: Array<{
            key: string;
            match: { value: unknown };
        }>;
    };
}

interface QdrantResponse {
    result?: Array<{
        id: string | number;
        score: number;
        payload?: Record<string, unknown>;
        vector?: number[];
    }>;
    points?: Array<{
        id: string | number;
        score: number;
        payload?: Record<string, unknown>;
        vector?: number[];
    }>;
}
import { embed } from 'ai';
import { google } from '@ai-sdk/google';

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
    metadata?: {
        source?: string;
        title?: string;
        [key: string]: unknown;
    };
}

export interface QdrantSearchHit {
    score: number;
    payload: QdrantPointPayload;
}

export async function searchQdrant(
    vector: number[],
    opts?: { 
        collection?: string; 
        limit?: number; 
        scoreThreshold?: number;
        withPayload?: boolean;
        withVectors?: boolean;
    }
): Promise<QdrantSearchHit[]> {
    const client = getQdrantClient();
    const collection = opts?.collection || process.env.QDRANT_COLLECTION;
    if (!collection) throw new Error('QDRANT_COLLECTION is not set');

    const searchParams = {
        vector,
        limit: opts?.limit ?? 5,
        with_payload: opts?.withPayload ?? true,
        with_vectors: opts?.withVectors ?? false,
        // Use cosine similarity for better semantic matching
        params: {
            hnsw_ef: 128, // Higher ef for better search quality
            exact: false
        }
    };

    // Add score threshold if specified
    if (opts?.scoreThreshold !== undefined) {
        (searchParams as SearchParams).score_threshold = opts.scoreThreshold;
    }

    console.log(`Searching Qdrant collection '${collection}' with params:`, searchParams);

    const res = await client.search(collection, searchParams) as QdrantResponse;

    // Normalize different client response shapes (Edge fetch vs Node runtime)
    type SearchPoint = { score: number; payload: QdrantPointPayload };
    type SearchEnvelope = { result?: SearchPoint[] };
    const points: SearchPoint[] = Array.isArray(res)
        ? (res as SearchPoint[])
        : (((res as SearchEnvelope)?.result as SearchPoint[] | undefined) ?? []);

    console.log(`Qdrant search returned ${points.length} results with scores:`, points.map(p => p.score));
    
    // Debug: If no results, try with no threshold to see what scores we get
    if (points.length === 0 && opts?.scoreThreshold !== undefined) {
        console.log(`No results with threshold ${opts.scoreThreshold}, trying without threshold...`);
        const noThresholdParams = { ...searchParams };
        delete (noThresholdParams as SearchParams).score_threshold;
        
        const noThresholdRes = await client.search(collection, noThresholdParams) as QdrantResponse;
        const noThresholdPoints: SearchPoint[] = Array.isArray(noThresholdRes)
            ? (noThresholdRes as SearchPoint[])
            : (((noThresholdRes as SearchEnvelope)?.result as SearchPoint[] | undefined) ?? []);
        
        if (noThresholdPoints.length > 0) {
            console.log(`Without threshold: ${noThresholdPoints.length} results with scores:`, noThresholdPoints.map(p => p.score));
            console.log(`Top 3 scores:`, noThresholdPoints.slice(0, 3).map(p => p.score));
        }
    }

    return (points || []).map((p) => ({
        score: p.score,
        payload: p.payload,
    }));
}

// Enhanced search with metadata filtering
export async function searchQdrantWithMetadata(
    vector: number[],
    metadataFilters?: Record<string, unknown>,
    opts?: { 
        collection?: string; 
        limit?: number; 
        scoreThreshold?: number;
    }
): Promise<QdrantSearchHit[]> {
    const client = getQdrantClient();
    const collection = opts?.collection || process.env.QDRANT_COLLECTION;
    if (!collection) throw new Error('QDRANT_COLLECTION is not set');

    const searchParams: SearchParams = {
        vector,
        limit: opts?.limit ?? 5,
        with_payload: true,
        with_vectors: false,
    };

    // Add score threshold if specified
    if (opts?.scoreThreshold !== undefined) {
        searchParams.score_threshold = opts.scoreThreshold;
    }

    // Add metadata filters if specified
    if (metadataFilters && Object.keys(metadataFilters).length > 0) {
        searchParams.filter = {
            must: Object.entries(metadataFilters).map(([key, value]) => ({
                key: `metadata.${key}`,
                match: { value }
            }))
        };
    }

    console.log(`Searching Qdrant with metadata filters:`, metadataFilters);

    const res = await client.search(collection, searchParams) as QdrantResponse;

    // Normalize response
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

// Get collection statistics
export async function getCollectionStats(collection?: string) {
    const client = getQdrantClient();
    const collectionName = collection || process.env.QDRANT_COLLECTION;
    if (!collectionName) throw new Error('QDRANT_COLLECTION is not set');

    try {
        const info = await client.getCollection(collectionName);
        return {
            success: true,
            collectionName,
            exists: true,
            stats: {
                totalVectors: info.points_count || 0,
                indexedVectors: info.indexed_vectors_count || 0,
                vectorSize: info.config?.params?.vectors?.size || 0
            },
            config: info.config
        };
    } catch (error) {
        console.error('Error getting collection stats:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

// Test Qdrant connection
export async function testQdrantConnection() {
    try {
        const client = getQdrantClient();
        await client.getCollections();
        return { success: true, message: 'Qdrant connection successful' };
    } catch (error) {
        console.error('Qdrant connection test failed:', error);
        return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
        };
    }
}

// Connect to Qdrant Cloud
export async function connectToQdrantCloud(url: string, apiKey: string, collectionName: string = 'documents') {
    try {
        console.log('Connecting to Qdrant Cloud...');
        
        // Test the connection by creating a new client
        const cloudClient = new QdrantClient({ url, apiKey });
        await cloudClient.getCollections();
        
        // Update environment variables (this would need to be handled differently in production)
        process.env.QDRANT_URL = url;
        process.env.QDRANT_API_KEY = apiKey;
        process.env.QDRANT_COLLECTION = collectionName;
        
        console.log(`Successfully connected to Qdrant Cloud at ${url}`);
        
        return {
            success: true,
            message: 'Successfully connected to Qdrant Cloud',
            url: url,
            collectionName: collectionName
        };
    } catch (error) {
        console.error(`Failed to connect to Qdrant Cloud: ${error}`);
        throw new Error(`Failed to connect to Qdrant Cloud: ${error}`);
    }
}

// Analyze similarity score distribution for threshold optimization
export async function analyzeSimilarityScores(
    query: string,
    opts?: { 
        collection?: string; 
        limit?: number;
    }
): Promise<{
    scores: number[];
    statistics: {
        min: number;
        max: number;
        mean: number;
        median: number;
        recommendedThreshold: number;
    };
    sampleResults: QdrantSearchHit[];
}> {
    const client = getQdrantClient();
    const collection = opts?.collection || process.env.QDRANT_COLLECTION;
    if (!collection) throw new Error('QDRANT_COLLECTION is not set');

    // Create embedding for the query
    const embeddingModel = google.embedding('text-embedding-004');
    const embeddingRes = await embed({
        model: embeddingModel,
        value: query,
    });
    const vector = embeddingRes.embedding;

    // Search without threshold to get all scores
    const searchParams = {
        vector,
        limit: opts?.limit ?? 20,
        with_payload: true,
        with_vectors: false,
        params: {
            hnsw_ef: 128,
            exact: false
        }
    };

    const res = await client.search(collection, searchParams) as QdrantResponse;
    
    // Normalize response
    type SearchPoint = { score: number; payload: QdrantPointPayload };
    type SearchEnvelope = { result?: SearchPoint[] };
    const points: SearchPoint[] = Array.isArray(res)
        ? (res as SearchPoint[])
        : (((res as SearchEnvelope)?.result as SearchPoint[] | undefined) ?? []);

    const scores = points.map(p => p.score).sort((a, b) => b - a);
    
    // Calculate statistics
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const median = scores[Math.floor(scores.length / 2)];
    
    // Recommend threshold based on score distribution
    // For cosine similarity, scores typically range from -1 to 1
    // For dot product, scores can vary widely
    let recommendedThreshold: number;
    if (max <= 1 && min >= -1) {
        // Likely cosine similarity
        recommendedThreshold = Math.max(0.1, mean * 0.8); // Conservative threshold
    } else {
        // Likely dot product or other metric
        recommendedThreshold = Math.max(0.1, mean * 0.6); // More conservative for dot product
    }

    return {
        scores,
        statistics: {
            min,
            max,
            mean,
            median,
            recommendedThreshold
        },
        sampleResults: points.map((p) => ({
            score: p.score,
            payload: p.payload,
        }))
    };
}


