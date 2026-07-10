// SessionService — the AuditorSession SEAM (Phase B step 4; scope §4.1).
//
// An AuditorSession is one auditor's run through one study. It groups the N
// conversations, tracks progress to N, holds the consent record (gate rendering is
// Phase C / AUD-3) and the opaque launch_metadata (capture is SC-13 / D7), and
// stamps the config version in force (provenance, D9). A mock implementation backs
// dev/tests now; a Supabase implementation (auditor_sessions table + RLS) lands in
// Phase E.
//
// Session: {
//   id, studyId, auditorId|null (null = anonymous), anonymous: boolean,
//   configVersion,
//   expectedConversations, completedConversations,
//   conversationIds: string[],
//   status: 'in_progress' | 'complete',
//   consentRecord: null | { version, agreed: true, timestamp },
//   launchMetadata: null | object,
//   createdAt
// }

const NI = (m) => { throw new Error(`SessionService.${m}() not implemented`); };

export class BaseSessionService {
  async createSession() { return NI('createSession'); }            // (studyId, auditorId|null, {configVersion, expectedConversations, launchMetadata?}) -> Session
  async getSession() { return NI('getSession'); }                  // (id) -> Session | null
  async recordConsent() { return NI('recordConsent'); }            // (id, {version}) -> Session
  async attachConversation() { return NI('attachConversation'); }  // (id, conversationId) -> Session
  async completeConversation() { return NI('completeConversation'); } // (id) -> Session (progress to N)
  async listSessionsForStudy() { return NI('listSessionsForStudy'); } // (studyId) -> [Session]
}

export default BaseSessionService;
