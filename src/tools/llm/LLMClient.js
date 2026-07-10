// LLMClient — the LLM-transport SEAM (Phase 2A).
//
// One interface so the app can talk to: the bundled relay (server/server.js,
// canonical), an external proxy, or an in-browser WebLLM runtime — without the
// caller (ConversationHandler) knowing which. Every client returns the same
// shape ConversationHandler already expects:
//   { status: 'success', data: <server response> }  | { status: 'error400', data: null }
//
// This makes multi-provider, dual-model, and image backends (Phase 4) plug in
// at one place rather than scattered through the app.

/**
 * @typedef {Object} LLMClient
 * @property {(hostUrl: string) => any} getInstance
 * @property {(contextMessages: Array<{author:string, content:string}>) => Promise<{status:string, data:any}>} sendChatMessage
 */

export class BaseLLMClient {
  getInstance() {
    throw new Error('LLMClient.getInstance() not implemented');
  }
  async sendChatMessage() {
    throw new Error('LLMClient.sendChatMessage() not implemented');
  }
}

export default BaseLLMClient;
