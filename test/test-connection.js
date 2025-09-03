#!/usr/bin/env node

/**
 * Simple Qdrant Connection Test
 */

require('dotenv').config({ path: '.env.local' });

const { QdrantClient } = require('@qdrant/js-client-rest');

async function testConnection() {
    console.log('🔗 Testing Qdrant Connection...\n');

    // Check environment variables
    console.log('📋 Environment Variables:');
    console.log(`   QDRANT_URL: ${process.env.QDRANT_URL ? '✅ Set' : '❌ Missing'}`);
    console.log(`   QDRANT_API_KEY: ${process.env.QDRANT_API_KEY ? '✅ Set' : '❌ Missing'}`);
    console.log(`   QDRANT_COLLECTION: ${process.env.QDRANT_COLLECTION ? '✅ Set' : '❌ Missing'}`);
    console.log(`   GOOGLE_API_KEY: ${process.env.GOOGLE_API_KEY ? '✅ Set' : '❌ Missing'}`);

    if (!process.env.QDRANT_URL || !process.env.QDRANT_API_KEY) {
        console.log('\n❌ Missing required environment variables');
        return;
    }

    try {
        const client = new QdrantClient({
            url: process.env.QDRANT_URL,
            apiKey: process.env.QDRANT_API_KEY,
        });

        console.log('\n🔍 Testing connection...');
        
        // Test basic connection
        const collections = await client.getCollections();
        console.log('✅ Connection successful!');
        console.log(`📊 Available collections: ${collections.collections?.length || 0}`);

        // Check if our collection exists
        const collectionName = process.env.QDRANT_COLLECTION || 'pulmo_fishman';
        const existingCollections = collections.collections?.map(c => c.name) || [];
        const collectionExists = existingCollections.includes(collectionName);

        if (collectionExists) {
            console.log(`✅ Collection '${collectionName}' exists!`);
            
            // Get collection info
            const collectionInfo = await client.getCollection(collectionName);
            const vectorCount = collectionInfo.points_count || 0;
            console.log(`📈 Collection Info:`);
            console.log(`   - Vectors: ${vectorCount}`);
            console.log(`   - Vector Size: ${collectionInfo.config?.params?.vectors?.size || 'Unknown'}`);
            console.log(`   - Distance: ${collectionInfo.config?.params?.vectors?.distance || 'Unknown'}`);

            if (vectorCount > 0) {
                console.log('\n🎉 Your RAG system is ready!');
                console.log('💡 Try asking: "What are the methods to differentiate asthma from other conditions causing wheeze?"');
            } else {
                console.log('\n⚠️ Collection is empty - add some documents first');
            }
        } else {
            console.log(`❌ Collection '${collectionName}' does not exist!`);
            console.log('💡 Available collections:', existingCollections);
        }

    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        
        if (error.message.includes('401')) {
            console.log('\n🔐 Authentication failed. Check your QDRANT_API_KEY.');
        } else if (error.message.includes('404')) {
            console.log('\n🌐 Connection failed. Check your QDRANT_URL.');
        } else if (error.message.includes('fetch failed')) {
            console.log('\n🌐 Network error. Check your internet connection and QDRANT_URL.');
        }
    }
}

testConnection().catch(console.error);
