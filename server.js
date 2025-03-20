const express = require('express');
const path = require('path');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'build')));

// Middleware to intercept chat API calls and redirect to Ollama
app.use('/chat', async (req, res) => {
  try {
    // Extract the relevant information from the request
    const { pid, model, messages } = req.body;
    
    // Get Ollama URL from request header or use default
    const ollamaUrl = req.headers['x-ollama-url'] || 'http://localhost:11434';
    
    // Get Ollama model from request or use default
    const ollamaModel = model || req.headers['x-ollama-model'] || 'llama3';
    
    console.log(`Proxying request to Ollama (${ollamaUrl})`);
    console.log(`Using model: ${ollamaModel}`);
    console.log(`Message count: ${messages?.length || 0}`);
    
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
    
    res.json(responseData);
  } catch (error) {
    console.error('Error proxying to Ollama:', error.message);
    
    // Send error response
    res.status(500).json({
      statusCode: 500,
      error: `Failed to get response from LLM: ${error.message}`
    });
  }
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
      // This is a bit complex with http-proxy-middleware, so we'll handle
      // this case in the route handler if needed
    }
    console.log(`Proxying Ollama API request: ${req.method} ${req.path}`);
  }
}));

// For any other GET request, send the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access the app at http://localhost:${PORT}`);
});