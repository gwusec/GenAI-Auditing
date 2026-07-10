// MockStudyService — in-memory studies/roles/access for dev and tests.
// Enforces role-based scoping in app code so the Feature 0 UI logic is correct
// and testable now; the same rules are enforced by SQL RLS in production.

import * as uuid from 'uuid';
import { BaseStudyService } from './StudyService';

const STORAGE_KEY = 'trails_mock_studies';

// Crypto-random, human-friendly access code (matches SupabaseStudyService).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I/L/O/0/1
function genCode(length = 10) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export class MockStudyService extends BaseStudyService {
  constructor({ persist = false } = {}) {
    super();
    this.persist = persist;
    this.studies = new Map();     // id -> study
    this.members = [];            // [{ studyId, userId, role }]
    this.codes = new Map();       // code -> { code, studyId, maxUses, uses, expiresAt }
    this._load();
  }

  _load() {
    if (!this.persist || typeof localStorage === 'undefined') return;
    try {
      const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!d) return;
      (d.studies || []).forEach((s) => this.studies.set(s.id, s));
      this.members = d.members || [];
      (d.codes || []).forEach((c) => this.codes.set(c.code, c));
    } catch (_) { /* ignore */ }
  }

  _save() {
    if (!this.persist || typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      studies: [...this.studies.values()],
      members: this.members,
      codes: [...this.codes.values()],
    }));
  }

  _isInvestigator(studyId, userId) {
    const s = this.studies.get(studyId);
    if (s && s.ownerId === userId) return true;
    return this.members.some((m) => m.studyId === studyId && m.userId === userId && m.role === 'investigator');
  }

  _isMember(studyId, userId) {
    return this._isInvestigator(studyId, userId) ||
      this.members.some((m) => m.studyId === studyId && m.userId === userId);
  }

  _addMember(studyId, userId, role) {
    const exists = this.members.some((m) => m.studyId === studyId && m.userId === userId && m.role === role);
    if (!exists) this.members.push({ studyId, userId, role });
  }

  async createStudy(ownerId, { title, description = '', config = {} } = {}) {
    if (!ownerId) throw new Error('ownerId is required');
    if (!title) throw new Error('title is required');
    const study = {
      id: uuid.v4(), ownerId, title, description, config,
      status: 'draft', createdAt: Date.now(),
    };
    this.studies.set(study.id, study);
    this._addMember(study.id, ownerId, 'investigator');
    this._save();
    return study;
  }

  async getStudy(id, asUserId) {
    const s = this.studies.get(id);
    if (!s) return null;
    if (!this._isMember(id, asUserId)) throw new Error('Not authorized to view this study');
    return s;
  }

  async listStudiesForUser(userId) {
    const ids = new Set(this.members.filter((m) => m.userId === userId).map((m) => m.studyId));
    return [...ids]
      .map((id) => this.studies.get(id))
      .filter(Boolean)
      .map((s) => ({ ...s, roles: this._rolesFor(s.id, userId) }));
  }

  _rolesFor(studyId, userId) {
    const roles = this.members
      .filter((m) => m.studyId === studyId && m.userId === userId)
      .map((m) => m.role);
    return [...new Set(roles)];
  }

  async getUserRoles(studyId, userId) {
    return this._rolesFor(studyId, userId);
  }

  async updateStudy(id, asUserId, patch = {}) {
    if (!this._isInvestigator(id, asUserId)) throw new Error('Only an investigator can update this study');
    const s = this.studies.get(id);
    if (!s) throw new Error('Study not found');
    const updated = { ...s, ...patch, id: s.id, ownerId: s.ownerId };
    this.studies.set(id, updated);
    this._save();
    return updated;
  }

  async addMember(studyId, asUserId, userId, role) {
    if (!this._isInvestigator(studyId, asUserId)) throw new Error('Only an investigator can add members');
    if (!['investigator', 'auditor'].includes(role)) throw new Error('Invalid role');
    this._addMember(studyId, userId, role);
    this._save();
  }

  async listMembers(studyId, asUserId) {
    if (!this._isInvestigator(studyId, asUserId)) throw new Error('Only an investigator can list members');
    return this.members.filter((m) => m.studyId === studyId);
  }

  async createAccessCode(studyId, asUserId, { maxUses = null, expiresAt = null } = {}) {
    if (!this._isInvestigator(studyId, asUserId)) throw new Error('Only an investigator can create access codes');
    let code = genCode();
    while (this.codes.has(code)) code = genCode();
    const entry = { code, studyId, maxUses, uses: 0, expiresAt };
    this.codes.set(code, entry);
    this._save();
    return entry;
  }

  // Anonymous or authenticated user redeems a code -> becomes an auditor of the study.
  // Code validity is checked first (so code-specific errors surface regardless of
  // study state); then the study-open gate (SC-11): a draft/closed study takes no
  // new participants.
  async redeemAccessCode(code, userId) {
    const entry = this.codes.get((code || '').toUpperCase());
    if (!entry) throw new Error('Invalid access code');
    if (entry.expiresAt && Date.now() > entry.expiresAt) throw new Error('This access code has expired');
    if (entry.maxUses != null && entry.uses >= entry.maxUses) throw new Error('This access code has reached its use limit');
    const study = this.studies.get(entry.studyId);
    if (!study || study.status !== 'open') throw new Error('This study is not open for new participants');
    entry.uses += 1;
    this._addMember(entry.studyId, userId, 'auditor');
    this._save();
    return entry.studyId;
  }

  async openStudy(id, asUserId) {
    return this._setStatus(id, asUserId, 'open');
  }

  async closeStudy(id, asUserId) {
    return this._setStatus(id, asUserId, 'closed');
  }

  _setStatus(id, asUserId, status) {
    if (!this._isInvestigator(id, asUserId)) throw new Error('Only an investigator can change study status');
    const s = this.studies.get(id);
    if (!s) throw new Error('Study not found');
    s.status = status;
    this._save();
    return s;
  }
}

export default MockStudyService;
