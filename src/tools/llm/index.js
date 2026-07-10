// LLMClient factory (Phase 2A seam entry point).
//
// Returns a client implementing the LLMClient contract. 'relay' is canonical and
// maps to the existing relay APIClient (which posts { messages, pid, relay } to
// server/server.js). 'proxy' and 'webllm' are reserved for the OSS "support both"
// path and the in-browser runtime — stubbed until Phase 4.

import relayClient from '../APIClient';
import { BaseLLMClient } from './LLMClient';

class WebLLMClientStub extends BaseLLMClient {
  getInstance() { return this; }
  async sendChatMessage() {
    throw new Error('WebLLM client is not implemented yet (planned Phase 4).');
  }
}

class ProxyClientStub extends BaseLLMClient {
  getInstance() { return this; }
  async sendChatMessage() {
    throw new Error(
      'External-proxy client (pid-only) is not wired in. The canonical contract ' +
      "is 'relay'. A configurable proxy mode is a Phase 4 follow-up."
    );
  }
}

export function getLLMClient(kind = process.env.REACT_APP_LLM_BACKEND || 'relay') {
  switch ((kind || '').toLowerCase()) {
    case 'relay':
    case '':
      return relayClient; // the existing APIClient — already implements the contract
    case 'webllm':
      return new WebLLMClientStub();
    case 'proxy':
      return new ProxyClientStub();
    default:
      throw new Error(`Unknown LLM backend: ${kind}`);
  }
}

export default getLLMClient;
