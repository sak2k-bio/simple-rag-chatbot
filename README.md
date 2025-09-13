# Advanced Pulmo RAGbot

A sophisticated Next.js chatbot application powered by Google's Gemini AI with full Qdrant Cloud integration for Retrieval Augmented Generation (RAG), memory persistence, and advanced conversation controls. Features comprehensive source visibility, customizable system prompts, and intuitive RAG parameter management.

![alttext](https://github.com/sak2k-bio/simple-rag-chatbot/blob/007c08a7d2fc14bc72973e6bd65e9d532e49a6d4/screenshots_examples/Screenshot%202025-09-01%20201014.png)

## ✨ Features

🤖 **AI-Powered Conversations**: Advanced conversations using Google Gemini 1.5 Flash
🔍 **RAG with Qdrant Cloud**: Full Retrieval-Augmented Generation using vector search
💬 **Streaming Chat**: Real-time streaming chat interface with instant responses
🧠 **Memory Persistence**: Conversation history stored in Supabase with session management
🎯 **Smart RAG Controls**: Interactive UI for Top-K, similarity threshold, and system prompt
⚖️ **Intuitive Similarity Controls**: User-friendly preset buttons (Precise, Balanced, Flexible) with custom slider
📊 **Comprehensive Source Visibility**: See ALL retrieved sources with clear indicators of which were used
🎭 **Customizable System Prompts**: Full control over AI personality and behavior
📝 **Multi-Session Management**: Switch between different conversation threads
🎨 **Modern UI**: Responsive design with Tailwind CSS and intuitive controls
🌙 **Dark Mode**: Toggleable dark/light theme with system preference detection
🔗 **Cloud Integration**: Seamless integration with Qdrant Cloud for scalable vector storage
📈 **Performance Monitoring**: Built-in debugging and similarity score analysis
🔍 **Source Usage Tracking**: Visual feedback showing used vs. unused sources with similarity scores

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Google AI API Key (Required)
GOOGLE_API_KEY=your_google_ai_api_key_here
# Alternative: GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_api_key_here

# Qdrant Cloud Configuration (Required for RAG)
QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your_qdrant_api_key_here
QDRANT_COLLECTION=pulmo_fishman

# Supabase Configuration (Optional - for memory persistence)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_CHAT_TABLE=chat_logs
CHAT_MESSAGES_TABLE=chat_messages_chatbot

# Optional: Rate limiting (if using Upstash Redis)
# UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
# UPSTASH_REDIS_REST_TOKEN=your_redis_token_here

# Optional: Error monitoring (if using Sentry)
# NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project

# Optional: CORS restrictions
# ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🔧 Setup Instructions

### Qdrant Cloud Setup (Required for RAG)

#### Step 1: Get Qdrant Cloud Credentials
1. Sign up at [Qdrant Cloud](https://cloud.qdrant.io)
2. Create a cluster
3. Get your cluster URL (e.g., `https://xyz-abc.qdrant.io`)
4. Generate an API key from the Access Management section

#### Step 2: Test Connection
```bash
# Test Qdrant connection and collection setup
node setup-qdrant-cloud.js

# Test similarity scores and thresholds
node test-similarity-scores.js
```

#### Step 3: Verify Collection
The setup script will:
- ✅ Test connection to Qdrant Cloud
- ✅ Verify collection exists (or create it)
- ✅ Show collection statistics (vectors, size, distance)
- ✅ Test search functionality

### Database Setup (Optional - for memory persistence)

#### Chat Messages Table
```sql
CREATE TABLE chat_messages_chatbot (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    session_id TEXT NOT NULL,
    sources JSONB DEFAULT '[]'::jsonb,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_chat_messages_chatbot_session_id ON chat_messages_chatbot(session_id);
CREATE INDEX idx_chat_messages_chatbot_timestamp ON chat_messages_chatbot(timestamp);
```

#### Chat Logs Table
```sql
CREATE TABLE chat_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_message TEXT NOT NULL,
    model TEXT NOT NULL,
    used_context BOOLEAN NOT NULL,
    context_preview TEXT,
    response_preview TEXT,
    metadata JSONB
);

-- Indexes for performance
CREATE INDEX idx_chat_logs_created_at ON chat_logs(created_at);
CREATE INDEX idx_chat_logs_model ON chat_logs(model);
```

## 🎨 UI Features

### Dark Mode Support
- **🌙 Theme Toggle**: Click the theme toggle button in the navigation bar to switch between light and dark modes
- **🔄 Auto-Detection**: Automatically detects your system's preferred theme on first visit
- **💾 Persistent Storage**: Your theme preference is saved in localStorage and restored on subsequent visits
- **⚡ Smooth Transitions**: All UI elements transition smoothly between themes for a polished experience
- **🎯 Comprehensive Coverage**: All components, including chat messages, controls, and navigation, support both themes

### Enhanced Navigation
- **🎯 Clean Borders**: Navigation bar features subtle borders for better visual definition
- **📱 Responsive Design**: Navigation adapts seamlessly to different screen sizes
- **🎨 Theme-Aware Styling**: Navigation colors and borders automatically adjust to the current theme
- **⚡ Interactive Elements**: Hover effects and transitions provide clear user feedback

## 🎛️ RAG Controls

The chatbot features an interactive RAG control panel with intuitive controls:

### Top-K Results
- **Range**: 1-20 documents
- **Default**: 10
- **Purpose**: Controls how many relevant documents to retrieve
- **💡 Tip**: Higher values (10-20) provide more context, lower values (1-5) focus on relevance

### Similarity Threshold (Relevance Filter)
- **Range**: 0.01-0.10 (configurable for different use cases)
- **Default**: 0.05 (balanced coverage)
- **Purpose**: Controls how strict document matching is
- **💡 Preset Options**:
  - **Very Flexible** (0.01-0.03): More sources, broader context
  - **Balanced** (0.05): Good quality/quantity balance ⭐ **Recommended**
  - **Very Precise** (0.08-0.10): Fewer sources, more precise matching
- **Auto-save**: Your threshold preference is saved to localStorage
- **Visual Feedback**: Real-time descriptions show current setting impact

### System Prompt Management
- **Toggle**: Enable/disable system prompts
- **Custom Prompts**: Write your own system instructions
- **Auto-save**: Automatically saves custom prompts to localStorage
- **Reset Options**: Restore default prompts or custom ones
- **Purpose**: Control AI personality, tone, and response style

## 🔍 How RAG Works

1. **Query Processing**: User message is converted to embedding vector
2. **Vector Search**: Searches Qdrant collection for similar documents (without threshold)
3. **Context Filtering**: Applies similarity threshold to determine which sources to use
4. **Response Generation**: Gemini uses filtered context to generate informed response
5. **Source Display**: Shows ALL retrieved sources with usage indicators
6. **Memory Storage**: Conversation is saved to Supabase for persistence

### Enhanced Source Visibility

The chatbot now provides complete transparency into the RAG process:
- **All Sources Shown**: See every document retrieved, not just those used
- **Usage Indicators**: Green badges for sources used in the answer, gray for unused
- **Similarity Scores**: View exact similarity scores for each source
- **Summary Statistics**: Quick overview of total retrieved vs. used sources
- **Threshold Impact**: Understand how your settings affect source selection

### Cosine Distance Optimization

This chatbot is specifically optimized for **Cosine distance** similarity scoring:
- **Lower scores = Better similarity** (opposite of Euclidean distance)
- **Configurable range**: 0.01-0.10 for precise control and flexibility
- **Recommended thresholds**:
  - **Very Precise**: 0.08-0.10 (very strict matching)
  - **Balanced**: 0.05 (good quality/quantity balance) ⭐ **Recommended**
  - **Very Flexible**: 0.01-0.03 (broader context inclusion)

## 🛠️ Troubleshooting

### No RAG Results
```bash
# Test similarity scores
node test-similarity-scores.js

# Check collection stats
node setup-qdrant-cloud.js
```

**Common Issues:**
- **Threshold too high**: Try "Balanced" (0.05) or "Very Flexible" (0.02) preset
- **Collection empty**: Add documents to your Qdrant collection
- **Wrong collection name**: Verify `QDRANT_COLLECTION` environment variable
- **Source visibility**: Check that sources are being retrieved (even if not used)

### No AI Responses
- ✅ Check `GOOGLE_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` is set
- ✅ Verify API key has sufficient credits
- ✅ Check browser console for errors

### Memory Persistence Issues
- ✅ Verify Supabase credentials in `.env.local`
- ✅ Check database tables exist
- ✅ Ensure RLS policies are configured

## 📊 Performance Tips

### Optimal RAG Settings
- **Medical queries**: Top-K: 10-15, Threshold: 0.05 (Balanced) or 0.08 (Precise)
- **General queries**: Top-K: 5-10, Threshold: 0.05 (Balanced)
- **Broad searches**: Top-K: 15-20, Threshold: 0.02 (Very Flexible)
- **Quick Start**: Use "Balanced" preset (0.05) for most queries

### Collection Optimization
- **Vector size**: 768 dimensions (text-embedding-004)
- **Distance metric**: Cosine (optimized for document similarity)
- **Indexing**: HNSW for fast approximate search

## 🔌 API Endpoints

- `POST /api/chat` - Main chat endpoint with RAG support
- `POST /api/chat/analyze` - Query analysis for optimal parameters

## 🛠️ Technologies

- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **AI**: Google Gemini 1.5 Flash via @ai-sdk/google
- **Vector Database**: Qdrant Cloud with Cosine distance
- **Database**: Supabase for memory persistence
- **Embeddings**: Google text-embedding-004 (768d)

## 📝 Scripts

- `setup-qdrant-cloud.js` - Test Qdrant connection and setup
- `test-similarity-scores.js` - Analyze similarity score distribution
- `setup-environment.js` - Environment variable validation

## 🎯 Use Cases

- **Medical Documentation**: RAG-powered medical Q&A with source transparency
- **Research Assistant**: Document-based research support with comprehensive source tracking
- **Knowledge Base**: Company/internal documentation search with usage analytics
- **Educational Tool**: Textbook/learning material assistance with learning insights
- **Quality Assurance**: Verify AI responses against source documents
- **Research Validation**: Understand which sources influenced each answer

---

## 🆕 What's New

### Dark Mode & UI Enhancements
- **🌙 Dark Mode Toggle**: Switch between light and dark themes with a single click
- **🎨 System Preference Detection**: Automatically detects and applies your system's preferred theme
- **💾 Theme Persistence**: Your theme preference is saved and restored across sessions
- **🎯 Enhanced Navigation**: Improved nav bar with clean borders and better visual hierarchy
- **⚡ Smooth Transitions**: Seamless theme switching with smooth color transitions

### Enhanced Source Visibility
- **Complete Transparency**: See all retrieved sources, not just those used
- **Usage Indicators**: Visual feedback showing which sources influenced the answer
- **Similarity Scores**: Exact scores for each source with threshold context
- **Summary Statistics**: Quick overview of source utilization

### Improved RAG Controls
- **Preset Buttons**: One-click access to Very Precise, Balanced, and Very Flexible modes
- **Precise Range**: Similarity threshold now 0.01-0.10 for fine-tuned control
- **Visual Feedback**: Real-time descriptions of current settings and their impact
- **Quick Reset**: Easy return to recommended settings with auto-save functionality

### Customizable System Prompts
- **Full Control**: Write your own system instructions
- **Auto-save**: Prompts automatically saved to localStorage
- **Toggle Control**: Enable/disable system prompts as needed
- **Reset Options**: Restore defaults or custom prompts

---

**Ready to chat?** 🚀 Start the development server and begin exploring your documents with AI-powered RAG and complete source transparency!
