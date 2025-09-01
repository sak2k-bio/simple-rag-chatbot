#!/usr/bin/env node

/**
 * Qdrant Connection Test Script
 *
 * This script tests your Qdrant Cloud connection and RAG functionality.
 *
 * Usage:
 * node test-qdrant-connection.js
 */

const { QdrantClient } = require('@qdrant/js-client-rest');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const { google } = require('@ai-sdk/google');
const { embed } = require('ai');

// Configuration
const qdrantUrl = process.env.QDRANT_URL;
const qdrantApiKey = process.env.QDRANT_API_KEY;
const collectionName = process.env.QDRANT_COLLECTION || 'documents';
const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;

async function testQdrantConnection() {
  console.log('🧪 Testing Qdrant Cloud Connection and RAG...\n');

  // Check environment variables
  console.log('📋 Checking environment variables...');
  if (!qdrantUrl) {
    console.error('❌ QDRANT_URL is not set');
    return false;
  }
  if (!qdrantApiKey) {
    console.error('❌ QDRANT_API_KEY is not set');
    return false;
  }
  if (!googleApiKey) {
    console.error('❌ GOOGLE_GENERATIVE_AI_API_KEY is not set');
    return false;
  }

  console.log('✅ Environment variables are set\n');

  try {
    // Test Qdrant connection
    console.log('🔗 Testing Qdrant Cloud connection...');
    const qdrantClient = new QdrantClient({
      url: qdrantUrl,
      apiKey: qdrantApiKey,
    });

    const collections = await qdrantClient.getCollections();
    console.log('✅ Qdrant Cloud connection successful!');
    console.log(`📊 Available collections: ${collections.collections?.length || 0}\n`);

    // Check if our collection exists
    const existingCollections = collections.collections?.map(c => c.name) || [];
    const collectionExists = existingCollections.includes(collectionName);

    if (!collectionExists) {
      console.log(`❌ Collection '${collectionName}' does not exist!`);
      console.log('💡 Run `node setup-qdrant-cloud.js` to create the collection.\n');
      return false;
    }

    console.log(`✅ Collection '${collectionName}' exists!\n`);

    // Get collection info
    const collectionInfo = await qdrantClient.getCollection(collectionName);
    const vectorCount = collectionInfo.points_count || 0;
    console.log(`📈 Collection Info:`);
    console.log(`   - Vectors: ${vectorCount}`);
    console.log(`   - Vector Size: ${collectionInfo.config?.params?.vectors?.size || 'Unknown'}`);
    console.log(`   - Distance: ${collectionInfo.config?.params?.vectors?.distance || 'Unknown'}\n`);

    if (vectorCount === 0) {
      console.log('⚠️ Collection is empty! Add some documents first.\n');
      console.log('💡 You can:');
      console.log('   1. Use the chatbot\'s document upload feature');
      console.log('   2. Use the URL crawling feature');
      console.log('   3. Manually add documents via the Qdrant API\n');
      return false;
    }

    // Test embeddings
    console.log('🧠 Testing Google AI embeddings...');
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: googleApiKey,
      model: 'text-embedding-004',
    });

    const testText = 'This is a test query for Qdrant RAG functionality.';
    const embedding = await embeddings.embedQuery(testText);
    console.log(`✅ Embeddings generated successfully! Vector dimension: ${embedding.length}\n`);

    // Test RAG search
    console.log('🔍 Testing RAG search functionality...');
    const searchResults = await qdrantClient.search(collectionName, {
      vector: embedding,
      limit: 3,
      with_payload: true,
      score_threshold: 0.1, // Low threshold to get results
    });

    console.log(`✅ Search completed! Found ${searchResults.length} results\n`);

    if (searchResults.length > 0) {
      console.log('📄 Top search results:');
      searchResults.forEach((result, index) => {
        console.log(`${index + 1}. Score: ${result.score.toFixed(3)}`);
        console.log(`   Content: ${(result.payload?.text || result.payload?.content || 'No content').substring(0, 100)}...`);
        console.log('');
      });
    } else {
      console.log('⚠️ No search results found. Try lowering the similarity threshold.\n');
    }

    // Test full RAG pipeline
    console.log('🤖 Testing complete RAG pipeline...');
    const embeddingModel = google.embedding('text-embedding-004');
    const embeddingRes = await embed({
      model: embeddingModel,
      value: testText,
    });

    const ragResults = await qdrantClient.search(collectionName, {
      vector: embeddingRes.embedding,
      limit: 3,
      with_payload: true,
      score_threshold: 0.5,
    });

    const context = ragResults
      .map(h => h.payload?.text || h.payload?.content || '')
      .join('\n---\n');

    console.log(`✅ RAG pipeline working! Retrieved ${ragResults.length} chunks`);
    console.log(`📝 Context length: ${context.length} characters\n`);

    // Summary
    console.log('🎉 RAG Test Summary:');
    console.log('✅ Qdrant Cloud connection: Working');
    console.log('✅ Collection exists: Yes');
    console.log(`✅ Documents in collection: ${vectorCount}`);
    console.log('✅ Embeddings generation: Working');
    console.log('✅ Search functionality: Working');
    console.log('✅ RAG pipeline: Working');
    console.log('\n🚀 Your chatbot is ready for RAG!');

    return true;

  } catch (error) {
    console.error('❌ Test failed:', error.message);

    if (error.message.includes('401')) {
      console.log('\n🔐 Authentication failed. Check your QDRANT_API_KEY.');
    } else if (error.message.includes('404')) {
      console.log('\n🌐 Connection failed. Check your QDRANT_URL.');
    } else if (error.message.includes('GOOGLE')) {
      console.log('\n🤖 Google AI error. Check your GOOGLE_GENERATIVE_AI_API_KEY.');
    } else {
      console.log('\n💡 Check your configuration and try again.');
    }

    return false;
  }
}

// Run test if called directly
if (require.main === module) {
  testQdrantConnection()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { testQdrantConnection };
