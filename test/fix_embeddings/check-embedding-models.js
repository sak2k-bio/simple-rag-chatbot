#!/usr/bin/env node

/**
 * Check for Embedding Model Mismatches
 * 
 * This script identifies chunks that were embedded with different models
 */

require('dotenv').config({ path: '.env.local' });

const { QdrantClient } = require('@qdrant/js-client-rest');
const { google } = require('@ai-sdk/google');
const { embed } = require('ai');

async function checkEmbeddingModels() {
    console.log('🔍 Checking for Embedding Model Mismatches...\n');

    const client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
    });

    const collectionName = process.env.QDRANT_COLLECTION || 'pulmo_fishman';
    const embeddingModel = google.embedding('text-embedding-004');

    try {
        // Step 1: Get a sample of chunks
        console.log('📊 Step 1: Sampling chunks for model consistency check...');
        
        const scrollResults = await client.scroll(collectionName, {
            limit: 100,
            with_payload: true,
            with_vectors: false,
        });

        const chunks = scrollResults.points || [];
        console.log(`📄 Testing ${chunks.length} chunks`);

        // Step 2: Test each chunk for embedding consistency
        console.log('\n🧪 Step 2: Testing embedding consistency...');
        
        const mismatchedChunks = [];
        const consistentChunks = [];
        let processed = 0;

        for (const chunk of chunks) {
            const chunkId = chunk.id;
            const content = chunk.payload?.text || chunk.payload?.content || chunk.payload?.pageContent || '';
            const source = chunk.payload?.metadata?.source || chunk.payload?.source || '';
            
            if (!content || content.length < 50) {
                continue;
            }

            try {
                // Generate new embedding
                const embeddingRes = await embed({
                    model: embeddingModel,
                    value: content,
                });
                const newVector = embeddingRes.embedding;

                // Search for this content
                const searchResults = await client.search(collectionName, {
                    vector: newVector,
                    limit: 5,
                    with_payload: true,
                    with_vectors: false,
                });

                // Check if original chunk is found in top 3 results
                const originalChunkFound = searchResults.find(result => result.id === chunkId);
                
                if (originalChunkFound) {
                    const rank = searchResults.findIndex(r => r.id === chunkId) + 1;
                    const score = originalChunkFound.score;
                    
                    if (rank <= 3 && score > 0.7) {
                        consistentChunks.push({
                            id: chunkId,
                            source: source,
                            rank: rank,
                            score: score
                        });
                    } else {
                        mismatchedChunks.push({
                            id: chunkId,
                            source: source,
                            rank: rank,
                            score: score,
                            content: content.substring(0, 100) + '...'
                        });
                    }
                } else {
                    mismatchedChunks.push({
                        id: chunkId,
                        source: source,
                        rank: 'Not found',
                        score: 0,
                        content: content.substring(0, 100) + '...'
                    });
                }

                processed++;
                if (processed % 10 === 0) {
                    console.log(`   Processed ${processed}/${chunks.length} chunks...`);
                }

            } catch (error) {
                console.log(`❌ Error processing chunk ${chunkId}: ${error.message}`);
            }
        }

        // Step 3: Analyze results
        console.log('\n📊 Step 3: Analysis Results...');
        console.log(`✅ Consistent chunks: ${consistentChunks.length}`);
        console.log(`❌ Mismatched chunks: ${mismatchedChunks.length}`);
        
        const consistencyRate = (consistentChunks.length / (consistentChunks.length + mismatchedChunks.length)) * 100;
        console.log(`📈 Consistency rate: ${consistencyRate.toFixed(1)}%`);

        // Step 4: Group mismatched chunks by source
        console.log('\n🔍 Step 4: Grouping mismatched chunks by source...');
        
        const sourceGroups = {};
        mismatchedChunks.forEach(chunk => {
            const source = chunk.source;
            if (!sourceGroups[source]) {
                sourceGroups[source] = [];
            }
            sourceGroups[source].push(chunk);
        });

        console.log(`📄 Sources with embedding issues:`);
        Object.keys(sourceGroups).forEach(source => {
            const count = sourceGroups[source].length;
            console.log(`   ${source}: ${count} problematic chunks`);
        });

        // Step 5: Show sample problematic chunks
        if (mismatchedChunks.length > 0) {
            console.log('\n🚨 Sample Problematic Chunks:');
            mismatchedChunks.slice(0, 5).forEach((chunk, index) => {
                console.log(`\n${index + 1}. ID: ${chunk.id}`);
                console.log(`   Source: ${chunk.source}`);
                console.log(`   Rank: ${chunk.rank}, Score: ${chunk.score}`);
                console.log(`   Content: ${chunk.content}`);
            });
        }

        // Step 6: Recommendations
        console.log('\n💡 Recommendations:');
        
        if (consistencyRate < 70) {
            console.log('🚨 CRITICAL: Major embedding model mismatch detected!');
            console.log('   - Your collection was likely embedded with a different model');
            console.log('   - Consider re-embedding the entire collection');
            console.log('   - This explains why some content is not retrievable');
        } else if (consistencyRate < 90) {
            console.log('⚠️  WARNING: Some embedding inconsistencies detected');
            console.log('   - Some chunks may have been embedded with different models');
            console.log('   - Consider re-embedding problematic sources');
        } else {
            console.log('✅ GOOD: Your collection has consistent embeddings');
        }

        // Step 7: Create fix script for problematic chunks
        if (mismatchedChunks.length > 0) {
            console.log('\n🔧 Creating fix script for problematic chunks...');
            
            const fixScript = `#!/usr/bin/env node

/**
 * Fix Embedding Mismatches
 * 
 * This script fixes the ${mismatchedChunks.length} problematic chunks
 */

require('dotenv').config({ path: '.env.local' });

const { QdrantClient } = require('@qdrant/js-client-rest');
const { google } = require('@ai-sdk/google');
const { embed } = require('ai');

async function fixEmbeddingMismatches() {
    console.log('🔧 Fixing Embedding Mismatches...\\n');

    const client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
    });

    const collectionName = process.env.QDRANT_COLLECTION || 'pulmo_fishman';
    const embeddingModel = google.embedding('text-embedding-004');

    const problematicChunkIds = [
${mismatchedChunks.map(chunk => `        "${chunk.id}"`).join(',\n')}
    ];

    try {
        for (let i = 0; i < problematicChunkIds.length; i++) {
            const chunkId = problematicChunkIds[i];
            console.log(\`\\n🔧 Fixing chunk \${i + 1}/\${problematicChunkIds.length}: \${chunkId}\`);
            
            // Get the chunk
            const chunk = await client.retrieve(collectionName, {
                ids: [chunkId],
                with_payload: true,
                with_vectors: false,
            });

            if (chunk.length === 0) {
                console.log(\`   ❌ Chunk not found\`);
                continue;
            }

            const content = chunk[0].payload?.text || chunk[0].payload?.content || chunk[0].payload?.pageContent || '';
            
            if (!content) {
                console.log(\`   ❌ No content found\`);
                continue;
            }

            // Generate new embedding
            const embeddingRes = await embed({
                model: embeddingModel,
                value: content,
            });

            // Update the chunk
            await client.upsert(collectionName, {
                points: [{
                    id: chunkId,
                    vector: embeddingRes.embedding,
                    payload: chunk[0].payload
                }]
            });

            console.log(\`   ✅ Fixed\`);
        }

        console.log('\\n🎉 All problematic chunks fixed!');
        
    } catch (error) {
        console.error('❌ Fix failed:', error.message);
    }
}

fixEmbeddingMismatches().catch(console.error);`;

            require('fs').writeFileSync('test/fix-embedding-mismatches.js', fixScript);
            console.log('   📝 Created: test/fix-embedding-mismatches.js');
            console.log('   🚀 Run: node test/fix-embedding-mismatches.js');
        }

    } catch (error) {
        console.error('❌ Check failed:', error.message);
    }
}

checkEmbeddingModels().catch(console.error);
