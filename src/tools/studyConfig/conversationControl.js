// conversationControl — applies a study's conversation-control mode to a new
// Conversation at start (Phase B scope §5, step 3). Two LIVE modes (PRD §9 D2):
//
//   seed_prompt       → no visible turn is injected; the seed framing is recorded
//                       on the conversation for the context builder to prepend
//                       (relay/context wiring lands in Phase D). Then free chat.
//   fixed_first_turn  → an investigator-authored opening BOT message is appended to
//                       the event log so the auditor sees it first; the live model
//                       then continues from it (buildContext includes bot turns).
//
// Both modes keep the live model in the loop on every subsequent turn — there is no
// model-bypass path. Provenance is stamped for BOTH modes (PRD §9 D9).
//
// Pure w.r.t. external I/O; operates on the in-memory Conversation + event log, so
// it is fully testable without a live model.

import { Message, ChatEvent, CHAT_EVENT_TYPE } from '../models';

/**
 * Build the provenance record for a conversation from a derived runtime config.
 * @param {object} runtimeConfig output of deriveRuntimeConfig()
 * @returns {{controlMode:string, seedOrFirstTurnText:(string|null), modelConfigId:string, modelConfigVersion:number, configVersion:number}}
 */
export function buildConversationProvenance(runtimeConfig) {
  const { conversationControl, model, configVersion } = runtimeConfig;
  const seedOrFirstTurnText =
    conversationControl.mode === 'fixed_first_turn'
      ? conversationControl.fixedFirstTurn
      : conversationControl.seedPrompt;

  return {
    controlMode: conversationControl.mode,
    seedOrFirstTurnText: seedOrFirstTurnText ?? null,
    modelConfigId: `${model.provider}:${model.modelId}`,
    modelConfigVersion: configVersion,
    configVersion,
  };
}

/**
 * Apply the configured control mode to a freshly-created Conversation: stamp
 * provenance, and either inject the fixed first bot turn or record the seed
 * framing. Mutates and returns the same conversation.
 *
 * @param {object} conversation a Conversation instance (from models.js)
 * @param {object} runtimeConfig output of deriveRuntimeConfig()
 * @returns {object} the same conversation
 */
export function applyConversationControl(conversation, runtimeConfig) {
  const { conversationControl } = runtimeConfig;

  conversation.setProvenance(buildConversationProvenance(runtimeConfig));

  if (conversationControl.mode === 'fixed_first_turn') {
    const text = conversationControl.fixedFirstTurn;
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('fixed_first_turn mode requires non-empty opening text');
    }
    const openingMessage = new Message({ author: 'bot', content: text });
    conversation.addChatEvent(new ChatEvent(CHAT_EVENT_TYPE.NEW_BOT_MESSAGE, openingMessage));
  } else {
    // seed_prompt: carry the seed for the context builder; no visible turn.
    conversation.setControlContext({
      mode: 'seed_prompt',
      seedPrompt: conversationControl.seedPrompt ?? null,
    });
  }

  return conversation;
}

export default applyConversationControl;
