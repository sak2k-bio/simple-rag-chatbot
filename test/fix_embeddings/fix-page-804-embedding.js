#!/usr/bin/env node

/**
 * Fix Page 804 Embedding Issue
 * 
 * This script re-embeds page 804 content to fix the mismatch
 */

require('dotenv').config({ path: '.env.local' });

const { QdrantClient } = require('@qdrant/js-client-rest');
const { google } = require('@ai-sdk/google');
const { embed } = require('ai');

async function fixPage804Embedding() {
    console.log('🔧 Fixing Page 804 Embedding Issue...\n');

    const client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
    });

    const collectionName = process.env.QDRANT_COLLECTION || 'pulmo_fishman';
    const embeddingModel = google.embedding('text-embedding-004');

    try {
        // Step 1: Find the problematic page 804 chunk
        console.log('📊 Step 1: Finding page 804 chunk...');
        
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

        if (page804Chunks.length === 0) {
            console.log('❌ Page 804 not found!');
            return;
        }

        const problemChunk = page804Chunks[0];
        const chunkId = problemChunk.id;
        const content = problemChunk.payload?.text || problemChunk.payload?.content || problemChunk.payload?.pageContent || '';
        
        console.log(`📄 Found page 804 chunk: ${chunkId}`);
        console.log(`📝 Content length: ${content.length} characters`);

        // Step 2: Generate new embedding with current model
        console.log('\n🔍 Step 2: Generating new embedding...');
        
        const embeddingRes = await embed({
            model: embeddingModel,
            value: content,
        });
        const newVector = embeddingRes.embedding;

        console.log(`✅ New embedding generated: ${newVector.length} dimensions`);

        // Step 3: Update the chunk with new embedding
        console.log('\n🔧 Step 3: Updating chunk with new embedding...');
        
        await client.upsert(collectionName, {
            points: [{
                id: chunkId,
                vector: newVector,
                payload: problemChunk.payload
            }]
        });

        console.log(`✅ Chunk ${chunkId} updated with new embedding`);

        // Step 4: Test the fix
        console.log('\n🧪 Step 4: Testing the fix...');
        
        const testQueries = [
            "spacers should be primed with the pMDI",
            "asthma medication administration",
            "inhalation devices"
        ];

        for (const query of testQueries) {
            console.log(`\n📝 Testing: "${query}"`);
            
            const queryEmbedding = await embed({
                model: embeddingModel,
                value: query,
            });

            const searchResults = await client.search(collectionName, {
                vector: queryEmbedding.embedding,
                limit: 10,
                with_payload: true,
                with_vectors: false,
            });

            const page804Results = searchResults.filter(result => result.id === chunkId);
            
            if (page804Results.length > 0) {
                const rank = searchResults.findIndex(r => r.id === chunkId) + 1;
                console.log(`   ✅ Page 804 found at rank ${rank} with score ${page804Results[0].score.toFixed(4)}`);
            } else {
                console.log(`   ❌ Page 804 still not found`);
            }
        }

        console.log('\n🎉 Page 804 embedding fix completed!');
        console.log('💡 Try your asthma queries again - they should now work!');

    } catch (error) {
        console.error('❌ Fix failed:', error.message);
    }
}

fixPage804Embedding().catch(console.error);
