# Simple Chatbot

A Next.js chatbot application powered by Google's Gemini AI and optionally Qdrant for RAG (Retrieval Augmented Generation).

## Features

- 🤖 AI-powered conversations using Google Gemini
- 🔍 Optional RAG functionality with Qdrant vector database
- 💬 Real-time streaming chat interface
- 🎨 Modern UI with Tailwind CSS

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Google AI API Key (Required)
# Get this from: https://makersuite.google.com/app/apikey
GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_api_key_here

# Qdrant Vector Database (Optional - for RAG functionality)
# If not set, the chatbot will work without RAG features
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your_qdrant_api_key_here
QDRANT_COLLECTION=your_collection_name_here
```

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## How It Works

1. **Basic Chat**: The chatbot will work with just the Google AI API key
2. **RAG Enhancement**: If Qdrant is configured, the chatbot will:
   - Convert user messages to embeddings
   - Search for relevant context in your vector database
   - Use that context to provide more informed responses

## Troubleshooting

### No Responses from AI
- Check that `GOOGLE_GENERATIVE_AI_API_KEY` is set correctly
- Verify your Google AI API key has sufficient credits/quota
- Check browser console for any error messages

### Qdrant Errors
- If you see Qdrant-related errors, the chatbot will fall back to basic chat mode
- Ensure all Qdrant environment variables are set if you want RAG functionality
- Verify your Qdrant instance is running and accessible

## API Endpoints

- `POST /api/chat` - Main chat endpoint that accepts messages and returns streaming responses

## Technologies Used

- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **AI**: Google Gemini via @ai-sdk/google
- **Vector Database**: Qdrant (optional)
- **Chat Interface**: @ai-sdk/react useChat hook
