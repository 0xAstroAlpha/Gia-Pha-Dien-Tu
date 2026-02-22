import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let _supabase: SupabaseClient | null = null;

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        if (!_supabase && supabaseUrl && supabaseAnonKey) {
            _supabase = createClient(supabaseUrl, supabaseAnonKey);
        }
        if (!_supabase) {
            // During build/SSR without env vars, return no-op
            if (prop === 'from') return () => ({ select: () => ({ data: [], error: null, order: () => ({ data: [], error: null, order: () => ({ data: [], error: null }) }) }), upsert: () => ({ error: null }), update: () => ({ eq: () => ({ error: null }) }) });
            if (prop === 'auth') return { getSession: () => Promise.resolve({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }), signInWithPassword: () => Promise.resolve({ error: { message: 'Not initialized' } }), signUp: () => Promise.resolve({ error: { message: 'Not initialized' } }), signOut: () => Promise.resolve({}) };
            return () => { };
        }
        return (_supabase as unknown as Record<string, unknown>)[prop as string];
    },
});

/** Create a service-role client for admin operations */
export function createServiceClient() {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
    return createClient(supabaseUrl, serviceKey);
}

