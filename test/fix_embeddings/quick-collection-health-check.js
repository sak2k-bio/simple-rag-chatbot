#!/usr/bin/env node

/**
 * Quick Collection Health Check
 * 
 * This script provides a fast overview of your collection's health
 */

require('dotenv').config({ path: '.env.local' });

const { QdrantClient } = require('@qdrant/js-client-rest');

async function quickHealthCheck() {
    console.log('🏥 Quick Collection Health Check...\n');

    const client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
    });

    const collectionName = process.env.QDRANT_COLLECTION || 'pulmo_fishman';

    try {
        // Step 1: Basic collection info
        console.log('📊 Collection Information:');
        const collectionInfo = await client.getCollection(collectionName);
        console.log(`   Total vectors: ${collectionInfo.points_count.toLocaleString()}`);
        console.log(`   Vector dimensions: ${collectionInfo.config.params.vectors.size}`);
        console.log(`   Status: ${collectionInfo.status}`);

        // Step 2: Sample content analysis
        console.log('\n🔍 Content Analysis:');
        const sampleResults = await client.scroll(collectionName, {
            limit: 100,
            with_payload: true,
            with_vectors: false,
        });

        const chunks = sampleResults.points || [];
        
        // Check content lengths
        const contentLengths = chunks.map(chunk => {
            const content = chunk.payload?.text || chunk.payload?.content || chunk.payload?.pageContent || '';
            return content.length;
        }).filter(length => length > 0);

        const avgLength = contentLengths.reduce((a, b) => a + b, 0) / contentLengths.length;
        const minLength = Math.min(...contentLengths);
        const maxLength = Math.max(...contentLengths);

        console.log(`   Average content length: ${avgLength.toFixed(0)} characters`);
        console.log(`   Min content length: ${minLength} characters`);
        console.log(`   Max content length: ${maxLength} characters`);

        // Check for empty content
        const emptyChunks = chunks.filter(chunk => {
            const content = chunk.payload?.text || chunk.payload?.content || chunk.payload?.pageContent || '';
            return !content || content.trim() === '';
        }).length;

        console.log(`   Empty content chunks: ${emptyChunks}`);

        // Check metadata quality
        const missingSource = chunks.filter(chunk => {
            const source = chunk.payload?.metadata?.source || chunk.payload?.source || '';
            return !source || source.trim() === '';
        }).length;

        console.log(`   Chunks missing source: ${missingSource}`);

        // Step 3: Source analysis
        console.log('\n📄 Source Analysis:');
        const sources = new Set();
        chunks.forEach(chunk => {
            const source = chunk.payload?.metadata?.source || chunk.payload?.source || '';
            if (source) {
                sources.add(source);
            }
        });

        console.log(`   Unique sources in sample: ${sources.size}`);
        
        // Show sample sources
        const sampleSources = Array.from(sources).slice(0, 5);
        console.log('   Sample sources:');
        sampleSources.forEach((source, index) => {
            const fileName = source.split('\\').pop() || source.split('/').pop() || source;
            console.log(`     ${index + 1}. ${fileName}`);
        });

        // Step 4: Health score
        console.log('\n📈 Health Score:');
        let healthScore = 100;
        
        if (emptyChunks > 0) {
            healthScore -= (emptyChunks / chunks.length) * 30;
        }
        
        if (missingSource > 0) {
            healthScore -= (missingSource / chunks.length) * 20;
        }
        
        if (avgLength < 200) {
            healthScore -= 15;
        }
        
        if (avgLength > 2000) {
            healthScore -= 10;
        }

        console.log(`   Overall health score: ${Math.max(0, healthScore).toFixed(1)}/100`);

        if (healthScore >= 90) {
            console.log('   Status: ✅ EXCELLENT');
        } else if (healthScore >= 75) {
            console.log('   Status: ✅ GOOD');
        } else if (healthScore >= 60) {
            console.log('   Status: ⚠️  FAIR');
        } else {
            console.log('   Status: ❌ POOR');
        }

        // Step 5: Recommendations
        console.log('\n💡 Recommendations:');
        
        if (emptyChunks > 0) {
            console.log('   🧹 Remove empty content chunks');
        }
        
        if (missingSource > 0) {
            console.log('   📝 Fix missing source metadata');
        }
        
        if (avgLength < 200) {
            console.log('   📏 Consider increasing chunk size');
        }
        
        if (avgLength > 2000) {
            console.log('   ✂️  Consider decreasing chunk size');
        }

        if (healthScore < 80) {
            console.log('   🔍 Run detailed embedding quality audit: node test/audit-embedding-quality.js');
        }

        console.log('\n🎯 Next Steps:');
        console.log('   1. Run embedding consistency check: node test/check-embedding-models.js');
        console.log('   2. Run full quality audit: node test/audit-embedding-quality.js');
        console.log('   3. Test your RAG system with optimized settings');

    } catch (error) {
        console.error('❌ Health check failed:', error.message);
    }
}

quickHealthCheck().catch(console.error);
