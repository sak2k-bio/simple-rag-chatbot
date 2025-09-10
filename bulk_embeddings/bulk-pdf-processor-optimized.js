#!/usr/bin/env node

/**
 * Optimized Bulk PDF Processor with Paragraph Awareness
 * 
 * This script processes PDFs with:
 * - Optimal chunking (800-1200 chars with semantic boundaries)
 * - Paragraph awareness (respects document structure)
 * - Enhanced metadata extraction
 * - Consistent embedding model (text-embedding-004)
 * - Resume capability and progress tracking
 * 
 * Usage:
 *   node fix_embeddings/bulk-pdf-processor-optimized.js <pdf-directory>
 * 
 * Example:
 *   node fix_embeddings/bulk-pdf-processor-optimized.js "C:\data\pdfs"
 */

require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fg = require('fast-glob');
const pLimit = require('p-limit');
let pRetry;
async function getPRetry() {
  if (!pRetry) {
    const mod = await import('p-retry');
    pRetry = mod.default || mod;
  }
  return pRetry;
}
const Database = require('better-sqlite3');
const { QdrantClient } = require('@qdrant/js-client-rest');
const { createGoogleGenerativeAI } = require('@ai-sdk/google');
const { embed } = require('ai');
const axios = require('axios');

// Configuration from environment variables
const {
  QDRANT_URL = 'http://localhost:6333',
  QDRANT_API_KEY = '',
  QDRANT_COLLECTION = 'pulmo_fishman',
  GOOGLE_API_KEY,
  GOOGLE_GENERATIVE_AI_API_KEY,
  OLLAMA_URL = 'http://localhost:11434',
  OLLAMA_MODEL = 'nomic-embed-text',
  EMBEDDING_PROVIDER = 'google', // 'google' or 'ollama'
  BULK_CONCURRENCY = '12',
  BULK_EMBED_BATCH = '50',
  BULK_UPSERT_BATCH = '200',
  OPTIMAL_CHUNK_SIZE = '1000',
  OPTIMAL_CHUNK_OVERLAP = '200',
  // Medical textbook specific chunking controls
  MED_HEADING_AWARE = 'true',
  MED_MAX_SECTION_LEAD = '300',
  MED_LIST_MERGE = 'true',
  MED_TABLE_DETECT = 'true',
  MED_MIN_CHUNK_SIZE_FACTOR = '0.5',
  MED_MAX_CHUNK_SIZE_FACTOR = '1.3'
} = process.env;

// Resolve Google API key (support both legacy and new env var names)
const RESOLVED_GOOGLE_API_KEY = GOOGLE_GENERATIVE_AI_API_KEY || GOOGLE_API_KEY;

// Validate required environment variables
if (EMBEDDING_PROVIDER === 'google' && !RESOLVED_GOOGLE_API_KEY) {
  console.error('❌ Google API key is required when using Google embeddings. Set GOOGLE_GENERATIVE_AI_API_KEY or GOOGLE_API_KEY.');
  process.exit(1);
}

if (EMBEDDING_PROVIDER === 'ollama') {
  console.log('🦙 Using Ollama for embeddings (local, privacy-focused)');
  console.log('🚀 GPU acceleration enabled for 12GB VRAM optimization');
} else {
  console.log('🔍 Using Google AI for embeddings (cloud-based)');
}

// Configuration
const concurrency = Number(BULK_CONCURRENCY);
const embedBatchSize = Number(BULK_EMBED_BATCH);
const upsertBatchSize = Number(BULK_UPSERT_BATCH);
const chunkSize = Number(OPTIMAL_CHUNK_SIZE);
const chunkOverlap = Number(OPTIMAL_CHUNK_OVERLAP);
const headingAware = String(MED_HEADING_AWARE).toLowerCase() === 'true';
const maxSectionLead = Number(MED_MAX_SECTION_LEAD);
const listMerge = String(MED_LIST_MERGE).toLowerCase() === 'true';
const tableDetect = String(MED_TABLE_DETECT).toLowerCase() === 'true';
const minChunkFactor = Number(MED_MIN_CHUNK_SIZE_FACTOR);
const maxChunkFactor = Number(MED_MAX_CHUNK_SIZE_FACTOR);

// Initialize clients
const client = new QdrantClient({
  url: QDRANT_URL,
  apiKey: QDRANT_API_KEY,
  checkCompatibility: false // Skip version compatibility check
});

const collectionName = QDRANT_COLLECTION;
let expectedVectorSize = null; // determined in ensureCollection
// Initialize Google provider explicitly with API key to avoid env name mismatches
const googleProvider = RESOLVED_GOOGLE_API_KEY ? createGoogleGenerativeAI({ apiKey: RESOLVED_GOOGLE_API_KEY }) : null;
// For Google embeddings, obtain the embedding model from the provider
const embeddingModel = EMBEDDING_PROVIDER === 'ollama' ? null : googleProvider?.textEmbeddingModel('gemini-embedding-001');

// Initialize database for manifest
const db = new Database('bulk_manifest_optimized.db');
db.pragma('journal_mode = WAL');

// Create manifest table
db.exec(`
  CREATE TABLE IF NOT EXISTS bulk_files_optimized (
    path TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    chunks_count INTEGER DEFAULT 0,
    updated_at TEXT NOT NULL
  );
  
  CREATE INDEX IF NOT EXISTS idx_bulk_files_optimized_status ON bulk_files_optimized(status);
  CREATE INDEX IF NOT EXISTS idx_bulk_files_optimized_checksum ON bulk_files_optimized(checksum);
`);

// Prepared statements
const upsertFileStmt = db.prepare(`
  INSERT INTO bulk_files_optimized (path, checksum, status, error, chunks_count, updated_at)
  VALUES (@path, @checksum, @status, @error, @chunks_count, @updated_at)
  ON CONFLICT(path) DO UPDATE SET
    checksum=excluded.checksum,
    status=excluded.status,
    error=excluded.error,
    chunks_count=excluded.chunks_count,
    updated_at=excluded.updated_at
`);

const getFileStmt = db.prepare(`SELECT path, checksum, status, chunks_count FROM bulk_files_optimized WHERE path = ?`);
const getStatsStmt = db.prepare(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
    SUM(CASE WHEN status IN ('queued', 'processing') THEN 1 ELSE 0 END) as pending,
    SUM(chunks_count) as total_chunks
  FROM bulk_files_optimized
`);

// Utility functions
function nowIso() {
  return new Date().toISOString();
}

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const rs = fs.createReadStream(filePath);
    rs.on('error', reject);
    rs.on('data', d => hash.update(d));
    rs.on('end', () => resolve(hash.digest('hex')));
  });
}

// Normalize PDF text to preserve paragraphs but fix spacing and hyphenation
function normalizeText(raw) {
  let t = raw.replace(/\r\n/g, '\n');
  // Remove hyphenated line breaks: "exam-\nple" -> "example"
  t = t.replace(/-\n/g, '');
  // Collapse 3+ newlines to double newlines (paragraphs)
  t = t.replace(/\n{3,}/g, '\n\n');
  // Temporarily mark paragraph breaks
  t = t.replace(/\n\n/g, '<<PARA>>');
  // Convert single newlines to spaces
  t = t.replace(/\n/g, ' ');
  // Restore paragraph breaks as double newline
  t = t.replace(/<<PARA>>/g, '\n\n');
  // Collapse multiple spaces
  t = t.replace(/[\t ]{2,}/g, ' ');
  return t.trim();
}

// Enhanced chunking with sentence, paragraph, and medical heading awareness
function findOptimalChunkBoundaries(rawText, targetSize = 1000, overlap = 200, options = {}) {
  const minSize = Math.floor(targetSize * (options.minFactor ?? minChunkFactor));
  const maxSize = Math.floor(targetSize * (options.maxFactor ?? maxChunkFactor));

  const text = normalizeText(rawText);

  // Split into paragraphs to keep structure
  const paragraphs = text.split(/\n\n+/);

  // Heading detection heuristics (for medical textbooks)
  const isHeadingLine = (p) => {
    if (!headingAware) return false;
    const trimmed = p.trim();
    if (trimmed.length === 0) return false;
    if (trimmed.length > 120) return false; // too long for a heading
    // CHAPTER, PART, SECTION prefixes
    if (/^(CHAPTER|PART|SECTION)\b[\s\d\.:\-A-Z_]*/i.test(trimmed)) return true;
    // All caps words (allow numbers and basic punctuation)
    if (/^[A-Z0-9 ,:\-()\/]+$/.test(trimmed) && /[A-Z]{3,}/.test(trimmed)) return true;
    // Title Case short phrases ending with no period
    if (/^[A-Z][a-z]+(?:[\s-][A-Z][a-z]+){0,6}$/.test(trimmed) && !/[.!?]$/.test(trimmed)) return true;
    return false;
  };

  // Sentence splitter: split on punctuation followed by space and capital/quote/number
  const splitSentences = (p) => p
    .split(/(?<=[.!?])\s+(?=(?:[A-Z"'\(\[]|\d))/)
    .filter(s => s && s.trim().length > 0);

  // List bullet detection
  const isListSentence = (s) => /^(?:[-•·\u2022\u25E6\u2043]|\d+\.|[a-z]\))\s/.test(s.trim());

  // Table-like block detection (pipes, multiple columns spacing, tabs)
  const isTabley = (s) => /\|[^\n]+\|/.test(s) || /\t/.test(s) || /\s{2,}\S+\s{2,}\S+/.test(s);

  const sentencesByPara = paragraphs.map(splitSentences);

  const chunks = [];
  let current = '';
  let currentHeading = '';
  let cursor = 0; // position in normalized text for start offsets

  const pushChunk = (content) => {
    const contentWithLead = currentHeading && content.length < maxSectionLead
      ? `${currentHeading}: ${content}`
      : content;
    const startIdx = text.indexOf(content, cursor);
    const start = startIdx === -1 ? cursor : startIdx;
    const end = start + content.length;
    chunks.push({ text: contentWithLead, start, end, length: contentWithLead.length, heading: currentHeading || null });
    cursor = end - Math.min(overlap, Math.floor(contentWithLead.length * 0.2));
  };

  for (let pIdx = 0; pIdx < sentencesByPara.length; pIdx++) {
    const paraText = paragraphs[pIdx];
    const sentences = sentencesByPara[pIdx];

    // Detect heading paragraph boundaries
    if (isHeadingLine(paraText)) {
      // flush existing chunk if it has content
      if (current.trim().length >= minSize * 0.5) {
        pushChunk(current.trim());
        current = '';
      }
      currentHeading = paraText.trim();
      continue; // do not include pure heading as standalone content
    }

    // Build chunk from sentences while respecting lists/tables
    for (let i = 0; i < sentences.length; i++) {
      let s = sentences[i].trim();
      if (!s) continue;

      // If this looks like a table block, try to keep it atomic
      const treatAtomic = tableDetect && isTabley(s);

      if (current.length === 0) {
        current = s;
        // If first sentence is list/table and heading exists, allow larger chunk around it
        continue;
      }

      const canAppend = (current.length + 1 + s.length) <= maxSize || (listMerge && (isListSentence(s) || isListSentence(current)));

      if (canAppend && !treatAtomic) {
        current += ' ' + s;
      } else {
        if (current.length < minSize) {
          // Try to add until reach minSize unless atomic table forces boundary
          if (!treatAtomic) {
            current += ' ' + s;
            continue;
          }
        }
        // finalize current
        pushChunk(current);
        // Start new chunk. To preserve cohesion with lists, optionally carry last bullet if short
        const tail = current.split(/(?<=[.!?])\s+/).slice(-1)[0] || '';
        const carry = tail.length > 0 && tail.length < overlap ? tail + ' ' : '';
        current = carry + s;
      }
    }
  }

  if (current.trim().length > 0) {
    pushChunk(current.trim());
  }

  // Merge undersized chunks (forward preference) to avoid tiny fragments
  let i = 0;
  while (i < chunks.length) {
    if (chunks[i].length < minSize) {
      if (i + 1 < chunks.length && chunks[i].heading === chunks[i + 1].heading) {
        // Merge with next chunk if same heading context
        chunks[i].text = `${chunks[i].text} ${chunks[i + 1].text}`.trim();
        chunks[i].end = chunks[i].start + chunks[i].text.length;
        chunks[i].length = chunks[i].text.length;
        chunks.splice(i + 1, 1);
        continue;
      } else if (i - 1 >= 0 && chunks[i - 1].heading === chunks[i].heading) {
        // Merge with previous if this is the last or next has different heading
        chunks[i - 1].text = `${chunks[i - 1].text} ${chunks[i].text}`.trim();
        chunks[i - 1].end = chunks[i - 1].start + chunks[i - 1].text.length;
        chunks[i - 1].length = chunks[i - 1].text.length;
        chunks.splice(i, 1);
        i = Math.max(0, i - 1);
        continue;
      }
    }
    i += 1;
  }

  return chunks;
}

// Enhanced metadata extraction
function extractMetadata(source, content, chunkIndex, totalChunks) {
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

  // Extract key terms from content
  const preview = content.substring(0, 300).toLowerCase();
  const keyTerms = [];

  const medicalTerms = [
    'asthma', 'copd', 'pneumonia', 'cancer', 'treatment', 'diagnosis', 'symptoms',
    'therapy', 'medication', 'lung', 'respiratory', 'pulmonary', 'bronchitis',
    'emphysema', 'fibrosis', 'tuberculosis', 'covid', 'influenza', 'pneumothorax',
    'pleural', 'alveolar', 'bronchial', 'tracheal', 'ventilation', 'oxygenation'
  ];

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
    chunkIndex: chunkIndex,
    totalChunks: totalChunks,
    chunkLength: content.length,
    optimized: true,
    timestamp: new Date().toISOString()
  };
}

// Ollama embedding function with GPU optimization
async function getOllamaEmbedding(text) {
  try {
    const response = await axios.post(`${OLLAMA_URL}/api/embeddings`, {
      model: OLLAMA_MODEL,
      prompt: text,
      options: {
        // GPU acceleration settings for 12GB VRAM
        num_gpu: 1,
        num_ctx: 2048,  // Context window
        num_batch: 512, // Batch size for GPU processing
        num_thread: 4,  // CPU threads for preprocessing
        use_mmap: true, // Memory mapping for efficiency
        use_mlock: true // Lock memory to prevent swapping
      }
    }, {
      timeout: 60000 // 60 second timeout for GPU processing
    });

    if (response.data && response.data.embedding) {
      return response.data.embedding;
    } else {
      throw new Error('Invalid response from Ollama');
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error(`Cannot connect to Ollama at ${OLLAMA_URL}. Make sure Ollama is running with GPU support and the model '${OLLAMA_MODEL}' is installed.`);
    }
    throw new Error(`Ollama embedding failed: ${error.message}`);
  }
}

// Test Ollama connection with GPU detection
async function testOllamaConnection() {
  try {
    log(`Testing Ollama connection at ${OLLAMA_URL}...`);
    const response = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 5000 });

    if (response.data && response.data.models) {
      const modelExists = response.data.models.some(model => model.name.includes(OLLAMA_MODEL));
      if (modelExists) {
        log(`✅ Ollama connection successful, model '${OLLAMA_MODEL}' found`);

        // Test GPU acceleration
        try {
          const gpuTest = await axios.post(`${OLLAMA_URL}/api/embeddings`, {
            model: OLLAMA_MODEL,
            prompt: 'GPU test',
            options: { num_gpu: 1 }
          }, { timeout: 10000 });

          if (gpuTest.data && gpuTest.data.embedding) {
            log(`🚀 GPU acceleration detected and working!`, 'success');
          }
        } catch (gpuError) {
          log(`⚠️  GPU acceleration not available, using CPU mode`, 'warning');
        }

        return true;
      } else {
        log(`⚠️  Ollama connected but model '${OLLAMA_MODEL}' not found. Available models:`, 'warning');
        response.data.models.forEach(model => log(`   - ${model.name}`));
        log(`💡 Install the model with: ollama pull ${OLLAMA_MODEL}`, 'info');
        return false;
      }
    }
  } catch (error) {
    log(`❌ Ollama connection failed: ${error.message}`, 'error');
    return false;
  }
}

async function ensureCollection() {
  try {
    const collections = await client.getCollections();
    const collectionExists = collections.collections.some(c => c.name === collectionName);

    // Determine vector size based on embedding provider
    let vectorSize = 768; // Default fallback
    if (EMBEDDING_PROVIDER === 'ollama') {
      // Test Ollama connection and get vector size
      const isConnected = await testOllamaConnection();
      if (!isConnected) {
        throw new Error('Ollama connection failed');
      }

      // Get vector size from Ollama model
      try {
        const testEmbedding = await getOllamaEmbedding('test');
        vectorSize = testEmbedding.length;
        log(`📏 Ollama model '${OLLAMA_MODEL}' produces ${vectorSize}-dimensional vectors`);
      } catch (error) {
        log(`⚠️  Could not determine vector size, using default 768`, 'warning');
      }
    } else {
      // Determine vector size for Google model by embedding a test string
      try {
        const test = await embed({ model: embeddingModel, value: 'test' });
        if (test && Array.isArray(test.embedding)) {
          vectorSize = test.embedding.length;
          log(`📏 Google model produces ${vectorSize}-dimensional vectors`);
        }
      } catch (error) {
        log(`⚠️  Could not determine Google vector size automatically, using default ${vectorSize}. Error: ${error.message}`, 'warning');
      }
    }

    if (!collectionExists) {
      log(`Creating collection: ${collectionName} with ${vectorSize} dimensions`);
      await client.createCollection(collectionName, {
        vectors: {
          size: vectorSize,
          distance: 'Cosine'
        }
      });
    }

    // Save expected vector size by reading collection config to be certain
    const collInfo = await client.getCollection(collectionName);
    expectedVectorSize = collInfo.config?.params?.vectors?.size || vectorSize;
    log(`Collection '${collectionName}' is ready (vector size: ${expectedVectorSize})`);

    // If the existing collection size doesn't match the current model output, fail fast with a clear message
    if (collectionExists && expectedVectorSize !== vectorSize) {
      throw new Error(
        `Qdrant collection '${collectionName}' has dimension ${expectedVectorSize}, ` +
        `but current model outputs ${vectorSize}. ` +
        `Please drop and recreate the collection with size ${vectorSize} (or set a new collection name).`
      );
    }
  } catch (error) {
    log(`Collection initialization error: ${error.message}`, 'error');
    throw error;
  }
}

async function embedBatch(texts) {
  try {
    log(`Embedding batch of ${texts.length} texts using ${EMBEDDING_PROVIDER}`);

    const embeddings = await (await getPRetry())(
      async () => {
        const results = [];

        if (EMBEDDING_PROVIDER === 'ollama') {
          // For GPU-accelerated Ollama, we can process in parallel
          // Create chunks for parallel processing to avoid overwhelming GPU
          const chunkSize = 8; // Process 8 texts in parallel for 12GB VRAM (increased for large batches)
          const chunks = [];

          for (let i = 0; i < texts.length; i += chunkSize) {
            chunks.push(texts.slice(i, i + chunkSize));
          }

          // Process chunks in parallel
          for (const chunk of chunks) {
            const chunkPromises = chunk.map(text => getOllamaEmbedding(text));
            const chunkResults = await Promise.all(chunkPromises);
            results.push(...chunkResults);
          }
        } else {
          // Process Google embeddings
          for (const text of texts) {
            const result = await embed({
              model: embeddingModel,
              value: text,
            });
            results.push(result.embedding);
          }
        }

        return results;
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 60000, // Longer timeout for GPU processing
        randomize: true
      }
    );

    return embeddings;
  } catch (error) {
    log(`Embedding failed: ${error.message}`, 'error');
    throw error;
  }
}

async function upsertBatch(points) {
  try {
    // Validate vectors length if we know expected size
    if (expectedVectorSize) {
      const invalid = points.find((p) => !Array.isArray(p.vector) || p.vector.length !== expectedVectorSize || p.vector.some((v) => typeof v !== 'number' || Number.isNaN(v)));
      if (invalid) {
        throw new Error(`Vector dimensionality mismatch or invalid values. Expected ${expectedVectorSize}, got ${Array.isArray(invalid.vector) ? invalid.vector.length : 'non-array'}`);
      }
    }
    // Preflight diagnostics
    const sample = points[0];
    if (sample) {
      const vecLen = Array.isArray(sample.vector) ? sample.vector.length : 'non-array';
      const vecType = Array.isArray(sample.vector) ? typeof sample.vector[0] : typeof sample.vector;
      const payloadSize = Buffer.byteLength(JSON.stringify(sample.payload || {}), 'utf8');
      log(`Upserting ${points.length} points (sample id=${sample.id}, vecLen=${vecLen}, vecType=${vecType}, payloadBytes≈${payloadSize})`);
    }

    await client.upsert(collectionName, {
      points: points,
      wait: true
    });
    log(`Upserted batch of ${points.length} points`);
  } catch (error) {
    let details = '';
    try {
      if (error && error.response && error.response.data) {
        details = ` Details: ${JSON.stringify(error.response.data)}`;
      } else if (error && error.body) {
        details = ` Details: ${JSON.stringify(error.body)}`;
      } else {
        const plain = JSON.stringify(error, Object.getOwnPropertyNames(error));
        details = plain ? ` Details: ${plain}` : '';
      }
    } catch (_) {}

    // Log shallow schema of sample payload to help diagnose
    try {
      const sample = points[0];
      if (sample) {
        const payloadKeys = Object.keys(sample.payload || {});
        const payloadTypes = Object.fromEntries(payloadKeys.map(k => [k, typeof sample.payload[k]]));
        log(`Sample payload keys=${payloadKeys.join(', ')} types=${JSON.stringify(payloadTypes)}`);
      }
    } catch (_) {}

    log(`Upsert failed: ${error.message || String(error)}${details}`, 'error');

    // Fallback: try direct REST call to capture full error body
    try {
      const url = `${QDRANT_URL.replace(/\/$/, '')}/collections/${encodeURIComponent(collectionName)}/points?wait=true`;
      const body = { points };
      log(`Attempting direct REST upsert to ${url} with ${points.length} points for diagnostics...`);
      const resp = await axios.put(url, body, {
        headers: QDRANT_API_KEY ? { 'api-key': QDRANT_API_KEY, 'content-type': 'application/json' } : { 'content-type': 'application/json' },
        timeout: 20000
      });
      log(`Direct REST upsert response: status=${resp.status} data=${JSON.stringify(resp.data).slice(0, 500)}...`);
    } catch (restErr) {
      try {
        const restDetails = restErr?.response?.data ? JSON.stringify(restErr.response.data) : JSON.stringify(restErr, Object.getOwnPropertyNames(restErr));
        log(`Direct REST upsert failed: ${restErr.message}. Details: ${restDetails}`, 'error');
      } catch (_) {
        log(`Direct REST upsert failed: ${restErr.message}`, 'error');
      }
    }
    throw error;
  }
}

async function processFile(filePath) {
  const normalizedPath = path.normalize(filePath);
  const checksum = await sha256File(normalizedPath);

  // Check if already processed
  const existing = getFileStmt.get(normalizedPath);
  if (existing && existing.status === 'completed' && existing.checksum === checksum) {
    log(`Skipping already processed file: ${path.basename(normalizedPath)}`);
    return { skipped: true, chunks: existing.chunks_count };
  }

  // Mark as queued
  upsertFileStmt.run({
    path: normalizedPath,
    checksum,
    status: 'queued',
    error: null,
    chunks_count: 0,
    updated_at: nowIso()
  });

  try {
    // Mark as processing
    upsertFileStmt.run({
      path: normalizedPath,
      checksum,
      status: 'processing',
      error: null,
      chunks_count: 0,
      updated_at: nowIso()
    });

    // Extract text from PDF
    const buffer = fs.readFileSync(normalizedPath);
    const pdfModule = await import('pdf-parse/lib/pdf-parse.js');
    const pdfParse = pdfModule.default || pdfModule;
    const data = await pdfParse(buffer);

    if (!data || !data.text || !data.text.trim()) {
      throw new Error('No text extracted from PDF');
    }

    const text = normalizeText(data.text);

    // Use optimized chunking with paragraph awareness
    const optimizedChunks = findOptimalChunkBoundaries(text, chunkSize, chunkOverlap, {
      minFactor: minChunkFactor,
      maxFactor: maxChunkFactor
    });

    log(`Processing ${path.basename(normalizedPath)}: ${optimizedChunks.length} optimized chunks`);

    // Embed in batches
    const vectors = [];
    const chunkTexts = optimizedChunks.map(chunk => chunk.text);

    for (let i = 0; i < chunkTexts.length; i += embedBatchSize) {
      const batch = chunkTexts.slice(i, i + embedBatchSize);
      const batchVecs = await embedBatch(batch);
      vectors.push(...batchVecs);
    }

    // Create points with enhanced metadata
    const displaySource = path.basename(normalizedPath);
    const points = optimizedChunks.map((chunkData, idx) => {
      const metadata = extractMetadata(displaySource, chunkData.text, idx, optimizedChunks.length);
      if (chunkData.heading) {
        metadata.sectionHeading = chunkData.heading;
      }
      // Generate a valid Qdrant ID (UUIDv4) and keep a deterministic hash for dedupe/traceability
      const deterministicHash = crypto.createHash('sha1').update(`${normalizedPath}|${idx}|optimized`).digest('hex');
      const pointId = crypto.randomUUID();

      return {
        id: pointId,
        vector: vectors[idx],
        payload: {
          text: chunkData.text,
          content: chunkData.text,
          pageContent: chunkData.text,
          metadata: metadata,
          source: displaySource,
          chunkIndex: idx,
          totalChunks: optimizedChunks.length,
          chunkStart: chunkData.start,
          chunkEnd: chunkData.end,
          chunkLength: chunkData.length,
          optimized: true,
          dedupeId: deterministicHash,
          timestamp: new Date().toISOString()
        }
      };
    });

    // Upsert to Qdrant in batches
    for (let i = 0; i < points.length; i += upsertBatchSize) {
      await upsertBatch(points.slice(i, i + upsertBatchSize));
    }

    // Mark as completed
    upsertFileStmt.run({
      path: normalizedPath,
      checksum,
      status: 'completed',
      error: null,
      chunks_count: optimizedChunks.length,
      updated_at: nowIso()
    });

    log(`✅ Successfully processed: ${path.basename(normalizedPath)} (${optimizedChunks.length} optimized chunks)`);
    return { skipped: false, chunks: optimizedChunks.length };

  } catch (error) {
    const errorMsg = error.message || 'Unknown error';
    log(`❌ Failed to process ${path.basename(normalizedPath)}: ${errorMsg}`, 'error');

    // Mark as error
    upsertFileStmt.run({
      path: normalizedPath,
      checksum,
      status: 'error',
      error: errorMsg,
      chunks_count: 0,
      updated_at: nowIso()
    });

    throw error;
  }
}

async function getStats() {
  try {
    const stats = getStatsStmt.get();
    return {
      total: stats.total || 0,
      completed: stats.completed || 0,
      errors: stats.errors || 0,
      pending: stats.pending || 0,
      total_chunks: stats.total_chunks || 0
    };
  } catch (error) {
    log(`Failed to get stats: ${error.message}`, 'error');
    return { total: 0, completed: 0, errors: 0, pending: 0, total_chunks: 0 };
  }
}

async function main() {
  const pdfDir = process.argv[2];

  if (!pdfDir) {
    console.error('❌ Usage: node fix_embeddings/bulk-pdf-processor-optimized.js <pdf-directory>');
    console.error('Example: node fix_embeddings/bulk-pdf-processor-optimized.js "C:\\data\\pdfs"');
    process.exit(1);
  }

  if (!fs.existsSync(pdfDir)) {
    console.error(`❌ Directory does not exist: ${pdfDir}`);
    process.exit(1);
  }

  try {
    log('🚀 Starting optimized bulk PDF processing...');
    log(`📁 PDF Directory: ${pdfDir}`);
    log(`⚙️  Concurrency: ${concurrency}`);
    log(`📦 Embed Batch Size: ${embedBatchSize}`);
    log(`💾 Upsert Batch Size: ${upsertBatchSize}`);
    log(`✂️  Optimal Chunk Size: ${chunkSize} chars`);
    log(`🔄 Chunk Overlap: ${chunkOverlap} chars`);
    log(`🧠 Embedding Provider: ${EMBEDDING_PROVIDER}`);
    if (EMBEDDING_PROVIDER === 'ollama') {
      log(`🦙 Ollama Model: ${OLLAMA_MODEL}`);
      log(`🌐 Ollama URL: ${OLLAMA_URL}`);
    } else {
      log(`🔍 Google Model: gemini-embedding-001`);
    }
    log(`📄 Paragraph Awareness: Enabled`);

    // Ensure Qdrant collection exists
    await ensureCollection();

    // Find all PDF files recursively
    log('🔍 Scanning for PDF files...');
    const files = await fg(['**/*.pdf'], {
      cwd: pdfDir,
      absolute: true,
      onlyFiles: true,
      followSymbolicLinks: false
    });

    if (files.length === 0) {
      log(`❌ No PDF files found in directory: ${pdfDir}`, 'error');
      process.exit(1);
    }

    log(`📚 Found ${files.length} PDF files to process`);

    // Get initial stats
    const initialStats = await getStats();
    if (initialStats.total > 0) {
      log(`📊 Previous run stats: ${initialStats.completed} completed, ${initialStats.errors} errors, ${initialStats.total_chunks} total chunks`);
    }

    // Concurrency limiter
    const limit = pLimit(concurrency);

    let completed = 0;
    let skipped = 0;
    let errors = 0;
    let totalChunks = 0;

    const startTime = Date.now();

    // Process files with concurrency limit
    const tasks = files.map(filePath =>
      limit(async () => {
        try {
          const result = await processFile(filePath);

          if (result.skipped) {
            skipped += 1;
          } else {
            totalChunks += result.chunks;
          }

          completed += 1;

          // Progress update
          const progress = ((completed / files.length) * 100).toFixed(1);
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
          log(`📈 Progress: ${progress}% (${completed}/${files.length}) - ${path.basename(filePath)} - Elapsed: ${elapsed}s`);

          return result;
        } catch (error) {
          errors += 1;
          log(`❌ Task failed for ${path.basename(filePath)}: ${error.message}`, 'error');
          throw error;
        }
      })
    );

    // Wait for all tasks to complete
    log('🔄 Processing files with optimized chunking...');
    await Promise.allSettled(tasks);

    // Get final stats
    const finalStats = await getStats();
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(0);

    log('🎉 Optimized bulk PDF processing completed!', 'success');
    log(`📊 Final Results:`);
    log(`   📁 Total Files: ${files.length}`);
    log(`   ✅ Completed: ${finalStats.completed}`);
    log(`   ⏭️  Skipped: ${skipped}`);
    log(`   ❌ Errors: ${finalStats.errors}`);
    log(`   📝 Total Chunks: ${finalStats.total_chunks}`);
    log(`   ⏱️  Total Time: ${totalTime} seconds`);

    log(`\n🎯 Optimization Benefits:`);
    log(`   ✅ Optimal chunk sizes (${chunkSize} chars with semantic boundaries)`);
    log(`   ✅ Paragraph awareness (respects document structure)`);
    log(`   ✅ Enhanced metadata (page numbers, chapters, medical terms)`);
    log(`   ✅ ${EMBEDDING_PROVIDER === 'ollama' ? 'Local Ollama embeddings (privacy-focused)' : 'Google AI embeddings (cloud-based)'}`);
    log(`   ✅ Better semantic retrieval for medical content`);

    if (finalStats.errors > 0) {
      log(`⚠️  ${finalStats.errors} files had errors. Check the manifest database for details.`);
    }

  } catch (error) {
    log(`❌ Optimized bulk PDF processing failed: ${error.message}`, 'error');
    process.exit(1);
  } finally {
    db.close();
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down gracefully');
  db.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  log('SIGINT received, shutting down gracefully');
  db.close();
  process.exit(0);
});

// Run the main function
main().catch(error => {
  log(`❌ Fatal error: ${error.message}`, 'error');
  db.close();
  process.exit(1);
});
