import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function getSupabaseClient(): SupabaseClient | null {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    // RLS bypass for server logging if service role is provided
    return createClient(url, key, {
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
}

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

