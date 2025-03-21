import AdapterFactory from './adapters/AdapterFactory';

/**
 * Service for handling chat interactions with different LLM backends
 */
class ChatService {
  constructor() {
    this.currentAdapter = null;
    this.initialized = false;
    this.currentBackend = null;
    this.currentConfig = null;
  }

  /**
   * Initialize the chat service with a specific backend and configuration
   * @param {string} backend - Backend type ('ollama', 'webllm', 'api')
   * @param {Object} config - Configuration for the backend
   * @param {Function} onProgress - Optional progress callback for initialization
   * @returns {Promise<boolean>} - Whether initialization was successful
   */
  async initialize(backend, config, onProgress = null) {
    try {
      this.currentBackend = backend;
      this.currentConfig = config;
      
      // Get the appropriate adapter
      const provider = backend === 'api' ? config.provider : null;
      this.currentAdapter = AdapterFactory.getAdapter(backend, provider);
      
      // Initialize the adapter
      const initSuccess = await this.currentAdapter.initialize({
        ...config,
        onProgress
      });
      
      this.initialized = initSuccess;
      return initSuccess;
    } catch (error) {
      console.error('Error initializing chat service:', error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Process a chat message using the current adapter
   * @param {Object} requestData - Chat request data
   * @returns {Promise<Object>} - Response data
   */
  async processChat(requestData) {
    if (!this.initialized || !this.currentAdapter) {
      return {
        statusCode: 500,
        error: 'Chat service not initialized',
        body: {
          message: {
            role: 'assistant',
            content: 'The chat service is not properly initialized. Please check your configuration and try again.'
          },
          finish_reason: 'error'
        }
      };
    }
    
    try {
      // Use the current adapter to process the chat
      return await this.currentAdapter.processChat(requestData);
    } catch (error) {
      console.error('Error processing chat:', error);
      return {
        statusCode: 500,
        error: `Chat processing error: ${error.message}`,
        body: {
          message: {
            role: 'assistant',
            content: 'I apologize, but I encountered an error while processing your request. Please try again later.'
          },
          finish_reason: 'error'
        }
      };
    }
  }

  /**
   * Clean up and prepare for shutdown
   * @returns {Promise<void>}
   */
  async cleanup() {
    if (this.currentAdapter && typeof this.currentAdapter.cleanup === 'function') {
      await this.currentAdapter.cleanup();
    }
    this.initialized = false;
    this.currentAdapter = null;
  }

  /**
   * Check if the current backend is of a specified type
   * @param {string} backendType - Backend type to check
   * @returns {boolean} - Whether the current backend matches
   */
  isBackendType(backendType) {
    return this.currentBackend === backendType;
  }

  /**
   * Get the current backend type
   * @returns {string|null} - Current backend type
   */
  getBackendType() {
    return this.currentBackend;
  }
}

// Create a singleton instance
const chatService = new ChatService();
export default chatService;