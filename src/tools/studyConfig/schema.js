// StudyConfig — the versioned backbone object that fully determines the auditor
// experience for a study (PRD §2.1, §7; Phase B scope docs/phase-b-study-config-scope.md).
//
// One object lives at `study.config`. This module owns its shape: the default,
// a defaults-merger for partial input (UI/migration), and a validator that must
// pass before a config is saved or an auditor session starts — a malformed config
// must never reach an auditor (mirrors the validate-before-save rule in PRD §9 D1).
//
// Pure module: no React, no DB, no I/O. Safe to unit-test in isolation.

/** Bump on any breaking change to the shape. Stamped onto sessions/conversations. */
export const STUDY_CONFIG_SCHEMA_VERSION = 1;

/** Two LIVE conversation-control modes ship in MVP (PRD §9 D2). `scripted` is
 *  reserved (Later) and is deliberately NOT accepted by the validator. */
export const CONTROL_MODES = ['seed_prompt', 'fixed_first_turn'];

/** Provider metadata — connection requirements differ per provider (which is why the
 *  config UI shows different fields for each). `needsBaseUrl`: the endpoint must be set
 *  (Ollama/vLLM are self-hosted). `needsKey`: the provider requires an API key —
 *  configured SERVER-SIDE by the deployer via `keyEnv` in the relay environment
 *  (MOD-1; reversal of the 2026-06-30 config-UI-key decision after the security
 *  audit: a key stored in study config reaches the DB and every auditor's browser).
 *  Keys are never part of StudyConfig and never sent from the browser. */
export const PROVIDER_META = {
  ollama:    { label: 'Ollama (local)', needsKey: false, keyEnv: null,                needsBaseUrl: true,  defaultBaseUrl: 'http://host.docker.internal:11434' },
  vllm:      { label: 'vLLM',           needsKey: false, keyEnv: 'VLLM_API_KEY',      needsBaseUrl: true,  defaultBaseUrl: '' },
  openai:    { label: 'OpenAI',         needsKey: true,  keyEnv: 'OPENAI_API_KEY',    needsBaseUrl: false, defaultBaseUrl: 'https://api.openai.com/v1' },
  anthropic: { label: 'Anthropic',      needsKey: true,  keyEnv: 'ANTHROPIC_API_KEY', needsBaseUrl: false, defaultBaseUrl: 'https://api.anthropic.com/v1' },
  gemini:    { label: 'Gemini',         needsKey: true,  keyEnv: 'GEMINI_API_KEY',    needsBaseUrl: false, defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
};
export const PROVIDERS = Object.keys(PROVIDER_META);

/** Turn-level reaction types (PRD §6.1 / AUD-5). */
export const REACTION_TYPES = ['thumbs', 'star', 'flag', 'comment'];

/** Study lifecycle states (PRD SC-11; vocabulary confirmed 2026-06-30). Lifecycle is
 *  persisted as the **study record's `status`** (the operational, queryable field used
 *  by the join gate + dashboard), NOT inside StudyConfig — config describes the auditor
 *  experience, not the study's publication state. Exported here for the UI + gate. */
export const LIFECYCLE_STATES = ['draft', 'open', 'closed'];

/**
 * A fresh default StudyConfig — a single-model free-chat study. The default targets
 * a local **Ollama** model (the zero-key path the Docker image ships with), so a new
 * study is runnable out of the box; the investigator can switch provider/model.
 * @returns {object} a new default config (safe to mutate)
 */
export function createDefaultStudyConfig() {
  return {
    schemaVersion: STUDY_CONFIG_SCHEMA_VERSION,
    conversationControl: {
      mode: 'seed_prompt',
      seedPrompt: '',
      fixedFirstTurn: null,
    },
    models: [
      {
        role: 'primary',
        provider: 'ollama',
        modelId: 'llama3.1',
        baseUrl: PROVIDER_META.ollama.defaultBaseUrl,
        // NOTE: no apiKey field — provider keys live in the relay env (MOD-1).
        systemPrompt: '',
        decoding: { temperature: 0.7, topP: 0.95, maxTokens: 1024 },
      },
    ],
    limits: {
      perConversationSeconds: 600,
      overallSeconds: 1800,
      conversationsPerAuditor: 2,
      warningSeconds: 120,
      minRemainingToStartNewChatSeconds: 180,
    },
    evaluation: {
      turnReactions: { enabled: true, types: ['thumbs', 'flag', 'comment'] },
      questionnaire: { enabled: true, schema: null },
      spanHighlighting: { enabled: true },
    },
    consent: { text: null, version: null },
    launchCapture: { enabled: false },
  };
}

const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

/**
 * Fill any missing fields of a partial config from the defaults, preserving the
 * caller's provided values. Used by the config UI and by config migration so a
 * partially-authored study still has a complete, valid-by-construction shape.
 * Does a deep merge over the known nested objects (not a generic deep merge).
 * @param {object} partial
 * @returns {object} a complete config
 */
export function withStudyConfigDefaults(partial = {}) {
  const d = createDefaultStudyConfig();
  if (!isPlainObject(partial)) return d;

  const p = partial;
  const merged = {
    schemaVersion: p.schemaVersion ?? d.schemaVersion,
    conversationControl: { ...d.conversationControl, ...(p.conversationControl || {}) },
    models: Array.isArray(p.models) && p.models.length
      ? p.models.map((m) => {
          const merged = {
            ...d.models[0],
            ...(isPlainObject(m) ? m : {}),
            decoding: { ...d.models[0].decoding, ...((isPlainObject(m) && m.decoding) || {}) },
          };
          // SECURITY SCRUB: configs saved before the server-side-keys change may
          // carry an apiKey. Strip it here so any load→save cycle removes the key
          // from the stored study config (it is never sent to the relay either).
          delete merged.apiKey;
          return merged;
        })
      : d.models,
    limits: { ...d.limits, ...(p.limits || {}) },
    evaluation: {
      turnReactions: { ...d.evaluation.turnReactions, ...((p.evaluation && p.evaluation.turnReactions) || {}) },
      questionnaire: { ...d.evaluation.questionnaire, ...((p.evaluation && p.evaluation.questionnaire) || {}) },
      spanHighlighting: { ...d.evaluation.spanHighlighting, ...((p.evaluation && p.evaluation.spanHighlighting) || {}) },
    },
    consent: { ...d.consent, ...(p.consent || {}) },
    launchCapture: { ...d.launchCapture, ...(p.launchCapture || {}) },
  };
  return merged;
}

/**
 * Validate a StudyConfig. Collects ALL problems (does not fail fast) so the UI can
 * surface them together. Does not mutate the input.
 * @param {object} config
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateStudyConfig(config) {
  const errors = [];
  const err = (m) => errors.push(m);

  if (!isPlainObject(config)) {
    return { valid: false, errors: ['config must be an object'] };
  }

  // schemaVersion
  if (!isFiniteNumber(config.schemaVersion)) {
    err('schemaVersion must be a number');
  } else if (config.schemaVersion > STUDY_CONFIG_SCHEMA_VERSION) {
    err(`schemaVersion ${config.schemaVersion} is newer than supported (${STUDY_CONFIG_SCHEMA_VERSION})`);
  }

  // conversationControl
  const cc = config.conversationControl;
  if (!isPlainObject(cc)) {
    err('conversationControl is required');
  } else if (!CONTROL_MODES.includes(cc.mode)) {
    err(`conversationControl.mode must be one of ${CONTROL_MODES.join(', ')} (got ${JSON.stringify(cc.mode)})`);
  } else if (cc.mode === 'fixed_first_turn' && !isNonEmptyString(cc.fixedFirstTurn)) {
    err('conversationControl.fixedFirstTurn is required when mode is fixed_first_turn');
  }

  // models — exactly one in MVP; a second entry is Arena (V1), not enabled here
  if (!Array.isArray(config.models) || config.models.length === 0) {
    err('models must contain at least one model config');
  } else {
    if (config.models.length > 1) {
      err('multiple models (Arena) is a V1 feature; exactly one model is allowed in this version');
    }
    config.models.forEach((m, i) => {
      if (!isPlainObject(m)) { err(`models[${i}] must be an object`); return; }
      const meta = PROVIDER_META[m.provider];
      if (!meta) {
        err(`models[${i}].provider must be one of ${PROVIDERS.join(', ')} (got ${JSON.stringify(m.provider)})`);
      } else {
        // Per-provider connection requirements differ. NOTE: no apiKey check —
        // keys are configured server-side (relay env), not in StudyConfig; the
        // "Test connection" path reports a missing server key instead.
        if (meta.needsBaseUrl && !isNonEmptyString(m.baseUrl)) {
          err(`models[${i}].baseUrl (endpoint) is required for ${meta.label}`);
        }
      }
      if (!isNonEmptyString(m.modelId)) err(`models[${i}].modelId is required`);
      if (m.decoding != null) {
        if (!isPlainObject(m.decoding)) {
          err(`models[${i}].decoding must be an object`);
        } else {
          const { temperature, topP, maxTokens } = m.decoding;
          if (temperature != null && (!isFiniteNumber(temperature) || temperature < 0)) {
            err(`models[${i}].decoding.temperature must be a non-negative number`);
          }
          if (topP != null && (!isFiniteNumber(topP) || topP <= 0 || topP > 1)) {
            err(`models[${i}].decoding.topP must be a number in (0, 1]`);
          }
          if (maxTokens != null && (!Number.isInteger(maxTokens) || maxTokens <= 0)) {
            err(`models[${i}].decoding.maxTokens must be a positive integer`);
          }
        }
      }
    });
  }

  // limits
  const lim = config.limits;
  if (!isPlainObject(lim)) {
    err('limits is required');
  } else {
    if (!isFiniteNumber(lim.perConversationSeconds) || lim.perConversationSeconds <= 0) {
      err('limits.perConversationSeconds must be a positive number');
    }
    if (!isFiniteNumber(lim.overallSeconds) || lim.overallSeconds <= 0) {
      err('limits.overallSeconds must be a positive number');
    }
    if (!Number.isInteger(lim.conversationsPerAuditor) || lim.conversationsPerAuditor < 1) {
      err('limits.conversationsPerAuditor must be an integer >= 1');
    }
    if (isFiniteNumber(lim.perConversationSeconds) && isFiniteNumber(lim.overallSeconds) &&
        lim.overallSeconds < lim.perConversationSeconds) {
      err('limits.overallSeconds must be >= limits.perConversationSeconds');
    }
    if (lim.warningSeconds != null && (!isFiniteNumber(lim.warningSeconds) || lim.warningSeconds < 0)) {
      err('limits.warningSeconds must be a non-negative number');
    }
    if (lim.minRemainingToStartNewChatSeconds != null &&
        (!isFiniteNumber(lim.minRemainingToStartNewChatSeconds) || lim.minRemainingToStartNewChatSeconds < 0)) {
      err('limits.minRemainingToStartNewChatSeconds must be a non-negative number');
    }
  }

  // evaluation
  const ev = config.evaluation;
  if (!isPlainObject(ev)) {
    err('evaluation is required');
  } else {
    const tr = ev.turnReactions;
    if (!isPlainObject(tr) || typeof tr.enabled !== 'boolean') {
      err('evaluation.turnReactions.enabled must be a boolean');
    } else if (tr.enabled) {
      if (!Array.isArray(tr.types) || tr.types.length === 0) {
        err('evaluation.turnReactions.types must be a non-empty array when reactions are enabled');
      } else {
        const bad = tr.types.filter((t) => !REACTION_TYPES.includes(t));
        if (bad.length) err(`evaluation.turnReactions.types has unknown type(s): ${bad.join(', ')}`);
      }
    }
    if (!isPlainObject(ev.questionnaire) || typeof ev.questionnaire.enabled !== 'boolean') {
      err('evaluation.questionnaire.enabled must be a boolean');
    }
    if (!isPlainObject(ev.spanHighlighting) || typeof ev.spanHighlighting.enabled !== 'boolean') {
      err('evaluation.spanHighlighting.enabled must be a boolean');
    }
  }

  // consent (gate rendering is Phase C; here we only validate the stored shape)
  if (config.consent != null) {
    if (!isPlainObject(config.consent)) {
      err('consent must be an object when present');
    } else if (config.consent.text != null && typeof config.consent.text !== 'string') {
      err('consent.text must be a string or null');
    }
  }

  // launchCapture
  if (config.launchCapture != null &&
      (!isPlainObject(config.launchCapture) || typeof config.launchCapture.enabled !== 'boolean')) {
    err('launchCapture.enabled must be a boolean');
  }

  // Note: study lifecycle (draft|open|closed) is NOT part of StudyConfig — it lives on
  // the study record's `status` field (see LIFECYCLE_STATES). The validator ignores any
  // stray `lifecycle` key rather than enforcing it here.

  return { valid: errors.length === 0, errors };
}

/**
 * Validate and throw if invalid — convenience for call sites that treat an invalid
 * config as a hard error (e.g. starting an auditor session).
 * @param {object} config
 * @returns {object} the same config (for chaining)
 */
export function assertValidStudyConfig(config) {
  const { valid, errors } = validateStudyConfig(config);
  if (!valid) {
    throw new Error(`Invalid StudyConfig:\n- ${errors.join('\n- ')}`);
  }
  return config;
}
