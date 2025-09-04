# Advanced Pulmo RAGbot

A sophisticated Next.js chatbot application powered by Google's Gemini AI with full Qdrant Cloud integration for Retrieval Augmented Generation (RAG), memory persistence, and advanced conversation controls. Features comprehensive source visibility, customizable system prompts, and intuitive RAG parameter management.

## ✨ Features

🤖 **AI-Powered Conversations**: Advanced conversations using Google Gemini 1.5 Flash
🔍 **RAG with Qdrant Cloud**: Full Retrieval-Augmented Generation using vector search
💬 **Streaming Chat**: Real-time streaming chat interface with instant responses
🧱 **Structured Streaming (JSONL)**: Optional JSONL event stream for robust parsing and incremental citations
🧠 **Memory Persistence**: Conversation history stored in Supabase with session management
🎯 **Smart RAG Controls**: Interactive UI for Top-K, cosine threshold, HyDE, Auto tuning, structured stream, and system prompt
⚖️ **Intuitive Similarity Controls**: User-friendly preset buttons (Broader, Balanced, Very Precise) with custom slider
📊 **Comprehensive Source Visibility**: See ALL retrieved sources with clear indicators of which were used
🎭 **Customizable System Prompts**: Full control over AI personality and behavior
📝 **Multi-Session Management**: Switch between different conversation threads
🎨 **Modern UI**: Responsive design with Tailwind CSS and intuitive controls
🌙 **Dark Mode**: Toggleable dark/light theme with system preference detection
🏗️ **Modular Architecture**: Clean component structure with focused, reusable components
🔗 **Cloud Integration**: Seamless integration with Qdrant Cloud for scalable vector storage
📈 **Performance Monitoring**: Built-in debugging and similarity score analysis, timing metadata in logs
🔍 **Source Usage Tracking**: Visual feedback showing used vs. unused sources with similarity scores
📚 **Session Management**: Persistent chats listed in a sidebar (rename/delete/new)
💡 **Sample Questions**: Auto-generated suggestions from your corpus, ask with one click

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
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
# (Server-only) SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_CHAT_TABLE=chat_logs
CHAT_MESSAGES_TABLE=chat_messages_ragbot

# Session Management (Optional but recommended)
CHAT_SESSIONS_TABLE=chat_sessions_ragbot

# Optional: Rate limiting (if using Upstash Redis)
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_redis_token_here

# Optional: Error monitoring (if using Sentry)
# NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project

# Optional: CORS restrictions (comma-separated)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
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
CREATE TABLE chat_messages_ragbot (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    session_id TEXT NOT NULL,
    sources JSONB DEFAULT '[]'::jsonb,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_chat_messages_ragbot_session_id ON chat_messages_ragbot(session_id);
CREATE INDEX idx_chat_messages_ragbot_timestamp ON chat_messages_ragbot(timestamp);
```

#### Chat Sessions Table
```sql
CREATE TABLE IF NOT EXISTS chat_sessions_ragbot (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_ragbot_updated_at ON chat_sessions_ragbot(updated_at);
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
- **🌙 Theme Toggle**: Click the theme toggle button in the chat header to switch between light and dark modes
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

### Cosine Threshold (Relevance Filter)
- **Range**: 0.01–0.1 (optimized for better precision)
- **Default**: 0.05 (balanced)
- **Purpose**: Controls how strict document matching is
- **💡 Preset Options**:
  - **Broader** (0.01) - More flexible matching
  - **Balanced** (0.05) ⭐ **Recommended**
  - **Very Precise** (0.1) - Strict matching
- **Auto-save**: Your threshold preference is saved to localStorage
- **Visual Feedback**: Real-time descriptions show current setting impact

### System Prompt Management
### HyDE (Hypothetical Document Embeddings)
- **Toggle**: Enable/disable HyDE retrieval
- **Behavior**: Generates a hypothetical dense answer and retrieves with its embedding, then merges with user-query hits
- **Tip**: Often improves recall for vague or underspecified questions

### Auto Retrieval Tuning
- **Toggle**: Enable to call the analysis endpoint and auto-adjust Top-K and threshold per query
- **Display**: Per-message badges show actual values used (Top-K, Thresh, HyDE, Auto)

### Structured Stream (JSONL)
- **Toggle**: Switch to JSONL event streaming for robust parsing
- **Events**: `{type:"delta", text}` and final `{type:"sources", ...}`

### Corrective RAG (CRAG)
### Session Management
- **Sidebar (desktop)**: View all sessions, create new, rename, and delete
- **Persistence**: Uses Supabase `chat_sessions_ragbot` and `chat_messages_ragbot`
- **Title**: First user message snippet becomes the session title
- **Toggle**: Enable to add a corrective retrieval loop
- **Pipeline**: Query translation → retrieval → LLM judge → optional refinement → re-retrieval
- **Use case**: Vague queries or when initial retrieval seems thin/irrelevant
- **Toggle**: Enable/disable system prompts
- **Custom Prompts**: Write your own system instructions
- **Auto-save**: Automatically saves custom prompts to localStorage
- **Reset Options**: Restore default prompts or custom ones
- **Purpose**: Control AI personality, tone, and response style

## 🔍 How RAG Works

1. **Query Processing**: User message is converted to embedding vector
2. **Vector Search**: Searches Qdrant collection for similar documents
3. **Context Filtering**: Applies cosine threshold to determine which sources to use
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

### Cosine Similarity Optimization

This chatbot is optimized for **Cosine similarity** as reported by Qdrant (higher = more similar):
- **Higher scores = Better similarity**
- **Optimized threshold range**: 0.01–0.1 (improved precision)
- **Recommended thresholds**:
  - **Very Precise**: 0.08–0.1 (strict matching)
  - **Balanced**: 0.05 (good quality/quantity balance) ⭐ **Recommended**
  - **Broader**: 0.01–0.03 (higher recall)
  - **Very Flexible**: Use 0.01 for maximum recall

## ⚙️ Retrieval Optimization (Advanced)

We provide an aggressive-yet-safe retrieval optimization pipeline to keep context precise and reduce citation-heavy noise. Highlights:

- Tightened dynamic filter: keep candidates within 85% of the top combined score.
- Cosine score floor: `max(user threshold, 0.10)` to drop weak vector hits.
- Reference penalty: increased to reduce citation/reference-only passages.
- Metadata/title boost: small boost for chapter/section/title keyword overlap.
- Acronym-aware boost: exact uppercase query tokens (e.g., `ILD`, `SBRT`) get a small boost when present in text.
- Context cap: use at most 10 sources in the final prompt to avoid flooding the LLM.

Recommended toggle presets:
- Hybrid ON, MMR ON, Cross-encoder ON → highest precision (slower).
- Hybrid ON only → balanced.
- All OFF → baseline.

Suggested UI settings:
- Similarity Threshold: 0.08–0.12 (start 0.10 if noisy, 0.08 if thin).
- Top-K: 10–12 (backend caps context to ~10).

Interpreting logs (server console):
- `Dynamic filter: topCombined=..., rel>=..., cosineFloor>=..., minKw=... Kept X/Y`
- `Post-rerank counts — optimized: A, passing dynamic filter: B, diversified: C, finalUsed: D (cap=...)`
- Optional: `Applied MMR selection, count: ...` and `Applied cross-encoder reranking to ... items`

For a deeper dive, see [`docs/RETRIEVAL_OPTIMIZATION.md`](./docs/RETRIEVAL_OPTIMIZATION.md).

## 🛠️ Troubleshooting

### No RAG Results
```bash
# Test similarity scores
node test-similarity-scores.js

# Check collection stats
node setup-qdrant-cloud.js
```

**Common Issues:**
- **Threshold too high**: Try "Balanced" (0.05) or "Broader" (0.01) preset
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
- **Broad searches**: Top-K: 15-20, Threshold: 0.01 (Broader)
- **Quick Start**: Use "Balanced" preset (0.05) for most queries

### Collection Optimization
- **Vector size**: 768 dimensions (text-embedding-004)
- **Distance metric**: Cosine (optimized for document similarity)
- **Indexing**: HNSW for fast approximate search

## 🔌 API Endpoints

- `POST /api/chat` - Main chat endpoint with RAG support
- `POST /api/chat/analyze` - Query analysis for optimal parameters
- `GET /api/chat/suggestions` - Generates sample questions from random corpus snippets

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

### Component Architecture Refactoring
- **🏗️ Modular Components**: ChatUI split into focused, reusable components for better maintainability
- **📁 Organized Structure**: New component hierarchy with dedicated chat components
  - `ChatHeader` - Session management and theme controls
  - `ChatInput` - Message input and action buttons
  - `SessionSidebar` - Session list and management
  - `RAGControls` - All RAG parameter controls
  - `SampleQuestions` - Dynamic question suggestions
- **🎯 Single Responsibility**: Each component handles one specific aspect of the UI
- **🔧 Improved Maintainability**: Reduced main component from 1593 lines to ~400 lines
- **📝 Type Safety**: Comprehensive TypeScript interfaces in dedicated types file

### Threshold Range Optimization
- **🎯 Improved Precision**: Threshold range updated from 0.60-0.95 to 0.01-0.1 for better document matching
- **⚖️ Better Balance**: New default of 0.05 provides optimal precision/recall balance
- **🚀 Enhanced Performance**: More granular control over document relevance filtering
- **💡 Updated Presets**: Broader (0.01), Balanced (0.05), Very Precise (0.1)

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
- **HyDE & Auto**: Toggle hypothetical retrieval and auto-tuned parameters
- **Cosine Threshold**: 0.01–0.1 range with presets (0.01/0.05/0.1) - optimized for better precision
- **Structured Streaming (JSONL)**: Robust incremental streaming and citations

### Retrieval Optimization Updates
- Increased reference penalty and added acronym-aware + metadata/title boosts for better precision
- Raised cosine floor to 0.10 and added relative cutoff at 85% of top combined score
- Context capped to 10 sources to avoid prompt bloat

## 🛡️ Operations

### Sentry Error Monitoring (Optional)
1. Install deps (already included): `@sentry/nextjs`
2. Set DSN: `NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn`
3. Build/deploy. Errors and stream failures will be captured automatically.

### Rate Limiting (Optional)
- Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. The chat API limits to ~60 req/min/IP when configured.

### CORS (Optional)
- Set `ALLOWED_ORIGINS` to a comma-separated list of allowed origins. Otherwise default allows any origin.

### Health Dashboard
- Visit `/health-ui` to see health status and latencies sourced from `/api/health`.

### Docker
1. Build: `docker build -t pulmo-ragbot .`
2. Run: `docker run -p 3000:3000 --env-file .env.local pulmo-ragbot`
 
### Vercel Deployment
1. Push to a Git repo and import the project in Vercel
2. Set Environment Variables in Vercel Project Settings:
   - `GOOGLE_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`
   - `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION`
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (optional, server-only)
   - `CHAT_SESSIONS_TABLE=chat_sessions_ragbot` (recommended)
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (optional)
   - `NEXT_PUBLIC_SENTRY_DSN` (optional)
   - `ALLOWED_ORIGINS` (optional)
3. Deploy. The app uses Edge runtime for chat routes; `vercel.json` sets function max duration and headers.
4. Verify:
   - `/api/health` returns healthy
   - Chat works with your corpus
   - Sessions appear in sidebar and can be renamed/deleted
- **Visual Feedback**: Real-time descriptions of current settings and their impact
- **Quick Reset**: Easy return to recommended settings with auto-save functionality

### Customizable System Prompts
- **Full Control**: Write your own system instructions
- **Auto-save**: Prompts automatically saved to localStorage
- **Toggle Control**: Enable/disable system prompts as needed
- **Reset Options**: Restore defaults or custom prompts

---

**Ready to chat?** 🚀 Start the development server and begin exploring your documents with AI-powered RAG and complete source transparency!
