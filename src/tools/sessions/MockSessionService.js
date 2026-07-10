// MockSessionService — in-memory AuditorSessions for dev and tests. Mirrors the
// rules the Supabase auditor_sessions table + RLS will enforce in Phase E.

import * as uuid from 'uuid';
import { BaseSessionService } from './SessionService';

const STORAGE_KEY = 'trails_mock_sessions';

export class MockSessionService extends BaseSessionService {
  constructor({ persist = false } = {}) {
    super();
    this.persist = persist;
    this.sessions = new Map(); // id -> session
    this._load();
  }

  _load() {
    if (!this.persist || typeof localStorage === 'undefined') return;
    try {
      const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      (d?.sessions || []).forEach((s) => this.sessions.set(s.id, s));
    } catch (_) { /* ignore */ }
  }

  _save() {
    if (!this.persist || typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions: [...this.sessions.values()] }));
  }

  _get(id) {
    const s = this.sessions.get(id);
    if (!s) throw new Error('Session not found');
    return s;
  }

  _recomputeStatus(s) {
    s.status = s.completedConversations >= s.expectedConversations ? 'complete' : 'in_progress';
  }

  async createSession(studyId, auditorId = null, { configVersion = null, expectedConversations, launchMetadata = null } = {}) {
    if (!studyId) throw new Error('studyId is required');
    if (!Number.isInteger(expectedConversations) || expectedConversations < 1) {
      throw new Error('expectedConversations must be an integer >= 1');
    }
    const session = {
      id: uuid.v4(),
      studyId,
      auditorId: auditorId || null,
      anonymous: !auditorId,
      configVersion,
      expectedConversations,
      completedConversations: 0,
      conversationIds: [],
      status: 'in_progress',
      consentRecord: null,
      launchMetadata: launchMetadata || null,
      createdAt: Date.now(),
    };
    this.sessions.set(session.id, session);
    this._save();
    return session;
  }

  async getSession(id) {
    return this.sessions.get(id) || null;
  }

  async recordConsent(id, { version = null } = {}) {
    const s = this._get(id);
    s.consentRecord = { version: version ?? null, agreed: true, timestamp: Date.now() };
    this._save();
    return s;
  }

  async attachConversation(id, conversationId) {
    const s = this._get(id);
    if (!conversationId) throw new Error('conversationId is required');
    if (!s.conversationIds.includes(conversationId)) s.conversationIds.push(conversationId);
    this._save();
    return s;
  }

  async completeConversation(id) {
    const s = this._get(id);
    // never exceed the expected N (idempotent at the ceiling)
    s.completedConversations = Math.min(s.expectedConversations, s.completedConversations + 1);
    this._recomputeStatus(s);
    this._save();
    return s;
  }

  async listSessionsForStudy(studyId) {
    return [...this.sessions.values()].filter((s) => s.studyId === studyId);
  }
}

export default MockSessionService;
