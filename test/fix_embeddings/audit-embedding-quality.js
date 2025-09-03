#!/usr/bin/env node

/**
 * Audit Embedding Quality Across All PDFs
 * 
 * This script checks for data quality issues in your entire collection
 */

require('dotenv').config({ path: '.env.local' });

const { QdrantClient } = require('@qdrant/js-client-rest');
const { google } = require('@ai-sdk/google');
const { embed } = require('ai');

async function auditEmbeddingQuality() {
    console.log('🔍 Auditing Embedding Quality Across All PDFs...\n');

    const client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
    });

    const collectionName = process.env.QDRANT_COLLECTION || 'pulmo_fishman';
    const embeddingModel = google.embedding('text-embedding-004');

    try {
        // Step 1: Get collection info
        console.log('📊 Step 1: Getting collection information...');
        const collectionInfo = await client.getCollection(collectionName);
        console.log(`📄 Total vectors: ${collectionInfo.points_count}`);
        console.log(`📐 Vector size: ${collectionInfo.config.params.vectors.size} dimensions`);

        // Step 2: Sample random chunks for testing
        console.log('\n🔍 Step 2: Sampling chunks for embedding quality testing...');
        
        const sampleSize = 50; // Test 50 random chunks
        const scrollResults = await client.scroll(collectionName, {
            limit: sampleSize,
            with_payload: true,
            with_vectors: false,
        });

        const chunks = scrollResults.points || [];
        console.log(`📄 Testing ${chunks.length} random chunks`);

        // Step 3: Test embedding consistency
        console.log('\n🧪 Step 3: Testing embedding consistency...');
        
        let embeddingMismatches = 0;
        let successfulMatches = 0;
        let errors = 0;
        const problemChunks = [];

        for (let i = 0; i < Math.min(chunks.length, 20); i++) { // Test first 20 for speed
            const chunk = chunks[i];
            const chunkId = chunk.id;
            const content = chunk.payload?.text || chunk.payload?.content || chunk.payload?.pageContent || '';
            const source = chunk.payload?.metadata?.source || chunk.payload?.source || '';
            
            if (!content || content.length < 50) {
                console.log(`⚠️  Chunk ${i + 1}: Skipping (content too short)`);
                continue;
            }

            try {
                // Generate new embedding for this content
                const embeddingRes = await embed({
                    model: embeddingModel,
                    value: content,
                });
                const newVector = embeddingRes.embedding;

                // Search for this exact content
                const searchResults = await client.search(collectionName, {
                    vector: newVector,
                    limit: 10,
                    with_payload: true,
                    with_vectors: false,
                });

                // Check if original chunk is found
                const originalChunkFound = searchResults.find(result => result.id === chunkId);
                
                if (originalChunkFound) {
                    const rank = searchResults.findIndex(r => r.id === chunkId) + 1;
                    const score = originalChunkFound.score;
                    
                    if (rank <= 3 && score > 0.8) {
                        successfulMatches++;
                        console.log(`✅ Chunk ${i + 1}: Found at rank ${rank}, score ${score.toFixed(4)}`);
                    } else {
                        embeddingMismatches++;
                        problemChunks.push({
                            id: chunkId,
                            source: source,
                            rank: rank,
                            score: score,
                            content: content.substring(0, 100) + '...'
                        });
                        console.log(`⚠️  Chunk ${i + 1}: Found at rank ${rank}, score ${score.toFixed(4)} (low quality)`);
                    }
                } else {
                    embeddingMismatches++;
                    problemChunks.push({
                        id: chunkId,
                        source: source,
                        rank: 'Not found',
                        score: 0,
                        content: content.substring(0, 100) + '...'
                    });
                    console.log(`❌ Chunk ${i + 1}: NOT FOUND in search results`);
                }

            } catch (error) {
                errors++;
                console.log(`❌ Chunk ${i + 1}: Error - ${error.message}`);
            }
        }

        // Step 4: Analyze results
        console.log('\n📊 Step 4: Analysis Results...');
        console.log(`✅ Successful matches: ${successfulMatches}`);
        console.log(`⚠️  Embedding mismatches: ${embeddingMismatches}`);
        console.log(`❌ Errors: ${errors}`);
        
        const qualityScore = (successfulMatches / (successfulMatches + embeddingMismatches + errors)) * 100;
        console.log(`📈 Overall quality score: ${qualityScore.toFixed(1)}%`);

        // Step 5: Report problem chunks
        if (problemChunks.length > 0) {
            console.log('\n🚨 Problem Chunks Found:');
            problemChunks.forEach((chunk, index) => {
                console.log(`\n${index + 1}. ID: ${chunk.id}`);
                console.log(`   Source: ${chunk.source}`);
                console.log(`   Rank: ${chunk.rank}, Score: ${chunk.score}`);
                console.log(`   Content: ${chunk.content}`);
            });
        }

        // Step 6: Check for common issues
        console.log('\n🔍 Step 6: Checking for common data quality issues...');
        
        // Check for empty or very short content
        const shortContentChunks = chunks.filter(chunk => {
            const content = chunk.payload?.text || chunk.payload?.content || chunk.payload?.pageContent || '';
            return content.length < 100;
        });
        
        console.log(`📄 Chunks with short content (<100 chars): ${shortContentChunks.length}`);

        // Check for missing metadata
        const missingMetadataChunks = chunks.filter(chunk => {
            const source = chunk.payload?.metadata?.source || chunk.payload?.source || '';
            return !source || source.trim() === '';
        });
        
        console.log(`📄 Chunks with missing source metadata: ${missingMetadataChunks.length}`);

        // Check for duplicate content
        const contentMap = new Map();
        let duplicates = 0;
        chunks.forEach(chunk => {
            const content = chunk.payload?.text || chunk.payload?.content || chunk.payload?.pageContent || '';
            if (content.length > 50) { // Only check substantial content
                if (contentMap.has(content)) {
                    duplicates++;
                } else {
                    contentMap.set(content, chunk.id);
                }
            }
        });
        
        console.log(`📄 Potential duplicate content chunks: ${duplicates}`);

        // Step 7: Recommendations
        console.log('\n💡 Recommendations:');
        
        if (qualityScore < 80) {
            console.log('🚨 CRITICAL: Your collection has significant embedding quality issues!');
            console.log('   - Consider re-embedding the entire collection');
            console.log('   - Check if you changed embedding models during indexing');
        } else if (qualityScore < 95) {
            console.log('⚠️  WARNING: Some embedding quality issues detected');
            console.log('   - Consider re-embedding problematic chunks');
            console.log('   - Monitor for more issues');
        } else {
            console.log('✅ GOOD: Your collection has high embedding quality');
        }

        if (problemChunks.length > 0) {
            console.log('\n🔧 To fix specific issues:');
            console.log('   1. Run the fix script for individual chunks');
            console.log('   2. Or re-embed the entire collection');
        }

        if (shortContentChunks.length > 0) {
            console.log('\n📝 Content quality issues:');
            console.log('   - Consider filtering out very short chunks');
            console.log('   - Check your chunking strategy');
        }

        if (duplicates > 0) {
            console.log('\n🔄 Duplicate content detected:');
            console.log('   - Consider deduplication');
            console.log('   - Check your indexing process');
        }

    } catch (error) {
        console.error('❌ Audit failed:', error.message);
    }
}

auditEmbeddingQuality().catch(console.error);
