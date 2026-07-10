// Phase B step 4 — AuditorSession (mock) + factory selection.

import {
  createSessionService,
  MockSessionService,
  SupabaseSessionService,
} from '../sessions';

const svc = () => new MockSessionService({ persist: false });

describe('SessionService factory', () => {
  test('defaults to MockSessionService', () => {
    expect(createSessionService('mock')).toBeInstanceOf(MockSessionService);
    expect(createSessionService('')).toBeInstanceOf(MockSessionService);
  });
  test('returns SupabaseSessionService when asked', () => {
    expect(createSessionService('supabase')).toBeInstanceOf(SupabaseSessionService);
  });
  test('throws on an unknown kind', () => {
    expect(() => createSessionService('mongo')).toThrow(/Unknown session service/);
  });
});

describe('SupabaseSessionService — unconfigured guardrail', () => {
  test('reports not configured and throws on use', async () => {
    const s = new SupabaseSessionService({ client: null });
    expect(s.isConfigured).toBe(false);
    await expect(s.getSession('x')).rejects.toThrow(/not configured/);
  });
});

describe('createSession', () => {
  test('creates an anonymous in-progress session with progress 0', async () => {
    const s = await svc().createSession('study-1', null, { configVersion: 1, expectedConversations: 2 });
    expect(s.studyId).toBe('study-1');
    expect(s.auditorId).toBeNull();
    expect(s.anonymous).toBe(true);
    expect(s.status).toBe('in_progress');
    expect(s.completedConversations).toBe(0);
    expect(s.expectedConversations).toBe(2);
    expect(s.configVersion).toBe(1);
    expect(s.consentRecord).toBeNull();
    expect(s.launchMetadata).toBeNull();
  });

  test('associates with an account when an auditorId is given', async () => {
    const s = await svc().createSession('study-1', 'user-9', { expectedConversations: 1 });
    expect(s.auditorId).toBe('user-9');
    expect(s.anonymous).toBe(false);
  });

  test('stores launchMetadata when provided', async () => {
    const s = await svc().createSession('study-1', null, {
      expectedConversations: 1,
      launchMetadata: { PROLIFIC_PID: 'abc123', STUDY_ID: 'zzz' },
    });
    expect(s.launchMetadata).toEqual({ PROLIFIC_PID: 'abc123', STUDY_ID: 'zzz' });
  });

  test('rejects a bad expectedConversations', async () => {
    await expect(svc().createSession('s', null, { expectedConversations: 0 })).rejects.toThrow(/>= 1/);
    await expect(svc().createSession('s', null, {})).rejects.toThrow(/>= 1/);
  });

  test('rejects a missing studyId', async () => {
    await expect(svc().createSession(null, null, { expectedConversations: 1 })).rejects.toThrow(/studyId is required/);
  });
});

describe('progress to N', () => {
  test('completing N conversations marks the session complete', async () => {
    const service = svc();
    let s = await service.createSession('study-1', null, { expectedConversations: 2 });
    s = await service.completeConversation(s.id);
    expect(s.completedConversations).toBe(1);
    expect(s.status).toBe('in_progress');
    s = await service.completeConversation(s.id);
    expect(s.completedConversations).toBe(2);
    expect(s.status).toBe('complete');
  });

  test('does not exceed N (idempotent at the ceiling)', async () => {
    const service = svc();
    const s0 = await service.createSession('study-1', null, { expectedConversations: 1 });
    await service.completeConversation(s0.id);
    const s = await service.completeConversation(s0.id);
    expect(s.completedConversations).toBe(1);
    expect(s.status).toBe('complete');
  });
});

describe('consent + conversation linking + listing', () => {
  test('recordConsent stores agreement with version + timestamp', async () => {
    const service = svc();
    const s0 = await service.createSession('study-1', null, { expectedConversations: 1 });
    const s = await service.recordConsent(s0.id, { version: 3 });
    expect(s.consentRecord.agreed).toBe(true);
    expect(s.consentRecord.version).toBe(3);
    expect(typeof s.consentRecord.timestamp).toBe('number');
  });

  test('attachConversation links ids and dedupes', async () => {
    const service = svc();
    const s0 = await service.createSession('study-1', null, { expectedConversations: 2 });
    await service.attachConversation(s0.id, 'conv-a');
    await service.attachConversation(s0.id, 'conv-a'); // dup
    const s = await service.attachConversation(s0.id, 'conv-b');
    expect(s.conversationIds).toEqual(['conv-a', 'conv-b']);
  });

  test('getSession returns null for an unknown id', async () => {
    expect(await svc().getSession('nope')).toBeNull();
  });

  test('listSessionsForStudy returns only that study\'s sessions', async () => {
    const service = svc();
    await service.createSession('study-1', null, { expectedConversations: 1 });
    await service.createSession('study-1', null, { expectedConversations: 1 });
    await service.createSession('study-2', null, { expectedConversations: 1 });
    expect(await service.listSessionsForStudy('study-1')).toHaveLength(2);
    expect(await service.listSessionsForStudy('study-2')).toHaveLength(1);
  });
});
