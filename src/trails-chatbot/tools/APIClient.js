import axios from 'axios';
import AppConfig from "./AppConfig";

const apiClient = (() => {
  let instance = null;

  const createInstance = (hostUrl) => {
    const api = axios.create({
      baseURL: hostUrl,
      timeout: 300000,
    });
    return api;
  };

  const getInstance = (hostUrl) => {
    if (!instance) {
      instance = createInstance(hostUrl);
    }
    return instance;
  };

  return {
    getInstance: (hostUrl) => {
      return getInstance(hostUrl);
    },

    sendChatMessage: async (contextMessages) => {
      if (!instance) {
        throw new Error('API client not initialized. Call getInstance first.');
      }
      console.log('contextMessages recieved by the api client:', contextMessages);

      const llmMessages = contextMessages.map(message => ({
        role: message.author === 'user' ? 'user' : 'assistant',
        content: message.content
      }));

      const userId = AppConfig.get("userId");

      try {
        if (!userId) {
          throw new Error('User ID not found');
        }
        const response = await instance.post('/chat', {
          messages: llmMessages,
          pid: userId
        });
        return {status: "success", data: response.data};
      } catch (err) {
        console.error("[ERROR] Error sending chat message:", err);
        if (err.response && err.response.status === 400) {
          return {status: "error400", data: null};
        } else {
          try {
            const testMessage = {
              role: 'user',
              content: 'Are you down?'
            }
            const response = await instance.post('/chat', {
              messages: [testMessage],
              pid: userId
            });
            if (response.data.statuCode === 200) {
              console.log("[INFO] API available - probably message exceeding limit.");
              return response.data;
            }
          } catch (err) {
            console.error("[ERROR] Error sending test message:", err);
          }
          throw err;
        }
      }
    }
  };
})();

export default apiClient;