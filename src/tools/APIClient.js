import axios from 'axios';
import AppConfig from "./AppConfig";

// Parse Server-Sent Events out of an accumulating buffer. Pure + synchronous so
// it can be unit-tested: returns the decoded events found and the unconsumed
// remainder (a partial event straddling a chunk boundary stays in `rest`).
// Event shapes from the relay: {delta}, {done:true}, {error}.
export function parseSSEEvents(buffer) {
  const events = [];
  let rest = buffer;
  let idx;
  while ((idx = rest.indexOf('\n\n')) >= 0) {
    const raw = rest.slice(0, idx);
    rest = rest.slice(idx + 2);
    const line = raw.trim();
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (payload === '' ) continue;
    if (payload === '[DONE]') { events.push({ done: true }); continue; }
    try { events.push(JSON.parse(payload)); } catch (_) { /* skip malformed */ }
  }
  return { events, rest };
}

// Run a completion entirely in the browser via WebLLM (WebGPU) — no relay call.
// Loads the model on first use (progress surfaced through onStatus), then streams
// tokens through onToken. Returns the same {status, data} shape as the relay paths.
// Throws a descriptive Error when WebGPU is unavailable or the model can't load,
// matching how the relay path throws on non-400 upstream failures.
async function runWebLLM(llmMessages, relay, { onToken, onStatus } = {}) {
  const { checkWebGPU, ensureModel, streamChat } = await import('./webllm/webllmEngine');
  const gpu = await checkWebGPU();
  if (!gpu.ok) throw new Error(gpu.reason);

  const modelId = relay.webllmModel;
  if (!modelId) throw new Error('No WebLLM model configured for this study.');

  const messages = [];
  if (relay.systemPrompt) messages.push({ role: 'system', content: relay.systemPrompt });
  for (const m of llmMessages) messages.push(m);

  if (onStatus) onStatus('⏳ Preparing the model in your browser… the first load can take a minute.');
  const engine = await ensureModel(modelId, {
    onProgress: ({ progress }) => {
      if (!onStatus) return;
      const pct = progress != null ? ` ${Math.round(progress * 100)}%` : '';
      onStatus(`⏳ Preparing the model in your browser…${pct}`);
    },
  });
  if (onStatus) onStatus(null); // clear the status so streamed tokens start clean

  const full = await streamChat(engine, messages, relay.decoding || {}, { onToken });
  return {
    status: 'success',
    data: { statusCode: 200, body: { message: { role: 'assistant', content: full }, finish_reason: 'stop' } },
  };
}

const apiClient = (() => {
  let instance = null;
  let baseUrl = '';

  const createInstance = (hostUrl) => {
    const api = axios.create({
      baseURL: hostUrl,
      timeout: 300000,
    });
    return api;
  };

  const getInstance = (hostUrl) => {
    if (!instance) {
      baseUrl = (hostUrl || '').toString();
      instance = createInstance(hostUrl);
    }
    return instance;
  };

  return {
    getInstance: (hostUrl) => {
      return getInstance(hostUrl);
    },

    sendChatMessage: async (contextMessages) => {
      if (!instance) {
        throw new Error('API client not initialized. Call getInstance first.');
      }
      console.log('contextMessages recieved by the api client:', contextMessages);

      const llmMessages = contextMessages.map(message => ({
        role: message.author === 'user' ? 'user' : 'assistant',
        content: message.content
      }));

      const userId = AppConfig.get("userId");
      // Canonical backend contract (Phase 1): the bundled relay (server/server.js)
      // expects a `relay` object describing the chosen backend/provider. It is
      // sourced from the runtime `config.llmRelay` passed into <App />. An
      // interactive settings UI to populate this is Phase 4; until then the host
      // app / index.js provides it. `pid` is retained for proxy allow-list/logging.
      const appRuntimeConfig = AppConfig.get("config") || {};
      const relay = appRuntimeConfig.llmRelay;

      try {
        if (!userId) {
          throw new Error('User ID not found');
        }
        if (!relay || !relay.backend) {
          throw new Error('LLM relay configuration is missing (expected config.llmRelay with a `backend`)');
        }
        if (relay.backend === 'webllm') {
          return await runWebLLM(llmMessages, relay, {});
        }
        const response = await instance.post('/chat', {
          messages: llmMessages,
          pid: userId,
          relay
        });
        return {status: "success", data: response.data};
      } catch (err) {
        // Log only message + status: the full axios error embeds the request
        // config (the whole relay object), which doesn't belong in the console.
        console.error(
          '[ERROR] Error sending chat message:',
          err.message,
          err.response?.status ?? '(no status)'
        );
        if (err.response && err.response.status === 400) {
          return {status: "error400", data: null};
        }
        // (Removed the old "Are you down?" probe: it fired a real upstream
        // model call on every non-400 error, and its success check tested a
        // misspelled `statuCode` so the branch could never return anyway.)
        throw err;
      }
    },

    // Streaming variant. Requests { stream: true } and, when the relay responds
    // with an SSE stream, invokes onToken(delta) as tokens arrive and returns the
    // same {status, data} shape as sendChatMessage once complete. If the relay
    // responds with plain JSON instead (providers that don't stream, or an error),
    // it transparently falls back to the non-streaming behavior — so callers get a
    // consistent result regardless of whether streaming actually happened.
    sendChatMessageStream: async (contextMessages, { onToken, onStatus } = {}) => {
      if (!instance) {
        throw new Error('API client not initialized. Call getInstance first.');
      }
      const llmMessages = contextMessages.map((message) => ({
        role: message.author === 'user' ? 'user' : 'assistant',
        content: message.content,
      }));
      const userId = AppConfig.get('userId');
      const appRuntimeConfig = AppConfig.get('config') || {};
      const relay = appRuntimeConfig.llmRelay;
      if (!userId) throw new Error('User ID not found');
      if (!relay || !relay.backend) {
        throw new Error('LLM relay configuration is missing (expected config.llmRelay with a `backend`)');
      }

      // WebLLM runs in-browser — intercept before any network call to the relay.
      if (relay.backend === 'webllm') {
        return runWebLLM(llmMessages, relay, { onToken, onStatus });
      }

      const base = (baseUrl || instance.defaults.baseURL || '').replace(/\/+$/, '');
      let res;
      try {
        res = await fetch(`${base}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: llmMessages, pid: userId, relay, stream: true }),
        });
      } catch (err) {
        console.error('[ERROR] Error sending chat message:', err.message);
        throw err;
      }

      const contentType = res.headers.get('content-type') || '';
      // Non-streaming (JSON) response — e.g. a provider that doesn't stream, or an error.
      if (!res.body || !contentType.includes('text/event-stream')) {
        let data = null;
        try { data = await res.json(); } catch (_) { /* ignore */ }
        if (!res.ok) {
          console.error('[ERROR] Error sending chat message:', res.status);
          if (res.status === 400) return { status: 'error400', data: null };
          throw new Error(`Relay error ${res.status}`);
        }
        return { status: 'success', data };
      }

      // Stream: decode SSE, emit tokens, accumulate the full reply.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const { events, rest } = parseSSEEvents(buffer);
          buffer = rest;
          for (const evt of events) {
            if (evt.error) throw new Error(evt.error);
            if (evt.delta) { full += evt.delta; if (onToken) onToken(evt.delta); }
          }
        }
      } catch (err) {
        console.error('[ERROR] Streaming error:', err.message);
        throw err;
      }

      return {
        status: 'success',
        data: { statusCode: 200, body: { message: { role: 'assistant', content: full }, finish_reason: 'stop' } },
      };
    },
  };
})();

export default apiClient;