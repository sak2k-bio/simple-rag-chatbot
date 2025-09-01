#!/usr/bin/env node

/**
 * Qdrant Cloud Setup Script
 *
 * This script helps you:
 * 1. Test your Qdrant Cloud connection
 * 2. Create a collection if it doesn't exist
 * 3. Verify the collection configuration
 *
 * Usage:
 * node setup-qdrant-cloud.js
 *
 * Make sure to set your environment variables first:
 * - QDRANT_URL=https://your-cluster.qdrant.io
 * - QDRANT_API_KEY=your_api_key
 * - QDRANT_COLLECTION=documents (optional, defaults to 'documents')
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { QdrantClient } = require('@qdrant/js-client-rest');

// Configuration
const qdrantUrl = process.env.QDRANT_URL;
const qdrantApiKey = process.env.QDRANT_API_KEY;
const collectionName = process.env.QDRANT_COLLECTION || 'documents';

async function setupQdrantCloud() {
  console.log('🚀 Setting up Qdrant Cloud...\n');

  // Check environment variables
  if (!qdrantUrl || !qdrantApiKey) {
    console.error('❌ Missing environment variables!');
    console.log('Please set the following environment variables:');
    console.log('- QDRANT_URL=https://your-cluster.qdrant.io');
    console.log('- QDRANT_API_KEY=your_qdrant_api_key');
    console.log('\nYou can get these from your Qdrant Cloud dashboard.');
    process.exit(1);
  }

  console.log('🔗 Connecting to Qdrant Cloud...');
  console.log(`📍 URL: ${qdrantUrl}`);
  console.log(`📁 Collection: ${collectionName}\n`);

  const client = new QdrantClient({
    url: qdrantUrl,
    apiKey: qdrantApiKey,
  });

  try {
    // Test connection
    console.log('🔍 Testing connection...');
    const collections = await client.getCollections();
    console.log('✅ Successfully connected to Qdrant Cloud!');
    console.log(`📊 Available collections: ${collections.collections?.length || 0}\n`);

    // Check if collection exists
    const existingCollections = collections.collections?.map(c => c.name) || [];
    const collectionExists = existingCollections.includes(collectionName);

    if (collectionExists) {
      console.log(`✅ Collection '${collectionName}' already exists!`);

      // Get collection info
      const collectionInfo = await client.getCollection(collectionName);
      console.log(`📈 Collection Info:`);
      console.log(`   - Vectors: ${collectionInfo.points_count || 0}`);
      console.log(`   - Vector Size: ${collectionInfo.config?.params?.vectors?.size || 'Unknown'}`);
      console.log(`   - Distance: ${collectionInfo.config?.params?.vectors?.distance || 'Unknown'}\n`);

    } else {
      console.log(`📝 Collection '${collectionName}' doesn't exist. Creating...`);

      // Create collection
      await client.createCollection(collectionName, {
        vectors: {
          size: 768, // Dimension for text-embedding-004
          distance: 'Cosine'
        }
      });

      console.log(`✅ Collection '${collectionName}' created successfully!\n`);
    }

    // Test a simple search to ensure everything works
    console.log('🧪 Testing search functionality...');
    try {
      const testResults = await client.search(collectionName, {
        vector: new Array(768).fill(0.1), // Dummy vector for testing
        limit: 1,
        with_payload: false,
        with_vectors: false
      });
      console.log('✅ Search functionality working!\n');
    } catch (searchError) {
      console.log('⚠️ Search test failed (this is normal for empty collections)\n');
    }

    console.log('🎉 Qdrant Cloud setup complete!');
    console.log('\nNext steps:');
    console.log('1. Make sure your .env.local file contains the correct QDRANT_URL and QDRANT_API_KEY');
    console.log('2. Add documents to your collection using the ingestion features');
    console.log('3. Test the chatbot with RAG functionality');

  } catch (error) {
    console.error('❌ Qdrant Cloud setup failed:');
    console.error(error.message);

    if (error.message.includes('401')) {
      console.log('\n🔐 Authentication failed. Please check your QDRANT_API_KEY.');
    } else if (error.message.includes('404')) {
      console.log('\n🌐 Connection failed. Please check your QDRANT_URL.');
    } else {
      console.log('\n💡 Please check your Qdrant Cloud configuration.');
    }

    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  setupQdrantCloud().catch(console.error);
}

module.exports = { setupQdrantCloud };
