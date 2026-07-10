// SupabaseStore — production conversation persistence via supabase-js v2.
// Maps the in-app Conversation object to the `conversations` table. Rehydrates
// rows back into Conversation instances so ConversationHandler can call methods
// (addChatEvent/updateState/...) on them. RLS scopes data per auditor/study.

import { Conversation } from '../models';
import { BaseConversationStore } from './ConversationStore';
import { getSupabaseClient } from '../supabaseClient';

const NEEDS_SETUP =
  'SupabaseStore is not configured. Set REACT_APP_SUPABASE_URL / ' +
  'REACT_APP_SUPABASE_ANON_KEY and REACT_APP_PERSISTENCE=supabase. See supabase/SETUP.md.';

function rowToConversation(row) {
  if (!row) return undefined;
  const c = Object.create(Conversation.prototype); // instance with methods, our data
  c.id = row.id;
  c.userID = row.auditor_id ?? null;
  c.studyId = row.study_id ?? null;
  c.sessionId = row.session_id ?? null;
  c.startTimestamp = row.start_timestamp ?? null;
  c.endTimestamp = row.end_timestamp ?? null;
  c.chatEvents = row.chat_events || [];
  c.audit = row.audit || {};
  c.state = row.state;
  // Provenance columns (0003, PRD §9 D9) → in-app provenance/controlContext,
  // so seed_prompt context building survives a reload against Supabase.
  c.provenance = row.control_mode
    ? {
        controlMode: row.control_mode,
        seedOrFirstTurnText: row.seed_or_first_turn_text ?? null,
        modelConfigId: row.model_config_id ?? null,
        modelConfigVersion: row.model_config_version ?? null,
        configVersion: row.config_version ?? null,
      }
    : null;
  c.controlContext = row.control_mode === 'seed_prompt'
    ? { mode: 'seed_prompt', seedPrompt: row.seed_or_first_turn_text ?? null }
    : null;
  return c;
}

export class SupabaseStore extends BaseConversationStore {
  constructor({ client = null, studyId = null } = {}) {
    super();
    this.client = client || getSupabaseClient();
    this.studyId = studyId || process.env.REACT_APP_STUDY_ID || null;
  }

  get isConfigured() { return Boolean(this.client); }
  _c() { if (!this.client) throw new Error(NEEDS_SETUP); return this.client; }

  _toRow(conv) {
    const p = conv.provenance || null;
    return {
      id: conv.id,
      study_id: this.studyId ?? conv.studyId ?? null,
      session_id: conv.sessionId ?? null,
      state: conv.state,
      chat_events: conv.chatEvents || [],
      audit: conv.audit || {},
      start_timestamp: conv.startTimestamp ?? null,
      end_timestamp: conv.endTimestamp ?? null,
      // Provenance columns (0003) — explicit, exportable condition record.
      control_mode: p ? p.controlMode ?? null : null,
      seed_or_first_turn_text: p ? p.seedOrFirstTurnText ?? null : null,
      model_config_id: p ? p.modelConfigId ?? null : null,
      model_config_version: p ? p.modelConfigVersion ?? null : null,
      config_version: p ? p.configVersion ?? null : null,
    };
  }

  async createConversation(userID) {
    const conv = new Conversation(userID); // client-side id + initial shape
    const row = this._toRow(conv);
    // auditor_id defaults to auth.uid() server-side (see 0002_auth_glue.sql)
    const { data, error } = await this._c().from('conversations').insert(row).select().single();
    if (error) throw error;
    return rowToConversation(data);
  }

  async getConversationById(id) {
    const { data, error } = await this._c()
      .from('conversations').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return rowToConversation(data);
  }

  async getAllConversations() {
    let q = this._c().from('conversations').select('*').order('start_timestamp', { ascending: true });
    if (this.studyId) q = q.eq('study_id', this.studyId);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(rowToConversation);
  }

  async updateConversation(id, updatedData) {
    const row = this._toRow(updatedData);
    delete row.id;
    const { data, error } = await this._c()
      .from('conversations').update(row).eq('id', id).select().single();
    if (error) throw error;
    return rowToConversation(data);
  }

  async deleteConversation(id) {
    const { error } = await this._c().from('conversations').delete().eq('id', id);
    if (error) throw error;
  }

  async addConversation(conversation) {
    const { data, error } = await this._c()
      .from('conversations').insert(this._toRow(conversation)).select().single();
    if (error) throw error;
    return rowToConversation(data);
  }

  // Scoped reset: removes the caller's own conversations (RLS prevents touching
  // others'). Used by the view-only import path.
  async resetDatabase() {
    let q = this._c().from('conversations').delete();
    if (this.studyId) q = q.eq('study_id', this.studyId);
    else q = q.not('id', 'is', null);
    const { error } = await q;
    if (error) throw error;
  }
}

export default SupabaseStore;
