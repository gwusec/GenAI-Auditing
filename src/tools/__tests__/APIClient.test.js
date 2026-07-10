// Tests for the canonical backend contract (Phase 1): APIClient must send the
// `relay` object (sourced from config.llmRelay) to /chat, matching server.js.

// Mock axios so no real network call happens. The created instance is a vi.fn
// we can inspect for the posted payload. `vi.mock` is hoisted above this file's
// imports, so the mock fn must be created via `vi.hoisted` to be in scope inside
// the factory (the Vitest equivalent of Jest's `mock*`-prefix hoisting rule).
const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }));
vi.mock('axios', () => ({
  __esModule: true,
  default: {
    create: () => ({ post: mockPost }),
  },
}));

import apiClient, { parseSSEEvents } from '../APIClient';
import AppConfig from '../AppConfig';

const RELAY = { backend: 'ollama', ollamaUrl: 'http://localhost:11434', ollamaModel: 'llama3.1' };

beforeEach(() => {
  mockPost.mockReset();
  AppConfig.initialize({
    llmProxyServerUrl: 'http://localhost:3001',
    userId: 'pid-123',
    config: { llmRelay: RELAY },
  });
  apiClient.getInstance('http://localhost:3001'); // singleton; first call wins
});

describe('APIClient — relay contract', () => {
  test('posts { messages, pid, relay } to /chat', async () => {
    mockPost.mockResolvedValueOnce({
      data: { statusCode: 200, body: { message: { role: 'assistant', content: 'hi' } } },
    });

    const res = await apiClient.sendChatMessage([
      { author: 'user', content: 'hello' },
    ]);

    expect(mockPost).toHaveBeenCalledWith('/chat', {
      messages: [{ role: 'user', content: 'hello' }],
      pid: 'pid-123',
      relay: RELAY,
    });
    expect(res.status).toBe('success');
  });

  test('maps bot author to the assistant role', async () => {
    mockPost.mockResolvedValueOnce({ data: { body: { message: { content: 'ok' } } } });
    await apiClient.sendChatMessage([
      { author: 'user', content: 'q' },
      { author: 'bot', content: 'a' },
    ]);
    const [, payload] = mockPost.mock.calls[0];
    expect(payload.messages).toEqual([
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'a' },
    ]);
  });

  test('a 400 response is surfaced as status "error400"', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 400 } });
    const res = await apiClient.sendChatMessage([{ author: 'user', content: 'x' }]);
    expect(res).toEqual({ status: 'error400', data: null });
  });
});

describe('parseSSEEvents (streaming)', () => {
  test('decodes consecutive data: delta events', () => {
    const { events, rest } = parseSSEEvents('data: {"delta":"Hel"}\n\ndata: {"delta":"lo"}\n\n');
    expect(events).toEqual([{ delta: 'Hel' }, { delta: 'lo' }]);
    expect(rest).toBe('');
  });

  test('keeps a partial trailing event in rest until the terminator arrives', () => {
    const first = parseSSEEvents('data: {"delta":"a"}\n\ndata: {"del');
    expect(first.events).toEqual([{ delta: 'a' }]);
    expect(first.rest).toBe('data: {"del');
    // next chunk completes it
    const second = parseSSEEvents(first.rest + 'ta":"b"}\n\n');
    expect(second.events).toEqual([{ delta: 'b' }]);
    expect(second.rest).toBe('');
  });

  test('handles done markers and skips malformed / non-data lines', () => {
    const { events } = parseSSEEvents(
      ': keep-alive\n\ndata: [DONE]\n\ndata: {bad json}\n\ndata: {"done":true}\n\n'
    );
    expect(events).toEqual([{ done: true }, { done: true }]);
  });

  test('surfaces error events', () => {
    const { events } = parseSSEEvents('data: {"error":"upstream 500"}\n\n');
    expect(events).toEqual([{ error: 'upstream 500' }]);
  });
});
