#!/usr/bin/env node

/**
 * Web UI Server for Bulk PDF Processor
 * 
 * Provides a simple web interface for:
 * - Uploading PDFs
 * - Configuring processing settings
 * - Monitoring progress
 * - Viewing results
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const cors = require('cors');
const { QdrantClient } = require('@qdrant/js-client-rest');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuration
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
const DATA_DIR = process.env.DATA_DIR || '/app/data';
const MANIFEST_DIR = process.env.MANIFEST_DIR || '/app/manifests';

// Ensure directories exist
[UPLOAD_DIR, DATA_DIR, MANIFEST_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Helper: sanitize filenames to avoid unsafe characters
function sanitizeFilename(name) {
  const parsed = path.parse(name);
  const base = parsed.name
    .replace(/[^a-zA-Z0-9._-]+/g, '_')   // replace unsafe chars
    .replace(/_{2,}/g, '_')              // collapse multiple underscores
    .slice(0, 200)                       // limit length
    || 'upload';
  const ext = (parsed.ext || '.pdf').toLowerCase();
  return base + ext;
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    try {
      const desired = sanitizeFilename(file.originalname || 'upload.pdf');
      let finalName = desired;
      const fullPath = (name) => path.join(UPLOAD_DIR, name);
      // If a file with same name exists, append timestamp to avoid overwrite
      if (fs.existsSync(fullPath(finalName))) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const p = path.parse(finalName);
        finalName = `${p.name}-${ts}${p.ext}`;
      }
      cb(null, finalName);
    } catch (e) {
      // Fallback to random if anything goes wrong
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'pdfs-' + uniqueSuffix + path.extname(file.originalname || '.pdf'));
    }
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 5000, // Allow up to 5000 files
    fieldSize: 10 * 1024 * 1024, // 10MB field size
    fieldNameSize: 1000, // 1000 characters for field name
    parts: 10000 // Allow up to 10000 parts
  }
});

// Qdrant client
const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY || '',
  checkCompatibility: false // Skip version compatibility check
});

// Store active processes
const activeProcesses = new Map();

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Get collection info
app.get('/api/collection-info', async (req, res) => {
  try {
    const collections = await qdrantClient.getCollections();
    const collectionName = process.env.QDRANT_COLLECTION || 'pulmo_fishman';
    const collection = collections.collections.find(c => c.name === collectionName);
    
    if (collection) {
      const info = await qdrantClient.getCollection(collectionName);
      res.json({
        exists: true,
        name: collectionName,
        pointsCount: info.points_count,
        vectorsCount: info.vectors_count,
        status: info.status
      });
    } else {
      res.json({
        exists: false,
        name: collectionName
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test Ollama connection
app.get('/api/ollama-status', async (req, res) => {
  try {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const ollamaModel = process.env.OLLAMA_MODEL || 'nomic-embed-text';
    
    const response = await axios.get(`${ollamaUrl}/api/tags`, { timeout: 5000 });
    
    if (response.data && response.data.models) {
      const modelExists = response.data.models.some(model => model.name.includes(ollamaModel));
      res.json({
        connected: true,
        url: ollamaUrl,
        model: ollamaModel,
        modelExists: modelExists,
        availableModels: response.data.models.map(m => m.name)
      });
    } else {
      res.json({
        connected: false,
        error: 'Invalid response from Ollama'
      });
    }
  } catch (error) {
    res.json({
      connected: false,
      error: error.message,
      url: process.env.OLLAMA_URL || 'http://localhost:11434'
    });
  }
});

// Get processing status
app.get('/api/status/:processId', (req, res) => {
  const { processId } = req.params;
  const process = activeProcesses.get(processId);
  
  if (!process) {
    return res.status(404).json({ error: 'Process not found' });
  }
  
  res.json({
    id: processId,
    status: process.status,
    progress: process.progress,
    message: process.message,
    startTime: process.startTime,
    endTime: process.endTime,
    error: process.error
  });
});

// Get manifest database stats
app.get('/api/manifest-stats', (req, res) => {
  try {
    const manifestPath = path.join(MANIFEST_DIR, 'bulk_manifest_optimized.db');
    
    if (!fs.existsSync(manifestPath)) {
      return res.json({
        exists: false,
        stats: { total: 0, completed: 0, errors: 0, pending: 0, total_chunks: 0 }
      });
    }
    
    // Read SQLite database (simplified - in production, use proper SQLite library)
    const Database = require('better-sqlite3');
    const db = new Database(manifestPath);
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
        SUM(CASE WHEN status IN ('queued', 'processing') THEN 1 ELSE 0 END) as pending,
        SUM(chunks_count) as total_chunks
      FROM bulk_files_optimized
    `).get();
    
    db.close();
    
    res.json({
      exists: true,
      stats: stats || { total: 0, completed: 0, errors: 0, pending: 0, total_chunks: 0 }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload PDFs
app.post('/api/upload', upload.array('pdfs', 5000), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    const uploadedFiles = req.files.map(file => ({
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
      size: file.size
    }));
    
    res.json({
      message: `${uploadedFiles.length} files uploaded successfully`,
      files: uploadedFiles
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start processing
app.post('/api/process', async (req, res) => {
  try {
    const { 
      sourceDirectory = UPLOAD_DIR,
      embeddingProvider = 'google',
      ollamaUrl = (process.env.OLLAMA_URL || 'http://localhost:11434'),
      ollamaModel = 'nomic-embed-text',
      concurrency = 6,
      embedBatch = 50,
      upsertBatch = 100,
      chunkSize = 1000,
      chunkOverlap = 200
    } = req.body;
    
    // Generate process ID
    const processId = Date.now().toString();
    
    // Check if source directory exists
    if (!fs.existsSync(sourceDirectory)) {
      return res.status(400).json({ error: 'Source directory does not exist' });
    }
    
    // Check for PDF files
    const files = fs.readdirSync(sourceDirectory).filter(file => 
      file.toLowerCase().endsWith('.pdf')
    );
    
    if (files.length === 0) {
      return res.status(400).json({ error: 'No PDF files found in directory' });
    }
    
    // Set up environment variables for the process
    const env = {
      ...process.env,
      EMBEDDING_PROVIDER: embeddingProvider,
      OLLAMA_URL: ollamaUrl,
      OLLAMA_MODEL: ollamaModel,
      BULK_CONCURRENCY: concurrency.toString(),
      BULK_EMBED_BATCH: embedBatch.toString(),
      BULK_UPSERT_BATCH: upsertBatch.toString(),
      OPTIMAL_CHUNK_SIZE: chunkSize.toString(),
      OPTIMAL_CHUNK_OVERLAP: chunkOverlap.toString(),
      UPLOAD_DIR: UPLOAD_DIR,
      DATA_DIR: DATA_DIR,
      MANIFEST_DIR: MANIFEST_DIR
    };
    
    // Start the bulk processor
    const processorPath = path.join(__dirname, '..', 'bulk-pdf-processor-optimized.js');
    const child = spawn('node', [processorPath, sourceDirectory], {
      env: env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Store process info
    const processInfo = {
      id: processId,
      status: 'running',
      progress: 0,
      message: 'Starting processing...',
      startTime: new Date().toISOString(),
      endTime: null,
      error: null,
      child: child
    };
    
    activeProcesses.set(processId, processInfo);
    
    // Handle process output
    child.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[${processId}] ${output}`);
      
      // Parse progress from output
      const progressMatch = output.match(/Progress: ([\d.]+)%/);
      if (progressMatch) {
        processInfo.progress = parseFloat(progressMatch[1]);
        processInfo.message = output.trim();
      }
    });
    
    child.stderr.on('data', (data) => {
      const error = data.toString();
      console.error(`[${processId}] ERROR: ${error}`);
      processInfo.error = error;
    });
    
    child.on('close', (code) => {
      processInfo.status = code === 0 ? 'completed' : 'failed';
      processInfo.endTime = new Date().toISOString();
      processInfo.progress = code === 0 ? 100 : processInfo.progress;
      
      if (code === 0) {
        processInfo.message = 'Processing completed successfully';
      } else {
        processInfo.message = `Processing failed with exit code ${code}`;
      }
      
      // Clean up child process reference
      delete processInfo.child;
    });
    
    res.json({
      processId: processId,
      message: 'Processing started',
      filesFound: files.length
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop processing
app.post('/api/stop/:processId', (req, res) => {
  const { processId } = req.params;
  const process = activeProcesses.get(processId);
  
  if (!process) {
    return res.status(404).json({ error: 'Process not found' });
  }
  
  if (process.child) {
    process.child.kill('SIGTERM');
    process.status = 'stopped';
    process.endTime = new Date().toISOString();
    process.message = 'Processing stopped by user';
  }
  
  res.json({ message: 'Process stopped' });
});

// Get list of uploaded files
app.get('/api/files', (req, res) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR)
      .filter(file => file.toLowerCase().endsWith('.pdf'))
      .map(file => {
        const filePath = path.join(UPLOAD_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: stats.size,
          uploadTime: stats.birthtime
        };
      });
    
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete uploaded files
app.delete('/api/files/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(UPLOAD_DIR, filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ message: 'File deleted successfully' });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve the main UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ error: error.message });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Bulk PDF Processor Web UI running on port ${PORT}`);
  console.log(`📁 Upload directory: ${UPLOAD_DIR}`);
  console.log(`📊 Data directory: ${DATA_DIR}`);
  console.log(`📋 Manifest directory: ${MANIFEST_DIR}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  // Kill all active processes
  activeProcesses.forEach(process => {
    if (process.child) {
      process.child.kill('SIGTERM');
    }
  });
  
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  
  // Kill all active processes
  activeProcesses.forEach(process => {
    if (process.child) {
      process.child.kill('SIGTERM');
    }
  });
  
  process.exit(0);
});
