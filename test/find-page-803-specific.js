#!/usr/bin/env node

/**
 * Find Page 803 Content - Specific Search
 * 
 * This script searches specifically for page 803 content using the correct source format
 */

require('dotenv').config({ path: '.env.local' });

const { QdrantClient } = require('@qdrant/js-client-rest');

async function findPage803Specific() {
    console.log('🔍 Searching for Page 803 Content (Specific Search)...\n');

    const client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
    });

    const collectionName = process.env.QDRANT_COLLECTION || 'pulmo_fishman';

    try {
        // Search for page 803 content with the correct format
        console.log('📄 Searching for Page_0803 content...');
        
        const results = await client.scroll(collectionName, {
            limit: 1000,
            with_payload: true,
            with_vectors: false,
        });

        // Look for page 803 content with various possible formats
        const page803Content = results.points?.filter(point => {
            const payload = point.payload;
            const source = payload?.metadata?.source || payload?.source || '';
            
            // Check for various page 803 formats
            return source.includes('Page_0803') || 
                   source.includes('Page_803') ||
                   source.includes('803') ||
                   (source.includes('Page_') && source.includes('803'));
        });

        console.log(`📊 Found ${page803Content?.length || 0} chunks from page 803`);

        if (page803Content && page803Content.length > 0) {
            console.log('\n📝 Page 803 Content Found:');
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
            console.log('❌ No page 803 content found');
            
            // Let's check what pages we do have
            console.log('\n🔍 Checking available pages...');
            
            const allPages = new Set();
            results.points?.forEach(point => {
                const payload = point.payload;
                const source = payload?.metadata?.source || payload?.source || '';
                
                const pageMatch = source.match(/Page_(\d+)/);
                if (pageMatch) {
                    allPages.add(parseInt(pageMatch[1]));
                }
            });
            
            const sortedPages = Array.from(allPages).sort((a, b) => a - b);
            console.log(`📊 Available pages: ${sortedPages.length} total`);
            console.log(`📊 Page range: ${sortedPages[0]} to ${sortedPages[sortedPages.length - 1]}`);
            
            // Find pages close to 803
            const closePages = sortedPages.filter(page => Math.abs(page - 803) <= 20);
            if (closePages.length > 0) {
                console.log(`📍 Pages close to 803: ${closePages.join(', ')}`);
            }
            
            // Check if there are any pages in the 800s
            const pages800s = sortedPages.filter(page => page >= 800 && page <= 899);
            if (pages800s.length > 0) {
                console.log(`📍 Pages in 800s: ${pages800s.join(', ')}`);
            }
        }

        // Test semantic search with the correct query
        console.log('\n🔍 Testing semantic search for asthma differentiation...');
        
        const { google } = require('@ai-sdk/google');
        const { embed } = require('ai');
        const embeddingModel = google.embedding('text-embedding-004');

        const testQuery = "What are the methods to differentiate asthma from other conditions causing wheeze?";
        console.log(`📝 Testing query: "${testQuery}"`);
        
        try {
            const embeddingRes = await embed({
                model: embeddingModel,
                value: testQuery,
            });
            const vector = embeddingRes.embedding;

            const searchResults = await client.search(collectionName, {
                vector: vector,
                limit: 50, // Large limit to see if page 803 appears
                with_payload: true,
                with_vectors: false,
            });

            console.log(`📊 Semantic search returned ${searchResults.length} results`);
            
            // Check if any results are from page 803
            const page803Results = searchResults.filter(result => {
                const payload = result.payload;
                const source = payload?.metadata?.source || payload?.source || '';
                
                return source.includes('Page_0803') || 
                       source.includes('Page_803') ||
                       source.includes('803');
            });

            if (page803Results.length > 0) {
                console.log(`✅ Found ${page803Results.length} page 803 results in semantic search!`);
                page803Results.forEach((result, index) => {
                    const rank = searchResults.findIndex(r => r === result) + 1;
                    console.log(`   ${index + 1}. Rank: ${rank}, Score: ${result.score.toFixed(4)}`);
                    console.log(`      Source: ${result.payload?.metadata?.source || result.payload?.source || 'Unknown'}`);
                });
            } else {
                console.log(`❌ No page 803 results in semantic search`);
                
                // Show top 5 results to understand what's being retrieved
                console.log(`\n📝 Top 5 semantic search results:`);
                searchResults.slice(0, 5).forEach((result, index) => {
                    const payload = result.payload;
                    const source = payload?.metadata?.source || payload?.source || '';
                    const text = payload?.text || payload?.content || payload?.pageContent || '';
                    
                    console.log(`   ${index + 1}. Score: ${result.score.toFixed(4)}`);
                    console.log(`      Source: ${source}`);
                    console.log(`      Content: ${text.substring(0, 150)}...`);
                });
            }

        } catch (error) {
            console.log(`❌ Semantic search failed: ${error.message}`);
        }

        // Final recommendations
        console.log('\n💡 Final Recommendations:');
        
        if (page803Content && page803Content.length > 0) {
            console.log('   ✅ Page 803 content exists in your collection');
            console.log('   🔧 The issue is with semantic retrieval');
            console.log('   🔧 Use the improved RAG settings we implemented');
            console.log('   🔧 Try the correct semantic query about asthma differentiation');
        } else {
            console.log('   ❌ Page 803 content does not exist in your collection');
            console.log('   💡 The content might be:');
            console.log('      - In a different page number');
            console.log('      - Not indexed yet');
            console.log('      - Named differently');
            console.log('   🔧 Focus on asking about the content topic instead of page number');
            console.log('   🔧 Use the improved RAG settings to get more relevant content');
        }

    } catch (error) {
        console.error('❌ Search failed:', error.message);
    }
}

findPage803Specific().catch(console.error);
