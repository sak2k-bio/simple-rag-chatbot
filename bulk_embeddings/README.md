# 🚀 Bulk PDF Embeddings - Production Ready

This folder contains production-ready scripts for bulk processing PDFs with optimized chunking and paragraph awareness.

## 📁 Contents

- **`bulk-pdf-processor-optimized.js`** - Main bulk PDF processing script with advanced features
- **`web-ui/`** - Web interface for easy management and monitoring
- **`Dockerfile`** - Docker configuration for containerized deployment
- **`docker-compose.yml`** - Complete stack with Qdrant database
- **`package.json`** - Dependencies and scripts
- **`env.example`** - Environment variables template
- **`setup.sh`** - Automated setup script for Linux/Mac
- **`setup.bat`** - Automated setup script for Windows
- **`start-ollama-gpu.sh`** - GPU-optimized Ollama startup (Linux/Mac)
- **`start-ollama-gpu.bat`** - GPU-optimized Ollama startup (Windows)
- **`README.md`** - This comprehensive guide

## 🎯 What This Does

The bulk PDF processor is designed for **production-scale PDF ingestion** with:

### ✨ **Advanced Features:**
- 🧠 **Optimal Chunking** - 800-1200 character chunks with semantic boundaries
- 📄 **Paragraph Awareness** - Respects document structure (paragraphs, sentences, words)
- 🔄 **Resume Capability** - Can resume interrupted processing sessions
- 📊 **Progress Tracking** - Real-time progress updates and statistics
- 🛡️ **Error Handling** - Robust error handling with retry logic
- 💾 **Manifest Database** - SQLite database tracks processed files
- ⚡ **Concurrent Processing** - Parallel processing with configurable concurrency
- 🏷️ **Rich Metadata** - Enhanced metadata extraction for medical content
- 🦙 **Dual Embedding Support** - Google AI (cloud) or Ollama (local, privacy-focused)

### 🎯 **Optimized for Medical Content:**
- ✅ **Medical Term Detection** - Automatically extracts relevant medical terms
- ✅ **Page Number Extraction** - Preserves page references
- ✅ **Chapter/Section Parsing** - Extracts document structure
- ✅ **Flexible Embeddings** - Google AI or local Ollama models

## 🚀 Quick Start

### Option 1: Docker (Recommended)

**Easiest way to get started with a complete setup:**

#### 🚀 **Quick Setup (Automated):**
```bash
# 1. Navigate to the bulk_embeddings directory
cd bulk_embeddings

# 2. Run the setup script
# On Linux/Mac:
chmod +x setup.sh && ./setup.sh

# On Windows:
setup.bat
```

#### 🔧 **Manual Setup:**
```bash
# 1. Clone and navigate to the bulk_embeddings directory
cd bulk_embeddings

# 2. Copy environment template
cp env.example .env.local

# 3. Edit .env.local with your API keys
# Add your GOOGLE_API_KEY and other settings

# 4. Start the complete stack (includes Qdrant)
docker-compose up -d

# 5. Open web UI at http://localhost:3001
# Upload PDFs and start processing!
```

### Option 2: Manual Setup

**For development or custom configurations:**

1. **Environment Setup:**
   ```bash
   # Copy environment template
   cp env.example .env.local
   
   # Edit .env.local with your settings:
   GOOGLE_API_KEY=your_google_api_key
   QDRANT_URL=http://localhost:6333
   QDRANT_API_KEY=your_qdrant_api_key
   QDRANT_COLLECTION=pulmo_fishman
   ```

2. **Dependencies:**
   ```bash
   npm install
   ```

3. **Start Qdrant (if not using Docker):**
   ```bash
   docker run -p 6333:6333 qdrant/qdrant:latest
   ```

4. **Start Web UI:**
   ```bash
   npm start
   # Open http://localhost:3001
   ```

### Option 3: Command Line Only

```bash
# Process all PDFs in a directory
node bulk-pdf-processor-optimized.js "C:\path\to\your\pdfs"
```

## 🖥️ Web UI Features

The included web interface provides a user-friendly way to manage bulk PDF processing:

### ✨ **Key Features:**
- 📁 **Drag & Drop Upload** - Easy PDF file uploads
- ⚙️ **Visual Configuration** - Adjust processing settings with sliders and inputs
- 📊 **Real-time Monitoring** - Live progress tracking and statistics
- 📋 **Processing Logs** - Detailed logs with timestamps
- 🎯 **Collection Stats** - View Qdrant collection information
- 🛑 **Process Control** - Start, stop, and monitor processing jobs
- 📱 **Responsive Design** - Works on desktop and mobile devices

### 🎯 **Web UI Workflow:**
1. **Upload PDFs** - Drag & drop or browse for PDF files
2. **Configure Settings** - Adjust chunk size, concurrency, batch sizes
3. **Start Processing** - Click "Start Processing" to begin
4. **Monitor Progress** - Watch real-time progress and logs
5. **View Results** - Check collection statistics and processing results

### 🌐 **Access the Web UI:**
- **Docker:** http://localhost:3001
- **Manual:** http://localhost:3001 (after running `npm start`)

## 🦙 Embedding Providers

The system supports two embedding providers for maximum flexibility:

### 🔍 **Google AI (Cloud-based)**
- **Model:** `text-embedding-004`
- **Dimensions:** 768
- **Pros:** High quality, fast, reliable
- **Cons:** Requires API key, data sent to Google
- **Best for:** Production environments, high-volume processing

### 🦙 **Ollama (Local, Privacy-focused)**
- **Model:** `nomic-embed-text` (recommended)
- **Dimensions:** 768
- **Pros:** Completely local, no API costs, privacy-focused, GPU acceleration
- **Cons:** Requires local setup, GPU setup complexity
- **Best for:** Privacy-sensitive environments, offline processing, GPU-accelerated processing

### 🚀 **Setting up Ollama with GPU Acceleration:**

1. **Install Ollama:**
   ```bash
   # Visit https://ollama.ai for installation instructions
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

2. **Install the embedding model:**
   ```bash
   ollama pull nomic-embed-text
   ```

3. **Start Ollama with GPU acceleration:**
   ```bash
   # Option 1: Use the provided startup script (recommended)
   ./start-ollama-gpu.sh    # Linux/Mac
   start-ollama-gpu.bat     # Windows
   
   # Option 2: Manual startup
   OLLAMA_GPU_LAYERS=20 ollama serve
   ```

4. **Configure environment:**
   ```bash
   # In your .env.local file:
   EMBEDDING_PROVIDER=ollama
   OLLAMA_URL=http://localhost:11434
   OLLAMA_MODEL=nomic-embed-text
   
   # GPU-optimized settings
   BULK_CONCURRENCY=8
   BULK_EMBED_BATCH=32
   OLLAMA_GPU_LAYERS=20
   OLLAMA_NUM_CTX=2048
   OLLAMA_NUM_BATCH=512
   ```
-----
GPU Configuration:
options: {
  num_gpu: 1,           // Use 1 GPU
  num_ctx: 2048,        // Context window
  num_batch: 512,       // GPU batch size
  num_thread: 4,        // CPU preprocessing threads
  use_mmap: true,       // Memory mapping
  use_mlock: true       // Lock memory
}

----


### 🚀 **GPU Performance Optimization:**

#### **For 12GB VRAM (Your Setup) - Large Scale Processing:**
- **Concurrency:** 12 (increased for 5000+ PDFs)
- **Embed Batch:** 50 (optimized for large-scale processing)
- **Upsert Batch:** 200 (increased for efficiency)
- **GPU Layers:** 20 (utilizes most of your VRAM)
- **Context Window:** 2048 (optimal for embeddings)
- **Batch Size:** 512 (GPU processing batch)
- **File Limit:** 5000 PDFs per upload

#### **Expected Performance:**
- **Speed:** 3-5x faster than CPU-only Ollama
- **Throughput:** ~100-200 texts/second (vs ~10-30 CPU-only)
- **Memory Usage:** ~8-10GB VRAM utilization
- **Processing Time:** 1000 PDFs in ~2-4 hours (vs 8-12 hours CPU-only)
- **Large Scale:** Supports 5000+ PDFs in a single batch

### 🎯 **Web UI Configuration:**
The web interface allows you to switch between providers and configure Ollama settings:
- Select embedding provider (Google AI or Ollama)
- Configure Ollama URL and model
- Test Ollama connection status
- View available models

### Example Commands

```bash
# Process with Google AI embeddings (default)
node bulk_embeddings/bulk-pdf-processor-optimized.js "C:\Users\User\Desktop\medical_pdfs"

# Process with Ollama embeddings (local, privacy-focused)
EMBEDDING_PROVIDER=ollama node bulk_embeddings/bulk-pdf-processor-optimized.js "C:\Users\User\Desktop\medical_pdfs"

# Process with custom Ollama model
EMBEDDING_PROVIDER=ollama OLLAMA_MODEL=mxbai-embed-large node bulk_embeddings/bulk-pdf-processor-optimized.js "C:\data\pdfs"

# Process with custom settings (via environment variables)
BULK_CONCURRENCY=8 OPTIMAL_CHUNK_SIZE=1200 node bulk_embeddings/bulk-pdf-processor-optimized.js "C:\data\pdfs"
```

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EMBEDDING_PROVIDER` | `google` | Embedding provider: `google` or `ollama` |
| `GOOGLE_API_KEY` | *required* | Google AI API key (when using Google) |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server URL (when using Ollama) |
| `OLLAMA_MODEL` | `nomic-embed-text` | Ollama embedding model |
| `BULK_CONCURRENCY` | `12` | Number of files to process simultaneously (large-scale optimized) |
| `BULK_EMBED_BATCH` | `50` | Number of texts to embed in one batch (large-scale optimized) |
| `BULK_UPSERT_BATCH` | `200` | Number of vectors to upsert in one batch (large-scale optimized) |
| `OPTIMAL_CHUNK_SIZE` | `1000` | Target chunk size in characters |
| `OPTIMAL_CHUNK_OVERLAP` | `200` | Overlap between chunks in characters |
| `OLLAMA_GPU_LAYERS` | `20` | GPU layers for 12GB VRAM optimization |
| `OLLAMA_NUM_CTX` | `2048` | Context window size |
| `OLLAMA_NUM_BATCH` | `512` | GPU batch processing size |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant server URL |
| `QDRANT_COLLECTION` | `pulmo_fishman` | Collection name |

### Performance Tuning

#### For Large Datasets (1000+ PDFs):
```bash
# Higher concurrency, larger batches
BULK_CONCURRENCY=12 BULK_EMBED_BATCH=100 BULK_UPSERT_BATCH=200 node bulk_embeddings/bulk-pdf-processor-optimized.js "C:\large_pdf_collection"
```

#### For High-Quality Chunking:
```bash
# Larger chunks with more overlap
OPTIMAL_CHUNK_SIZE=1200 OPTIMAL_CHUNK_OVERLAP=300 node bulk_embeddings/bulk-pdf-processor-optimized.js "C:\medical_pdfs"
```

#### For Fast Processing:
```bash
# Smaller chunks, higher concurrency
OPTIMAL_CHUNK_SIZE=800 BULK_CONCURRENCY=8 node bulk_embeddings/bulk-pdf-processor-optimized.js "C:\pdfs"
```

## 📊 Monitoring & Progress

### Real-Time Progress
The script provides detailed progress updates:
```
[2025-01-03T23:13:45.123Z] ℹ️ 📈 Progress: 45.2% (23/51) - medical_textbook_chapter_5.pdf - Elapsed: 180s
[2025-01-03T23:13:46.456Z] ℹ️ ✅ Successfully processed: medical_textbook_chapter_5.pdf (47 optimized chunks)
```

### Manifest Database
The script creates `bulk_manifest_optimized.db` to track:
- ✅ **Completed files** - Successfully processed
- ❌ **Failed files** - With error messages
- ⏭️ **Skipped files** - Already processed (unchanged)
- 📊 **Statistics** - Total chunks, processing time, etc.

### Resume Capability
If processing is interrupted, simply run the same command again:
- ✅ **Already processed files** are automatically skipped
- 🔄 **Failed files** are retried
- 📈 **Progress continues** from where it left off

## 🎯 Chunking Strategy

### Semantic Boundary Detection
The script uses intelligent chunking that respects document structure:

1. **Paragraph Boundaries** (Priority 1)
   - Breaks at `\n\n` (double newlines)
   - Preserves paragraph structure

2. **Sentence Boundaries** (Priority 2)
   - Breaks at `.` (periods)
   - Maintains sentence integrity

3. **Word Boundaries** (Priority 3)
   - Breaks at spaces
   - Avoids splitting words

### Chunk Size Optimization
- **Target Size:** 800-1200 characters
- **Overlap:** 200 characters between chunks
- **Minimum Size:** 50 characters (filters out tiny chunks)

### Example Chunking:
```
Original Text: "Asthma is a chronic inflammatory disease of the airways. 
It affects millions of people worldwide. The condition is characterized by 
recurrent episodes of wheezing, breathlessness, chest tightness, and coughing."

Chunk 1: "Asthma is a chronic inflammatory disease of the airways. 
It affects millions of people worldwide. The condition is characterized by 
recurrent episodes of wheezing, breathlessness, chest tightness, and coughing."

Chunk 2: "The condition is characterized by recurrent episodes of wheezing, 
breathlessness, chest tightness, and coughing. [Next paragraph content...]"
```

## 🏷️ Metadata Extraction

### Automatic Medical Term Detection
The script automatically extracts medical terms from each chunk:

```javascript
const medicalTerms = [
  'asthma', 'copd', 'pneumonia', 'cancer', 'treatment', 'diagnosis', 
  'symptoms', 'therapy', 'medication', 'lung', 'respiratory', 'pulmonary',
  'bronchitis', 'emphysema', 'fibrosis', 'tuberculosis', 'covid', 
  'influenza', 'pneumothorax', 'pleural', 'alveolar', 'bronchial', 
  'tracheal', 'ventilation', 'oxygenation'
];
```

### Document Structure Parsing
Extracts from filename patterns:
- **Page Numbers:** `Page_804_` → `pageNumber: 804`
- **Chapters:** `CHAPTER_74_` → `chapterNumber: 74, chapterTitle: "Pulmonary Vasculitis"`
- **Parts:** `PART_4_` → `partNumber: 4, partTitle: "Obstructive Lung Diseases"`

### Rich Metadata Example
```json
{
  "source": "C:\\pdfs\\Page_804_PART_4_Obstructive_Lung_Diseases.pdf",
  "pageNumber": 804,
  "chapterNumber": 74,
  "chapterTitle": "Pulmonary Vasculitis",
  "partNumber": 4,
  "partTitle": "Obstructive Lung Diseases",
  "keyTerms": ["asthma", "pulmonary", "respiratory", "treatment"],
  "chunkIndex": 2,
  "totalChunks": 15,
  "chunkLength": 1150,
  "optimized": true,
  "timestamp": "2025-01-03T23:13:45.123Z"
}
```

## 🔧 Troubleshooting

### Common Issues

#### 1. **"Google Generative AI API key is missing"**
```bash
# Solution: Add to .env.local
echo "GOOGLE_API_KEY=your_actual_api_key" >> .env.local
```

#### 2. **"No PDF files found in directory"**
```bash
# Check directory path and file extensions
ls "C:\path\to\pdfs"  # Should show .pdf files
```

#### 3. **"Qdrant connection failed"**
```bash
# Check Qdrant is running
curl http://localhost:6333/collections
```

#### 4. **"Embedding failed"**
```bash
# Check API key and rate limits
# Reduce BULK_EMBED_BATCH size
BULK_EMBED_BATCH=25 node bulk_embeddings/bulk-pdf-processor-optimized.js "C:\pdfs"
```

### Performance Issues

#### Slow Processing
```bash
# Increase concurrency
BULK_CONCURRENCY=8 node bulk_embeddings/bulk-pdf-processor-optimized.js "C:\pdfs"
```

#### Memory Issues
```bash
# Reduce batch sizes
BULK_EMBED_BATCH=25 BULK_UPSERT_BATCH=50 node bulk_embeddings/bulk-pdf-processor-optimized.js "C:\pdfs"
```

#### API Rate Limits
```bash
# Reduce concurrency and batch sizes
BULK_CONCURRENCY=3 BULK_EMBED_BATCH=20 node bulk_embeddings/bulk-pdf-processor-optimized.js "C:\pdfs"
```

## 📈 Performance Benchmarks

### Typical Performance (on modern hardware):
- **Small PDFs (1-5 pages):** ~2-5 seconds per file
- **Medium PDFs (10-50 pages):** ~10-30 seconds per file
- **Large PDFs (100+ pages):** ~1-3 minutes per file

### Throughput Examples:
- **100 small PDFs:** ~5-10 minutes
- **50 medium PDFs:** ~15-30 minutes
- **20 large PDFs:** ~30-60 minutes

### Memory Usage:
- **Base memory:** ~100-200 MB
- **Per concurrent file:** ~50-100 MB
- **Peak memory:** ~500 MB - 1 GB (depending on concurrency)

## 🔄 Workflow Examples

### 1. **Initial Bulk Processing**
```bash
# First time processing a large collection
node bulk_embeddings/bulk-pdf-processor-optimized.js "C:\medical_library"
```

### 2. **Adding New PDFs**
```bash
# Add new PDFs to existing collection
node bulk_embeddings/bulk-pdf-processor-optimized.js "C:\new_medical_pdfs"
```

### 3. **Reprocessing with Better Settings**
```bash
# Delete manifest database to force reprocessing
rm bulk_manifest_optimized.db
OPTIMAL_CHUNK_SIZE=1200 node bulk_embeddings/bulk-pdf-processor-optimized.js "C:\pdfs"
```

### 4. **Production Deployment**
```bash
# Production settings for large-scale processing
BULK_CONCURRENCY=8 BULK_EMBED_BATCH=100 BULK_UPSERT_BATCH=200 \
OPTIMAL_CHUNK_SIZE=1000 OPTIMAL_CHUNK_OVERLAP=200 \
node bulk_embeddings/bulk-pdf-processor-optimized.js "C:\production_pdfs"
```

## 🎯 Best Practices

### 1. **File Organization**
- Organize PDFs in logical folder structures
- Use descriptive filenames with page numbers
- Keep related documents together

### 2. **Processing Strategy**
- Start with a small test batch
- Monitor progress and adjust settings
- Use resume capability for large datasets

### 3. **Quality Control**
- Check manifest database for errors
- Verify chunk quality with sample queries
- Monitor embedding consistency

### 4. **Performance Optimization**
- Adjust concurrency based on system resources
- Use appropriate batch sizes for your API limits
- Consider chunk size vs. retrieval quality trade-offs

## 🔗 Integration with RAG System

After processing, your PDFs are ready for the RAG system:

```javascript
// The processed chunks are automatically available in your Qdrant collection
// with optimized metadata for better retrieval

// Example query in your RAG system:
const results = await client.search(collectionName, {
  vector: queryEmbedding,
  limit: 10,
  filter: {
    must: [
      { key: "metadata.keyTerms", match: { value: "asthma" } },
      { key: "metadata.pageNumber", range: { gte: 800, lte: 900 } }
    ]
  }
});
```

## 🛠️ Troubleshooting

### Docker Issues

#### **Build Error: "src: not found"**
This error occurs when the Dockerfile tries to copy non-existent directories. **Fixed in current version:**

```bash
# The Dockerfile now correctly copies only the bulk_embeddings files
# No more src/ directory dependency
```

#### **Build Error: "npm ci --only=production"**
This error occurs with newer npm versions where `--only=production` is deprecated. **Fixed in current version:**

```bash
# Updated to use the modern npm syntax without package-lock.json dependency
RUN npm install --omit=dev --no-package-lock
```

#### **Runtime Error: "Cannot find module '/app/bulk_embeddings/web-ui/server.js'"**
This error occurs when the Docker CMD path doesn't match the copied file structure. **Fixed in current version:**

```bash
# Updated CMD to use correct path after COPY . ./
CMD ["node", "web-ui/server.js"]
```

#### **Upload Error: "MulterError: Unexpected field"**
This error occurs when uploading many files or large files. **Fixed in current version:**

```bash
# Updated Multer limits for large-scale processing
limits: {
  fileSize: 100 * 1024 * 1024, // 100MB per file
  files: 5000, // Allow up to 5000 files
  fieldSize: 10 * 1024 * 1024, // 10MB field size
  fieldNameSize: 1000, // 1000 characters for field name
  parts: 10000 // Allow up to 10000 parts
}
```

#### **Qdrant Connection Issues**
**Warning: "Api key is used with unsecure connection"**
This is just a warning for local development. **Fixed in current version:**

```bash
# For local development, leave QDRANT_API_KEY empty
# QDRANT_API_KEY=  # Comment out or leave empty
```

**Error: "Failed to obtain server version"**
This occurs when Qdrant client can't verify version compatibility. **Fixed in current version:**

```bash
# Added checkCompatibility: false to QdrantClient
const client = new QdrantClient({
  url: QDRANT_URL,
  apiKey: QDRANT_API_KEY,
  checkCompatibility: false // Skip version compatibility check
});
```

#### **Volume Mount Issues**
If you encounter volume mounting problems:

```bash
# Ensure directories exist
mkdir -p data uploads manifests

# Check file permissions (Linux/Mac)
chmod 755 data uploads manifests
```

#### **GPU Support in Docker**
For GPU acceleration with Ollama in Docker:

```bash
# Add to docker-compose.yml under bulk-processor service:
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1
          capabilities: [gpu]
```

### Ollama Issues

#### **GPU Not Detected**
```bash
# Check if Ollama can see your GPU
ollama ps

# Start with explicit GPU layers
OLLAMA_GPU_LAYERS=20 ollama serve
```

#### **Model Not Found**
```bash
# Install the embedding model
ollama pull nomic-embed-text

# List available models
ollama list
```

### Performance Issues

#### **Slow Processing**
- **Check GPU utilization:** `nvidia-smi` (if using GPU)
- **Reduce concurrency:** Lower `BULK_CONCURRENCY` to 4-6
- **Smaller batches:** Reduce `BULK_EMBED_BATCH` to 16-24

#### **Memory Issues**
- **Reduce GPU layers:** Lower `OLLAMA_GPU_LAYERS` to 10-15
- **Smaller context:** Reduce `OLLAMA_NUM_CTX` to 1024
- **Close other applications** using GPU memory

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the manifest database for error details
3. Check your environment variables and API keys
4. Verify Qdrant connection and collection status
5. Test Docker setup: `node test-docker-setup.js`

---

**🎉 Happy Processing!** This tool is designed to make bulk PDF processing efficient, reliable, and optimized for medical content retrieval with GPU acceleration.
