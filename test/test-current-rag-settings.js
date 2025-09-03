#!/usr/bin/env node

/**
 * Test Current RAG Settings
 * 
 * This script tests your current RAG configuration to see what's happening with retrieval.
 */

require('dotenv').config({ path: '.env.local' });

const { QdrantClient } = require('@qdrant/js-client-rest');
const { google } = require('@ai-sdk/google');
const { embed } = require('ai');

async function testCurrentRAGSettings() {
    console.log('🧪 Testing Current RAG Settings...\n');

    const client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
    });

    const collectionName = process.env.QDRANT_COLLECTION || 'pulmo_fishman';

    try {
        // Test with your current settings
        const currentTopK = 12; // Your current setting
        const currentThreshold = 0.1; // Your current fallback threshold
        
        console.log(`📊 Current Settings:`);
        console.log(`   - Top-K: ${currentTopK}`);
        console.log(`   - Threshold: ${currentThreshold}`);
        console.log(`   - Search Limit: ${currentTopK * 2} (Top-K * 2)`);
        
        // Test query - replace with your actual query
        const testQuery = "What is the condition mentioned on page 803?";
        console.log(`\n🔍 Test Query: "${testQuery}"`);
        
        const embeddingModel = google.embedding('text-embedding-004');
        const embeddingRes = await embed({
            model: embeddingModel,
            value: testQuery,
        });
        const vector = embeddingRes.embedding;

        // Test with current search limit (Top-K * 2)
        console.log(`\n📈 Testing with current search limit (${currentTopK * 2}):`);
        
        const allResults = await client.search(collectionName, {
            vector: vector,
            limit: currentTopK * 2, // This is what your system does
            with_payload: true,
            with_vectors: false,
        });

        console.log(`   Retrieved ${allResults.length} total sources`);
        console.log(`   Score range: ${allResults[allResults.length - 1]?.score.toFixed(4)} to ${allResults[0]?.score.toFixed(4)}`);
        
        // Filter by current threshold
        const filteredResults = allResults.filter(h => h.score >= currentThreshold);
        console.log(`   After threshold ${currentThreshold} filter: ${filteredResults.length} sources`);
        
        // Check for page 803 content
        const page803Results = allResults.filter(result => {
            const payload = result.payload;
            const text = payload?.text || payload?.content || payload?.pageContent || '';
            const source = payload?.metadata?.source || payload?.source || '';
            
            return text.includes('803') || 
                   source.includes('803') || 
                   text.includes('Page_803') ||
                   source.includes('Page_803');
        });

        console.log(`   Page 803 content found: ${page803Results.length} results`);
        
        if (page803Results.length > 0) {
            console.log(`\n📝 Page 803 Results:`);
            page803Results.forEach((result, index) => {
                const rank = allResults.findIndex(r => r === result) + 1;
                const passedThreshold = result.score >= currentThreshold;
                console.log(`   ${index + 1}. Rank: ${rank}, Score: ${result.score.toFixed(4)}, Passed threshold: ${passedThreshold ? '✅' : '❌'}`);
                console.log(`      Source: ${result.payload?.metadata?.source || result.payload?.source || 'Unknown'}`);
            });
        }

        // Test with different settings
        console.log(`\n🔧 Testing with improved settings:`);
        
        const improvedTopK = 25;
        const improvedThreshold = 0.01;
        
        console.log(`   - Top-K: ${improvedTopK}`);
        console.log(`   - Threshold: ${improvedThreshold}`);
        console.log(`   - Search Limit: ${improvedTopK * 2}`);
        
        const improvedResults = await client.search(collectionName, {
            vector: vector,
            limit: improvedTopK * 2,
            with_payload: true,
            with_vectors: false,
        });

        const improvedFiltered = improvedResults.filter(h => h.score >= improvedThreshold);
        const improvedPage803 = improvedResults.filter(result => {
            const payload = result.payload;
            const text = payload?.text || payload?.content || payload?.pageContent || '';
            const source = payload?.metadata?.source || payload?.source || '';
            
            return text.includes('803') || 
                   source.includes('803') || 
                   text.includes('Page_803') ||
                   source.includes('Page_803');
        });

        console.log(`   Retrieved: ${improvedResults.length} sources`);
        console.log(`   After threshold filter: ${improvedFiltered.length} sources`);
        console.log(`   Page 803 content: ${improvedPage803.length} results`);

        // Summary
        console.log(`\n📊 Summary:`);
        console.log(`   Current settings: ${filteredResults.length} sources, ${page803Results.length} page 803 results`);
        console.log(`   Improved settings: ${improvedFiltered.length} sources, ${improvedPage803.length} page 803 results`);
        
        if (improvedPage803.length > page803Results.length) {
            console.log(`   ✅ Improved settings would find ${improvedPage803.length - page803Results.length} more page 803 results`);
        } else if (improvedPage803.length === page803Results.length && page803Results.length > 0) {
            console.log(`   ✅ Both settings find the same page 803 results`);
        } else {
            console.log(`   ❌ Page 803 content might not be in your collection or needs different approach`);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('\n💡 Make sure your .env.local file has the correct Qdrant credentials');
    }
}

// Run the test
testCurrentRAGSettings().catch(console.error);
