-- Migration: chat_messages_chatbot -> chat_messages_ragbot (idempotent)

-- 1) Create target table if it does not exist
CREATE TABLE IF NOT EXISTS chat_messages_ragbot (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  session_id TEXT NOT NULL,
  sources JSONB DEFAULT '[]'::jsonb,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Ensure helpful indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_ragbot_session_id ON chat_messages_ragbot(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_ragbot_timestamp ON chat_messages_ragbot(timestamp);

-- 3) Copy data from old table into new table (skip duplicates)
INSERT INTO chat_messages_ragbot (id, role, content, session_id, sources, timestamp)
SELECT id, role, content, session_id, sources, timestamp
FROM chat_messages_chatbot
ON CONFLICT (id) DO NOTHING;

-- 4) Verify counts (optional)
-- SELECT 'old' AS which, COUNT(*) FROM chat_messages_chatbot
-- UNION ALL
-- SELECT 'new' AS which, COUNT(*) FROM chat_messages_ragbot;

-- 5) (Optional) Once verified, you may drop the old table
-- DROP TABLE chat_messages_chatbot;

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