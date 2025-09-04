#!/usr/bin/env node

/**
 * Test script to verify Docker setup without building
 * This checks if all required files exist and configurations are correct
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Docker Setup for Bulk Embeddings...\n');

// Check required files
const requiredFiles = [
  'Dockerfile',
  'docker-compose.yml',
  'package.json',
  'bulk-pdf-processor-optimized.js',
  'web-ui/server.js',
  'web-ui/public/index.html',
  'env.example',
  '.dockerignore'
];

console.log('📁 Checking required files:');
let allFilesExist = true;

requiredFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`   ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
});

// Check package.json dependencies
console.log('\n📦 Checking package.json dependencies:');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredDeps = ['pdf-parse', 'better-sqlite3', 'axios', 'p-limit', 'p-retry'];
  
  requiredDeps.forEach(dep => {
    const exists = packageJson.dependencies && packageJson.dependencies[dep];
    console.log(`   ${exists ? '✅' : '❌'} ${dep}`);
    if (!exists) allFilesExist = false;
  });
} catch (error) {
  console.log('   ❌ Error reading package.json:', error.message);
  allFilesExist = false;
}

// Check Dockerfile content
console.log('\n🐳 Checking Dockerfile configuration:');
try {
  const dockerfile = fs.readFileSync('Dockerfile', 'utf8');
  const checks = [
    { name: 'Node.js base image', pattern: /FROM node:/ },
    { name: 'System dependencies', pattern: /apk add/ },
    { name: 'Package installation', pattern: /npm install --omit=dev/ },
    { name: 'Port exposure', pattern: /EXPOSE 3001/ },
    { name: 'Health check', pattern: /HEALTHCHECK/ }
  ];
  
  checks.forEach(check => {
    const exists = check.pattern.test(dockerfile);
    console.log(`   ${exists ? '✅' : '❌'} ${check.name}`);
    if (!exists) allFilesExist = false;
  });
} catch (error) {
  console.log('   ❌ Error reading Dockerfile:', error.message);
  allFilesExist = false;
}

// Check docker-compose.yml
console.log('\n🐙 Checking docker-compose.yml configuration:');
try {
  const compose = fs.readFileSync('docker-compose.yml', 'utf8');
  const checks = [
    { name: 'Bulk processor service', pattern: /bulk-processor:/ },
    { name: 'Qdrant service', pattern: /qdrant:/ },
    { name: 'GPU-optimized settings', pattern: /BULK_CONCURRENCY=8/ },
    { name: 'Volume mappings', pattern: /volumes:/ },
    { name: 'Port mappings', pattern: /ports:/ }
  ];
  
  checks.forEach(check => {
    const exists = check.pattern.test(compose);
    console.log(`   ${exists ? '✅' : '❌'} ${check.name}`);
    if (!exists) allFilesExist = false;
  });
} catch (error) {
  console.log('   ❌ Error reading docker-compose.yml:', error.message);
  allFilesExist = false;
}

// Check environment template
console.log('\n⚙️  Checking environment configuration:');
try {
  const envExample = fs.readFileSync('env.example', 'utf8');
  const checks = [
    { name: 'Embedding provider config', pattern: /EMBEDDING_PROVIDER/ },
    { name: 'Ollama configuration', pattern: /OLLAMA_URL/ },
    { name: 'GPU optimization', pattern: /OLLAMA_GPU_LAYERS/ },
    { name: 'Qdrant configuration', pattern: /QDRANT_URL/ },
    { name: 'Processing settings', pattern: /BULK_CONCURRENCY/ }
  ];
  
  checks.forEach(check => {
    const exists = check.pattern.test(envExample);
    console.log(`   ${exists ? '✅' : '❌'} ${check.name}`);
    if (!exists) allFilesExist = false;
  });
} catch (error) {
  console.log('   ❌ Error reading env.example:', error.message);
  allFilesExist = false;
}

// Final result
console.log('\n' + '='.repeat(50));
if (allFilesExist) {
  console.log('🎉 Docker setup is ready!');
  console.log('\n📋 Next steps:');
  console.log('   1. Copy env.example to .env.local and configure');
  console.log('   2. Run: docker-compose up --build');
  console.log('   3. Access web UI at: http://localhost:3001');
  console.log('\n🚀 GPU-optimized settings are configured for 12GB VRAM!');
} else {
  console.log('❌ Docker setup has issues. Please fix the errors above.');
  process.exit(1);
}
