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

import apiClient from '../APIClient';
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
