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
      // Canonical backend contract (Phase 1): the bundled relay (server/server.js)
      // expects a `relay` object describing the chosen backend/provider. It is
      // sourced from the runtime `config.llmRelay` passed into <App />. An
      // interactive settings UI to populate this is Phase 4; until then the host
      // app / index.js provides it. `pid` is retained for proxy allow-list/logging.
      const appRuntimeConfig = AppConfig.get("config") || {};
      const relay = appRuntimeConfig.llmRelay;

      try {
        if (!userId) {
          throw new Error('User ID not found');
        }
        if (!relay || !relay.backend) {
          throw new Error('LLM relay configuration is missing (expected config.llmRelay with a `backend`)');
        }
        const response = await instance.post('/chat', {
          messages: llmMessages,
          pid: userId,
          relay
        });
        return {status: "success", data: response.data};
      } catch (err) {
        // Log only message + status: the full axios error embeds the request
        // config (the whole relay object), which doesn't belong in the console.
        console.error(
          '[ERROR] Error sending chat message:',
          err.message,
          err.response?.status ?? '(no status)'
        );
        if (err.response && err.response.status === 400) {
          return {status: "error400", data: null};
        }
        // (Removed the old "Are you down?" probe: it fired a real upstream
        // model call on every non-400 error, and its success check tested a
        // misspelled `statuCode` so the branch could never return anyway.)
        throw err;
      }
    }
  };
})();

export default apiClient;