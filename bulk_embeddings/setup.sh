#!/bin/bash

# Bulk PDF Processor Setup Script
# This script helps you get started quickly with the bulk PDF processor

echo "🚀 Bulk PDF Processor Setup"
echo "=========================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "   Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local from template..."
    cp env.example .env.local
    echo "✅ Created .env.local"
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env.local and add your API keys:"
    echo "   - GOOGLE_API_KEY=your_google_api_key_here"
    echo "   - QDRANT_API_KEY=your_qdrant_api_key_here (optional)"
    echo ""
    read -p "Press Enter after you've updated .env.local..."
else
    echo "✅ .env.local already exists"
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p data uploads manifests
echo "✅ Created directories: data, uploads, manifests"

# Build and start the services
echo "🐳 Building and starting Docker services..."
docker-compose up -d --build

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    echo "✅ Services are running!"
    echo ""
    echo "🎉 Setup complete!"
    echo ""
    echo "📱 Web UI: http://localhost:3001"
    echo "🗄️  Qdrant: http://localhost:6333"
    echo ""
    echo "📋 Next steps:"
    echo "1. Open http://localhost:3001 in your browser"
    echo "2. Upload your PDF files"
    echo "3. Configure processing settings"
    echo "4. Start processing!"
    echo ""
    echo "🛑 To stop services: docker-compose down"
    echo "📊 To view logs: docker-compose logs -f"
else
    echo "❌ Services failed to start. Check the logs:"
    echo "   docker-compose logs"
    exit 1
fi
