import APIAdapter from './APIAdapter';

/**
 * Adapter specifically for OpenAI API
 */
class OpenAIAdapter extends APIAdapter {
  constructor() {
    super();
    this.provider = 'openai';
  }

  /**
   * Initialize the OpenAI adapter
   * @param {Object} config - Configuration object
   * @returns {boolean} - Whether initialization was successful
   */
  initialize(config) {
    // Set default base URL if not provided
    if (!config.baseUrl) {
      config.baseUrl = 'https://api.openai.com/v1';
    }
    
    // Set provider explicitly
    config.provider = 'openai';
    
    return super.initialize(config);
  }

  /**
   * Format messages for OpenAI API
   * @param {Array} messages - Array of message objects
   * @returns {Array} - Formatted messages for OpenAI
   */
  formatMessages(messages) {
    messages = super.formatMessages(messages);
    
    // OpenAI uses 'system', 'user', and 'assistant' roles as is
    // No additional formatting needed
    
    return messages;
  }

  /**
   * Process the response from OpenAI API
   * @param {Object} responseData - Raw response from API
   * @returns {Object} - Formatted response for TRAILS-Chatbot
   */
  processResponse(responseData) {
    if (!responseData.choices || responseData.choices.length === 0) {
      throw new Error('Invalid response from OpenAI API');
    }
    
    return {
      statusCode: 200,
      body: {
        message: {
          role: 'assistant',
          content: responseData.choices[0].message.content
        },
        finish_reason: responseData.choices[0].finish_reason || 'stop'
      }
    };
  }
}

// Create a singleton instance
const openaiAdapter = new OpenAIAdapter();
export default openaiAdapter;