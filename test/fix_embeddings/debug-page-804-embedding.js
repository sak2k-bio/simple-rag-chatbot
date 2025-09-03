#!/usr/bin/env node

/**
 * Debug Page 804 Embedding Issue
 * 
 * This script investigates why page 804 content is not being retrieved
 */

require('dotenv').config({ path: '.env.local' });

const { QdrantClient } = require('@qdrant/js-client-rest');
const { google } = require('@ai-sdk/google');
const { embed } = require('ai');

async function debugPage804() {
    console.log('🔍 Debugging Page 804 Embedding Issue...\n');

    const client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
    });

    const collectionName = process.env.QDRANT_COLLECTION || 'pulmo_fishman';
    const embeddingModel = google.embedding('text-embedding-004');

    try {
        // Step 1: Check if page 804 exists in the collection
        console.log('📊 Step 1: Checking if page 804 exists in collection...');
        
        const scrollResults = await client.scroll(collectionName, {
            limit: 1000,
            with_payload: true,
            with_vectors: false,
        });

        const page804Chunks = scrollResults.points?.filter(point => {
            const payload = point.payload;
            const source = payload?.metadata?.source || payload?.source || '';
            return source.includes('Page_0804') || source.includes('804');
        }) || [];

        console.log(`📄 Found ${page804Chunks.length} chunks from page 804`);
        
        if (page804Chunks.length === 0) {
            console.log('❌ Page 804 does not exist in the collection!');
            return;
        }

        // Step 2: Examine the actual content and metadata
        console.log('\n📝 Step 2: Examining page 804 content...');
        page804Chunks.forEach((chunk, index) => {
            const payload = chunk.payload;
            const source = payload?.metadata?.source || payload?.source || '';
            const content = payload?.text || payload?.content || payload?.pageContent || '';
            
            console.log(`\nChunk ${index + 1}:`);
            console.log(`   Source: ${source}`);
            console.log(`   Content length: ${content.length} characters`);
            console.log(`   Content preview: ${content.substring(0, 200)}...`);
            console.log(`   Vector ID: ${chunk.id}`);
        });

        // Step 3: Test embedding the actual content
        console.log('\n🔍 Step 3: Testing embedding of actual page 804 content...');
        
        const firstChunk = page804Chunks[0];
        const actualContent = firstChunk.payload?.text || firstChunk.payload?.content || firstChunk.payload?.pageContent || '';
        
        if (actualContent) {
            console.log(`📝 Embedding content: "${actualContent.substring(0, 100)}..."`);
            
            try {
                const embeddingRes = await embed({
                    model: embeddingModel,
                    value: actualContent,
                });
                const vector = embeddingRes.embedding;

                // Search for this exact content
                const searchResults = await client.search(collectionName, {
                    vector: vector,
                    limit: 10,
                    with_payload: true,
                    with_vectors: false,
                });

                // Check if the original chunk is found
                const originalChunkFound = searchResults.find(result => result.id === firstChunk.id);
                
                if (originalChunkFound) {
                    const rank = searchResults.findIndex(r => r.id === firstChunk.id) + 1;
                    console.log(`✅ Original chunk found at rank ${rank} with score ${originalChunkFound.score.toFixed(4)}`);
                } else {
                    console.log(`❌ Original chunk NOT found in search results!`);
                    console.log(`   This suggests an embedding mismatch issue`);
                }

                // Show top results
                console.log(`\n📊 Top 5 search results:`);
                searchResults.slice(0, 5).forEach((result, index) => {
                    const payload = result.payload;
                    const source = payload?.metadata?.source || payload?.source || '';
                    console.log(`   ${index + 1}. Score: ${result.score.toFixed(4)} - ${source}`);
                });

            } catch (error) {
                console.log(`❌ Error embedding content: ${error.message}`);
            }
        }

        // Step 4: Test with different query variations
        console.log('\n🔍 Step 4: Testing with different query variations...');
        
        const testQueries = [
            "spacers should be primed with the pMDI",
            "pressurized metered-dose inhaler",
            "inhalation devices advantages disadvantages",
            "asthma medication administration",
            "pMDI spacer device"
        ];

        for (const query of testQueries) {
            console.log(`\n📝 Testing: "${query}"`);
            
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

                const page804Results = searchResults.filter(result => {
                    const payload = result.payload;
                    const source = payload?.metadata?.source || payload?.source || '';
                    return source.includes('Page_0804') || source.includes('804');
                });

                if (page804Results.length > 0) {
                    console.log(`   ✅ Found ${page804Results.length} page 804 results!`);
                    page804Results.forEach((result, index) => {
                        const rank = searchResults.findIndex(r => r === result) + 1;
                        console.log(`      Rank: ${rank}, Score: ${result.score.toFixed(4)}`);
                    });
                } else {
                    console.log(`   ❌ No page 804 results found`);
                }
                
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
            }
        }

        // Step 5: Check if there are any other asthma-related pages
        console.log('\n🔍 Step 5: Looking for other asthma-related pages...');
        
        const asthmaPages = scrollResults.points?.filter(point => {
            const payload = point.payload;
            const source = payload?.metadata?.source || payload?.source || '';
            const content = payload?.text || payload?.content || payload?.pageContent || '';
            
            return source.toLowerCase().includes('asthma') || 
                   content.toLowerCase().includes('asthma');
        }) || [];

        console.log(`📄 Found ${asthmaPages.length} chunks containing "asthma"`);
        
        if (asthmaPages.length > 0) {
            console.log(`\n📊 Sample asthma pages:`);
            asthmaPages.slice(0, 5).forEach((page, index) => {
                const payload = page.payload;
                const source = payload?.metadata?.source || payload?.source || '';
                console.log(`   ${index + 1}. ${source}`);
            });
        }

    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    }
}

debugPage804().catch(console.error);
