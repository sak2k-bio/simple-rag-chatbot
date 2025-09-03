#!/bin/bash

# GPU-Optimized Ollama Startup Script for 12GB VRAM
# This script starts Ollama with optimal settings for bulk PDF processing

echo "🚀 Starting Ollama with GPU acceleration for 12GB VRAM..."

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama is not installed. Please install it first:"
    echo "   Visit: https://ollama.ai"
    exit 1
fi

# Check if nomic-embed-text model is installed
if ! ollama list | grep -q "nomic-embed-text"; then
    echo "📥 Installing nomic-embed-text model..."
    ollama pull nomic-embed-text
fi

# Set GPU optimization environment variables
export OLLAMA_GPU_LAYERS=20
export OLLAMA_NUM_CTX=2048
export OLLAMA_NUM_BATCH=512
export OLLAMA_NUM_THREAD=4

echo "⚙️  GPU Configuration:"
echo "   - GPU Layers: 20"
echo "   - Context Window: 2048"
echo "   - Batch Size: 512"
echo "   - CPU Threads: 4"
echo ""

# Start Ollama with GPU acceleration
echo "🦙 Starting Ollama server with GPU acceleration..."
echo "   URL: http://localhost:11434"
echo "   Model: nomic-embed-text"
echo ""

# Start Ollama in the background
ollama serve &

# Wait a moment for Ollama to start
sleep 3

# Test the connection
echo "🧪 Testing Ollama connection..."
if curl -s http://localhost:11434/api/tags > /dev/null; then
    echo "✅ Ollama is running successfully!"
    echo ""
    echo "🎯 Ready for bulk PDF processing with GPU acceleration!"
    echo "   - Concurrency: 8 files"
    echo "   - Embed Batch: 32 texts"
    echo "   - Expected speed: 3-5x faster than CPU-only"
    echo ""
    echo "💡 To stop Ollama: pkill ollama"
    echo "💡 To check status: curl http://localhost:11434/api/tags"
else
    echo "❌ Failed to start Ollama. Check the logs above."
    exit 1
fi
