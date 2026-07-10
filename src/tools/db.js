// TRAILS-Chatbot/src/tools/db.js
//
// BACKWARD-COMPAT SHIM (Phase 2B). The persistence logic now lives behind the
// ConversationStore seam (./stores). This module preserves the historical
// `db.*` API so existing imports (ConversationHandler, FinalAssessment) keep
// working unchanged, while delegating to whichever store the factory selects
// (IndexedDB by default; Supabase when configured).
//
// New code should prefer: import { getConversationStore } from './stores';

import { getConversationStore } from './stores';

// Resolve the store per-call (not captured once) so a runtime persistence
// override (e.g. demo mode forcing local storage) takes effect.
const db = {
  initializeDatabase: async () => {},
  createConversation: (userID) => getConversationStore().createConversation(userID),
  getConversationById: (id) => getConversationStore().getConversationById(id),
  getAllConversations: () => getConversationStore().getAllConversations(),
  updateConversation: (id, updatedData) => getConversationStore().updateConversation(id, updatedData),
  deleteConversation: (id) => getConversationStore().deleteConversation(id),
  addConversation: (conversation) => getConversationStore().addConversation(conversation),
  resetDatabase: () => getConversationStore().resetDatabase(),
};

export { db };
export default db;
