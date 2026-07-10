// SessionService factory (Phase B seam entry point).
// Defaults to the mock service; set REACT_APP_SESSIONS=supabase to use the real one.

import MockSessionService from './MockSessionService';
import SupabaseSessionService from './SupabaseSessionService';

let singleton = null;

export function createSessionService(kind = process.env.REACT_APP_SESSIONS || 'mock', options = {}) {
  switch ((kind || '').toLowerCase()) {
    case 'supabase':
      return new SupabaseSessionService(options);
    case 'mock':
    case '':
      return new MockSessionService({ persist: true, ...options });
    default:
      throw new Error(`Unknown session service: ${kind}`);
  }
}

export function getSessionService() {
  if (!singleton) singleton = createSessionService();
  return singleton;
}

export { MockSessionService, SupabaseSessionService };
export { parseLaunchMetadata } from './launchMetadata';
export default getSessionService;
