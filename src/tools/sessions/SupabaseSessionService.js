// SupabaseSessionService — production AuditorSessions via supabase-js v2.
// Maps to the `auditor_sessions` table that lands in the Phase E migration
// (see supabase/README.md). RLS scopes a session to its auditor + the study's
// investigators. Inert until a Supabase client is configured.

import { BaseSessionService } from './SessionService';
import { getSupabaseClient } from '../supabaseClient';

const NEEDS_SETUP =
  'SupabaseSessionService is not configured. Set Supabase env vars and apply the ' +
  'migrations (auditor_sessions lands in the Phase E migration). See supabase/SETUP.md.';

function mapSession(r) {
  if (!r) return null;
  return {
    id: r.id,
    studyId: r.study_id,
    auditorId: r.auditor_id,
    anonymous: !r.auditor_id,
    configVersion: r.config_version,
    expectedConversations: r.expected_conversations,
    completedConversations: r.completed_conversations,
    conversationIds: r.conversation_ids || [],
    status: r.status,
    consentRecord: r.consent || null,
    launchMetadata: r.launch_metadata || null,
    createdAt: r.created_at,
  };
}

export class SupabaseSessionService extends BaseSessionService {
  constructor({ client = null } = {}) {
    super();
    this.client = client || getSupabaseClient();
  }

  get isConfigured() { return Boolean(this.client); }
  _c() { if (!this.client) throw new Error(NEEDS_SETUP); return this.client; }

  async createSession(studyId, auditorId = null, { configVersion = null, expectedConversations, launchMetadata = null } = {}) {
    const { data, error } = await this._c()
      .from('auditor_sessions')
      .insert({
        study_id: studyId,
        auditor_id: auditorId,
        config_version: configVersion,
        expected_conversations: expectedConversations,
        completed_conversations: 0,
        status: 'in_progress',
        launch_metadata: launchMetadata,
      })
      .select().single();
    if (error) throw error;
    return mapSession(data);
  }

  async getSession(id) {
    const { data, error } = await this._c()
      .from('auditor_sessions').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return mapSession(data);
  }

  async recordConsent(id, { version = null } = {}) {
    const consent = { version: version ?? null, agreed: true, timestamp: Date.now() };
    const { data, error } = await this._c()
      .from('auditor_sessions').update({ consent }).eq('id', id).select().single();
    if (error) throw error;
    return mapSession(data);
  }

  async attachConversation(id, conversationId) {
    // In SQL this is better modeled by conversations.session_id; this RPC-free
    // path is a placeholder until the Phase E migration wires the FK.
    const { data, error } = await this._c().rpc('attach_conversation_to_session', {
      p_session_id: id, p_conversation_id: conversationId,
    });
    if (error) throw error;
    return mapSession(data);
  }

  async completeConversation(id) {
    const { data, error } = await this._c().rpc('complete_session_conversation', { p_session_id: id });
    if (error) throw error;
    return mapSession(data);
  }

  async listSessionsForStudy(studyId) {
    const { data, error } = await this._c()
      .from('auditor_sessions').select('*').eq('study_id', studyId);
    if (error) throw error;
    return (data || []).map(mapSession);
  }
}

export default SupabaseSessionService;
