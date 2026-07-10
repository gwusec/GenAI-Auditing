// Phase B step 1 — StudyConfig schema + validator.
// Covers the scope's required cases (good config; bad mode; missing model; bad
// limits; fixed_first_turn without text) plus defaults, merge, and the full
// validation surface.

import {
  STUDY_CONFIG_SCHEMA_VERSION,
  CONTROL_MODES,
  PROVIDERS,
  REACTION_TYPES,
  LIFECYCLE_STATES,
  createDefaultStudyConfig,
  withStudyConfigDefaults,
  validateStudyConfig,
  assertValidStudyConfig,
} from '../studyConfig/schema';

// Deep clone so per-test mutations don't leak.
const clone = (o) => JSON.parse(JSON.stringify(o));

describe('createDefaultStudyConfig', () => {
  test('defaults to a runnable local Ollama model and validates out of the box', () => {
    const cfg = createDefaultStudyConfig();
    expect(cfg.schemaVersion).toBe(STUDY_CONFIG_SCHEMA_VERSION);
    expect(cfg.models[0].provider).toBe('ollama');
    expect(validateStudyConfig(cfg)).toEqual({ valid: true, errors: [] });
  });

  test('returns a fresh object each call (no shared mutable state)', () => {
    const a = createDefaultStudyConfig();
    const b = createDefaultStudyConfig();
    a.models[0].modelId = 'x';
    expect(b.models[0].modelId).toBe('llama3.1');
  });

  test('exported constants reflect the locked scope decisions', () => {
    expect(CONTROL_MODES).toEqual(['seed_prompt', 'fixed_first_turn']);
    expect(CONTROL_MODES).not.toContain('scripted');
    expect(PROVIDERS).toEqual(['ollama', 'vllm', 'openai', 'anthropic', 'gemini']);
    expect(REACTION_TYPES).toEqual(['thumbs', 'star', 'flag', 'comment']);
    expect(LIFECYCLE_STATES).toEqual(['draft', 'open', 'closed']);
  });
});

describe('validateStudyConfig — accepts good configs', () => {
  test('the default config is valid', () => {
    expect(validateStudyConfig(clone(createDefaultStudyConfig())).valid).toBe(true);
  });

  test('a cloud provider is valid WITHOUT an api key (keys live server-side, MOD-1)', () => {
    const cfg = clone(createDefaultStudyConfig());
    cfg.models[0] = { role: 'primary', provider: 'openai', modelId: 'gpt-4o', baseUrl: '', systemPrompt: '', decoding: {} };
    expect(validateStudyConfig(cfg).valid).toBe(true);
  });

  test('fixed_first_turn with text is valid', () => {
    const cfg = clone(createDefaultStudyConfig());
    cfg.conversationControl.mode = 'fixed_first_turn';
    cfg.conversationControl.fixedFirstTurn = 'Hello, how can I help with your hiring task?';
    cfg.models[0].modelId = 'org/model';
    expect(validateStudyConfig(cfg).valid).toBe(true);
  });

  test('all evaluation methods disabled is valid (methods are independent)', () => {
    const cfg = clone(createDefaultStudyConfig());
    cfg.models[0].modelId = 'org/model';
    cfg.evaluation.turnReactions = { enabled: false, types: [] };
    cfg.evaluation.questionnaire.enabled = false;
    cfg.evaluation.spanHighlighting.enabled = false;
    expect(validateStudyConfig(cfg).valid).toBe(true);
  });
});

describe('validateStudyConfig — rejects bad configs', () => {
  test('rejects a non-object', () => {
    expect(validateStudyConfig(null).valid).toBe(false);
    expect(validateStudyConfig('nope').valid).toBe(false);
  });

  test('rejects an unknown control mode (incl. reserved "scripted")', () => {
    const cfg = clone(createDefaultStudyConfig());
    cfg.conversationControl.mode = 'scripted';
    const r = validateStudyConfig(cfg);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/mode must be one of/);
  });

  test('rejects fixed_first_turn without fixedFirstTurn text', () => {
    const cfg = clone(createDefaultStudyConfig());
    cfg.conversationControl.mode = 'fixed_first_turn';
    cfg.conversationControl.fixedFirstTurn = '   '; // whitespace only
    const r = validateStudyConfig(cfg);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/fixedFirstTurn is required/);
  });

  test('rejects a missing model list', () => {
    const cfg = clone(createDefaultStudyConfig());
    cfg.models = [];
    const r = validateStudyConfig(cfg);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/at least one model/);
  });

  test('rejects a second model (Arena is V1)', () => {
    const cfg = clone(createDefaultStudyConfig());
    cfg.models[0].modelId = 'org/a';
    cfg.models.push({ role: 'b', provider: 'openai', modelId: 'gpt-x', decoding: {} });
    const r = validateStudyConfig(cfg);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/Arena/);
  });

  test('rejects an unknown provider', () => {
    const cfg = clone(createDefaultStudyConfig());
    cfg.models[0].provider = 'cohere';
    cfg.models[0].modelId = 'x';
    const r = validateStudyConfig(cfg);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/provider must be one of/);
  });

  test('rejects an empty modelId', () => {
    const cfg = clone(createDefaultStudyConfig());
    cfg.models[0].modelId = '';
    const r = validateStudyConfig(cfg);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/modelId is required/);
  });

  test('does NOT require an api key for cloud providers (server-side keys, MOD-1)', () => {
    const cfg = clone(createDefaultStudyConfig());
    cfg.models[0] = { role: 'primary', provider: 'anthropic', modelId: 'claude-x', baseUrl: '', systemPrompt: '', decoding: {} };
    expect(validateStudyConfig(cfg).valid).toBe(true);
  });

  test('withStudyConfigDefaults scrubs a legacy stored apiKey (security)', () => {
    const withKey = clone(createDefaultStudyConfig());
    withKey.models[0].apiKey = 'sk-legacy-secret';
    const scrubbed = withStudyConfigDefaults(withKey);
    expect(scrubbed.models[0]).not.toHaveProperty('apiKey');
  });

  test('requires a base URL for ollama and vllm', () => {
    const ollama = clone(createDefaultStudyConfig());
    ollama.models[0].baseUrl = '';
    expect(validateStudyConfig(ollama).errors.join(' ')).toMatch(/baseUrl .* is required/);

    const vllm = clone(createDefaultStudyConfig());
    vllm.models[0] = { role: 'primary', provider: 'vllm', modelId: 'org/m', baseUrl: '', systemPrompt: '', decoding: {} };
    expect(validateStudyConfig(vllm).errors.join(' ')).toMatch(/baseUrl .* is required/);
  });

  test('rejects non-positive / inconsistent limits', () => {
    const cfg = clone(createDefaultStudyConfig());
    cfg.models[0].modelId = 'x';
    cfg.limits.perConversationSeconds = 0;
    cfg.limits.conversationsPerAuditor = 0;
    cfg.limits.overallSeconds = 10;
    const r = validateStudyConfig(cfg);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/perConversationSeconds must be a positive number/);
    expect(r.errors.join(' ')).toMatch(/conversationsPerAuditor must be an integer >= 1/);
  });

  test('rejects overallSeconds < perConversationSeconds', () => {
    const cfg = clone(createDefaultStudyConfig());
    cfg.models[0].modelId = 'x';
    cfg.limits.perConversationSeconds = 600;
    cfg.limits.overallSeconds = 300;
    const r = validateStudyConfig(cfg);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/overallSeconds must be >=/);
  });

  test('rejects turnReactions enabled with empty/unknown types', () => {
    const cfg = clone(createDefaultStudyConfig());
    cfg.models[0].modelId = 'x';
    cfg.evaluation.turnReactions = { enabled: true, types: [] };
    expect(validateStudyConfig(cfg).errors.join(' ')).toMatch(/non-empty array/);

    cfg.evaluation.turnReactions = { enabled: true, types: ['thumbs', 'laugh'] };
    expect(validateStudyConfig(cfg).errors.join(' ')).toMatch(/unknown type/);
  });

  test('ignores a stray lifecycle key (lifecycle lives on study.status, not config)', () => {
    const cfg = clone(createDefaultStudyConfig());
    cfg.models[0].modelId = 'x';
    cfg.lifecycle = { state: 'whatever' }; // not part of the config schema
    expect(validateStudyConfig(cfg).valid).toBe(true);
  });

  test('collects multiple errors at once (not fail-fast)', () => {
    const cfg = clone(createDefaultStudyConfig());
    cfg.conversationControl.mode = 'scripted';
    cfg.models = [];
    cfg.limits.perConversationSeconds = -1;
    const r = validateStudyConfig(cfg);
    expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('withStudyConfigDefaults', () => {
  test('fills missing fields from defaults while preserving provided values', () => {
    const merged = withStudyConfigDefaults({
      conversationControl: { mode: 'fixed_first_turn', fixedFirstTurn: 'Hi there' },
      models: [{ provider: 'openai', modelId: 'gpt-4o', apiKey: 'sk-x' }],
      limits: { conversationsPerAuditor: 3 },
    });
    // preserved
    expect(merged.conversationControl.mode).toBe('fixed_first_turn');
    expect(merged.models[0].provider).toBe('openai');
    expect(merged.models[0].modelId).toBe('gpt-4o');
    expect(merged.limits.conversationsPerAuditor).toBe(3);
    // filled
    expect(merged.schemaVersion).toBe(STUDY_CONFIG_SCHEMA_VERSION);
    expect(merged.models[0].decoding.temperature).toBe(0.7);
    expect(merged.limits.perConversationSeconds).toBe(600);
    // and the result validates
    expect(validateStudyConfig(merged).valid).toBe(true);
  });

  test('an empty/invalid partial yields the full default', () => {
    expect(withStudyConfigDefaults()).toEqual(createDefaultStudyConfig());
    expect(withStudyConfigDefaults(null)).toEqual(createDefaultStudyConfig());
  });
});

describe('assertValidStudyConfig', () => {
  test('returns the config when valid', () => {
    const cfg = withStudyConfigDefaults({ models: [{ modelId: 'org/m' }] });
    expect(assertValidStudyConfig(cfg)).toBe(cfg);
  });

  test('throws with a joined message when invalid', () => {
    const bad = clone(createDefaultStudyConfig());
    bad.models[0].modelId = '';
    expect(() => assertValidStudyConfig(bad)).toThrow(/Invalid StudyConfig/);
  });
});
