import { z } from 'zod';

const envSchema = z.object({
  // Google AI
  GOOGLE_API_KEY: z.string().min(1, 'Google API key is required'),
  
  // Qdrant Vector Database
  QDRANT_URL: z.string().url('QDRANT_URL must be a valid URL'),
  QDRANT_API_KEY: z.string().min(1, 'QDRANT API key is required'),
  QDRANT_COLLECTION: z.string().min(1, 'QDRANT collection name is required'),
  
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Supabase URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key is required'),
  SUPABASE_CHAT_TABLE: z.string().default('chat_logs'),
  CHAT_MESSAGES_TABLE: z.string().default('chat_messages_chatbot'),
  
  // Optional: Rate limiting
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  
  // Optional: Monitoring
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  
  // Optional: CORS
  ALLOWED_ORIGINS: z.string().optional(),
  
  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse(process.env);

// Type-safe environment access
export type Env = z.infer<typeof envSchema>;
