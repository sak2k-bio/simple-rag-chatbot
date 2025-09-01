#!/usr/bin/env node

/**
 * Test Similarity Scores Script
 * 
 * This script tests what similarity scores we actually get from your Qdrant collection
 * to help determine the right threshold values.
 */

require('dotenv').config({ path: '.env.local' });

const { QdrantClient } = require('@qdrant/js-client-rest');
const { google } = require('@ai-sdk/google');
const { embed } = require('ai');

async function testSimilarityScores() {
    console.log('🧪 Testing Similarity Scores from Qdrant Collection\n');

    const client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
    });

    const collectionName = process.env.QDRANT_COLLECTION || 'pulmo_fishman';

    try {
        // Test with a medical query
        const testQuery = "What is pneumothorax?";
        console.log(`🔍 Testing query: "${testQuery}"`);
        
        // Create embedding
        const embeddingModel = google.embedding('text-embedding-004');
        const embeddingRes = await embed({
            model: embeddingModel,
            value: testQuery,
        });
        const vector = embeddingRes.embedding;

        console.log(`✅ Created embedding with ${vector.length} dimensions\n`);

        // Test different thresholds
        const thresholds = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
        
        for (const threshold of thresholds) {
            try {
                const results = await client.search(collectionName, {
                    vector: vector,
                    limit: 5,
                    with_payload: false,
                    with_vectors: false,
                    score_threshold: threshold
                });

                console.log(`📊 Threshold ${threshold.toFixed(1)}: ${results.length} results`);
                
                if (results.length > 0) {
                    console.log(`   Top scores: ${results.slice(0, 3).map(r => r.score.toFixed(3)).join(', ')}`);
                }
            } catch (error) {
                console.log(`❌ Threshold ${threshold.toFixed(1)}: Error - ${error.message}`);
            }
        }

        // Test without threshold to see all scores
        console.log('\n🔍 Testing without threshold (all results):');
        const allResults = await client.search(collectionName, {
            vector: vector,
            limit: 10,
            with_payload: false,
            with_vectors: false
        });

        console.log(`📊 Total results: ${allResults.length}`);
        if (allResults.length > 0) {
            console.log('📈 Score distribution:');
            allResults.forEach((result, index) => {
                console.log(`   ${index + 1}. Score: ${result.score.toFixed(4)}`);
            });
        }

        // Get collection info
        const collectionInfo = await client.getCollection(collectionName);
        console.log(`\n📊 Collection Info:`);
        console.log(`   - Name: ${collectionName}`);
        console.log(`   - Vectors: ${collectionInfo.points_count || 0}`);
        console.log(`   - Vector Size: ${collectionInfo.config?.params?.vectors?.size || 'Unknown'}`);
        console.log(`   - Distance: ${collectionInfo.config?.params?.vectors?.distance || 'Unknown'}`);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testSimilarityScores().catch(console.error);
