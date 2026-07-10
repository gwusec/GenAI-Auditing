// StudyService — the studies/roles/access SEAM (Phase 3 / Feature 0).
//
// Encodes the backbone: investigators create studies and assign per-study roles;
// auditors join (often anonymously) via access codes; data access is scoped by
// role (the app-layer mirror of the SQL Row-Level Security). A mock implementation
// backs dev/tests; a Supabase implementation activates later.
//
// Study:   { id, ownerId, title, description, config, status, createdAt }
// Member:  { studyId, userId, role: 'investigator'|'auditor' }
// Code:    { code, studyId, maxUses, uses, expiresAt }

const NI = (m) => { throw new Error(`StudyService.${m}() not implemented`); };

export class BaseStudyService {
  async createStudy() { return NI('createStudy'); }          // (ownerId,{title,description,config}) -> Study
  async getStudy() { return NI('getStudy'); }                // (id, asUserId) -> Study | null (scoped)
  async listStudiesForUser() { return NI('listStudiesForUser'); } // (userId) -> [{...Study, roles:[]}]
  async updateStudy() { return NI('updateStudy'); }          // (id, asUserId, patch) -> Study (investigator only)
  async addMember() { return NI('addMember'); }              // (studyId, asUserId, userId, role)
  async listMembers() { return NI('listMembers'); }          // (studyId, asUserId) -> [Member] (investigator only)
  async getUserRoles() { return NI('getUserRoles'); }        // (studyId, userId) -> ['investigator'|'auditor']
  async createAccessCode() { return NI('createAccessCode'); } // (studyId, asUserId, {maxUses,expiresAt}) -> Code
  async redeemAccessCode() { return NI('redeemAccessCode'); } // (code, userId) -> studyId (adds auditor; refused unless study is open)
  async openStudy() { return NI('openStudy'); }              // (id, asUserId) -> Study (status -> open; SC-11)
  async closeStudy() { return NI('closeStudy'); }            // (id, asUserId) -> Study (status -> closed; accepts no new sessions)
}

export default BaseStudyService;
