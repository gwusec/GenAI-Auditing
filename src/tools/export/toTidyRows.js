// toTidyRows — project a study's conversations into TIDY / LONG rows: exactly one
// row per observation (a turn reaction, a span highlight, a Likert answer, or a
// free-text answer). Every row carries the conversation's provenance columns
// (control_mode, seed/first-turn text, model + config version) so an analyst can
// stratify by study condition in R/pandas without a join (DASH / §4.2).
//
// Pure module: no React, no I/O. CSV and JSON are both derived from THIS output
// (see toCsv + index.buildStudyExport), so the two encodings can never disagree.

import { CHAT_EVENT_TYPE } from '../models';

// The full, ordered column set. Every row is filled to this shape (missing cells
// become '') so CSV columns line up and JSON objects are homogeneous.
export const TIDY_COLUMNS = [
  'conversation_id',
  'user_id',
  'study_id',
  'control_mode',
  'seed_or_first_turn_text',
  'model_config_id',
  'model_config_version',
  'config_version',
  'observation_type', // reaction | highlight | likert | text_response
  'message_id',
  'question_key',
  'value',
  'label',
  'quoted_text',
  'start_offset',
  'end_offset',
  'explanation',
  'comment',
  'conversation_start',
  'conversation_end',
];

const firstDefined = (...vals) => {
  for (const v of vals) if (v !== undefined && v !== null) return v;
  return '';
};

// Reactions, projected from the event log directly so this works on both live
// Conversation instances and plain deserialized objects (which lack getReactions).
function reactionsOf(conv) {
  const events = Array.isArray(conv?.chatEvents) ? conv.chatEvents : [];
  return events
    .filter((e) => e && e.type === CHAT_EVENT_TYPE.NEW_REACTION && e.data)
    .map((e) => ({ timestamp: e.timestamp, ...e.data }));
}

// The provenance + identity columns shared by every row of one conversation.
function conversationBase(conv) {
  const p = conv?.provenance || {};
  return {
    conversation_id: firstDefined(conv?.id),
    user_id: firstDefined(conv?.userID, conv?.userId),
    study_id: firstDefined(conv?.studyId),
    control_mode: firstDefined(p.controlMode),
    seed_or_first_turn_text: firstDefined(p.seedOrFirstTurnText),
    model_config_id: firstDefined(p.modelConfigId),
    model_config_version: firstDefined(p.modelConfigVersion),
    config_version: firstDefined(p.configVersion),
    conversation_start: firstDefined(conv?.startTimestamp),
    conversation_end: firstDefined(conv?.endTimestamp),
  };
}

// Normalize a row to the full column set in order.
function fillColumns(row) {
  const out = {};
  for (const col of TIDY_COLUMNS) out[col] = row[col] === undefined || row[col] === null ? '' : row[col];
  return out;
}

/**
 * @param {Array<object>} conversations conversations for one study (Conversation
 *   instances or plain deserialized objects)
 * @returns {Array<object>} tidy/long rows, each with every TIDY_COLUMNS key
 */
export function toTidyRows(conversations) {
  const rows = [];
  for (const conv of conversations || []) {
    const base = conversationBase(conv);
    const audit = conv?.audit || {};

    // Turn reactions (thumbs/flag/star): one row each.
    for (const r of reactionsOf(conv)) {
      rows.push({
        ...base,
        observation_type: 'reaction',
        message_id: firstDefined(r.messageId),
        label: firstDefined(r.type),          // reaction kind (thumbs/flag/star)
        value: firstDefined(r.value),         // up/down/1..5/etc.
        comment: firstDefined(r.comment),
      });
    }

    // Span highlights: tolerate both the hardened ({quotedText,startOffset,endOffset})
    // and legacy ({text,startIndex}) shapes.
    for (const h of (Array.isArray(audit.highlights) ? audit.highlights : [])) {
      rows.push({
        ...base,
        observation_type: 'highlight',
        message_id: firstDefined(h.messageId),
        quoted_text: firstDefined(h.quotedText, h.text),
        start_offset: firstDefined(h.startOffset, h.startIndex),
        end_offset: firstDefined(h.endOffset),
        label: firstDefined(h.label),
        explanation: firstDefined(h.explanation),
      });
    }

    // Legacy questionnaire shape (pre-AuditFlow): explicit likert/text buckets.
    for (const [k, v] of Object.entries(audit.likertResponses || {})) {
      rows.push({ ...base, observation_type: 'likert', question_key: k, value: firstDefined(v) });
    }
    for (const [k, v] of Object.entries(audit.textResponses || {})) {
      rows.push({ ...base, observation_type: 'text_response', question_key: k, value: firstDefined(v) });
    }

    // Current questionnaire shape (AuditFlow stores the SurveyJS response map on
    // audit.questionnaire): a flat { questionName: answer } object where an answer
    // may be a scalar (single choice / rating / text), a matrix ({ row: value }),
    // or an array (multi-select). Flatten each into tidy rows.
    for (const [q, answer] of Object.entries(audit.questionnaire || {})) {
      rows.push(...questionnaireRows(base, q, answer));
    }
  }
  return rows.map(fillColumns);
}

// Flatten one questionnaire answer into tidy rows. Matrix answers expand to one
// row per sub-question (question_key "q.row"); arrays are joined; strings become
// text_response, everything else (numbers/booleans/ratings) becomes likert.
function questionnaireRows(base, question, answer) {
  if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
    return Object.entries(answer).map(([sub, val]) => ({
      ...base, observation_type: 'likert', question_key: `${question}.${sub}`, value: firstDefined(val),
    }));
  }
  if (Array.isArray(answer)) {
    return [{ ...base, observation_type: 'text_response', question_key: question, value: answer.join('; ') }];
  }
  const type = typeof answer === 'string' ? 'text_response' : 'likert';
  return [{ ...base, observation_type: type, question_key: question, value: firstDefined(answer) }];
}

export default toTidyRows;
