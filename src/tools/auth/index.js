// Auth factory (Phase 3 seam entry point).
// Defaults to the mock provider so dev/tests work with no backend; set
// REACT_APP_AUTH=supabase to use the real provider once configured.

import MockAuthProvider from './MockAuthProvider';
import SupabaseAuthProvider from './SupabaseAuthProvider';

let singleton = null;

export function createAuthProvider(kind = process.env.REACT_APP_AUTH || 'mock', options = {}) {
  switch ((kind || '').toLowerCase()) {
    case 'supabase':
      return new SupabaseAuthProvider(options);
    case 'mock':
    case '':
      return new MockAuthProvider({ persist: true, ...options });
    default:
      throw new Error(`Unknown auth provider: ${kind}`);
  }
}

export function getAuthProvider() {
  if (!singleton) singleton = createAuthProvider();
  return singleton;
}

export { MockAuthProvider, SupabaseAuthProvider };
export default getAuthProvider;
