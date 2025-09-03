#!/usr/bin/env node

/**
 * Test with Correct Query for Page 803 Content
 * 
 * This script tests with the actual content topic instead of asking about "page 803"
 */

require('dotenv').config({ path: '.env.local' });

const { QdrantClient } = require('@qdrant/js-client-rest');
const { google } = require('@ai-sdk/google');
const { embed } = require('ai');

async function testCorrectQuery() {
    console.log('🧪 Testing with Correct Query for Page 803 Content...\n');

    const client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
    });

    const collectionName = process.env.QDRANT_COLLECTION || 'pulmo_fishman';

    try {
        // Test with the actual content topic
        const correctQueries = [
            "What are the methods to differentiate asthma from other conditions causing wheeze?",
            "How do you distinguish asthma from other wheezing conditions?", 
            "What are the diagnostic criteria for asthma vs other obstructive lung diseases?",
            "How to differentiate asthma from COPD and other obstructive conditions?",
            "What causes wheezing besides asthma?"
        ];
        
        const embeddingModel = google.embedding('text-embedding-004');
        
        for (const query of correctQueries) {
            console.log(`🔍 Testing Query: "${query}"`);
            
            const embeddingRes = await embed({
                model: embeddingModel,
                value: query,
            });
            const vector = embeddingRes.embedding;

            // Test with different limits
            const limits = [10, 20, 50];
            
            for (const limit of limits) {
                const results = await client.search(collectionName, {
                    vector: vector,
                    limit: limit,
                    with_payload: true,
                    with_vectors: false,
                });

                // Check for page 803 content
                const page803Results = results.filter(result => {
                    const payload = result.payload;
                    const text = payload?.text || payload?.content || payload?.pageContent || '';
                    const source = payload?.metadata?.source || payload?.source || '';
                    
                    return text.includes('803') || 
                           source.includes('803') || 
                           source.includes('Page_0803') ||
                           text.includes('differentiate') && text.includes('asthma') && text.includes('wheeze');
                });

                if (page803Results.length > 0) {
                    console.log(`   ✅ Found ${page803Results.length} page 803 results in top ${limit}`);
                    page803Results.forEach((result, index) => {
                        console.log(`      ${index + 1}. Score: ${result.score.toFixed(4)}`);
                        console.log(`         Source: ${result.payload?.metadata?.source || result.payload?.source || 'Unknown'}`);
                        console.log(`         Content: ${(result.payload?.text || result.payload?.content || '').substring(0, 200)}...`);
                    });
                    break; // Found it, no need to test higher limits
                } else {
                    console.log(`   ❌ No page 803 results in top ${limit}`);
                }
            }
            console.log('');
        }

        // Test with improved settings
        console.log('🔧 Testing with Improved Settings:');
        console.log('   - Top-K: 25');
        console.log('   - Threshold: 0.01');
        
        const bestQuery = "What are the methods to differentiate asthma from other conditions causing wheeze?";
        const embeddingRes = await embed({
            model: embeddingModel,
            value: bestQuery,
        });
        const vector = embeddingRes.embedding;

        const results = await client.search(collectionName, {
            vector: vector,
            limit: 50, // Top-K * 2
            with_payload: true,
            with_vectors: false,
        });

        const filteredResults = results.filter(h => h.score >= 0.01);
        const page803Results = results.filter(result => {
            const payload = result.payload;
            const text = payload?.text || payload?.content || payload?.pageContent || '';
            const source = payload?.metadata?.source || payload?.source || '';
            
            return text.includes('803') || 
                   source.includes('803') || 
                   source.includes('Page_0803') ||
                   (text.includes('differentiate') && text.includes('asthma') && text.includes('wheeze'));
        });

        console.log(`   Retrieved: ${results.length} sources`);
        console.log(`   After threshold 0.01 filter: ${filteredResults.length} sources`);
        console.log(`   Page 803 content: ${page803Results.length} results`);

        if (page803Results.length > 0) {
            console.log(`\n📝 Page 803 Results Found:`);
            page803Results.forEach((result, index) => {
                const rank = results.findIndex(r => r === result) + 1;
                console.log(`   ${index + 1}. Rank: ${rank}, Score: ${result.score.toFixed(4)}`);
                console.log(`      Source: ${result.payload?.metadata?.source || result.payload?.source || 'Unknown'}`);
                console.log(`      Content: ${(result.payload?.text || result.payload?.content || '').substring(0, 300)}...`);
            });
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testCorrectQuery().catch(console.error);
