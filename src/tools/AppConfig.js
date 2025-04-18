class AppConfig {
    constructor() {
      if (!AppConfig.instance) {
        this.config = {}; // Mutable configuration object
        AppConfig.instance = this;
      }
      return AppConfig.instance;
    }
  
    // Initialize with settings
    initialize({ llmProxyServerUrl, isViewOnly = false, config = {}, userId }) {
      this.config = {
        llmProxyServerUrl,
        isViewOnly,
        config,
        userId,
      };
    }
  
    // Get a specific key's value
    get(key) {
      return this.config[key];
    }
  
    // Set a specific key's value
    set(key, value) {
      this.config[key] = value;
    }
  
    // Retrieve the entire configuration object
    getAll() {
      return { ...this.config }; // Return a shallow copy for safety
    }
  }
  
  // Create and export a singleton instance
  const instance = new AppConfig();
  
  // Remove Object.freeze(instance) to allow config updates
  export default instance;