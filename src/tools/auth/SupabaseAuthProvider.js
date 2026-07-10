// SupabaseAuthProvider — production auth via Supabase Auth (supabase-js v2).
// Activated when REACT_APP_SUPABASE_URL/ANON_KEY are set and REACT_APP_AUTH=supabase.
// Maintains a cached current user (updated via onAuthStateChange) so the
// synchronous getCurrentUser() in the AuthProvider contract is satisfied.

import { BaseAuthProvider } from './AuthProvider';
import { getSupabaseClient } from '../supabaseClient';

const NEEDS_SETUP =
  'SupabaseAuthProvider is not configured. Set REACT_APP_SUPABASE_URL / ' +
  'REACT_APP_SUPABASE_ANON_KEY and enable anonymous sign-ins. See supabase/SETUP.md.';

function mapUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email ?? null,
    displayName: u.user_metadata?.display_name ?? null,
    isAnonymous: !!u.is_anonymous,
  };
}

export class SupabaseAuthProvider extends BaseAuthProvider {
  constructor({ client = null } = {}) {
    super();
    this.client = client || getSupabaseClient();
    this._user = null;
    this.listeners = new Set();
    if (this.client) {
      // Fires INITIAL_SESSION on load, then on every sign in/out/upgrade.
      this.client.auth.onAuthStateChange((_event, session) => {
        this._user = mapUser(session?.user);
        this.listeners.forEach((cb) => cb(this._user));
      });
    }
  }

  get isConfigured() { return Boolean(this.client); }
  _c() { if (!this.client) throw new Error(NEEDS_SETUP); return this.client; }

  async signUp({ email, password, displayName = null }) {
    const { data, error } = await this._c().auth.signUp({
      email, password, options: { data: { display_name: displayName } },
    });
    if (error) throw error;
    return mapUser(data.user);
  }

  async signIn({ email, password }) {
    const { data, error } = await this._c().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return mapUser(data.user);
  }

  async signInAnonymously() {
    const { data, error } = await this._c().auth.signInAnonymously();
    if (error) throw error;
    return mapUser(data.user);
  }

  // Upgrade the current anonymous session to a permanent account, preserving id.
  async linkEmail({ email, password, displayName = null }) {
    const { data, error } = await this._c().auth.updateUser({
      email, password, data: { display_name: displayName },
    });
    if (error) throw error;
    return mapUser(data.user);
  }

  async signOut() {
    const { error } = await this._c().auth.signOut();
    if (error) throw error;
  }

  getCurrentUser() {
    if (!this.client) throw new Error(NEEDS_SETUP);
    return this._user;
  }

  onAuthChange(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}

export default SupabaseAuthProvider;
