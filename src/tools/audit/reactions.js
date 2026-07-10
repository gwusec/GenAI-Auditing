// reactions — turn-level reaction helpers (Phase C step 2; AUD-5 / EVAL-1).
// Reactions are stored as `new_reaction` events in the conversation event log
// (decision: single source of truth, survives resume). These helpers build/validate
// reaction data and project the current state for the UI.
//
// Reaction data: { messageId, type, value, comment }
//   type ∈ REACTION_TYPES ('thumbs' | 'star' | 'flag' | 'comment')
//   value: e.g. 'up'|'down' for thumbs, true/false for star/flag, null to clear
//   comment: free text (chiefly for type 'comment'); optional

import { REACTION_TYPES } from '../studyConfig/schema';

export { REACTION_TYPES };

/** Is this reaction type enabled for the study? (config.evaluation.turnReactions.types) */
export function isReactionEnabled(type, enabledTypes = []) {
  return Array.isArray(enabledTypes) && enabledTypes.includes(type);
}

/**
 * Build + validate the data payload for a NEW_REACTION event.
 * @param {{messageId:string,type:string,value?:any,comment?:(string|null)}} input
 * @returns {{messageId:string,type:string,value:any,comment:(string|null)}}
 */
export function makeReactionData({ messageId, type, value = null, comment = null } = {}) {
  if (!messageId) throw new Error('messageId is required');
  if (!REACTION_TYPES.includes(type)) {
    throw new Error(`Unknown reaction type: ${JSON.stringify(type)}`);
  }
  return { messageId, type, value, comment };
}

/**
 * Reduce a reaction list to the **current** state: the last value per
 * (messageId, type). `comment` reactions are kept individually (each comment is a
 * distinct annotation, not a toggle). A reaction whose latest `value` is null and
 * has no comment is treated as cleared and dropped.
 * @param {Array} reactions output of Conversation.getReactions()
 * @returns {Array} current reactions
 */
export function currentReactions(reactions = []) {
  const byKey = new Map();   // `${messageId}|${type}` -> reaction (for toggles)
  const comments = [];        // comments kept as-is, in order

  for (const r of reactions) {
    if (r.type === 'comment') { comments.push(r); continue; }
    byKey.set(`${r.messageId}|${r.type}`, r);
  }

  const toggles = [...byKey.values()].filter(
    (r) => !(r.value == null && (r.comment == null || r.comment === ''))
  );
  return [...toggles, ...comments];
}
