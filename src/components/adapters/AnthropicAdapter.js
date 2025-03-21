import APIAdapter from './APIAdapter';

/**
 * Adapter specifically for Anthropic Claude API
 */
class AnthropicAdapter extends APIAdapter {
  constructor() {
    super();
    this.provider = 'anthropic';
  }

  /**
   * Initialize the Anthropic adapter
   * @param {Object} config - Configuration object
   * @returns {boolean} - Whether initialization was successful
   */
  initialize(config) {
    // Set default base URL if not provided
    if (!config.baseUrl) {
      config.baseUrl = 'https://api.anthropic.com/v1';
    }
    
    // Set provider explicitly
    config.provider = 'anthropic';
    
    return super.initialize(config);
  }

  /**
   * Format messages for Anthropic API
   * @param {Array} messages - Array of message objects
   * @returns {Array} - Formatted messages for Anthropic
   */
  formatMessages(messages) {
    messages = super.formatMessages(messages);
    
    // Claude uses 'user', 'assistant', and 'system' roles
    // No additional transformation needed for now
    
    return messages;
  }

  /**
   * Process the response from Anthropic API
   * @param {Object} responseData - Raw response from API
   * @returns {Object} - Formatted response for TRAILS-Chatbot
   */
  processResponse(responseData) {
    if (!responseData.content || responseData.content.length === 0) {
      throw new Error('Invalid response from Anthropic API');
    }
    
    return {
      statusCode: 200,
      body: {
        message: {
          role: 'assistant',
          content: responseData.content[0].text
        },
        finish_reason: responseData.stop_reason || 'stop'
      }
    };
  }

  /**
   * Override processChat to add Anthropic-specific headers
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
          'X-API-Base-URL': this.baseUrl,
          'X-Anthropic-Version': '2023-06-01' // Anthropic-specific header
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
        error: `Anthropic API error: ${error.message}`,
        body: {
          message: {
            role: 'assistant',
            content: `I apologize, but I encountered an error when trying to communicate with Anthropic Claude. Please check your API key and settings.`
          },
          finish_reason: 'error'
        }
      };
    }
  }
}

// Create a singleton instance
const anthropicAdapter = new AnthropicAdapter();
export default anthropicAdapter;