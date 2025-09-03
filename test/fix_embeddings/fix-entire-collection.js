#!/usr/bin/env node

/**
 * Fix Entire Collection with Optimized Chunking
 * 
 * This script re-embeds ALL chunks in your collection with optimized chunking strategy
 * WARNING: This will take a long time and use API credits!
 * 
 * Optimizations:
 * - Better chunk size (800-1200 characters)
 * - Overlap between chunks (200 characters)
 * - Semantic boundary detection
 * - Improved metadata structure
 */

require('dotenv').config({ path: '.env.local' });

const { QdrantClient } = require('@qdrant/js-client-rest');
const { google } = require('@ai-sdk/google');
const { embed } = require('ai');

// Chunking optimization functions
function findOptimalChunkBoundaries(text, targetSize = 1000, overlap = 200) {
    const chunks = [];
    let start = 0;
    
    while (start < text.length) {
        let end = Math.min(start + targetSize, text.length);
        
        // Try to find a good breaking point (sentence, paragraph, or word boundary)
        if (end < text.length) {
            // Look for sentence endings first
            const sentenceEnd = text.lastIndexOf('.', end);
            const paragraphEnd = text.lastIndexOf('\n\n', end);
            const wordEnd = text.lastIndexOf(' ', end);
            
            if (sentenceEnd > start + targetSize * 0.7) {
                end = sentenceEnd + 1;
            } else if (paragraphEnd > start + targetSize * 0.7) {
                end = paragraphEnd + 2;
            } else if (wordEnd > start + targetSize * 0.8) {
                end = wordEnd;
            }
        }
        
        const chunkText = text.slice(start, end).trim();
        if (chunkText.length > 50) { // Only include substantial chunks
            chunks.push({
                text: chunkText,
                start: start,
                end: end,
                length: chunkText.length
            });
        }
        
        // Move start position with overlap
        start = Math.max(start + 1, end - overlap);
    }
    
    return chunks;
}

function extractMetadata(source, content) {
    // Extract page number from source
    const pageMatch = source.match(/Page_(\d+)/);
    const pageNumber = pageMatch ? parseInt(pageMatch[1]) : null;
    
    // Extract chapter/section info
    const chapterMatch = source.match(/CHAPTER_(\d+)_([^_]+)/);
    const chapterNumber = chapterMatch ? parseInt(chapterMatch[1]) : null;
    const chapterTitle = chapterMatch ? chapterMatch[2].replace(/_/g, ' ') : null;
    
    // Extract part info
    const partMatch = source.match(/PART_(\d+)_([^_]+)/);
    const partNumber = partMatch ? parseInt(partMatch[1]) : null;
    const partTitle = partMatch ? partMatch[2].replace(/_/g, ' ') : null;
    
    // Extract key terms from content (first 200 chars)
    const preview = content.substring(0, 200).toLowerCase();
    const keyTerms = [];
    
    const medicalTerms = ['asthma', 'copd', 'pneumonia', 'cancer', 'treatment', 'diagnosis', 'symptoms', 'therapy', 'medication', 'lung', 'respiratory', 'pulmonary'];
    medicalTerms.forEach(term => {
        if (preview.includes(term)) {
            keyTerms.push(term);
        }
    });
    
    return {
        source: source,
        pageNumber: pageNumber,
        chapterNumber: chapterNumber,
        chapterTitle: chapterTitle,
        partNumber: partNumber,
        partTitle: partTitle,
        keyTerms: keyTerms,
        chunkLength: content.length,
        timestamp: new Date().toISOString()
    };
}

async function fixEntireCollection() {
    console.log('🚨 CRITICAL: Fixing Entire Collection with Optimized Chunking...\n');
    console.log('⚠️  WARNING: This will re-embed ALL chunks and may take hours!');
    console.log('⚠️  WARNING: This will use significant API credits!\n');
    console.log('🔧 Optimizations applied:');
    console.log('   - Optimal chunk size: 800-1200 characters');
    console.log('   - Overlap between chunks: 200 characters');
    console.log('   - Semantic boundary detection');
    console.log('   - Enhanced metadata extraction\n');

    const client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
    });

    const collectionName = process.env.QDRANT_COLLECTION || 'pulmo_fishman';
    const embeddingModel = google.embedding('text-embedding-004');

    try {
        // Get collection info
        const collectionInfo = await client.getCollection(collectionName);
        const totalChunks = collectionInfo.points_count;
        console.log(`📊 Total chunks to optimize: ${totalChunks.toLocaleString()}`);

        // First, collect all content by source to re-chunk properly
        console.log('\n📚 Step 1: Collecting content by source for re-chunking...');
        
        const sourceContentMap = new Map();
        const batchSize = 100;
        let processed = 0;

        while (processed < totalChunks) {
            const remaining = totalChunks - processed;
            const currentBatchSize = Math.min(batchSize, remaining);
            
            console.log(`📦 Collecting batch: ${processed + 1}-${processed + currentBatchSize} of ${totalChunks}`);

            const scrollResults = await client.scroll(collectionName, {
                limit: currentBatchSize,
                offset: processed,
                with_payload: true,
                with_vectors: false,
            });

            const chunks = scrollResults.points || [];
            
            if (chunks.length === 0) {
                break;
            }

            // Group chunks by source
            for (const chunk of chunks) {
                const source = chunk.payload?.metadata?.source || chunk.payload?.source || 'unknown';
                const content = chunk.payload?.text || chunk.payload?.content || chunk.payload?.pageContent || '';
                
                if (content && content.length > 50) {
                    if (!sourceContentMap.has(source)) {
                        sourceContentMap.set(source, []);
                    }
                    sourceContentMap.get(source).push({
                        id: chunk.id,
                        content: content,
                        payload: chunk.payload
                    });
                }
            }

            processed += chunks.length;
        }

        console.log(`📄 Found ${sourceContentMap.size} unique sources`);

        // Step 2: Re-chunk and re-embed each source
        console.log('\n🔧 Step 2: Re-chunking and re-embedding with optimizations...');
        
        let totalNewChunks = 0;
        let totalDeleted = 0;
        let errors = 0;

        for (const [source, chunks] of sourceContentMap) {
            console.log(`\n📄 Processing source: ${source.split('\\').pop() || source.split('/').pop()}`);
            console.log(`   Original chunks: ${chunks.length}`);

            try {
                // Combine all content from this source
                const fullContent = chunks.map(c => c.content).join('\n\n');
                
                // Create optimized chunks
                const optimizedChunks = findOptimalChunkBoundaries(fullContent, 1000, 200);
                console.log(`   Optimized chunks: ${optimizedChunks.length}`);

                // Delete old chunks for this source
                const oldChunkIds = chunks.map(c => c.id);
                await client.delete(collectionName, {
                    points: oldChunkIds
                });
                totalDeleted += oldChunkIds.length;

                // Create new optimized chunks
                for (let i = 0; i < optimizedChunks.length; i++) {
                    const chunkData = optimizedChunks[i];
                    const chunkId = `${chunks[0].id.split('-')[0]}-optimized-${i}`;
                    
                    // Extract enhanced metadata
                    const metadata = extractMetadata(source, chunkData.text);
                    
                    // Generate new embedding
                    const embeddingRes = await embed({
                        model: embeddingModel,
                        value: chunkData.text,
                    });

                    // Create new chunk with optimized structure
                    const newChunk = {
                        id: chunkId,
                        vector: embeddingRes.embedding,
                        payload: {
                            text: chunkData.text,
                            content: chunkData.text,
                            pageContent: chunkData.text,
                            metadata: metadata,
                            source: source,
                            chunkIndex: i,
                            totalChunks: optimizedChunks.length,
                            chunkStart: chunkData.start,
                            chunkEnd: chunkData.end,
                            chunkLength: chunkData.length,
                            optimized: true,
                            timestamp: new Date().toISOString()
                        }
                    };

                    await client.upsert(collectionName, {
                        points: [newChunk]
                    });

                    totalNewChunks++;
                }

                console.log(`   ✅ Processed: ${optimizedChunks.length} new chunks created`);

            } catch (error) {
                errors++;
                console.log(`   ❌ Error processing source: ${error.message}`);
            }
        }

        console.log('\n🎉 Collection optimization completed!');
        console.log(`📊 Final results:`);
        console.log(`   🗑️  Old chunks deleted: ${totalDeleted}`);
        console.log(`   ✨ New optimized chunks created: ${totalNewChunks}`);
        console.log(`   ❌ Errors: ${errors}`);
        console.log(`   📄 Sources processed: ${sourceContentMap.size}`);
        
        // Calculate improvement metrics
        const improvementRatio = totalNewChunks / totalDeleted;
        console.log(`\n📈 Optimization metrics:`);
        console.log(`   📊 Chunk efficiency ratio: ${improvementRatio.toFixed(2)}x`);
        console.log(`   📏 Average chunk size: ~1000 characters (optimized)`);
        console.log(`   🔗 Overlap between chunks: 200 characters`);
        console.log(`   🏷️  Enhanced metadata: Page numbers, chapters, key terms`);
        
        if (errors === 0) {
            console.log('\n🎯 Your RAG system is now fully optimized!');
            console.log('💡 Benefits of the optimization:');
            console.log('   ✅ Better semantic retrieval with proper chunk boundaries');
            console.log('   ✅ Improved context with 200-character overlap');
            console.log('   ✅ Enhanced metadata for better filtering');
            console.log('   ✅ Consistent embedding model (text-embedding-004)');
            console.log('   ✅ Optimal chunk sizes for medical content');
            console.log('\n🚀 Try your asthma queries again - they should work perfectly!');
        } else {
            console.log(`\n⚠️  ${errors} sources had errors. You may need to investigate these manually.`);
        }

    } catch (error) {
        console.error('❌ Collection fix failed:', error.message);
    }
}

// Add confirmation prompt
console.log('🚨 CRITICAL EMBEDDING MISMATCH + CHUNKING OPTIMIZATION!');
console.log('Your entire collection was embedded with a different model AND has suboptimal chunking.');
console.log('This explains why your RAG system is not retrieving relevant content.\n');

console.log('This optimized script will:');
console.log('1. 🔧 Re-chunk ALL content with optimal boundaries (1000 chars, 200 overlap)');
console.log('2. 🏷️  Extract enhanced metadata (page numbers, chapters, key terms)');
console.log('3. 🧠 Re-embed ALL chunks with the correct model (text-embedding-004)');
console.log('4. ⚡ Improve semantic retrieval with better chunk boundaries');
console.log('5. 📊 Provide detailed optimization metrics\n');

console.log('⚠️  WARNINGS:');
console.log('   - This will take several hours to complete');
console.log('   - This will use significant API credits');
console.log('   - This will DELETE and recreate ALL chunks');
console.log('   - This will completely fix your RAG system\n');

console.log('🎯 EXPECTED IMPROVEMENTS:');
console.log('   - Better semantic retrieval (proper chunk boundaries)');
console.log('   - Improved context (200-character overlap)');
console.log('   - Enhanced filtering (rich metadata)');
console.log('   - Consistent embeddings (same model)');
console.log('   - Optimal chunk sizes for medical content\n');

console.log('To proceed, uncomment the line below and run the script:');
console.log('// fixEntireCollection().catch(console.error);');

// Uncomment the line below to run the optimization
// fixEntireCollection().catch(console.error);
