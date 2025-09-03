#!/usr/bin/env node

/**
 * Test Different Asthma Queries
 * 
 * This script tests various asthma-related queries to find the best semantic matches
 */

require('dotenv').config({ path: '.env.local' });

const { QdrantClient } = require('@qdrant/js-client-rest');
const { google } = require('@ai-sdk/google');
const { embed } = require('ai');

async function testAsthmaQueries() {
    console.log('🔍 Testing Different Asthma Queries...\n');

    const client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
    });

    const collectionName = process.env.QDRANT_COLLECTION || 'pulmo_fishman';
    const embeddingModel = google.embedding('text-embedding-004');

    try {
        // Test different asthma-related queries
        const asthmaQueries = [
            "asthma clinical presentation and management",
            "asthma diagnosis and treatment",
            "asthma symptoms and signs",
            "asthma management guidelines",
            "asthma inhaler devices",
            "asthma medication administration",
            "asthma treatment options",
            "asthma patient care",
            "asthma clinical features",
            "asthma therapeutic approach"
        ];

        for (const query of asthmaQueries) {
            console.log(`🔍 Testing: "${query}"`);
            
            try {
                const embeddingRes = await embed({
                    model: embeddingModel,
                    value: query,
                });
                const vector = embeddingRes.embedding;

                const searchResults = await client.search(collectionName, {
                    vector: vector,
                    limit: 10,
                    with_payload: true,
                    with_vectors: false,
                });

                // Check if any results are from page 804 (asthma chapter)
                const page804Results = searchResults.filter(result => {
                    const payload = result.payload;
                    const source = payload?.metadata?.source || payload?.source || '';
                    return source.includes('Page_0804') || source.includes('804');
                });

                if (page804Results.length > 0) {
                    console.log(`   ✅ Found ${page804Results.length} page 804 results!`);
                    page804Results.forEach((result, index) => {
                        const rank = searchResults.findIndex(r => r === result) + 1;
                        console.log(`      ${index + 1}. Rank: ${rank}, Score: ${result.score.toFixed(4)}`);
                        console.log(`         Content: ${(result.payload?.text || result.payload?.content || '').substring(0, 150)}...`);
                    });
                } else {
                    console.log(`   ❌ No page 804 results found`);
                    
                    // Show top 3 results
                    console.log(`   Top 3 results:`);
                    searchResults.slice(0, 3).forEach((result, index) => {
                        const payload = result.payload;
                        const source = payload?.metadata?.source || payload?.source || '';
                        console.log(`      ${index + 1}. Score: ${result.score.toFixed(4)} - ${source}`);
                    });
                }
                console.log('');
                
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
            }
        }

        // Test with the exact content from page 804
        console.log('🔍 Testing with exact page 804 content...');
        
        const page804Content = "asthma clinical presentation management administration cost reimburse";
        console.log(`📝 Testing: "${page804Content}"`);
        
        try {
            const embeddingRes = await embed({
                model: embeddingModel,
                value: page804Content,
            });
            const vector = embeddingRes.embedding;

            const searchResults = await client.search(collectionName, {
                vector: vector,
                limit: 10,
                with_payload: true,
                with_vectors: false,
            });

            const page804Results = searchResults.filter(result => {
                const payload = result.payload;
                const source = payload?.metadata?.source || payload?.source || '';
                return source.includes('Page_0804') || source.includes('804');
            });

            if (page804Results.length > 0) {
                console.log(`✅ Found ${page804Results.length} page 804 results with exact content!`);
                page804Results.forEach((result, index) => {
                    const rank = searchResults.findIndex(r => r === result) + 1;
                    console.log(`   ${index + 1}. Rank: ${rank}, Score: ${result.score.toFixed(4)}`);
                });
            } else {
                console.log(`❌ Still no page 804 results with exact content`);
            }

        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }

        // Final analysis
        console.log('\n💡 Analysis:');
        console.log('   The issue might be:');
        console.log('   1. The page 804 content is not semantically similar to asthma queries');
        console.log('   2. The content might be about device administration rather than diagnosis');
        console.log('   3. The embedding model might not capture the connection well');
        console.log('   4. The chunking strategy might have split the content poorly');
        
        console.log('\n🔧 Recommendations:');
        console.log('   1. Try asking about "asthma inhaler devices" or "asthma medication administration"');
        console.log('   2. Use the improved RAG settings to get more context');
        console.log('   3. The system will still retrieve relevant asthma content from other pages');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testAsthmaQueries().catch(console.error);
