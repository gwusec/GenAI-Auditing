// ConversationStore — the persistence SEAM (Phase 2B).
//
// The app must be able to run on local IndexedDB (today) OR a backend like
// Supabase/Postgres (Phase 3) WITHOUT changing UI or ConversationHandler code.
// Every concrete store implements this contract.
//
// Methods mirror exactly what ConversationHandler / db.js consume today, so the
// IndexedDB implementation is a drop-in and the Supabase implementation can be
// swapped in by the factory (see ./index.js) with no caller changes.

/**
 * @typedef {Object} ConversationStore
 * @property {(userID?: string) => Promise<object>} createConversation
 * @property {(id: string) => Promise<object|undefined>} getConversationById
 * @property {() => Promise<object[]>} getAllConversations            // sorted by startTimestamp asc
 * @property {(id: string, data: object) => Promise<object>} updateConversation
 * @property {(id: string) => Promise<void>} deleteConversation
 * @property {(conversation: object) => Promise<any>} addConversation // import an existing object
 * @property {() => Promise<void>} resetDatabase
 */

const NOT_IMPLEMENTED = (name) => {
  throw new Error(`ConversationStore.${name}() not implemented by this store`);
};

/**
 * Base class documenting the contract. Concrete stores may extend this (to get
 * helpful "not implemented" errors for any method they forget) or simply provide
 * an object with the same method names.
 */
export class BaseConversationStore {
  async createConversation() { return NOT_IMPLEMENTED('createConversation'); }
  async getConversationById() { return NOT_IMPLEMENTED('getConversationById'); }
  async getAllConversations() { return NOT_IMPLEMENTED('getAllConversations'); }
  async updateConversation() { return NOT_IMPLEMENTED('updateConversation'); }
  async deleteConversation() { return NOT_IMPLEMENTED('deleteConversation'); }
  async addConversation() { return NOT_IMPLEMENTED('addConversation'); }
  async resetDatabase() { return NOT_IMPLEMENTED('resetDatabase'); }
}

export default BaseConversationStore;
