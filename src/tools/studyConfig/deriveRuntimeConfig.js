// deriveRuntimeConfig — the pure mapping from a versioned StudyConfig (authored by
// the investigator) to the flat runtime config the auditor-facing app already
// consumes (Phase B scope §5). Keeping this a single, tested function is what lets
// the audit `<App>` stay almost unchanged: it still receives timer keys + a model
// block, now sourced from the study instead of hard-coded in index.js.
//
// Pure module: no React, no DB, no I/O.

import {
  withStudyConfigDefaults,
  assertValidStudyConfig,
  PROVIDER_META,
} from './schema';

/**
 * Map a study's model config to the relay wire contract (`server/server.js`):
 *   ollama → { backend:'ollama', ollamaUrl, ollamaModel }
 *   others → { backend:'api', provider, model, baseUrl, decoding }
 * Cloud providers fall back to their default base URL when none is given.
 * NO apiKey field: provider keys live server-side in the relay env (MOD-1);
 * the browser never carries one.
 */
export function modelToRelay(model) {
  const decoding = { ...(model.decoding || {}) };
  const systemPrompt = (model.systemPrompt || '');
  if (model.provider === 'ollama') {
    return { backend: 'ollama', ollamaUrl: model.baseUrl, ollamaModel: model.modelId, decoding, systemPrompt };
  }
  // WebLLM runs entirely in the auditor's browser (WebGPU) — it never touches the
  // relay. The wire object just names the model + decoding so the client-side
  // WebLLM path can pick it up; APIClient intercepts backend:'webllm' before any fetch.
  if (model.provider === 'webllm') {
    return { backend: 'webllm', webllmModel: model.modelId, decoding, systemPrompt };
  }
  const baseUrl = (model.baseUrl && model.baseUrl.trim())
    || (PROVIDER_META[model.provider] && PROVIDER_META[model.provider].defaultBaseUrl)
    || '';
  return {
    backend: 'api',
    provider: model.provider,
    model: model.modelId,
    baseUrl,
    decoding,
    systemPrompt,
  };
}

/**
 * The effective system prompt the relay should apply for a study: the model's
 * own system prompt, plus (in seed_prompt mode) the study's seed used as framing.
 * Both are legitimate system context; when both are present the model's system
 * text comes first, then the seed. Returns '' when neither is set.
 */
export function effectiveSystemPrompt(model, conversationControl) {
  const base = (model.systemPrompt || '').trim();
  const seed = conversationControl && conversationControl.mode === 'seed_prompt'
    ? (conversationControl.seedPrompt || '').trim()
    : '';
  return [base, seed].filter(Boolean).join('\n\n');
}

/**
 * Map a StudyConfig to the runtime config consumed by the auditor session.
 *
 * The input is first completed with defaults (so a partial is tolerated) and then
 * asserted valid — you only ever derive a runtime config for a real session, and a
 * malformed config must never reach an auditor (PRD §9 D1; scope §3).
 *
 * Output shape:
 *   - timer keys (consumed by ChatTimerSystem via its existing field names)
 *   - conversationsPerAuditor (SC-5; the session's expected N)
 *   - model: the normalized model block the relay will call (relay wire-format is
 *     assembled in Phase D, where provider routing + server-side keys live)
 *   - conversationControl: drives seeding at conversation start (SC-2 / D2)
 *   - evaluation: which surfaces render (components hardened in Phase C)
 *   - consent / launchCapture: carried through for the session
 *   - configVersion: provenance stamp (D9)
 *
 * @param {object} rawConfig a StudyConfig (possibly partial)
 * @returns {object} the runtime config
 */
export function deriveRuntimeConfig(rawConfig) {
  const cfg = withStudyConfigDefaults(rawConfig);
  assertValidStudyConfig(cfg);

  const { limits } = cfg;
  const n = limits.conversationsPerAuditor;
  const model = cfg.models[0];

  return {
    // --- timing: ChatTimerSystem reads exactly these keys (decision: derive into
    // the existing array shape rather than touch the timer engine). ---
    timerMaxOverallChatTimeSeconds: limits.overallSeconds,
    timerChatsMaxSeconds: Array.from({ length: n }, () => limits.perConversationSeconds),
    timerAuditMaxSeconds: null, // no audit timer configured in this version
    timerWarningChatTimeIsUpSeconds: limits.warningSeconds,
    timerMinChatTimeRemainingToStartNewChatSeconds: limits.minRemainingToStartNewChatSeconds,

    // --- session shape ---
    conversationsPerAuditor: n,

    // --- model the relay should call ---
    model: {
      provider: model.provider,
      modelId: model.modelId,
      baseUrl: model.baseUrl || '',
      systemPrompt: model.systemPrompt || '',
      decoding: { ...model.decoding },
    },
    // The relay wire-contract object (server/server.js reads `relay`). This makes the
    // study's chosen provider/model + framing + decoding actually drive chat. The
    // seed prompt (seed_prompt mode) is folded into the relay's system prompt so the
    // model is framed on every turn without injecting a visible conversation turn.
    llmRelay: {
      ...modelToRelay(model),
      systemPrompt: effectiveSystemPrompt(model, cfg.conversationControl),
    },

    // --- conversation control: seeding handled at conversation start (Phase B step 3) ---
    conversationControl: {
      mode: cfg.conversationControl.mode,
      seedPrompt: cfg.conversationControl.seedPrompt || null,
      fixedFirstTurn: cfg.conversationControl.fixedFirstTurn || null,
    },

    // --- evaluation surfaces (Phase C wires the components to these flags) ---
    evaluation: {
      turnReactions: {
        enabled: cfg.evaluation.turnReactions.enabled,
        types: [...(cfg.evaluation.turnReactions.types || [])],
      },
      questionnaire: {
        enabled: cfg.evaluation.questionnaire.enabled,
        schema: cfg.evaluation.questionnaire.schema ?? null,
      },
      spanHighlighting: { enabled: cfg.evaluation.spanHighlighting.enabled },
    },

    // --- carried through for the session ---
    consent: { text: cfg.consent?.text ?? null, version: cfg.consent?.version ?? null },
    launchCapture: { enabled: cfg.launchCapture?.enabled ?? false },

    // --- provenance (D9): tie collected data to the exact config version in force ---
    configVersion: cfg.schemaVersion,
  };
}

export default deriveRuntimeConfig;
