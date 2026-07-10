// StudyService factory (Phase 3 seam entry point).
// Defaults to the mock service; set REACT_APP_STUDIES=supabase to use the real one.

import MockStudyService from './MockStudyService';
import SupabaseStudyService from './SupabaseStudyService';

let singleton = null;

export function createStudyService(kind = process.env.REACT_APP_STUDIES || 'mock', options = {}) {
  switch ((kind || '').toLowerCase()) {
    case 'supabase':
      return new SupabaseStudyService(options);
    case 'mock':
    case '':
      return new MockStudyService({ persist: true, ...options });
    default:
      throw new Error(`Unknown study service: ${kind}`);
  }
}

export function getStudyService() {
  if (!singleton) singleton = createStudyService();
  return singleton;
}

export { MockStudyService, SupabaseStudyService };
export default getStudyService;
