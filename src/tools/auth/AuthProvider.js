// AuthProvider — the authentication SEAM (Phase 3 / Feature 0).
//
// One interface for: investigator accounts (email/password), anonymous auditors
// (link/code entry), and upgrading an anonymous session to a real account. A mock
// implementation backs local dev/tests; a Supabase implementation activates later
// with zero caller changes.
//
// User shape: { id: string, email: string|null, displayName: string|null, isAnonymous: boolean }

/**
 * @typedef {Object} AuthUser
 * @property {string} id
 * @property {string|null} email
 * @property {string|null} displayName
 * @property {boolean} isAnonymous
 */

const NI = (m) => { throw new Error(`AuthProvider.${m}() not implemented`); };

export class BaseAuthProvider {
  async signUp() { return NI('signUp'); }            // {email,password,displayName} -> AuthUser
  async signIn() { return NI('signIn'); }            // {email,password} -> AuthUser
  async signInAnonymously() { return NI('signInAnonymously'); } // -> AuthUser (isAnonymous)
  async linkEmail() { return NI('linkEmail'); }      // {email,password,displayName} -> AuthUser (upgrade anon)
  async signOut() { return NI('signOut'); }
  getCurrentUser() { return NI('getCurrentUser'); }  // -> AuthUser | null
  onAuthChange() { return NI('onAuthChange'); }      // (cb) -> unsubscribe()
}

export default BaseAuthProvider;
