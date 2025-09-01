-- Create the chat_messages_chatbot table for memory persistence
CREATE TABLE IF NOT EXISTS chat_messages_chatbot (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    session_id TEXT NOT NULL,
    sources JSONB DEFAULT '[]'::jsonb,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient session queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_chatbot_session_id ON chat_messages_chatbot(session_id);

-- Create index for timestamp queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_chatbot_timestamp ON chat_messages_chatbot(timestamp);

-- Enable Row Level Security (RLS) - you can disable this if you don't need it
ALTER TABLE chat_messages_chatbot ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations (adjust based on your security needs)
-- You can modify this policy based on your authentication requirements
CREATE POLICY "Allow all operations on chat_messages_chatbot" ON chat_messages_chatbot
    FOR ALL USING (true);

-- Optional: Add a foreign key constraint if you have a sessions table
-- ALTER TABLE chat_messages_chatbot ADD CONSTRAINT fk_session
--     FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE;
