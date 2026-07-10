// Shared Supabase client (browser). Created lazily on first use, but using a
// STATIC import of createClient — a require() here breaks under webpack's CJS
// interop (createClient comes back undefined in the browser bundle). The client
// is only constructed when the Supabase env vars are present, so the mock-backed
// test suite (no env) never builds a real client.

import { createClient } from '@supabase/supabase-js';

let _client = null;
let _tried = false;

export function getSupabaseClient() {
  if (_tried) return _client;
  _tried = true;
  const url = process.env.REACT_APP_SUPABASE_URL;
  const key = process.env.REACT_APP_SUPABASE_ANON_KEY;
  if (!url || !key) return null; // unconfigured -> adapters stay in "not configured" mode
  _client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return _client;
}

export default getSupabaseClient;
