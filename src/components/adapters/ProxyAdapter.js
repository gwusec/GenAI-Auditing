import axios from 'axios';

/**
 * Adapter to handle communication with the LLM proxy server
 */
class ProxyAdapter {
  constructor() {
    this.axiosInstance = null;
    this.config = null;
  }

  /**
   * Initialize the proxy adapter
   * @param {Object} config - Configuration object
   * @param {string} config.proxyUrl - URL of the proxy server
   * @param {string} config.ollamaUrl - URL of the Ollama server
   * @param {string} config.model - Model name to use
   * @returns {boolean} - Whether initialization was successful
   */
  initialize(config) {
    this.config = config;
    
    // Create axios instance
    this.axiosInstance = axios.create({
      baseURL: config.proxyUrl,
      timeout: 60000, // 60 second timeout for LLM responses
      headers: {
        'Content-Type': 'application/json',
        'X-Ollama-Url': config.ollamaUrl || 'http://localhost:11434',
        'X-Ollama-Model': config.model || 'llama3'
      }
    });
    
    return true;
  }

  /**
   * Check if the proxy server is reachable
   * @returns {Promise<boolean>} - Whether the server is reachable
   */
  async checkConnection() {
    try {
      await this.axiosInstance.get('/api/health', { timeout: 3000 });
      return true;
    } catch (error) {
      console.error('Proxy server connection check failed:', error);
      return false;
    }
  }

  /**
   * Process a chat message using the proxy server
   * @param {Object} requestData - Chat request data from TRAILS-Chatbot
   * @returns {Promise<Object>} - Formatted response for TRAILS-Chatbot
   */
  async processChat(requestData) {
    try {
      if (!this.axiosInstance) {
        throw new Error('Proxy adapter not initialized');
      }

      const response = await this.axiosInstance.post('/chat', requestData);
      return response.data;
    } catch (error) {
      console.error('Proxy processing error:', error);
      
      // Return error in the format expected by TRAILS-Chatbot
      return {
        statusCode: error.response?.status || 500,
        error: `Proxy error: ${error.message}`,
        body: {
          message: {
            role: 'assistant',
            content: 'I apologize, but I encountered an error while processing your request. Please check your server connection and try again.'
          },
          finish_reason: 'error'
        }
      };
    }
  }

  /**
   * Fetch available models from Ollama
   * @returns {Promise<Array>} - Array of available models
   */
  async getAvailableModels() {
    try {
      if (!this.axiosInstance) {
        throw new Error('Proxy adapter not initialized');
      }

      const response = await this.axiosInstance.get('/api/ollama/api/tags', {
        timeout: 3000
      });
      
      if (response.data && response.data.models) {
        return response.data.models;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching available models:', error);
      return [];
    }
  }
}

// Create a singleton instance
const proxyAdapter = new ProxyAdapter();
export default proxyAdapter;