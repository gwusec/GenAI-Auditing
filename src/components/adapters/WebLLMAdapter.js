import webllmClient from '../../utils/WebLLMClient';

/**
 * Adapter to integrate WebLLM with the TRAILS-Chatbot
 * Simulates API responses that the chatbot expects
 */
class WebLLMAdapter {
  constructor() {
    this.isInitialized = false;
    this.currentModel = '';
    this.quantized = true;
    this.initPromise = null;
  }

  /**
   * Initialize the WebLLM client
   * @param {Object} config - Configuration object
   * @param {string} config.model - Model name
   * @param {boolean} config.quantized - Whether to use the quantized model
   * @param {Function} config.onProgress - Progress callback
   * @returns {Promise<boolean>} - Resolves when initialization is complete
   */
  async initialize(config) {
    const { model, quantized = true, onProgress } = config;
    
    if (this.isInitialized && this.currentModel === model && this.quantized === quantized) {
      return true;
    }

    // Check if browser supports WebGPU
    if (!webllmClient.isWebGPUSupported()) {
      throw new Error('Your browser does not support WebGPU, which is required for WebLLM');
    }

    this.initPromise = webllmClient.initialize(model, quantized, onProgress);
    
    try {
      await this.initPromise;
      this.isInitialized = true;
      this.currentModel = model;
      this.quantized = quantized;
      return true;
    } catch (error) {
      console.error('Failed to initialize WebLLM:', error);
      throw error;
    }
  }

  /**
   * Process a chat message using WebLLM
   * @param {Object} requestData - Chat request data from TRAILS-Chatbot
   * @returns {Promise<Object>} - Formatted response for TRAILS-Chatbot
   */
  async processChat(requestData) {
    try {
      // Ensure WebLLM is initialized
      if (!this.isInitialized) {
        throw new Error('WebLLM is not initialized');
      }

      const { messages } = requestData;
      
      // Generate response using WebLLM
      const response = await webllmClient.chat(messages);
      
      // Format the response to match what TRAILS-Chatbot expects
      return {
        statusCode: 200,
        body: {
          message: {
            role: 'assistant',
            content: response
          },
          finish_reason: 'stop'
        }
      };
    } catch (error) {
      console.error('WebLLM processing error:', error);
      
      // Return error in the format expected by TRAILS-Chatbot
      return {
        statusCode: 500,
        error: `WebLLM error: ${error.message}`,
        body: {
          message: {
            role: 'assistant',
            content: 'I apologize, but I encountered an error while processing your request. Please try again or consider using a different model.'
          },
          finish_reason: 'error'
        }
      };
    }
  }

  /**
   * Clean up and unload model when no longer needed
   */
  async cleanup() {
    if (this.isInitialized) {
      await webllmClient.unload();
      this.isInitialized = false;
      this.currentModel = '';
    }
  }
}

// Create a singleton instance
const webllmAdapter = new WebLLMAdapter();
export default webllmAdapter;