#!/usr/bin/env node

/**
 * Page 803 Search Diagnostic Tool
 * 
 * This script helps you find content from page 803 and understand why it might not be retrieved.
 */

require('dotenv').config({ path: '.env.local' });

const { QdrantClient } = require('@qdrant/js-client-rest');
const { google } = require('@ai-sdk/google');
const { embed } = require('ai');

async function findPage803() {
    console.log('🔍 Searching for Page 803 Content...\n');

    const client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
    });

    const collectionName = process.env.QDRANT_COLLECTION || 'pulmo_fishman';

    try {
        // Step 1: Search for any content containing "803"
        console.log('📄 Step 1: Searching for content containing "803"...');
        
        const results = await client.scroll(collectionName, {
            limit: 1000,
            with_payload: true,
            with_vectors: false,
        });

        const page803Content = results.points?.filter(point => {
            const payload = point.payload;
            const text = payload?.text || payload?.content || payload?.pageContent || '';
            const source = payload?.metadata?.source || payload?.source || '';
            
            // Look for page 803 references
            return text.includes('803') || 
                   source.includes('803') || 
                   text.includes('Page_803') ||
                   source.includes('Page_803') ||
                   text.includes('page 803') ||
                   source.includes('page 803');
        });

        console.log(`📊 Found ${page803Content?.length || 0} chunks containing "803"`);

        if (page803Content && page803Content.length > 0) {
            console.log('\n📝 Page 803 Content Found:');
            page803Content.forEach((point, index) => {
                const payload = point.payload;
                const text = payload?.text || payload?.content || payload?.pageContent || '';
                const source = payload?.metadata?.source || payload?.source || '';
                
                console.log(`\n${index + 1}. Source: ${source}`);
                console.log(`   Content preview: ${text.substring(0, 300)}...`);
            });
        } else {
            console.log('❌ No content containing "803" found in your collection');
            console.log('💡 This might mean:');
            console.log('   - The content is not indexed in Qdrant');
            console.log('   - The page number is stored differently');
            console.log('   - The content is in a different format');
        }

        // Step 2: Test semantic search for a sample query
        console.log('\n🔍 Step 2: Testing semantic search...');
        
        // Replace this with your actual query that should find page 803 content
        const testQuery = "What is the treatment for the condition mentioned on page 803?";
        console.log(`📝 Testing query: "${testQuery}"`);
        
        const embeddingModel = google.embedding('text-embedding-004');
        const embeddingRes = await embed({
            model: embeddingModel,
            value: testQuery,
        });
        const vector = embeddingRes.embedding;

        // Test with different limits to see if page 803 content appears
        const limits = [10, 20, 50, 100];
        
        for (const limit of limits) {
            console.log(`\n📊 Testing with limit ${limit}:`);
            
            const results = await client.search(collectionName, {
                vector: vector,
                limit: limit,
                with_payload: true,
                with_vectors: false,
            });

            console.log(`   Found ${results.length} results`);
            
            // Check if any results contain page 803
            const page803Results = results.filter(result => {
                const payload = result.payload;
                const text = payload?.text || payload?.content || payload?.pageContent || '';
                const source = payload?.metadata?.source || payload?.source || '';
                
                return text.includes('803') || 
                       source.includes('803') || 
                       text.includes('Page_803') ||
                       source.includes('Page_803');
            });

            if (page803Results.length > 0) {
                console.log(`   ✅ Found ${page803Results.length} page 803 results in top ${limit}`);
                page803Results.forEach((result, index) => {
                    console.log(`      ${index + 1}. Score: ${result.score.toFixed(4)}`);
                    console.log(`         Source: ${result.payload?.metadata?.source || result.payload?.source || 'Unknown'}`);
                });
            } else {
                console.log(`   ❌ No page 803 results in top ${limit}`);
            }
        }

        // Step 3: Test with different thresholds
        console.log('\n📈 Step 3: Testing different thresholds...');
        
        const thresholds = [0.01, 0.05, 0.1, 0.2];
        
        for (const threshold of thresholds) {
            const results = await client.search(collectionName, {
                vector: vector,
                limit: 50,
                with_payload: true,
                with_vectors: false,
                score_threshold: threshold
            });

            const page803Results = results.filter(result => {
                const payload = result.payload;
                const text = payload?.text || payload?.content || payload?.pageContent || '';
                const source = payload?.metadata?.source || payload?.source || '';
                
                return text.includes('803') || 
                       source.includes('803') || 
                       text.includes('Page_803') ||
                       source.includes('Page_803');
            });

            console.log(`   Threshold ${threshold}: ${results.length} total results, ${page803Results.length} page 803 results`);
        }

        // Step 4: Get collection statistics
        console.log('\n📊 Step 4: Collection Statistics...');
        
        const collectionInfo = await client.getCollection(collectionName);
        console.log(`   - Collection: ${collectionName}`);
        console.log(`   - Total vectors: ${collectionInfo.points_count || 0}`);
        console.log(`   - Vector size: ${collectionInfo.config?.params?.vectors?.size || 'Unknown'}`);
        console.log(`   - Distance metric: ${collectionInfo.config?.params?.vectors?.distance || 'Unknown'}`);

        // Step 5: Recommendations
        console.log('\n💡 Recommendations:');
        console.log('   1. If page 803 content is ranked low (>20), try:');
        console.log('      - Increasing Top-K to 50-100');
        console.log('      - Lowering threshold to 0.01');
        console.log('      - Using HyDE (Hypothetical Document Embeddings)');
        console.log('   2. If page 803 content is not semantically similar:');
        console.log('      - Try different query phrasings');
        console.log('      - Use more specific medical terminology');
        console.log('      - Consider query expansion');
        console.log('   3. If the content is split across chunks:');
        console.log('      - Check if you need to re-chunk your documents');
        console.log('      - Consider overlapping chunks');

    } catch (error) {
        console.error('❌ Search failed:', error.message);
        console.log('\n💡 Make sure your .env.local file has the correct Qdrant credentials:');
        console.log('   - QDRANT_URL');
        console.log('   - QDRANT_API_KEY');
        console.log('   - QDRANT_COLLECTION');
    }
}

// Run the search
findPage803().catch(console.error);
