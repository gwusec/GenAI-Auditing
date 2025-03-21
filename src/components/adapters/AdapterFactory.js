import ollmaAdapter from './ProxyAdapter'; // Rename for consistency
import webllmAdapter from './WebLLMAdapter';
import openaiAdapter from './OpenAIAdapter';
import anthropicAdapter from './AnthropicAdapter';

/**
 * Factory for creating LLM adapters
 */
class AdapterFactory {
  /**
   * Get the appropriate adapter based on backend type and provider
   * @param {string} backend - Backend type ('ollama', 'webllm', 'api')
   * @param {string} provider - Provider name (for API backend)
   * @returns {Object} - The appropriate adapter instance
   */
  static getAdapter(backend, provider = null) {
    switch (backend) {
      case 'ollama':
        return ollmaAdapter;
      
      case 'webllm':
        return webllmAdapter;
      
      case 'api':
        return this.getApiAdapter(provider);
      
      default:
        throw new Error(`Unsupported backend: ${backend}`);
    }
  }
  
  /**
   * Get the appropriate API adapter based on provider
   * @param {string} provider - Provider name
   * @returns {Object} - The appropriate API adapter instance
   */
  static getApiAdapter(provider) {
    switch (provider) {
      case 'openai':
        return openaiAdapter;
      
      case 'anthropic':
        return anthropicAdapter;
      
      // Add additional providers here as they're implemented
      
      default:
        throw new Error(`Unsupported API provider: ${provider}`);
    }
  }
}

export default AdapterFactory;