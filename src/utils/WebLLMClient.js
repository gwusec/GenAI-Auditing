import { Chat } from '@mlc-ai/web-llm';

class WebLLMClient {
  constructor() {
    this.chat = null;
    this.initialized = false;
    this.modelName = '';
    this.initializationPromise = null;
  }

  /**
   * Initialize the WebLLM client with the specified model
   * @param {string} modelName - Name of the model to use
   * @param {boolean} quantized - Whether to use the quantized model version
   * @param {Function} progressCallback - Optional callback for progress updates
   */
  async initialize(modelName, quantized = true, progressCallback = null) {
    // If already initializing with the same model, return the existing promise
    if (this.initializationPromise && this.modelName === modelName) {
      return this.initializationPromise;
    }

    // Create a new initialization promise
    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // Clean up any existing instance
        if (this.chat) {
          await this.chat.unload();
          this.chat = null;
        }

        this.modelName = modelName;
        this.initialized = false;

        // Create a new chat instance - using Chat instead of ChatModule
        this.chat = new Chat();

        // Configure the model options
        const modelOptions = {
          // Prefer quantized models to save bandwidth, unless specifically requested otherwise
          model: quantized ? `${modelName}-q4f32_1` : modelName
        };

        // Set up progress handling if a callback was provided
        if (progressCallback && typeof progressCallback === 'function') {
          this.chat.setInitProgressCallback((report) => {
            const progress = {
              progress: report.progress,
              timeElapsed: report.timeElapsed,
              text: `${report.text} (${Math.round(report.progress * 100)}%)`
            };
            progressCallback(progress);
          });
        }

        // Initialize the model
        await this.chat.reload(modelOptions);
        this.initialized = true;
        resolve(true);
      } catch (error) {
        console.error('WebLLM initialization error:', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * Generate a response for the given conversation
   * @param {Array} messages - Array of message objects with role and content
   * @returns {Promise<string>} - The generated response
   */
  async chat(messages) {
    if (!this.initialized || !this.chat) {
      throw new Error('WebLLM client not initialized');
    }

    // Format messages for WebLLM
    let prompt = '';
    
    // Implement proper prompt formatting based on the model type
    if (this.modelName.includes('Llama')) {
      // Llama format
      messages.forEach(msg => {
        if (msg.role === 'system') {
          prompt += `<s>[INST] <<SYS>>\n${msg.content}\n<</SYS>>\n\n`;
        } else if (msg.role === 'user') {
          prompt += `${msg.content} [/INST]\n`;
        } else if (msg.role === 'assistant') {
          prompt += `${msg.content}</s>\n<s>[INST] `;
        }
      });
      // Add final user instruction if the last message is from the user
      if (messages[messages.length - 1].role === 'user') {
        prompt += ' [/INST]\n';
      }
    } else if (this.modelName.includes('Gemma')) {
      // Gemma format
      messages.forEach(msg => {
        if (msg.role === 'system') {
          prompt += `<start_of_turn>system\n${msg.content}<end_of_turn>\n`;
        } else if (msg.role === 'user') {
          prompt += `<start_of_turn>user\n${msg.content}<end_of_turn>\n`;
        } else if (msg.role === 'assistant') {
          prompt += `<start_of_turn>model\n${msg.content}<end_of_turn>\n`;
        }
      });
      prompt += `<start_of_turn>model\n`;
    } else {
      // Generic format for other models (Mistral, etc.)
      messages.forEach(msg => {
        if (msg.role === 'system') {
          prompt += `<|im_start|>system\n${msg.content}<|im_end|>\n`;
        } else if (msg.role === 'user') {
          prompt += `<|im_start|>user\n${msg.content}<|im_end|>\n`;
        } else if (msg.role === 'assistant') {
          prompt += `<|im_start|>assistant\n${msg.content}<|im_end|>\n`;
        }
      });
      prompt += `<|im_start|>assistant\n`;
    }

    try {
      // Generate the response
      const response = await this.chat.generate(prompt, {
        temperature: 0.7,
        max_gen_length: 2048
      });

      return response.trim();
    } catch (error) {
      console.error('WebLLM generation error:', error);
      throw error;
    }
  }

  /**
   * Check if the browser supports WebGPU
   * @returns {boolean} - True if WebGPU is supported
   */
  static isWebGPUSupported() {
    return navigator && 'gpu' in navigator;
  }

  /**
   * Unload the model and free resources
   */
  async unload() {
    if (this.chat) {
      await this.chat.unload();
      this.chat = null;
      this.initialized = false;
    }
  }
}

// Create a singleton instance
const webllmClient = new WebLLMClient();
export default webllmClient;