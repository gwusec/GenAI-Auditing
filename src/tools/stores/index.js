// ConversationStore factory (Phase 2B seam entry point).
//
// Chooses the persistence backend at runtime. Defaults to local IndexedDB so the
// app behaves exactly as before; set REACT_APP_PERSISTENCE=supabase (and provide
// the Supabase env vars) to switch — no caller changes required.

import IndexedDBStore from './IndexedDBStore';
import SupabaseStore from './SupabaseStore';

let singleton = null;
let override = null; // runtime override (e.g. demo forces local persistence)

export function createConversationStore(kind = process.env.REACT_APP_PERSISTENCE || 'indexeddb', options = {}) {
  switch ((kind || '').toLowerCase()) {
    case 'supabase':
      return new SupabaseStore(options);
    case 'indexeddb':
    case 'local':
    case '':
      return new IndexedDBStore(options.dbName);
    default:
      throw new Error(`Unknown persistence backend: ${kind}`);
  }
}

/** Force a persistence backend at runtime (resets the shared store). */
export function setPersistenceOverride(kind) {
  override = kind;
  singleton = null;
}

/** Lazily-created shared store used by the app. */
export function getConversationStore() {
  if (!singleton) {
    singleton = createConversationStore(override || undefined);
  }
  return singleton;
}

export { IndexedDBStore, SupabaseStore };
export default getConversationStore;
