# Qdrant Cloud Setup Guide for RAG

This guide will help you set up Qdrant Cloud for Retrieval Augmented Generation (RAG) with your enhanced chatbot.

## Prerequisites

1. **Qdrant Cloud Account**: Sign up at [Qdrant Cloud](https://cloud.qdrant.io)
2. **API Key**: Generate an API key from your Qdrant Cloud dashboard
3. **Cluster URL**: Get your cluster URL from the dashboard

## Step 1: Create Environment Variables

Create a `.env.local` file in your project root with the following variables:

```bash
# Qdrant Cloud Configuration
QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your_qdrant_api_key_here
QDRANT_COLLECTION=documents

# Google AI (required for embeddings)
GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_api_key_here

# Supabase (optional, for memory persistence)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Step 2: Run Setup Script

Execute the setup script to verify your connection and create the collection:

```bash
node setup-qdrant-cloud.js
```

This script will:
- ✅ Test your Qdrant Cloud connection
- ✅ Create the collection if it doesn't exist
- ✅ Verify the collection configuration
- ✅ Test search functionality

## Step 3: Get Your Qdrant Cloud Details

### Finding Your Cluster URL and API Key

1. **Log in to Qdrant Cloud**: Go to [cloud.qdrant.io](https://cloud.qdrant.io)
2. **Navigate to your cluster**: Select your cluster from the dashboard
3. **Get Cluster URL**: Copy the REST API URL (looks like `https://xyz-abc.qdrant.io`)
4. **Generate API Key**:
   - Go to **Access Management** in your cluster
   - Create a new API key
   - Copy the API key (starts with `qdrant_`)

### Example Configuration

```bash
QDRANT_URL=https://xyz-abc.qdrant.io
QDRANT_API_KEY=qdrant_abcd1234...
QDRANT_COLLECTION=documents
```

## Step 4: Test the Connection

### Using the Setup Script

```bash
# Run the setup script
node setup-qdrant-cloud.js
```

**Expected Output:**
```
🚀 Setting up Qdrant Cloud...

🔗 Connecting to Qdrant Cloud...
📍 URL: https://xyz-abc.qdrant.io
📁 Collection: documents

🔍 Testing connection...
✅ Successfully connected to Qdrant Cloud!
📊 Available collections: 1

📝 Collection 'documents' doesn't exist. Creating...
✅ Collection 'documents' created successfully!

🧪 Testing search functionality...
⚠️ Search test failed (this is normal for empty collections)

🎉 Qdrant Cloud setup complete!
```

### Manual Testing

You can also test the connection manually by running the development server and checking the console logs:

```bash
npm run dev
```

Look for these log messages in the terminal:
```
Qdrant configured, attempting RAG search...
RAG context found: X chunks with threshold 0.7
```

## Step 5: Add Documents to Your Collection

Once your collection is created, you need to add documents for RAG to work. You can:

### Option 1: Use the Built-in Document Ingestion

The chatbot has built-in document ingestion features. You can:
- Upload PDF, TXT, DOC files
- Provide website URLs for crawling
- Paste raw text content

### Option 2: Manual Document Addition

You can add documents programmatically using the Qdrant client:

```javascript
const { QdrantClient } = require('@qdrant/js-client-rest');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');

const client = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  model: 'text-embedding-004',
});

// Add a document
async function addDocument(text, metadata = {}) {
  const vector = await embeddings.embedQuery(text);

  await client.upsert('documents', {
    wait: true,
    points: [{
      id: Date.now().toString(),
      vector: vector,
      payload: {
        text: text,
        content: text,
        metadata: metadata,
        ...metadata
      }
    }]
  });
}
```

## Step 6: Configure RAG Parameters

### Similarity Threshold

Adjust the similarity threshold in your environment:

```bash
# Conservative (higher quality, fewer results)
SIMILARITY_THRESHOLD=0.8

# Balanced (good mix of quality and coverage)
SIMILARITY_THRESHOLD=0.7

# Permissive (more results, lower quality)
SIMILARITY_THRESHOLD=0.5
```

### Top-K Selection

The chatbot supports automatic Top-K selection based on query complexity, or you can set it manually:

```bash
# Let the AI decide based on query analysis
# TOP_K=auto (default)

# Or set manually
# TOP_K=5
```

## Troubleshooting

### Common Issues

#### 1. "Qdrant connection failed"
```
❌ Qdrant search failed, continuing without context
```
**Solution:**
- Check your `QDRANT_URL` is correct
- Verify your `QDRANT_API_KEY` is valid
- Ensure your cluster is running

#### 2. "Collection doesn't exist"
```
📝 Collection 'documents' doesn't exist
```
**Solution:**
- Run `node setup-qdrant-cloud.js` to create the collection
- Or create it manually in your Qdrant Cloud dashboard

#### 3. "No search results"
```
RAG context found: 0 chunks with threshold 0.7
```
**Solution:**
- Add documents to your collection first
- Lower the similarity threshold
- Check that documents were embedded correctly

#### 4. "Authentication failed"
```
❌ Failed to connect to Qdrant Cloud: 401
```
**Solution:**
- Regenerate your API key in Qdrant Cloud
- Make sure you're using the correct API key
- Check that the API key has the right permissions

### Debug Commands

#### Test Qdrant Connection
```bash
node -e "
const { QdrantClient } = require('@qdrant/js-client-rest');
const client = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY
});
client.getCollections().then(console.log).catch(console.error);
"
```

#### Check Collection Status
```bash
node -e "
const { QdrantClient } = require('@qdrant/js-client-rest');
const client = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY
});
client.getCollection('documents').then(console.log).catch(console.error);
"
```

## Performance Tips

### Optimize for Speed
1. **Use appropriate similarity thresholds**: Higher thresholds = faster searches
2. **Limit Top-K**: Don't request more results than you need
3. **Batch operations**: Use bulk operations for multiple documents

### Optimize for Quality
1. **Choose the right embedding model**: `text-embedding-004` provides good quality
2. **Tune similarity thresholds**: Find the sweet spot for your use case
3. **Use metadata filtering**: Narrow down results with metadata queries

## Advanced Configuration

### Custom Collection Configuration

```javascript
// Create collection with custom configuration
await client.createCollection('documents', {
  vectors: {
    size: 768,
    distance: 'Cosine'
  },
  optimizers_config: {
    default_segment_number: 2,
    indexing_threshold: 10000
  }
});
```

### Metadata Filtering

```javascript
// Search with metadata filters
const results = await client.search('documents', {
  vector: embedding,
  limit: 5,
  filter: {
    must: [
      {
        key: 'metadata.category',
        match: { value: 'technical' }
      }
    ]
  }
});
```

## Next Steps

Once your Qdrant Cloud is set up:

1. **Add documents** using the chatbot's ingestion features
2. **Test RAG functionality** by asking questions
3. **Monitor performance** and adjust parameters as needed
4. **Scale up** your cluster if you have lots of documents

Your chatbot now has full RAG capabilities powered by Qdrant Cloud! 🎉
