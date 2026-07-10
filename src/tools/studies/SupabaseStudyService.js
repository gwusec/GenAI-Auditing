// SupabaseStudyService — production studies/roles/access via supabase-js v2.
// Maps to studies / study_members / access_codes (see supabase/migrations).
// RLS enforces scoping server-side; redeemAccessCode uses the SECURITY DEFINER
// RPC from 0002_auth_glue.sql so anonymous auditors can join.

import { BaseStudyService } from './StudyService';
import { getSupabaseClient } from '../supabaseClient';

const NEEDS_SETUP =
  'SupabaseStudyService is not configured. Set Supabase env vars and apply the ' +
  'migrations. See supabase/SETUP.md.';

// Crypto-random access codes (10 chars, unambiguous upper-case alphabet ≈ 50
// bits). The old Math.random 6-char base36 (~31 bits, non-crypto) was guessable
// for an unthrottled redeem RPC. Upper-case to match the RPC's upper() compare.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I/L/O/0/1
function genCode(length = 10) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}
function mapStudy(r) {
  if (!r) return null;
  return {
    id: r.id, ownerId: r.owner_id, title: r.title, description: r.description,
    config: r.config, status: r.status, createdAt: r.created_at,
  };
}

export class SupabaseStudyService extends BaseStudyService {
  constructor({ client = null } = {}) {
    super();
    this.client = client || getSupabaseClient();
  }
  get isConfigured() { return Boolean(this.client); }
  _c() { if (!this.client) throw new Error(NEEDS_SETUP); return this.client; }

  async createStudy(ownerId, { title, description = '', config = {} } = {}) {
    const c = this._c();
    const { data: study, error } = await c
      .from('studies')
      .insert({ owner_id: ownerId, title, description, config })
      .select().single();
    if (error) throw error;
    const { error: memErr } = await c
      .from('study_members')
      .insert({ study_id: study.id, user_id: ownerId, role: 'investigator' });
    if (memErr) throw memErr;
    return mapStudy(study);
  }

  async getStudy(id) {
    const { data, error } = await this._c().from('studies').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return mapStudy(data);
  }

  async listStudiesForUser(userId) {
    const { data, error } = await this._c()
      .from('study_members')
      .select('role, studies(*)')
      .eq('user_id', userId);
    if (error) throw error;
    const byId = new Map();
    for (const row of data || []) {
      const s = row.studies;
      if (!s) continue;
      if (!byId.has(s.id)) byId.set(s.id, { ...mapStudy(s), roles: [] });
      byId.get(s.id).roles.push(row.role);
    }
    return [...byId.values()].map((s) => ({ ...s, roles: [...new Set(s.roles)] }));
  }

  async updateStudy(id, _asUserId, patch = {}) {
    const allowed = (({ title, description, config, status }) => ({ title, description, config, status }))(patch);
    Object.keys(allowed).forEach((k) => allowed[k] === undefined && delete allowed[k]);
    const { data, error } = await this._c()
      .from('studies').update(allowed).eq('id', id).select().single();
    if (error) throw error;
    return mapStudy(data);
  }

  async addMember(studyId, _asUserId, userId, role) {
    const { error } = await this._c()
      .from('study_members').insert({ study_id: studyId, user_id: userId, role });
    if (error) throw error;
  }

  async listMembers(studyId) {
    const { data, error } = await this._c()
      .from('study_members').select('*').eq('study_id', studyId);
    if (error) throw error;
    return data || [];
  }

  async getUserRoles(studyId, userId) {
    const { data, error } = await this._c()
      .from('study_members').select('role').eq('study_id', studyId).eq('user_id', userId);
    if (error) throw error;
    return [...new Set((data || []).map((r) => r.role))];
  }

  async createAccessCode(studyId, _asUserId, { maxUses = null, expiresAt = null } = {}) {
    const c = this._c();
    const code = genCode(); // stored upper-case to match the redeem RPC's upper()
    const { data, error } = await c
      .from('access_codes')
      .insert({
        study_id: studyId, code, max_uses: maxUses,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      })
      .select().single();
    if (error) throw error;
    return { code: data.code, studyId: data.study_id, maxUses: data.max_uses, uses: data.uses, expiresAt: data.expires_at };
  }

  async redeemAccessCode(code /* , userId (server uses auth.uid()) */) {
    // The study-open gate (SC-11) is enforced inside the redeem_access_code RPC in
    // SQL (see the Phase E migration deltas in supabase/README.md).
    const { data, error } = await this._c().rpc('redeem_access_code', { p_code: code });
    if (error) throw error;
    return data; // study_id (uuid)
  }

  async openStudy(id, asUserId) {
    return this.updateStudy(id, asUserId, { status: 'open' });
  }

  async closeStudy(id, asUserId) {
    return this.updateStudy(id, asUserId, { status: 'closed' });
  }
}

export default SupabaseStudyService;
