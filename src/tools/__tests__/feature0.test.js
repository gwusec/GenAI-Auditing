// Tests for Feature 0 backbone: auth (accounts + anonymous + upgrade) and
// studies (per-study roles, access codes, anonymous redemption, scoping).

import { MockAuthProvider } from '../auth';
import { MockStudyService } from '../studies';
import { createAuthProvider } from '../auth';
import { createStudyService } from '../studies';

describe('MockAuthProvider', () => {
  let auth;
  beforeEach(() => { auth = new MockAuthProvider({ persist: false }); });

  test('sign up creates a permanent account and sets it current', async () => {
    const u = await auth.signUp({ email: 'pi@example.com', password: 'pw', displayName: 'PI' });
    expect(u.isAnonymous).toBe(false);
    expect(u.email).toBe('pi@example.com');
    expect(auth.getCurrentUser().id).toBe(u.id);
  });

  test('duplicate email is rejected', async () => {
    await auth.signUp({ email: 'a@b.com', password: 'pw' });
    await expect(auth.signUp({ email: 'a@b.com', password: 'pw2' })).rejects.toThrow(/already exists/);
  });

  test('sign in validates credentials', async () => {
    await auth.signUp({ email: 'a@b.com', password: 'pw' });
    await auth.signOut();
    await expect(auth.signIn({ email: 'a@b.com', password: 'wrong' })).rejects.toThrow(/Invalid/);
    const u = await auth.signIn({ email: 'a@b.com', password: 'pw' });
    expect(u.email).toBe('a@b.com');
  });

  test('anonymous sign-in, then upgrade preserves the same id', async () => {
    const anon = await auth.signInAnonymously();
    expect(anon.isAnonymous).toBe(true);
    const upgraded = await auth.linkEmail({ email: 'late@b.com', password: 'pw', displayName: 'Late' });
    expect(upgraded.id).toBe(anon.id);        // identity preserved -> data stays attached
    expect(upgraded.isAnonymous).toBe(false);
    expect(upgraded.email).toBe('late@b.com');
  });

  test('onAuthChange fires on sign in/out', async () => {
    const seen = [];
    const off = auth.onAuthChange((u) => seen.push(u ? u.id : null));
    const u = await auth.signUp({ email: 'x@y.com', password: 'pw' });
    await auth.signOut();
    off();
    expect(seen).toEqual([u.id, null]);
  });
});

describe('MockStudyService — roles, scoping, access codes', () => {
  let studies;
  const PI = 'pi-1';
  const PI2 = 'pi-2';
  const AUDITOR = 'auditor-1';
  beforeEach(() => { studies = new MockStudyService({ persist: false }); });

  test('creating a study makes the owner an investigator', async () => {
    const s = await studies.createStudy(PI, { title: 'Study A' });
    expect(await studies.getUserRoles(s.id, PI)).toEqual(['investigator']);
  });

  test('a non-member cannot view a study (RLS-equivalent)', async () => {
    const s = await studies.createStudy(PI, { title: 'Study A' });
    await expect(studies.getStudy(s.id, PI2)).rejects.toThrow(/Not authorized/);
    expect(await studies.getStudy(s.id, PI)).toBeTruthy();
  });

  test('only an investigator can update a study or list members', async () => {
    const s = await studies.createStudy(PI, { title: 'Study A' });
    await studies.addMember(s.id, PI, AUDITOR, 'auditor');
    await expect(studies.updateStudy(s.id, AUDITOR, { title: 'Hacked' })).rejects.toThrow(/investigator/);
    await expect(studies.listMembers(s.id, AUDITOR)).rejects.toThrow(/investigator/);
    const updated = await studies.updateStudy(s.id, PI, { title: 'Renamed' });
    expect(updated.title).toBe('Renamed');
  });

  test('access code redemption adds the user as an auditor', async () => {
    const s = await studies.createStudy(PI, { title: 'Study A' });
    await studies.openStudy(s.id, PI);
    const code = await studies.createAccessCode(s.id, PI, { maxUses: 2 });
    const studyId = await studies.redeemAccessCode(code.code, AUDITOR);
    expect(studyId).toBe(s.id);
    expect(await studies.getUserRoles(s.id, AUDITOR)).toEqual(['auditor']);
  });

  test('expired or exhausted codes are rejected', async () => {
    const s = await studies.createStudy(PI, { title: 'Study A' });
    await studies.openStudy(s.id, PI);
    const expired = await studies.createAccessCode(s.id, PI, { expiresAt: Date.now() - 1000 });
    await expect(studies.redeemAccessCode(expired.code, AUDITOR)).rejects.toThrow(/expired/);
    const oneUse = await studies.createAccessCode(s.id, PI, { maxUses: 1 });
    await studies.redeemAccessCode(oneUse.code, AUDITOR);
    await expect(studies.redeemAccessCode(oneUse.code, 'auditor-2')).rejects.toThrow(/use limit/);
  });

  test('a closed or draft study refuses new participants (SC-11)', async () => {
    const s = await studies.createStudy(PI, { title: 'Gated' });
    const code = await studies.createAccessCode(s.id, PI, {});
    // draft by default -> refused
    await expect(studies.redeemAccessCode(code.code, AUDITOR)).rejects.toThrow(/not open/);
    // open -> allowed
    await studies.openStudy(s.id, PI);
    expect(await studies.redeemAccessCode(code.code, AUDITOR)).toBe(s.id);
    // closed -> refused again
    await studies.closeStudy(s.id, PI);
    await expect(studies.redeemAccessCode(code.code, 'auditor-3')).rejects.toThrow(/not open/);
  });

  test('only an investigator can change study status', async () => {
    const s = await studies.createStudy(PI, { title: 'S' });
    await expect(studies.openStudy(s.id, AUDITOR)).rejects.toThrow(/investigator/);
  });

  test('a user can be investigator on one study and auditor on another', async () => {
    const a = await studies.createStudy(PI, { title: 'A' });
    const b = await studies.createStudy(PI2, { title: 'B' });
    await studies.openStudy(b.id, PI2);
    const code = await studies.createAccessCode(b.id, PI2, {});
    await studies.redeemAccessCode(code.code, PI); // PI joins B as auditor
    const list = await studies.listStudiesForUser(PI);
    const byId = Object.fromEntries(list.map((s) => [s.id, s.roles]));
    expect(byId[a.id]).toEqual(['investigator']);
    expect(byId[b.id]).toEqual(['auditor']);
  });
});

describe('factories default to mock', () => {
  test('auth + studies factories return mock implementations', () => {
    expect(createAuthProvider('mock')).toBeInstanceOf(MockAuthProvider);
    expect(createStudyService('mock')).toBeInstanceOf(MockStudyService);
  });
});
