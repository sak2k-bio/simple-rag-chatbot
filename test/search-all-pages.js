#!/usr/bin/env node

/**
 * Search for All Pages in Collection
 * 
 * This script searches for any content that might be related to page 803
 */

require('dotenv').config({ path: '.env.local' });

const { QdrantClient } = require('@qdrant/js-client-rest');

async function searchAllPages() {
    console.log('🔍 Searching for All Pages in Collection...\n');

    const client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
    });

    const collectionName = process.env.QDRANT_COLLECTION || 'pulmo_fishman';

    try {
        // Get a sample of all content to see naming patterns
        console.log('📄 Retrieving sample content to analyze naming patterns...');
        
        const results = await client.scroll(collectionName, {
            limit: 100, // Get first 100 items
            with_payload: true,
            with_vectors: false,
        });

        console.log(`📊 Retrieved ${results.points?.length || 0} sample items\n`);

        // Analyze source naming patterns
        const sourcePatterns = new Set();
        const pageNumbers = new Set();
        
        results.points?.forEach(point => {
            const payload = point.payload;
            const source = payload?.metadata?.source || payload?.source || '';
            
            if (source) {
                sourcePatterns.add(source);
                
                // Extract page numbers (handle both Page_1332 and Page_0803 formats)
                const pageMatch = source.match(/Page_(\d+)/);
                if (pageMatch) {
                    pageNumbers.add(parseInt(pageMatch[1]));
                }
            }
        });

        console.log('📋 Source Naming Patterns (first 10):');
        Array.from(sourcePatterns).slice(0, 10).forEach((pattern, index) => {
            console.log(`   ${index + 1}. ${pattern}`);
        });

        console.log(`\n📊 Page Numbers Found (sorted):`);
        const sortedPages = Array.from(pageNumbers).sort((a, b) => a - b);
        console.log(`   Total unique pages: ${sortedPages.length}`);
        console.log(`   Page range: ${sortedPages[0]} to ${sortedPages[sortedPages.length - 1]}`);
        
        // Check if page 803 exists (both 803 and 0803 formats)
        if (sortedPages.includes(803)) {
            console.log('   ✅ Page 803 found in collection!');
        } else {
            console.log('   ❌ Page 803 NOT found in collection');
            
            // Find closest pages
            const closestPages = sortedPages.filter(page => Math.abs(page - 803) <= 10);
            if (closestPages.length > 0) {
                console.log(`   📍 Closest pages to 803: ${closestPages.join(', ')}`);
            }
        }

        // Search for any content containing "803"
        console.log('\n🔍 Searching for any content containing "803"...');
        
        const allResults = await client.scroll(collectionName, {
            limit: 1000,
            with_payload: true,
            with_vectors: false,
        });

        const contentWith803 = allResults.points?.filter(point => {
            const payload = point.payload;
            const text = payload?.text || payload?.content || payload?.pageContent || '';
            const source = payload?.metadata?.source || payload?.source || '';
            
            return text.includes('803') || 
                   source.includes('803') || 
                   source.includes('Page_0803') ||
                   source.includes('Page_803');
        });

        console.log(`📊 Found ${contentWith803?.length || 0} chunks containing "803"`);

        if (contentWith803 && contentWith803.length > 0) {
            console.log('\n📝 Content containing "803":');
            contentWith803.forEach((point, index) => {
                const payload = point.payload;
                const text = payload?.text || payload?.content || payload?.pageContent || '';
                const source = payload?.metadata?.source || payload?.source || '';
                
                console.log(`\n${index + 1}. Source: ${source}`);
                console.log(`   Content preview: ${text.substring(0, 200)}...`);
            });
        }

        // Search for asthma-related content
        console.log('\n🔍 Searching for asthma-related content...');
        
        const asthmaContent = allResults.points?.filter(point => {
            const payload = point.payload;
            const text = payload?.text || payload?.content || payload?.pageContent || '';
            const source = payload?.metadata?.source || payload?.source || '';
            
            return text.toLowerCase().includes('asthma') && 
                   (text.toLowerCase().includes('differentiate') || 
                    text.toLowerCase().includes('wheeze') ||
                    text.toLowerCase().includes('wheezing'));
        });

        console.log(`📊 Found ${asthmaContent?.length || 0} chunks with asthma + differentiate/wheeze`);

        if (asthmaContent && asthmaContent.length > 0) {
            console.log('\n📝 Asthma + differentiate/wheeze content:');
            asthmaContent.slice(0, 5).forEach((point, index) => {
                const payload = point.payload;
                const text = payload?.text || payload?.content || payload?.pageContent || '';
                const source = payload?.metadata?.source || payload?.source || '';
                
                console.log(`\n${index + 1}. Source: ${source}`);
                console.log(`   Content preview: ${text.substring(0, 300)}...`);
            });
        }

        // Recommendations
        console.log('\n💡 Recommendations:');
        
        if (sortedPages.includes(803)) {
            console.log('   ✅ Page 803 exists - the issue is with semantic retrieval');
            console.log('   🔧 Try the improved RAG settings we implemented');
            console.log('   🔧 Use the correct semantic query about asthma differentiation');
        } else {
            console.log('   ❌ Page 803 does not exist in your collection');
            console.log('   💡 The content might be:');
            console.log('      - In a different page number');
            console.log('      - Not indexed yet');
            console.log('      - Named differently');
            console.log('   🔧 Try asking about the content topic instead of page number');
        }

    } catch (error) {
        console.error('❌ Search failed:', error.message);
    }
}

searchAllPages().catch(console.error);
