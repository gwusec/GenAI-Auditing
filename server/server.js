const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const isDevelopment = process.env.NODE_ENV !== 'production';
app.set('trust proxy', 1);
const BODY_SIZE_LIMIT = process.env.BODY_SIZE_LIMIT || '1mb';
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 120000);
const CHAT_RATE_LIMIT_WINDOW_MS = Number(process.env.CHAT_RATE_LIMIT_WINDOW_MS || 60000);
const CHAT_RATE_LIMIT_MAX = Number(process.env.CHAT_RATE_LIMIT_MAX || 20);
const OLLAMA_TEST_TIMEOUT_MS = Number(process.env.OLLAMA_TEST_TIMEOUT_MS || 5000);
const ALLOW_PRIVATE_OLLAMA_URLS = (process.env.ALLOW_PRIVATE_OLLAMA_URLS || '').toLowerCase() === 'true';

// --- Server-side provider API keys (MOD-1 invariant) -------------------------
// The deployer sets these in the relay environment. Study configs, the DB, and
// auditors' browsers never carry a provider key. A client-supplied relay.apiKey
// is honored ONLY as a fallback when ALLOW_CLIENT_API_KEYS=true (the BYO-key
// carve-out reserved for the hosted demo, MOD-8/§9 D5) — never over a server key.
const SERVER_PROVIDER_KEYS = {
  openai: process.env.OPENAI_API_KEY || '',
  anthropic: process.env.ANTHROPIC_API_KEY || '',
  gemini: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
  cohere: process.env.COHERE_API_KEY || '',
  vllm: process.env.VLLM_API_KEY || '',
};
const PROVIDER_KEY_ENV = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
  cohere: 'COHERE_API_KEY',
  vllm: 'VLLM_API_KEY',
};
const KEY_REQUIRED_PROVIDERS = ['openai', 'anthropic', 'gemini', 'cohere'];
const ALLOW_CLIENT_API_KEYS = (process.env.ALLOW_CLIENT_API_KEYS || '').toLowerCase() === 'true';

/** Resolve the key for a provider: server env first; client key only when
 *  explicitly allowed. Returns '' when neither is available. */
function resolveApiKey(rawProvider, clientKey) {
  const serverKey = SERVER_PROVIDER_KEYS[rawProvider] || '';
  if (serverKey) return serverKey;
  if (ALLOW_CLIENT_API_KEYS && clientKey) return String(clientKey);
  return '';
}

function missingKeyMessage(rawProvider) {
  const envVar = PROVIDER_KEY_ENV[rawProvider] || 'the provider API key';
  return `No server-side API key is configured for ${rawProvider}. ` +
    `Set ${envVar} in the relay environment (see .env.example) and restart.`;
}

// Pure relay helpers (decoding resolution + system-message injection) live in a
// dependency-free module so they can be unit-tested without the relay's deps.
const { resolveDecoding, ensureSystemMessage } = require('./relayHelpers');

function parseAllowedOrigins(value) {
  if (!value) {
    return isDevelopment ? ['*'] : [];
  }
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN);

// When no allowlist is configured, default to permissive. This is the self-host /
// demo single-container case where the frontend and relay share an origin — and it
// is required because Vite emits asset tags with `crossorigin`, so the browser
// fetches same-origin JS/CSS in CORS mode (sending an Origin header). A blocking
// default would 403 the app's own assets. Operators lock cross-origin access down
// by setting ALLOWED_ORIGINS in production.
const allowAllOrigins = allowedOrigins.length === 0;
if (allowAllOrigins) {
  console.warn('[cors] ALLOWED_ORIGINS not set — allowing all origins. Set ALLOWED_ORIGINS to restrict cross-origin access in production.');
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    if (allowAllOrigins || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin not allowed'));
  }
};

function redactSecret(secret = '') {
  if (!secret || typeof secret !== 'string') {
    return undefined;
  }
  if (secret.length <= 8) {
    return '***';
  }
  return `${secret.slice(0, 3)}***${secret.slice(-3)}`;
}

function normalizeUrl(url) {
  return (url || '').trim().replace(/\/$/, '');
}

function safeHostname(rawUrl) {
  try {
    return new URL(rawUrl).hostname;
  } catch (error) {
    return 'invalid-url';
  }
}

function isPrivateIPv4(hostname) {
  if (/^127\./.test(hostname)) return true;
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  const match172 = hostname.match(/^172\.(\d{1,3})\./);
  if (match172) {
    const secondOctet = Number(match172[1]);
    return secondOctet >= 16 && secondOctet <= 31;
  }
  return false;
}

function isPrivateHost(hostname) {
  const host = (hostname || '').toLowerCase();
  if (!host) return true;
  if (host === 'localhost' || host === '::1' || host === '[::1]') return true;
  if (host.endsWith('.local')) return true;
  if (host.startsWith('169.254.')) return true;
  if (host.startsWith('fc') || host.startsWith('fd')) return true;
  return isPrivateIPv4(host);
}

function validateOllamaUrl(rawUrl) {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) {
    return { valid: false, error: 'Ollama URL is required' };
  }

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch (error) {
    return { valid: false, error: 'Ollama URL is invalid' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, error: 'Ollama URL must use http or https' };
  }

  if (!isDevelopment && !ALLOW_PRIVATE_OLLAMA_URLS && isPrivateHost(parsed.hostname)) {
    return {
      valid: false,
      error: 'Private/local Ollama URLs are blocked by server policy'
    };
  }

  return { valid: true, normalized };
}

// SSRF guard for the `api` backend's baseUrl (openai/anthropic/gemini/cohere/vllm).
// Same policy as validateOllamaUrl: private/local hosts are blocked in production
// unless the deployer opts in (ALLOW_PRIVATE_API_URLS=true, e.g. a LAN vLLM).
const ALLOW_PRIVATE_API_URLS = (process.env.ALLOW_PRIVATE_API_URLS || '').toLowerCase() === 'true';
function validateApiBaseUrl(rawUrl) {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) {
    return { valid: false, error: 'baseUrl is required' };
  }
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch (error) {
    return { valid: false, error: 'baseUrl is invalid' };
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, error: 'baseUrl must use http or https' };
  }
  if (!isDevelopment && !ALLOW_PRIVATE_API_URLS && isPrivateHost(parsed.hostname)) {
    return {
      valid: false,
      error: 'Private/local provider URLs are blocked by server policy (set ALLOW_PRIVATE_API_URLS=true for a LAN vLLM)'
    };
  }
  return { valid: true, normalized };
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return false;
  }
  return messages.every((msg) => msg && typeof msg.content === 'string' && typeof msg.role === 'string');
}

const chatRateBuckets = new Map();
setInterval(() => {
  const cutoff = Date.now() - CHAT_RATE_LIMIT_WINDOW_MS;
  for (const [key, entry] of chatRateBuckets.entries()) {
    if (entry.windowStart < cutoff) {
      chatRateBuckets.delete(key);
    }
  }
}, Math.max(30000, CHAT_RATE_LIMIT_WINDOW_MS)).unref();

function chatRateLimit(req, res, next) {
  const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();
  const entry = chatRateBuckets.get(key);

  if (!entry || now - entry.windowStart >= CHAT_RATE_LIMIT_WINDOW_MS) {
    chatRateBuckets.set(key, { count: 1, windowStart: now });
    return next();
  }

  entry.count += 1;
  if (entry.count > CHAT_RATE_LIMIT_MAX) {
    return res.status(429).json({
      statusCode: 429,
      error: 'Too many chat requests, please try again shortly.'
    });
  }

  return next();
}

app.use(cors(corsOptions));
app.use(express.json({ limit: BODY_SIZE_LIMIT }));

app.use((err, req, res, next) => {
  if (err && err.message === 'CORS origin not allowed') {
    return res.status(403).json({ error: 'CORS origin not allowed' });
  }
  return next(err);
});

app.use((req, res, next) => {
  const startTime = Date.now();
  res.setTimeout(REQUEST_TIMEOUT_MS, () => {
    if (!res.headersSent) {
      res.status(408).json({ statusCode: 408, error: 'Request timed out' });
    }
  });

  console.log(`${req.method} ${req.url}`);

  if (req.url === '/chat' && req.body?.relay) {
    const relay = req.body.relay;
    console.log('CHAT RELAY META:', {
      backend: relay.backend,
      provider: relay.provider,
      model: relay.model,
      baseUrl: relay.baseUrl,
      apiKey: redactSecret(relay.apiKey),
      ollamaUrl: relay.ollamaUrl,
      ollamaModel: relay.ollamaModel
    });
  }

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`${req.method} ${req.url} -> ${res.statusCode} (${duration}ms)`);
  });

  next();
});

app.post('/api/set-config', (req, res) => {
  res.json({
    success: true,
    deprecated: true,
    message: 'Request-scoped routing is active. /api/set-config is no longer used by the relay.'
  });
});

// IMPORTANT: This is the main chat endpoint that TRAILS-Chatbot uses
app.post('/chat', chatRateLimit, async (req, res) => {
  try {
    const { messages, relay } = req.body;
    if (!validateMessages(messages)) {
      return res.status(400).json({ statusCode: 400, error: 'Invalid messages payload' });
    }

    if (!relay || !relay.backend) {
      return res.status(400).json({ statusCode: 400, error: 'Missing relay configuration' });
    }

    if (relay.backend === 'api') {
      const rawProvider = relay.provider;
      // vLLM exposes an OpenAI-compatible API — route it through the OpenAI formatter
      // but keep the caller's custom baseUrl. (vLLM may be keyless.)
      const provider = rawProvider === 'vllm' ? 'openai' : rawProvider;
      const model = relay.model;
      const baseUrl = relay.baseUrl;

      if (!rawProvider || !model || !baseUrl) {
        return res.status(400).json({
          statusCode: 400,
          error: 'API relay requires provider, model, and baseUrl'
        });
      }

      const baseUrlValidation = validateApiBaseUrl(baseUrl);
      if (!baseUrlValidation.valid) {
        return res.status(400).json({ statusCode: 400, error: baseUrlValidation.error });
      }

      // Keys are resolved SERVER-SIDE (env), never trusted from the study config.
      const apiKey = resolveApiKey(rawProvider, relay.apiKey);
      if (KEY_REQUIRED_PROVIDERS.includes(rawProvider) && !apiKey) {
        return res.status(400).json({ statusCode: 400, error: missingKeyMessage(rawProvider) });
      }

      return handleApiProviderRequest(req, res, provider, apiKey, model, baseUrl);
    }

    if (relay.backend !== 'ollama') {
      return res.status(400).json({ statusCode: 400, error: `Unsupported backend: ${relay.backend}` });
    }

    const ollamaUrlValidation = validateOllamaUrl(relay.ollamaUrl);
    if (!ollamaUrlValidation.valid) {
      return res.status(400).json({ statusCode: 400, error: ollamaUrlValidation.error });
    }

    const ollamaUrl = ollamaUrlValidation.normalized;
    const ollamaModel = relay.ollamaModel || 'llama3.1';

    let tagsResponse;
    try {
      tagsResponse = await axios.get(`${ollamaUrl}/api/tags`, { timeout: OLLAMA_TEST_TIMEOUT_MS });
    } catch (error) {
      return res.status(502).json({
        statusCode: 502,
        error: `Unable to reach Ollama endpoint: ${error.message}`
      });
    }

    const availableModels = Array.isArray(tagsResponse.data?.models)
      ? tagsResponse.data.models.map((model) => model.name)
      : [];

    const hasRequestedModel = availableModels.some((name) =>
      name === ollamaModel ||
      name === `${ollamaModel}:latest` ||
      name === `${ollamaModel}:8b` ||
      name.startsWith(`${ollamaModel}:`)
    );

    if (!hasRequestedModel) {
      return res.status(400).json({
        statusCode: 400,
        error: `Model ${ollamaModel} not found on the provided Ollama endpoint`
      });
    }

    // Apply the study's system/seed prompt (relay.systemPrompt) and decoding.
    const ollamaMessages = ensureSystemMessage(
      messages.map(msg => ({ role: msg.role, content: msg.content })),
      relay.systemPrompt
    );
    const ollamaDecoding = resolveDecoding(relay);

    if (req.body.stream) {
      try {
        await streamOllamaChat(res, ollamaUrl, ollamaModel, ollamaMessages, ollamaDecoding);
        return;
      } catch (err) {
        console.error('Ollama stream failed:', err.message);
        if (!res.headersSent) {
          return res.status(502).json({ statusCode: 502, error: `Ollama stream failed: ${err.message}` });
        }
        return;
      }
    }

    try {
      console.log(`SENDING REQUEST TO OLLAMA API at ${ollamaUrl}/api/chat`);
      const ollamaResponse = await axios.post(`${ollamaUrl}/api/chat`, {
        model: ollamaModel,
        messages: ollamaMessages,
        stream: false,
        options: {
          temperature: ollamaDecoding.temperature,
          num_predict: ollamaDecoding.maxTokens,
          ...(ollamaDecoding.topP !== undefined ? { top_p: ollamaDecoding.topP } : {})
        }
      }, {
        timeout: REQUEST_TIMEOUT_MS
      });

      console.log('RECEIVED RESPONSE FROM OLLAMA');

      // Format response to match what the TRAILS chatbot expects
      const responseData = {
        statusCode: 200,
        body: {
          message: {
            role: 'assistant',
            content: ollamaResponse.data.message.content
          },
          finish_reason: 'stop'
        }
      };

      console.log('RETURNING RESPONSE TO CLIENT');
      res.json(responseData);
    } catch (error) {
      console.error('Error calling Ollama API:', error.message);
      console.error('Error details:', error.response?.status || 'No status');

      // Prevent crash if headers already sent (e.g., by timeout).
      // NOTE: the property is `headersSent`; the old `headerSent` was always
      // undefined, so this guard never fired and a late upstream error after a
      // 408 timeout would throw ERR_HTTP_HEADERS_SENT.
      if (res.headersSent) return;

      // Send error response
      res.status(500).json({
        statusCode: 500,
        error: `Failed to get response from Ollama: ${error.message}`,
        body: {
          message: {
            role: 'assistant',
            content: 'Sorry, I encountered an error when trying to communicate with the LLM. Please make sure Ollama is running and try again.'
          },
          finish_reason: 'error'
        }
      });
    }
  } catch (error) {
    console.error('Error processing chat request:', error.message);

    // Prevent crash if headers already sent (e.g., by timeout) — see note above.
    if (res.headersSent) return;

    // Send error response
    res.status(500).json({
      statusCode: 500,
      error: `Failed to process request: ${error.message}`
    });
  }
});

// Handler for API provider requests
async function handleApiProviderRequest(req, res, provider, apiKey, model, baseUrl) {
  const { messages, relay } = req.body;
  const decoding = resolveDecoding(relay);

  try {
    console.log(`PROCESSING ${provider.toUpperCase()} API REQUEST - Model: ${model}`);

    // Apply the study's system/seed prompt before provider formatting, then let
    // each provider body carry the study's decoding settings.
    const messagesWithSystem = ensureSystemMessage(messages, relay && relay.systemPrompt);
    const formattedMessages = formatMessagesForProvider(messagesWithSystem, provider);

    // Prepare headers for the API request
    const headers = {
      'Content-Type': 'application/json',
    };

    // Set provider-specific headers
    switch (provider) {
      case 'openai':
        headers['Authorization'] = `Bearer ${apiKey}`;
        break;
      case 'anthropic':
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        break;
      case 'cohere':
        headers['Authorization'] = `Bearer ${apiKey}`;
        break;
      case 'gemini':
        // Google uses API key as a query parameter, not a header
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    // Prepare the request body based on the provider.
    // System-message handling is provider-specific and was previously wrong for
    // anthropic (which REJECTS role:"system" inside `messages` — it must be the
    // top-level `system` param) and gemini (where a system message was silently
    // remapped to a `model` turn). Extract it once and route it correctly.
    const systemText = formattedMessages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const nonSystemMessages = formattedMessages.filter((m) => m.role !== 'system');

    let requestBody;
    let apiEndpoint;

    switch (provider) {
      case 'openai':
        // OpenAI-compatible endpoints accept system messages inline.
        apiEndpoint = `${baseUrl}/chat/completions`;
        requestBody = {
          model: model,
          messages: formattedMessages,
          temperature: decoding.temperature,
          max_tokens: decoding.maxTokens,
          ...(decoding.topP !== undefined ? { top_p: decoding.topP } : {})
        };
        break;
      case 'anthropic':
        apiEndpoint = `${baseUrl}/messages`;
        requestBody = {
          model: model,
          messages: nonSystemMessages,
          ...(systemText ? { system: systemText } : {}),
          max_tokens: decoding.maxTokens,
          temperature: decoding.temperature,
          ...(decoding.topP !== undefined ? { top_p: decoding.topP } : {})
        };
        break;
      case 'cohere':
        apiEndpoint = `${baseUrl}/chat`;
        requestBody = {
          model: model,
          message: nonSystemMessages[nonSystemMessages.length - 1].content,
          chat_history: nonSystemMessages.slice(0, -1).map(msg => ({
            role: msg.role,
            message: msg.content
          })),
          ...(systemText ? { preamble: systemText } : {}),
          temperature: decoding.temperature,
          max_tokens: decoding.maxTokens,
          ...(decoding.topP !== undefined ? { p: decoding.topP } : {})
        };
        break;
      case 'gemini':
        // For Gemini, API key is in the URL as a parameter
        apiEndpoint = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;
        requestBody = {
          ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
          contents: nonSystemMessages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
          })),
          generationConfig: {
            temperature: decoding.temperature,
            maxOutputTokens: decoding.maxTokens,
            ...(decoding.topP !== undefined ? { topP: decoding.topP } : {})
          }
        };
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    // Stream OpenAI-compatible providers (openai, vLLM) when requested; other
    // providers fall through to the non-streaming JSON path below.
    if (req.body.stream && provider === 'openai') {
      try {
        await streamOpenAICompatible(res, apiEndpoint, headers, requestBody);
        return;
      } catch (err) {
        console.error(`${provider} stream failed:`, err.message);
        if (!res.headersSent) {
          return res.status(502).json({ statusCode: 502, error: `Stream failed: ${err.message}` });
        }
        return;
      }
    }

    console.log('API REQUEST START', {
      provider,
      hostname: safeHostname(apiEndpoint),
      model,
      stage: 'started'
    });

    // Make the API request
    const apiResponse = await axios.post(apiEndpoint, requestBody, {
      headers,
      timeout: REQUEST_TIMEOUT_MS
    });

    console.log('API REQUEST RESULT', {
      provider,
      hostname: safeHostname(apiEndpoint),
      model,
      stage: 'succeeded'
    });

    // Extract and format the response based on provider
    let assistantResponse;
    switch (provider) {
      case 'openai':
        assistantResponse = apiResponse.data.choices[0].message.content;
        break;
      case 'anthropic':
        assistantResponse = apiResponse.data.content[0].text;
        break;
      case 'cohere':
        assistantResponse = apiResponse.data.text;
        break;
      case 'gemini':
        assistantResponse = apiResponse.data.candidates[0].content.parts[0].text;
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    // Format response for the TRAILS chatbot
    const responseData = {
      statusCode: 200,
      body: {
        message: {
          role: 'assistant',
          content: assistantResponse
        },
        finish_reason: 'stop'
      }
    };

    console.log('RETURNING API RESPONSE TO CLIENT');
    res.json(responseData);
  } catch (error) {
    console.error(`Error processing ${provider} API request:`, error.message);
    console.error('API REQUEST RESULT', {
      provider,
      model,
      stage: 'failed'
    });
    console.error(error.response?.status || 'No status');

    res.status(500).json({
      statusCode: 500,
      error: `API error: ${error.message}`,
      body: {
        message: {
          role: 'assistant',
          content: `I encountered an error when trying to communicate with ${provider}. Please check your API key and settings.`
        },
        finish_reason: 'error'
      }
    });
  }
}

// Format messages for different providers
function formatMessagesForProvider(messages, provider) {
  // Clone messages to avoid modifying the original
  const formattedMessages = JSON.parse(JSON.stringify(messages));

  // Make sure we have a system message
  const hasSystemMessage = formattedMessages.some(msg => msg.role === 'system');

  if (!hasSystemMessage) {
    formattedMessages.unshift({
      role: 'system',
      content: 'You are a helpful assistant.'
    });
  }

  console.log(`FORMATTING MESSAGES FOR ${provider.toUpperCase()}`);

  // Provider-specific formatting
  switch (provider) {
    case 'anthropic':
      // Claude requires 'user' and 'assistant' roles, 'system' remains the same
      return formattedMessages;

    case 'gemini':
      // Gemini uses 'user' and 'model' roles
      return formattedMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        content: msg.content
      }));

    case 'cohere':
      // Cohere has a different structure we'll handle in the API call
      return formattedMessages;

    case 'openai':
    default:
      // OpenAI format is our default
      return formattedMessages;
  }
}

// --- Streaming (SSE) ---------------------------------------------------------
// When the client requests { stream: true }, the relay streams tokens to the
// browser as Server-Sent Events: `data: {"delta":"..."}` per token, a final
// `data: {"done":true}`, and `data: {"error":"..."}` on failure. Ollama and
// OpenAI-compatible (openai/vLLM) upstreams are streamed; other providers fall
// back to the non-streaming JSON path. Decoding + system prompt are already
// applied by the caller (same as the non-streaming path).
function setupSSE(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable proxy buffering (nginx)
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
}

function sseWrite(res, obj) {
  if (res.writableEnded) return;
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

// Ollama /api/chat with stream:true emits one JSON object per line (NDJSON),
// each carrying an incremental { message: { content } } and a final { done }.
async function streamOllamaChat(res, url, model, messages, decoding) {
  const upstream = await axios.post(`${url}/api/chat`, {
    model,
    messages,
    stream: true,
    options: {
      temperature: decoding.temperature,
      num_predict: decoding.maxTokens,
      ...(decoding.topP !== undefined ? { top_p: decoding.topP } : {}),
    },
  }, { responseType: 'stream', timeout: REQUEST_TIMEOUT_MS });

  setupSSE(res);
  let buffer = '';
  upstream.data.on('data', (chunk) => {
    if (res.writableEnded) return;
    buffer += chunk.toString();
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      let obj;
      try { obj = JSON.parse(line); } catch (_) { continue; }
      const delta = obj.message && obj.message.content;
      if (delta) sseWrite(res, { delta });
      if (obj.done) { sseWrite(res, { done: true }); res.end(); return; }
    }
  });
  upstream.data.on('end', () => { if (!res.writableEnded) { sseWrite(res, { done: true }); res.end(); } });
  upstream.data.on('error', (err) => { if (!res.writableEnded) { sseWrite(res, { error: err.message }); res.end(); } });
}

// OpenAI-compatible /chat/completions with stream:true emits SSE lines
// `data: {choices:[{delta:{content}}]}` and a terminal `data: [DONE]`.
async function streamOpenAICompatible(res, endpoint, headers, body) {
  const upstream = await axios.post(endpoint, { ...body, stream: true }, {
    headers, responseType: 'stream', timeout: REQUEST_TIMEOUT_MS,
  });

  setupSSE(res);
  let buffer = '';
  upstream.data.on('data', (chunk) => {
    if (res.writableEnded) return;
    buffer += chunk.toString();
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') { sseWrite(res, { done: true }); res.end(); return; }
      let obj;
      try { obj = JSON.parse(payload); } catch (_) { continue; }
      const delta = obj.choices && obj.choices[0] && obj.choices[0].delta && obj.choices[0].delta.content;
      if (delta) sseWrite(res, { delta });
    }
  });
  upstream.data.on('end', () => { if (!res.writableEnded) { sseWrite(res, { done: true }); res.end(); } });
  upstream.data.on('error', (err) => { if (!res.writableEnded) { sseWrite(res, { error: err.message }); res.end(); } });
}

// API endpoint to test API keys
app.post('/api/test-api-key', async (req, res) => {
  const payload = req.body || {};
  const provider = (payload.provider || '').toLowerCase().trim();
  // Server env key first; a payload key only under ALLOW_CLIENT_API_KEYS.
  const apiKey = resolveApiKey(provider, (payload.apiKey || '').trim());
  const model = (payload.model || '').trim();
  const baseUrl = (payload.baseUrl || '').trim();

  if (!provider) {
    return res.status(400).json({ error: 'Provider is required' });
  }
  if (!apiKey) {
    return res.status(400).json({ error: missingKeyMessage(provider) });
  }

  if (!baseUrl || typeof baseUrl !== 'string') {
    return res.status(400).json({ error: 'A valid baseUrl is required' });
  }

  const baseUrlValidation = validateApiBaseUrl(baseUrl);
  if (!baseUrlValidation.valid) {
    return res.status(400).json({ error: baseUrlValidation.error });
  }

  console.log(`TESTING API KEY FOR ${provider.toUpperCase()} - Model: ${model}`);

  try {
    // Create test request based on provider
    let testEndpoint;
    const headers = { 'Content-Type': 'application/json' };

    switch (provider) {
      case 'openai':
        testEndpoint = `${baseUrl}/models`;
        headers['Authorization'] = `Bearer ${apiKey}`;
        break;
      case 'anthropic':
        testEndpoint = `${baseUrl}/models`;
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        break;
      case 'cohere':
        testEndpoint = `${baseUrl}/models`;
        headers['Authorization'] = `Bearer ${apiKey}`;
        break;
      case 'gemini':
        testEndpoint = `${baseUrl}/models?key=${apiKey}`;
        break;
      default:
        return res.status(400).json({ error: 'Unsupported provider' });
    }

    console.log('API KEY TEST REQUEST START', {
      provider,
      hostname: safeHostname(testEndpoint),
      model,
      stage: 'started'
    });

    // Make test request
    const response = await axios.get(testEndpoint, {
      headers,
      timeout: REQUEST_TIMEOUT_MS
    });

    if (response.status === 200) {
      console.log(`API KEY TEST SUCCESSFUL FOR ${provider.toUpperCase()}`);
      res.json({ success: true });
    } else {
      console.log(`API KEY TEST FAILED FOR ${provider.toUpperCase()} - Status: ${response.status}`);
      res.status(response.status).json({ error: 'API key validation failed' });
    }
  } catch (error) {
    console.error(`Error testing ${provider} API key:`, error.message);

    const upstreamStatus = error.response?.status;
    const upstreamError = error.response?.data?.error;
    const upstreamMessage =
      typeof upstreamError === 'string'
        ? upstreamError
        : upstreamError?.message || error.message;

    if (upstreamStatus) {
      return res.status(upstreamStatus).json({
        error: `Provider request failed (${upstreamStatus}): ${upstreamMessage}`
      });
    }

    return res.status(500).json({ error: `Provider request failed: ${upstreamMessage}` });
  }
});

// WebLLM API endpoint for client-side initialization
app.get('/api/webllm/models', (req, res) => {
  // Return a list of available WebLLM models
  res.json({
    models: [
      { id: 'Llama-3-8B-Instruct', size: '4.1 GB', quantized_size: '2.2 GB' },
      { id: 'Gemma-2B-Instruct', size: '2.5 GB', quantized_size: '1.3 GB' },
      { id: 'Mistral-7B-Instruct', size: '4.5 GB', quantized_size: '2.4 GB' },
      { id: 'Phi-3-Mini-4K', size: '2.0 GB', quantized_size: '1.1 GB' }
    ]
  });
});

app.get('/api/ollama/api/tags', async (req, res) => {
  const providedUrl = req.headers['x-ollama-url'];
  const validation = validateOllamaUrl(providedUrl);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const response = await axios.get(`${validation.normalized}/api/tags`, {
      timeout: OLLAMA_TEST_TIMEOUT_MS
    });
    return res.status(200).json(response.data);
  } catch (error) {
    return res.status(502).json({ error: `Failed to reach Ollama endpoint: ${error.message}` });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    version: '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Test-connection endpoint: given a relay config, check that the model is actually
// reachable and (for Ollama) pulled. Returns { ok, stage, message, availableModels? }
// with actionable diagnostics so an investigator knows whether their model works
// BEFORE opening a study. Comprehensive for Ollama; reasonable for API providers.
app.post('/api/test-model', async (req, res) => {
  const relay = (req.body && req.body.relay) || {};

  try {
    if (relay.backend === 'ollama') {
      const validation = validateOllamaUrl(relay.ollamaUrl);
      if (!validation.valid) {
        return res.json({ ok: false, stage: 'url', message: validation.error });
      }
      const url = validation.normalized;
      const wanted = (relay.ollamaModel || '').trim();
      if (!wanted) {
        return res.json({ ok: false, stage: 'model', message: 'No model name provided.' });
      }

      // 1) Is the Ollama server reachable?
      let tags;
      try {
        tags = await axios.get(`${url}/api/tags`, { timeout: OLLAMA_TEST_TIMEOUT_MS });
      } catch (error) {
        const reason = error.code === 'ECONNREFUSED' || /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/.test(error.message || '')
          ? `Couldn't reach an Ollama server at ${url}. Make sure Ollama is running AND listening on all interfaces so this container can reach it: stop Ollama, then run "OLLAMA_HOST=0.0.0.0 ollama serve". (Ollama listens on 127.0.0.1 only by default, which Docker can't reach.)`
          : `Couldn't reach Ollama at ${url}: ${error.message}`;
        return res.json({ ok: false, stage: 'reachability', message: reason });
      }

      // 2) Is the requested model pulled?
      const available = (tags.data && Array.isArray(tags.data.models) ? tags.data.models : []).map((m) => m.name);
      const present = available.some(
        (n) => n === wanted || n === `${wanted}:latest` || n.startsWith(`${wanted}:`)
      );
      if (!present) {
        return res.json({
          ok: false,
          stage: 'model',
          message: `Connected to Ollama at ${url}, but the model "${wanted}" isn't pulled. Run: ollama pull ${wanted}`,
          availableModels: available,
        });
      }

      return res.json({
        ok: true,
        stage: 'ready',
        message: `Connected to Ollama at ${url} and "${wanted}" is available.`,
        availableModels: available,
      });
    }

    if (relay.backend === 'api') {
      const rawProvider = relay.provider;
      const provider = rawProvider === 'vllm' ? 'openai' : rawProvider;
      if (!relay.model) return res.json({ ok: false, stage: 'model', message: 'No model id provided.' });
      if (!relay.baseUrl) return res.json({ ok: false, stage: 'url', message: 'No base URL provided.' });
      const baseCheck = validateApiBaseUrl(relay.baseUrl);
      if (!baseCheck.valid) return res.json({ ok: false, stage: 'url', message: baseCheck.error });
      const apiKey = resolveApiKey(rawProvider, relay.apiKey);
      if (KEY_REQUIRED_PROVIDERS.includes(rawProvider) && !apiKey) {
        return res.json({ ok: false, stage: 'key', message: missingKeyMessage(rawProvider) });
      }

      // Live check for OpenAI-compatible endpoints (openai, vllm): list models.
      if (provider === 'openai') {
        try {
          const base = normalizeUrl(relay.baseUrl);
          const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
          const r = await axios.get(`${base}/models`, { headers, timeout: OLLAMA_TEST_TIMEOUT_MS });
          const ids = (r.data && Array.isArray(r.data.data) ? r.data.data.map((m) => m.id) : []);
          const present = ids.length === 0 || ids.includes(relay.model);
          return res.json({
            ok: present,
            stage: present ? 'ready' : 'model',
            message: present
              ? `Reached ${base} and credentials are accepted.`
              : `Reached ${base}, but model "${relay.model}" was not listed. Available: ${ids.slice(0, 20).join(', ')}`,
            availableModels: ids,
          });
        } catch (error) {
          const status = error.response && error.response.status;
          const msg = status === 401 || status === 403
            ? 'Reached the endpoint but the API key was rejected (401/403).'
            : `Couldn't reach ${relay.baseUrl}: ${error.message}`;
          return res.json({ ok: false, stage: status === 401 || status === 403 ? 'key' : 'reachability', message: msg });
        }
      }

      // Anthropic / Gemini: no uniform list endpoint here — report config completeness.
      return res.json({
        ok: true,
        stage: 'config',
        message: `Config for ${rawProvider} looks complete. A full live check for this provider isn't implemented yet — it will be verified on the first chat.`,
      });
    }

    return res.json({ ok: false, stage: 'config', message: 'Unknown or missing backend.' });
  } catch (error) {
    return res.status(500).json({ ok: false, stage: 'error', message: `Test failed: ${error.message}` });
  }
});

// List the models available at a provider endpoint, so the config UI can offer a
// dropdown instead of a free-text model id. { ok, models: string[], error? }
app.post('/api/list-models', async (req, res) => {
  const relay = (req.body && req.body.relay) || {};
  try {
    if (relay.backend === 'ollama') {
      const v = validateOllamaUrl(relay.ollamaUrl);
      if (!v.valid) return res.json({ ok: false, models: [], error: v.error });
      const r = await axios.get(`${v.normalized}/api/tags`, { timeout: OLLAMA_TEST_TIMEOUT_MS });
      const models = (r.data && Array.isArray(r.data.models) ? r.data.models : []).map((m) => m.name);
      return res.json({ ok: true, models });
    }
    if (relay.backend === 'api') {
      const provider = relay.provider === 'vllm' ? 'openai' : relay.provider;
      if (provider === 'openai' && relay.baseUrl) {
        const baseCheck = validateApiBaseUrl(relay.baseUrl);
        if (!baseCheck.valid) return res.json({ ok: false, models: [], error: baseCheck.error });
        const base = normalizeUrl(relay.baseUrl);
        const apiKey = resolveApiKey(relay.provider, relay.apiKey);
        const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
        const r = await axios.get(`${base}/models`, { headers, timeout: OLLAMA_TEST_TIMEOUT_MS });
        const models = (r.data && Array.isArray(r.data.data) ? r.data.data : []).map((m) => m.id);
        return res.json({ ok: true, models });
      }
      // Anthropic / Gemini have no uniform list endpoint here.
      return res.json({ ok: true, models: [] });
    }
    return res.json({ ok: false, models: [], error: 'Unknown backend' });
  } catch (error) {
    const status = error.response && error.response.status;
    const msg = status === 401 || status === 403 ? 'API key rejected (401/403).' : error.message;
    return res.json({ ok: false, models: [], error: msg });
  }
});

// In development mode, don't try to serve the static build files
if (!isDevelopment) {
  // Locate the React build robustly. Depending on how the image is laid out,
  // server.js may sit beside `build/` (/app/server.js + /app/build) or one level
  // up (/app/server/server.js + /app/build). An explicit BUILD_DIR env wins.
  const buildCandidates = [
    process.env.BUILD_DIR,
    path.join(__dirname, '..', 'build'),
    path.join(__dirname, 'build'),
    path.join(process.cwd(), 'build'),
  ].filter(Boolean);
  const buildPath = buildCandidates.find((p) => fs.existsSync(p));
  if (buildPath) {
    // Serve static files from the React app
    app.use(express.static(buildPath));

    // For any other GET request, send the React app
    app.get('*', (req, res) => {
      res.sendFile(path.join(buildPath, 'index.html'));
    });
  } else {
    console.warn('Warning: Build directory does not exist. Run npm run build first.');

    app.get('*', (req, res) => {
      res.send('Server is running but the React app has not been built yet. Run npm run build first.');
    });
  }
} else {
  console.log('Running in development mode. Static files will be served by the React dev server.');

  // In development, any unknown routes should 404
  app.get('*', (req, res) => {
    res.status(404).send('Not found: This route is not handled by the API server in development mode.');
  });
}

// Start the server — only when run directly (not when imported by a test).
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API available at :${PORT}`);
    if (isDevelopment) {
      console.log(`React app running at http://localhost:3001`);
    } else {
      console.log(`App available on configured host at :${PORT}`);
    }
  });
}

// Exported for unit tests (the pure relay helpers) and for supertest-style
// integration tests that import the Express app without binding a port.
module.exports = {
  app,
  resolveDecoding,
  ensureSystemMessage,
  resolveApiKey,
  validateApiBaseUrl,
  formatMessagesForProvider,
};