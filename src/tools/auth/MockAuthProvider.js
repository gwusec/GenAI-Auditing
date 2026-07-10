// MockAuthProvider — in-memory auth for local dev and tests. Encodes the real
// semantics (accounts, anonymous sessions, anon->account upgrade) so Feature 0
// UI/logic can be built and tested without a live Supabase project.
//
// Persistence: optional localStorage so a dev session survives reloads. Passwords
// are NOT hashed — this is a mock for development only, never for production.

import * as uuid from 'uuid';
import { BaseAuthProvider } from './AuthProvider';

const STORAGE_KEY = 'trails_mock_auth';

export class MockAuthProvider extends BaseAuthProvider {
  constructor({ persist = false } = {}) {
    super();
    this.persist = persist;
    this.users = new Map();        // id -> { id, email, password, displayName, isAnonymous }
    this.byEmail = new Map();      // email -> id
    this.currentId = null;
    this.listeners = new Set();
    this._load();
  }

  _load() {
    if (!this.persist || typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      (data.users || []).forEach((u) => {
        this.users.set(u.id, u);
        if (u.email) this.byEmail.set(u.email, u.id);
      });
      this.currentId = data.currentId || null;
    } catch (_) { /* ignore corrupt cache */ }
  }

  _save() {
    if (!this.persist || typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      users: [...this.users.values()],
      currentId: this.currentId,
    }));
  }

  _public(u) {
    if (!u) return null;
    return { id: u.id, email: u.email ?? null, displayName: u.displayName ?? null, isAnonymous: !!u.isAnonymous };
  }

  _emit() {
    const u = this.getCurrentUser();
    this.listeners.forEach((cb) => cb(u));
  }

  _setCurrent(id) {
    this.currentId = id;
    this._save();
    this._emit();
  }

  async signUp({ email, password, displayName = null }) {
    if (!email || !password) throw new Error('email and password are required');
    if (this.byEmail.has(email)) throw new Error('An account with that email already exists');
    const user = { id: uuid.v4(), email, password, displayName, isAnonymous: false };
    this.users.set(user.id, user);
    this.byEmail.set(email, user.id);
    this._setCurrent(user.id);
    return this._public(user);
  }

  async signIn({ email, password }) {
    const id = this.byEmail.get(email);
    const user = id && this.users.get(id);
    if (!user || user.password !== password) throw new Error('Invalid email or password');
    this._setCurrent(user.id);
    return this._public(user);
  }

  async signInAnonymously() {
    const user = { id: uuid.v4(), email: null, password: null, displayName: null, isAnonymous: true };
    this.users.set(user.id, user);
    this._setCurrent(user.id);
    return this._public(user);
  }

  // Upgrade the current anonymous session into a real account, preserving the id
  // (so any data created while anonymous stays attached) — mirrors Supabase's
  // anonymous->permanent linking.
  async linkEmail({ email, password, displayName = null }) {
    const user = this.currentId && this.users.get(this.currentId);
    if (!user) throw new Error('No active session to upgrade');
    if (!user.isAnonymous) throw new Error('Current account is already permanent');
    if (this.byEmail.has(email)) throw new Error('An account with that email already exists');
    user.email = email;
    user.password = password;
    user.displayName = displayName;
    user.isAnonymous = false;
    this.byEmail.set(email, user.id);
    this._save();
    this._emit();
    return this._public(user);
  }

  async signOut() {
    this._setCurrent(null);
  }

  getCurrentUser() {
    return this._public(this.currentId && this.users.get(this.currentId));
  }

  onAuthChange(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}

export default MockAuthProvider;
