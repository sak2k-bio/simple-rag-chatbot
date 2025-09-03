#!/usr/bin/env node

/**
 * Deep Dive Analysis of Page 803 Content
 * 
 * This script performs a comprehensive analysis to understand why page 803 content isn't being retrieved
 */

require('dotenv').config({ path: '.env.local' });

const { QdrantClient } = require('@qdrant/js-client-rest');

async function deepDivePage803() {
    console.log('🔍 Deep Dive Analysis of Page 803 Content...\n');

    const client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
    });

    const collectionName = process.env.QDRANT_COLLECTION || 'pulmo_fishman';

    try {
        // Step 1: Get the exact page 803 content
        console.log('📄 Step 1: Retrieving exact page 803 content...');
        
        const results = await client.scroll(collectionName, {
            limit: 1000,
            with_payload: true,
            with_vectors: false,
        });

        const page803Content = results.points?.filter(point => {
            const payload = point.payload;
            const source = payload?.metadata?.source || payload?.source || '';
            return source.includes('Page_0803') || source.includes('803');
        });

        if (page803Content && page803Content.length > 0) {
            console.log(`📊 Found ${page803Content.length} chunks from page 803`);
            
            page803Content.forEach((point, index) => {
                const payload = point.payload;
                const text = payload?.text || payload?.content || payload?.pageContent || '';
                const source = payload?.metadata?.source || payload?.source || '';
                
                console.log(`\n${index + 1}. Source: ${source}`);
                console.log(`   Content length: ${text.length} characters`);
                console.log(`   Content preview: ${text.substring(0, 500)}...`);
                
                // Check for key terms
                const keyTerms = ['asthma', 'differentiate', 'wheeze', 'wheezing', 'obstructive', 'lung', 'disease'];
                const foundTerms = keyTerms.filter(term => text.toLowerCase().includes(term));
                console.log(`   Key terms found: ${foundTerms.join(', ')}`);
            });
        } else {
            console.log('❌ No page 803 content found in collection');
            return;
        }

        // Step 2: Test with very specific queries
        console.log('\n🔍 Step 2: Testing with very specific queries...');
        
        const specificQueries = [
            "asthma differentiation wheeze",
            "obstructive lung diseases asthma",
            "wheezing conditions asthma",
            "asthma vs other conditions",
            "differentiate asthma wheeze",
            "asthma diagnostic criteria",
            "wheezing differential diagnosis",
            "asthma obstructive diseases"
        ];

        const { google } = require('@ai-sdk/google');
        const { embed } = require('ai');
        const embeddingModel = google.embedding('text-embedding-004');

        for (const query of specificQueries) {
            console.log(`\n📝 Testing: "${query}"`);
            
            try {
                const embeddingRes = await embed({
                    model: embeddingModel,
                    value: query,
                });
                const vector = embeddingRes.embedding;

                const results = await client.search(collectionName, {
                    vector: vector,
                    limit: 100, // Large limit to see if it's there
                    with_payload: true,
                    with_vectors: false,
                });

                // Check for page 803 content
                const page803Results = results.filter(result => {
                    const payload = result.payload;
                    const source = payload?.metadata?.source || payload?.source || '';
                    return source.includes('Page_0803') || source.includes('803');
                });

                if (page803Results.length > 0) {
                    console.log(`   ✅ Found ${page803Results.length} page 803 results!`);
                    page803Results.forEach((result, index) => {
                        const rank = results.findIndex(r => r === result) + 1;
                        console.log(`      ${index + 1}. Rank: ${rank}, Score: ${result.score.toFixed(4)}`);
                        console.log(`         Source: ${result.payload?.metadata?.source || result.payload?.source || 'Unknown'}`);
                    });
                } else {
                    console.log(`   ❌ No page 803 results found`);
                    
                    // Show top 5 results to understand what's being retrieved
                    console.log(`   Top 5 results:`);
                    results.slice(0, 5).forEach((result, index) => {
                        const payload = result.payload;
                        const source = payload?.metadata?.source || payload?.source || '';
                        const text = payload?.text || payload?.content || payload?.pageContent || '';
                        console.log(`      ${index + 1}. Score: ${result.score.toFixed(4)}`);
                        console.log(`         Source: ${source}`);
                        console.log(`         Content: ${text.substring(0, 100)}...`);
                    });
                }
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
            }
        }

        // Step 3: Check if the content is properly chunked
        console.log('\n📊 Step 3: Analyzing content chunking...');
        
        if (page803Content && page803Content.length > 0) {
            const firstChunk = page803Content[0];
            const text = firstChunk.payload?.text || firstChunk.payload?.content || firstChunk.payload?.pageContent || '';
            
            console.log(`   Total content length: ${text.length} characters`);
            console.log(`   Number of chunks: ${page803Content.length}`);
            console.log(`   Average chunk size: ${Math.round(text.length / page803Content.length)} characters`);
            
            // Check if content is meaningful
            const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
            console.log(`   Number of sentences: ${sentences.length}`);
            console.log(`   First few sentences:`);
            sentences.slice(0, 3).forEach((sentence, index) => {
                console.log(`      ${index + 1}. ${sentence.trim().substring(0, 100)}...`);
            });
        }

        // Step 4: Test with exact text matching
        console.log('\n🔍 Step 4: Testing with exact text matching...');
        
        if (page803Content && page803Content.length > 0) {
            const firstChunk = page803Content[0];
            const text = firstChunk.payload?.text || firstChunk.payload?.content || firstChunk.payload?.pageContent || '';
            
            // Extract key phrases from the content
            const keyPhrases = [
                text.substring(0, 200),
                text.substring(200, 400),
                text.substring(400, 600)
            ].filter(phrase => phrase.trim().length > 50);

            for (const phrase of keyPhrases) {
                console.log(`\n📝 Testing with phrase: "${phrase.substring(0, 100)}..."`);
                
                try {
                    const embeddingRes = await embed({
                        model: embeddingModel,
                        value: phrase,
                    });
                    const vector = embeddingRes.embedding;

                    const results = await client.search(collectionName, {
                        vector: vector,
                        limit: 10,
                        with_payload: true,
                        with_vectors: false,
                    });

                    const page803Results = results.filter(result => {
                        const payload = result.payload;
                        const source = payload?.metadata?.source || payload?.source || '';
                        return source.includes('Page_0803') || source.includes('803');
                    });

                    if (page803Results.length > 0) {
                        console.log(`   ✅ Found page 803 content with score: ${page803Results[0].score.toFixed(4)}`);
                    } else {
                        console.log(`   ❌ Still not found`);
                    }
                } catch (error) {
                    console.log(`   ❌ Error: ${error.message}`);
                }
            }
        }

        // Step 5: Recommendations
        console.log('\n💡 Step 5: Analysis and Recommendations...');
        
        if (page803Content && page803Content.length > 0) {
            console.log('   ✅ Page 803 content exists in your collection');
            console.log('   ❌ But it\'s not being retrieved by semantic search');
            console.log('\n   Possible issues:');
            console.log('   1. Content might be poorly chunked (too long/short)');
            console.log('   2. Embedding model might not capture the semantic meaning well');
            console.log('   3. Content might be split across multiple chunks');
            console.log('   4. The content might not be semantically similar to your queries');
            
            console.log('\n   Solutions to try:');
            console.log('   1. Re-chunk the page 803 content with better strategies');
            console.log('   2. Use HyDE (Hypothetical Document Embeddings)');
            console.log('   3. Try different embedding models');
            console.log('   4. Use query expansion techniques');
            console.log('   5. Consider using metadata filtering');
        }

    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
    }
}

// Run the analysis
deepDivePage803().catch(console.error);
