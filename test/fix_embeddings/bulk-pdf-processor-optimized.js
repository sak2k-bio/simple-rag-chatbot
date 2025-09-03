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
const pRetry = require('p-retry');
const Database = require('better-sqlite3');
const { QdrantClient } = require('@qdrant/js-client-rest');
const { google } = require('@ai-sdk/google');
const { embed } = require('ai');

// Configuration from environment variables
const {
  QDRANT_URL = 'http://localhost:6333',
  QDRANT_API_KEY = '',
  QDRANT_COLLECTION = 'pulmo_fishman',
  GOOGLE_API_KEY,
  BULK_CONCURRENCY = '6',
  BULK_EMBED_BATCH = '50',
  BULK_UPSERT_BATCH = '100',
  OPTIMAL_CHUNK_SIZE = '1000',
  OPTIMAL_CHUNK_OVERLAP = '200'
} = process.env;

// Validate required environment variables
if (!GOOGLE_API_KEY) {
  console.error('❌ GOOGLE_API_KEY is required in .env file');
  process.exit(1);
}

// Configuration
const concurrency = Number(BULK_CONCURRENCY);
const embedBatchSize = Number(BULK_EMBED_BATCH);
const upsertBatchSize = Number(BULK_UPSERT_BATCH);
const chunkSize = Number(OPTIMAL_CHUNK_SIZE);
const chunkOverlap = Number(OPTIMAL_CHUNK_OVERLAP);

// Initialize clients
const client = new QdrantClient({
  url: QDRANT_URL,
  apiKey: QDRANT_API_KEY,
});

const collectionName = QDRANT_COLLECTION;
const embeddingModel = google.embedding('text-embedding-004');

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

// Enhanced chunking with paragraph awareness
function findOptimalChunkBoundaries(text, targetSize = 1000, overlap = 200) {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    let end = Math.min(start + targetSize, text.length);
    
    // Try to find a good breaking point (sentence, paragraph, or word boundary)
    if (end < text.length) {
      // Look for paragraph breaks first (double newlines)
      const paragraphEnd = text.lastIndexOf('\n\n', end);
      // Look for sentence endings
      const sentenceEnd = text.lastIndexOf('.', end);
      // Look for word boundaries
      const wordEnd = text.lastIndexOf(' ', end);
      
      if (paragraphEnd > start + targetSize * 0.6) {
        end = paragraphEnd + 2;
      } else if (sentenceEnd > start + targetSize * 0.7) {
        end = sentenceEnd + 1;
      } else if (wordEnd > start + targetSize * 0.8) {
        end = wordEnd;
      }
    }
    
    const chunkText = text.slice(start, end).trim();
    if (chunkText.length > 50) { // Only include substantial chunks
      chunks.push({
        text: chunkText,
        start: start,
        end: end,
        length: chunkText.length
      });
    }
    
    // Move start position with overlap
    start = Math.max(start + 1, end - overlap);
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

async function ensureCollection() {
  try {
    const collections = await client.getCollections();
    const collectionExists = collections.collections.some(c => c.name === collectionName);
    
    if (!collectionExists) {
      log(`Creating collection: ${collectionName}`);
      await client.createCollection(collectionName, {
        vectors: { size: 768 } // text-embedding-004 has 768 dimensions
      });
    }
    
    log(`Collection '${collectionName}' is ready`);
  } catch (error) {
    log(`Collection initialization error: ${error.message}`, 'error');
    throw error;
  }
}

async function embedBatch(texts) {
  try {
    log(`Embedding batch of ${texts.length} texts`);
    
    const embeddings = await pRetry(
      async () => {
        const results = [];
        for (const text of texts) {
          const result = await embed({
            model: embeddingModel,
            value: text,
          });
          results.push(result.embedding);
        }
        return results;
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 10000,
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
    await client.upsert(collectionName, {
      points: points
    });
    log(`Upserted batch of ${points.length} points`);
  } catch (error) {
    log(`Upsert failed: ${error.message}`, 'error');
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

    const text = data.text.replace(/\r\n/g, '\n').trim();
    
    // Use optimized chunking with paragraph awareness
    const optimizedChunks = findOptimalChunkBoundaries(text, chunkSize, chunkOverlap);
    
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
    const points = optimizedChunks.map((chunkData, idx) => {
      const metadata = extractMetadata(normalizedPath, chunkData.text, idx, optimizedChunks.length);
      
      return {
        id: crypto.createHash('sha1').update(`${normalizedPath}|${idx}|optimized`).digest('hex'),
        vector: vectors[idx],
        payload: {
          text: chunkData.text,
          content: chunkData.text,
          pageContent: chunkData.text,
          metadata: metadata,
          source: normalizedPath,
          chunkIndex: idx,
          totalChunks: optimizedChunks.length,
          chunkStart: chunkData.start,
          chunkEnd: chunkData.end,
          chunkLength: chunkData.length,
          optimized: true,
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
    log(`🧠 Embedding Model: text-embedding-004`);
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
    log(`   ✅ Consistent embedding model (text-embedding-004)`);
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
