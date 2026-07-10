// Tests for the Phase 2 seams: persistence (ConversationStore) and LLM transport.
// We avoid opening Dexie/axios by only exercising factory selection + stubs.

vi.mock('axios', () => ({ __esModule: true, default: { create: () => ({ post: vi.fn() }) } }));

import { createConversationStore, IndexedDBStore, SupabaseStore } from '../stores';
import { SupabaseStore as DirectSupabaseStore } from '../stores/SupabaseStore';
import { getLLMClient } from '../llm';

describe('ConversationStore factory', () => {
  test('defaults to IndexedDBStore', () => {
    const store = createConversationStore('indexeddb');
    expect(store).toBeInstanceOf(IndexedDBStore);
  });

  test('returns SupabaseStore when asked', () => {
    const store = createConversationStore('supabase');
    expect(store).toBeInstanceOf(SupabaseStore);
  });

  test('throws on an unknown backend', () => {
    expect(() => createConversationStore('mongo')).toThrow(/Unknown persistence backend/);
  });
});

describe('SupabaseStore — unconfigured guardrails', () => {
  test('is not configured without env/credentials', () => {
    const store = new DirectSupabaseStore({});
    expect(store.isConfigured).toBe(false);
  });

  test('every operation throws a clear setup error until configured', async () => {
    const store = new DirectSupabaseStore({});
    await expect(store.createConversation('u')).rejects.toThrow(/not configured/i);
    await expect(store.getAllConversations()).rejects.toThrow(/not configured/i);
  });
});

describe('LLMClient factory', () => {
  test("'relay' returns a client exposing sendChatMessage", () => {
    const client = getLLMClient('relay');
    expect(typeof client.sendChatMessage).toBe('function');
  });

  test("'webllm' is a stub that throws not-implemented", async () => {
    const client = getLLMClient('webllm');
    await expect(client.sendChatMessage([])).rejects.toThrow(/not implemented/i);
  });

  test("'proxy' is a stub that throws", async () => {
    const client = getLLMClient('proxy');
    await expect(client.sendChatMessage([])).rejects.toThrow(/proxy/i);
  });

  test('unknown backend throws', () => {
    expect(() => getLLMClient('llama-pigeon')).toThrow(/Unknown LLM backend/);
  });
});
