import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Create a singleton Supabase client for the browser
let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    // Never expose SERVICE_ROLE to the browser; prefer public anon key
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    
    // Check if we have valid URL and key (not placeholder values)
    if (!url || !key || url.includes('your_') || key.includes('your_')) {
        console.log('Supabase not configured - using placeholder values');
        return null;
    }
    
    // Return cached client if available
    if (supabaseClient) return supabaseClient;
    
    try {
        supabaseClient = createClient(url, key, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
            global: {
                headers: {
                    // Ensure edge-friendly fetch is used automatically
                },
            },
        });
        
        return supabaseClient;
    } catch (error) {
        console.error('Failed to create Supabase client:', error);
        return null;
    }
}

// Export a function that always returns a valid client or throws an error
export function getSupabase(): SupabaseClient {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error('Supabase client not initialized. Please check your environment variables.');
    }
    return client;
}

// Export the client for direct use (legacy support)
export const supabase = getSupabaseClient();

export interface ChatLogRow {
    id?: string;
    created_at?: string;
    user_message: string;
    model: string;
    used_context: boolean;
    context_preview?: string | null;
    response_preview?: string | null;
    metadata?: Record<string, unknown> | null;
}

export async function logChatEvent(row: ChatLogRow): Promise<void> {
    const client = getSupabaseClient();
    const table = process.env.SUPABASE_CHAT_TABLE || 'chat_logs';
    if (!client) return;
    try {
        const { error } = await client.from(table).insert([row]);
        if (error) console.warn('Supabase log insert error:', error.message);
    } catch (err) {
        console.warn('Supabase logging failed:', err);
    }
}

