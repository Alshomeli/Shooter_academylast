import { createClient } from '@supabase/supabase-js';

const fallbackUrl = 'http://localhost:54321';
const fallbackAnonKey = 'development-anon-key';

function getSupabaseUrl(): string {
  const value = import.meta.env.VITE_SUPABASE_URL?.trim();
  if (value) return value;

  console.warn('[supabase] Missing VITE_SUPABASE_URL. Falling back to a local placeholder. Configure the env before production deployment.');
  return fallbackUrl;
}

function getSupabaseAnonKey(): string {
  const value = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (value) return value;

  console.warn('[supabase] Missing VITE_SUPABASE_ANON_KEY. Falling back to a local placeholder. Configure the env before production deployment.');
  return fallbackAnonKey;
}

const url = getSupabaseUrl();
const anonKey = getSupabaseAnonKey();

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
