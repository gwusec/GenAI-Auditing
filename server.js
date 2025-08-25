const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const isDevelopment = process.env.NODE_ENV !== 'production';

// Simple in-memory session store to keep track of user configurations
const sessionStore = {
  sessions: {},
  
  // Store a user's configuration
  setUserConfig(userId, config) {
    console.log(`SETTING USER CONFIG for ${userId}:`, config);
    this.sessions[userId] = {
      ...config,
      lastUpdated: new Date()
    };
    return true;
  },
  
  // Get a user's configuration
  getUserConfig(userId) {
    const config = this.sessions[userId];
    if (config) {
      console.log(`RETRIEVED USER CONFIG for ${userId}:`, config);
    } else {
      console.log(`NO CONFIG FOUND for ${userId}`);
    }
    return config;
  },
  
  // Clean up old sessions (can be called periodically)
  cleanup() {
    const now = new Date();
    const expireTime = 24 * 60 * 60 * 1000; // 24 hours
    
    Object.keys(this.sessions).forEach(userId => {
      const session = this.sessions[userId];
      if (now - session.lastUpdated > expireTime) {
        delete this.sessions[userId];
      }
    });
  }
};

/**
 * Smart connection logic for Ollama - tries multiple URLs to find a working connection
 */
async function findWorkingOllamaUrl(configUrl, model = 'llama3.1') {
  const urlsToTry = [
    configUrl, // User's configured URL
    'http://localhost:11434', // Standard local
    'http://host.docker.internal:11434', // Docker Desktop (Mac/Windows)
    'http://172.17.0.1:11434', // Docker default bridge (Linux)
    'http://192.168.65.2:11434', // Docker Desktop alternative
  ].filter((url, index, self) => 
    // Remove duplicates and empty URLs
    url && url.trim() && self.indexOf(url) === index
  );

  console.log('🔍 Trying Ollama URLs:', urlsToTry);

  for (const url of urlsToTry) {
    try {
      console.log(`   Attempting: ${url}`);
      
      // Test connection with a simple request
      const response = await axios.get(`${url}/api/tags`, {
        timeout: 3000,
        validateStatus: (status) => status === 200
      });
      
      if (response.data && response.data.models) {
        // Check if the required model is available
        const modelNames = response.data.models.map(model => model.name);
        const hasRequiredModel = modelNames.some(name => 
          name === model || 
          name === `${model}:latest` ||
          name === `${model}:8b` ||
          name.startsWith(`${model}:`)
        );
        
        if (hasRequiredModel) {
          console.log(`✅ Found working Ollama with ${model} at: ${url}`);
          return url;
        } else {
          console.log(`⚠️  Ollama at ${url} doesn't have model ${model}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
    }
  }
  
  console.log('❌ No working Ollama URL found');
  return null;
}

// Enable CORS
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Enhanced request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;
  
  // Pretty formatting for the method + URL in logs
  const methodColor = '\x1b[36m'; // Cyan
  const resetColor = '\x1b[0m';
  console.log(`${methodColor}${req.method} ${req.url}${resetColor}`);
  
  // Add header logging for important requests
  if (req.url === '/chat') {
    console.log('REQUEST HEADERS:', {
      'x-api-provider': req.headers['x-api-provider'],
      'x-api-model': req.headers['x-api-model'],
      'x-api-base-url': req.headers['x-api-base-url'],
      // Only show the last 4 chars of API key for security
      'x-api-key': req.headers['x-api-key'] ? 
        '***' + req.headers['x-api-key'].slice(-4) : undefined,
      'x-ollama-url': req.headers['x-ollama-url'],
      'x-ollama-model': req.headers['x-ollama-model']
    });
  }
  
  // Add response logging
  res.send = function(body) {
    const duration = Date.now() - startTime;
    console.log(`Response sent in ${duration}ms - Status: ${res.statusCode}`);
    return originalSend.call(this, body);
  };
  
  next();
});

// Endpoint to save user configuration
app.post('/api/set-config', (req, res) => {
  const { userId, backend, config } = req.body;
  
  if (!userId || !backend || !config) {
    return res.status(400).json({ 
      error: 'Missing required parameters' 
    });
  }
  
  console.log(`RECEIVED CONFIG UPDATE for user ${userId}`);
  console.log(`BACKEND: ${backend}`);
  console.log('CONFIG:', config);
  
  // Store the configuration
  sessionStore.setUserConfig(userId, { backend, config });
  
  res.json({ success: true });
});

// IMPORTANT: This is the main chat endpoint that TRAILS-Chatbot uses
app.post('/chat', async (req, res) => {
  try {
    // Extract the relevant information from the request
    const { pid: userId, messages } = req.body;
    console.log(`CHAT REQUEST - User ID: ${userId}, Messages: ${messages?.length || 0}`);
    
    // Get the user's configuration from the session store
    const userConfig = sessionStore.getUserConfig(userId);
    
    // Check if we have API configuration in the headers (legacy support)
    const apiProvider = req.headers['x-api-provider'];
    const apiKey = req.headers['x-api-key'];
    const apiModel = req.headers['x-api-model'];
    const apiBaseUrl = req.headers['x-api-base-url'];
    
    // Use the session store config if available, otherwise fall back to headers
    if (userConfig && userConfig.backend === 'api') {
      console.log(`USING STORED CONFIG: Backend ${userConfig.backend}, Provider ${userConfig.config.provider}`);
      
      // Get the API config from the session store
      const apiConfig = userConfig.config;
      
      return handleApiProviderRequest(req, res, 
        apiConfig.provider, 
        apiConfig.apiKey, 
        apiConfig.model, 
        apiConfig.baseUrl
      );
    } else if (apiProvider && apiKey) {
      console.log(`USING HEADER CONFIG: Provider ${apiProvider}`);
      return handleApiProviderRequest(req, res, apiProvider, apiKey, apiModel, apiBaseUrl);
    }
    
// Otherwise, handle Ollama request with smart connection logic
let ollamaUrl = 'http://localhost:11434';
let ollamaModel = 'llama3.1';

if (userConfig && userConfig.backend === 'ollama') {
  ollamaUrl = userConfig.config.url || ollamaUrl;
  ollamaModel = userConfig.config.model || ollamaModel;
  console.log(`USING STORED OLLAMA CONFIG: Model ${ollamaModel} @ ${ollamaUrl}`);
} else {
  // For backward compatibility, get from headers if available
  ollamaUrl = req.headers['x-ollama-url'] || ollamaUrl;
  ollamaModel = req.headers['x-ollama-model'] || ollamaModel;
  console.log(`USING DEFAULT/HEADER OLLAMA CONFIG: Model ${ollamaModel} @ ${ollamaUrl}`);
}

// 🚀 NEW: Use smart connection logic to find working URL
console.log(`🔍 Using smart connection logic for Ollama...`);
const workingUrl = await findWorkingOllamaUrl(ollamaUrl, ollamaModel);

if (!workingUrl) {
  console.error('❌ Could not find any working Ollama installation');
  return res.status(500).json({
    statusCode: 500,
    error: 'Could not connect to Ollama. Please make sure Ollama is running and the model is installed.',
    body: {
      message: {
        role: 'assistant',
        content: `I couldn't connect to Ollama. Please ensure:\n\n1. Ollama is running (ollama serve)\n2. The model is installed (ollama pull ${ollamaModel})\n3. Ollama is accessible from Docker\n\nTried these URLs: ${[ollamaUrl, 'http://host.docker.internal:11434', 'http://172.17.0.1:11434'].join(', ')}`
      },
      finish_reason: 'error'
    }
  });
}

// Update the URL to the working one (and optionally save it back to config)
ollamaUrl = workingUrl;
console.log(`✅ Using working Ollama URL: ${ollamaUrl}`);

// Update user config with working URL if it's different
if (userConfig && userConfig.config.url !== workingUrl) {
  console.log(`💾 Auto-updating user config with working URL: ${workingUrl}`);
  sessionStore.setUserConfig(userId, {
    ...userConfig,
    config: {
      ...userConfig.config,
      url: workingUrl
    }
  });
}

console.log(`ROUTING TO OLLAMA - URL: ${ollamaUrl}, Model: ${ollamaModel}`);
    
    // Format messages for Ollama API
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
      // Call Ollama API
      const ollamaResponse = await axios.post(`${ollamaUrl}/api/chat`, {
        model: ollamaModel,
        messages: ollamaMessages,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 2000
        }
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
      console.error('Error details:', error.response?.data || 'No response data');
      
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
    
    console.log(`SENDING REQUEST TO ${provider.toUpperCase()} API at ${apiEndpoint}`);
    
    // Make the API request
    const apiResponse = await axios.post(apiEndpoint, requestBody, { headers });
    
    console.log(`RECEIVED RESPONSE FROM ${provider.toUpperCase()} API`);
    
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
    console.error(error.response?.data || 'No response data');
    
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
  const { provider, apiKey, model, baseUrl } = req.body;
  
  if (!provider || !apiKey) {
    return res.status(400).json({ error: 'Provider and API key are required' });
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
    
    console.log(`SENDING TEST REQUEST TO ${testEndpoint}`);
    
    // Make test request
    const response = await axios.get(testEndpoint, { headers });
    
    if (response.status === 200) {
      console.log(`API KEY TEST SUCCESSFUL FOR ${provider.toUpperCase()}`);
      res.json({ success: true });
    } else {
      console.log(`API KEY TEST FAILED FOR ${provider.toUpperCase()} - Status: ${response.status}`);
      res.status(response.status).json({ error: 'API key validation failed' });
    }
  } catch (error) {
    console.error(`Error testing ${provider} API key:`, error.message);
    res.status(500).json({ error: error.response?.data?.error || error.message });
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

// Create a proxy for the Ollama API for direct model queries
app.use('/api/ollama', createProxyMiddleware({
  target: 'http://localhost:11434',
  changeOrigin: true,
  pathRewrite: {
    '^/api/ollama': ''
  },
  onProxyReq: (proxyReq, req, res) => {
    // If a custom Ollama URL was provided in headers, use that instead
    const customOllamaUrl = req.headers['x-ollama-url'];
    if (customOllamaUrl) {
      // We'd need to cancel this proxy and create a new request
      // This is complex with http-proxy-middleware, so we'll handle
      // the case in the route handler if needed
    }
    console.log(`Proxying Ollama API request: ${req.method} ${req.path}`);
  }
}));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Clean up old sessions periodically
setInterval(() => {
  try {
    sessionStore.cleanup();
  } catch (error) {
    console.error('Error cleaning up session store:', error);
  }
}, 3600000); // Once per hour

// In development mode, don't try to serve the static build files
if (!isDevelopment) {
  // Check if the build directory exists
  const buildPath = path.join(__dirname, 'build');
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
  console.log(`API available at http://localhost:${PORT}`);
  if (isDevelopment) {
    console.log(`React app running at http://localhost:3001`);
  } else {
    console.log(`App available at http://localhost:${PORT}`);
  }
});