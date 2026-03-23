/**
 * Base adapter for API-based LLM providers
 */
class APIAdapter {
    constructor() {
      this.apiKey = null;
      this.provider = null;
      this.model = null;
      this.baseUrl = null;
    }
  
    /**
     * Initialize the API adapter
     * @param {Object} config - Configuration object
     * @param {string} config.provider - API provider (openai, anthropic, etc.)
     * @param {string} config.apiKey - API key
     * @param {string} config.model - Model to use
     * @param {string} config.baseUrl - Base URL for API (can be custom for proxies)
     * @returns {boolean} - Whether initialization was successful
     */
    initialize(config) {
      try {
        this.provider = config.provider;
        this.apiKey = config.apiKey;
        this.model = config.model;
        this.baseUrl = config.baseUrl;
        
        if (!this.apiKey || !this.provider || !this.model) {
          throw new Error('Missing required configuration');
        }
        
        return true;
      } catch (error) {
        console.error('Error initializing API adapter:', error);
        return false;
      }
    }
  
    /**
     * Verify API key is valid
     * @returns {Promise<boolean>} - Whether the key is valid
     */
    async verifyApiKey() {
      try {
        const response = await fetch('/api/test-api-key', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            provider: this.provider,
            apiKey: this.apiKey,
            model: this.model,
            baseUrl: this.baseUrl
          })
        });
        
        if (!response.ok) {
          throw new Error(`API key validation failed: ${response.statusText}`);
        }
        
        return true;
      } catch (error) {
        console.error('API key verification failed:', error);
        return false;
      }
    }
  
    /**
     * Process a chat message using the appropriate API
     * @param {Object} requestData - Chat request data from TRAILS-Chatbot
     * @returns {Promise<Object>} - Formatted response for TRAILS-Chatbot
     */
    async processChat(requestData) {
      try {
        if (!this.apiKey || !this.provider || !this.model) {
          throw new Error('API adapter not initialized properly');
        }
  
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey,
            'X-API-Provider': this.provider,
            'X-API-Model': this.model,
            'X-API-Base-URL': this.baseUrl
          },
          body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'API request failed');
        }
        
        return await response.json();
      } catch (error) {
        console.error('API processing error:', error);
        
        // Return error in the format expected by TRAILS-Chatbot
        return {
          statusCode: 500,
          error: `API error: ${error.message}`,
          body: {
            message: {
              role: 'assistant',
              content: `I apologize, but I encountered an error when trying to communicate with ${this.provider}. Please check your API key and settings.`
            },
            finish_reason: 'error'
          }
        };
      }
    }
  
    /**
     * Format messages according to provider requirements
     * This should be overridden by specific provider adapters
     * @param {Array} messages - Array of message objects
     * @returns {Array} - Formatted messages
     */
    formatMessages(messages) {
      // Default implementation - just ensure there's a system message
      if (!messages.some(msg => msg.role === 'system')) {
        messages = [
          { role: 'system', content: 'You are a helpful assistant.' },
          ...messages
        ];
      }
      return messages;
    }
  }
  
  export default APIAdapter;