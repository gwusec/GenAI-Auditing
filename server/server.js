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

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
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
      const provider = relay.provider;
      const apiKey = relay.apiKey;
      const model = relay.model;
      const baseUrl = relay.baseUrl;

      if (!provider || !apiKey || !model || !baseUrl) {
        return res.status(400).json({
          statusCode: 400,
          error: 'API relay requires provider, apiKey, model, and baseUrl'
        });
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

    const ollamaMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Make sure we have a system message
    if (!ollamaMessages.some(msg => msg.role === 'system')) {
      ollamaMessages.unshift({
        role: 'system',
        content: 'You are a helpful assistant.'
      });
    }
    
    try {
      console.log(`SENDING REQUEST TO OLLAMA API at ${ollamaUrl}/api/chat`);
      const ollamaResponse = await axios.post(`${ollamaUrl}/api/chat`, {
        model: ollamaModel,
        messages: ollamaMessages,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 2000
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
    
    // Send error response
    res.status(500).json({
      statusCode: 500,
      error: `Failed to process request: ${error.message}`
    });
  }
});

// Handler for API provider requests
async function handleApiProviderRequest(req, res, provider, apiKey, model, baseUrl) {
  const { messages } = req.body;
  
  try {
    console.log(`PROCESSING ${provider.toUpperCase()} API REQUEST - Model: ${model}`);
    
    // Format messages according to provider requirements
    const formattedMessages = formatMessagesForProvider(messages, provider);
    
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
    
    // Prepare the request body based on the provider
    let requestBody;
    let apiEndpoint;
    
    switch (provider) {
      case 'openai':
        apiEndpoint = `${baseUrl}/chat/completions`;
        requestBody = {
          model: model,
          messages: formattedMessages,
          temperature: 0.7,
          max_tokens: 2000
        };
        break;
      case 'anthropic':
        apiEndpoint = `${baseUrl}/messages`;
        requestBody = {
          model: model,
          messages: formattedMessages,
          max_tokens: 2000,
          temperature: 0.7
        };
        break;
      case 'cohere':
        apiEndpoint = `${baseUrl}/chat`;
        requestBody = {
          model: model,
          message: formattedMessages[formattedMessages.length - 1].content,
          chat_history: formattedMessages.slice(0, -1).map(msg => ({
            role: msg.role,
            message: msg.content
          })),
          temperature: 0.7,
          max_tokens: 2000
        };
        break;
      case 'gemini':
        // For Gemini, API key is in the URL as a parameter
        apiEndpoint = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;
        requestBody = {
          contents: formattedMessages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
          })),
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000
          }
        };
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
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

// API endpoint to test API keys
app.post('/api/test-api-key', async (req, res) => {
  const provider = (req.body.provider || '').toLowerCase().trim();
  const apiKey = (req.body.apiKey || '').trim();
  const model = (req.body.model || '').trim();
  const baseUrl = (req.body.baseUrl || '').trim();
  
  if (!provider || !apiKey) {
    return res.status(400).json({ error: 'Provider and API key are required' });
  }

  if (!baseUrl || typeof baseUrl !== 'string') {
    return res.status(400).json({ error: 'A valid baseUrl is required' });
  }

  try {
    new URL(baseUrl);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid baseUrl format' });
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

// In development mode, don't try to serve the static build files
if (!isDevelopment) {
  // Check if the build directory exists
  const buildPath = path.join(__dirname, '..', 'build');
  if (fs.existsSync(buildPath)) {
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at :${PORT}`);
  if (isDevelopment) {
    console.log(`React app running at http://localhost:3001`);
  } else {
    console.log(`App available on configured host at :${PORT}`);
  }
});