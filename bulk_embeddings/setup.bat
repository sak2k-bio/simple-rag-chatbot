@echo off
REM Bulk PDF Processor Setup Script for Windows
REM This script helps you get started quickly with the bulk PDF processor

echo 🚀 Bulk PDF Processor Setup
echo ==========================

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker Desktop first.
    echo    Visit: https://docs.docker.com/desktop/windows/install/
    pause
    exit /b 1
)

REM Check if Docker Compose is installed
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker Compose is not installed. Please install Docker Compose first.
    echo    Visit: https://docs.docker.com/compose/install/
    pause
    exit /b 1
)

echo ✅ Docker and Docker Compose are installed

REM Create .env.local if it doesn't exist
if not exist .env.local (
    echo 📝 Creating .env.local from template...
    copy env.example .env.local
    echo ✅ Created .env.local
    echo.
    echo ⚠️  IMPORTANT: Please edit .env.local and add your API keys:
    echo    - GOOGLE_API_KEY=your_google_api_key_here
    echo    - QDRANT_API_KEY=your_qdrant_api_key_here (optional)
    echo.
    pause
) else (
    echo ✅ .env.local already exists
)

REM Create necessary directories
echo 📁 Creating directories...
if not exist data mkdir data
if not exist uploads mkdir uploads
if not exist manifests mkdir manifests
echo ✅ Created directories: data, uploads, manifests

REM Build and start the services
echo 🐳 Building and starting Docker services...
docker-compose up -d --build

REM Wait for services to be ready
echo ⏳ Waiting for services to start...
timeout /t 10 /nobreak >nul

REM Check if services are running
docker-compose ps | findstr "Up" >nul
if %errorlevel% equ 0 (
    echo ✅ Services are running!
    echo.
    echo 🎉 Setup complete!
    echo.
    echo 📱 Web UI: http://localhost:3001
    echo 🗄️  Qdrant: http://localhost:6333
    echo.
    echo 📋 Next steps:
    echo 1. Open http://localhost:3001 in your browser
    echo 2. Upload your PDF files
    echo 3. Configure processing settings
    echo 4. Start processing!
    echo.
    echo 🛑 To stop services: docker-compose down
    echo 📊 To view logs: docker-compose logs -f
    echo.
    pause
) else (
    echo ❌ Services failed to start. Check the logs:
    echo    docker-compose logs
    pause
    exit /b 1
)
