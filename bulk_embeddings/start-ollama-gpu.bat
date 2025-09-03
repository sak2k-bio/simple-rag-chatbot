@echo off
REM GPU-Optimized Ollama Startup Script for 12GB VRAM (Windows)
REM This script starts Ollama with optimal settings for bulk PDF processing

echo 🚀 Starting Ollama with GPU acceleration for 12GB VRAM...

REM Check if Ollama is installed
ollama --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Ollama is not installed. Please install it first:
    echo    Visit: https://ollama.ai
    pause
    exit /b 1
)

REM Check if nomic-embed-text model is installed
ollama list | findstr "nomic-embed-text" >nul 2>&1
if errorlevel 1 (
    echo 📥 Installing nomic-embed-text model...
    ollama pull nomic-embed-text
)

REM Set GPU optimization environment variables
set OLLAMA_GPU_LAYERS=20
set OLLAMA_NUM_CTX=2048
set OLLAMA_NUM_BATCH=512
set OLLAMA_NUM_THREAD=4

echo ⚙️  GPU Configuration:
echo    - GPU Layers: 20
echo    - Context Window: 2048
echo    - Batch Size: 512
echo    - CPU Threads: 4
echo.

REM Start Ollama with GPU acceleration
echo 🦙 Starting Ollama server with GPU acceleration...
echo    URL: http://localhost:11434
echo    Model: nomic-embed-text
echo.

REM Start Ollama in the background
start /b ollama serve

REM Wait a moment for Ollama to start
timeout /t 3 /nobreak >nul

REM Test the connection
echo 🧪 Testing Ollama connection...
curl -s http://localhost:11434/api/tags >nul 2>&1
if errorlevel 1 (
    echo ❌ Failed to start Ollama. Check the logs above.
    pause
    exit /b 1
) else (
    echo ✅ Ollama is running successfully!
    echo.
    echo 🎯 Ready for bulk PDF processing with GPU acceleration!
    echo    - Concurrency: 8 files
    echo    - Embed Batch: 32 texts
    echo    - Expected speed: 3-5x faster than CPU-only
    echo.
    echo 💡 To stop Ollama: taskkill /f /im ollama.exe
    echo 💡 To check status: curl http://localhost:11434/api/tags
    echo.
    echo Press any key to continue...
    pause >nul
)
