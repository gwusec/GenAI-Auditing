// Phase B step 2 — deriveRuntimeConfig: StudyConfig -> flat runtime config.

import { withStudyConfigDefaults } from '../studyConfig/schema';
import { deriveRuntimeConfig } from '../studyConfig/deriveRuntimeConfig';

// A complete, valid config built from a minimal partial.
const completeConfig = (overrides = {}) =>
  withStudyConfigDefaults({
    models: [{ provider: 'vllm', modelId: 'org/model', baseUrl: 'http://vllm:8000/v1', systemPrompt: 'be fair' }],
    ...overrides,
  });

describe('deriveRuntimeConfig — limits → timer keys', () => {
  test('conversationsPerAuditor=N produces a per-chat array of length N', () => {
    const rt = deriveRuntimeConfig(completeConfig({
      limits: { perConversationSeconds: 300, overallSeconds: 1800, conversationsPerAuditor: 3 },
    }));
    expect(rt.timerChatsMaxSeconds).toEqual([300, 300, 300]);
    expect(rt.conversationsPerAuditor).toBe(3);
  });

  test('overall / warning / min-new-chat map through', () => {
    const rt = deriveRuntimeConfig(completeConfig({
      limits: {
        perConversationSeconds: 600,
        overallSeconds: 2400,
        conversationsPerAuditor: 1,
        warningSeconds: 90,
        minRemainingToStartNewChatSeconds: 150,
      },
    }));
    expect(rt.timerMaxOverallChatTimeSeconds).toBe(2400);
    expect(rt.timerWarningChatTimeIsUpSeconds).toBe(90);
    expect(rt.timerMinChatTimeRemainingToStartNewChatSeconds).toBe(150);
    expect(rt.timerAuditMaxSeconds).toBeNull();
  });
});

describe('deriveRuntimeConfig — model block', () => {
  test('maps provider / modelId / systemPrompt / decoding from models[0]', () => {
    const rt = deriveRuntimeConfig(completeConfig({
      models: [{
        provider: 'anthropic',
        modelId: 'claude-x',
        baseUrl: '',
        systemPrompt: 'system here',
        decoding: { temperature: 0.2, topP: 0.9, maxTokens: 512 },
      }],
    }));
    expect(rt.model).toEqual({
      provider: 'anthropic',
      modelId: 'claude-x',
      baseUrl: '',
      systemPrompt: 'system here',
      decoding: { temperature: 0.2, topP: 0.9, maxTokens: 512 },
    });
  });

  test('maps to the relay wire-contract (llmRelay) — no apiKey, ever (MOD-1)', () => {
    const ollama = deriveRuntimeConfig(withStudyConfigDefaults({
      models: [{ provider: 'ollama', modelId: 'llama3.1', baseUrl: 'http://h:11434' }],
    }));
    expect(ollama.llmRelay).toEqual({
      backend: 'ollama', ollamaUrl: 'http://h:11434', ollamaModel: 'llama3.1',
      decoding: { temperature: 0.7, topP: 0.95, maxTokens: 1024 }, // defaults carried
    });

    const openai = deriveRuntimeConfig(withStudyConfigDefaults({
      models: [{ provider: 'openai', modelId: 'gpt-4o', baseUrl: '' }],
    }));
    expect(openai.llmRelay).toEqual({
      backend: 'api', provider: 'openai', model: 'gpt-4o',
      baseUrl: 'https://api.openai.com/v1', // default filled in
      decoding: { temperature: 0.7, topP: 0.95, maxTokens: 1024 },
    });
    expect(openai.llmRelay).not.toHaveProperty('apiKey');
  });

  test('a legacy stored apiKey never reaches the relay object', () => {
    const rt = deriveRuntimeConfig(withStudyConfigDefaults({
      models: [{ provider: 'openai', modelId: 'gpt-4o', apiKey: 'sk-legacy', baseUrl: '' }],
    }));
    expect(rt.llmRelay).not.toHaveProperty('apiKey');
    expect(rt.model).not.toHaveProperty('apiKey');
  });

  test('decoding is copied, not shared by reference', () => {
    const cfg = completeConfig();
    const rt = deriveRuntimeConfig(cfg);
    rt.model.decoding.temperature = 999;
    expect(cfg.models[0].decoding.temperature).not.toBe(999);
  });
});

describe('deriveRuntimeConfig — control mode', () => {
  test('seed_prompt carries the seed and null first-turn', () => {
    const rt = deriveRuntimeConfig(completeConfig({
      conversationControl: { mode: 'seed_prompt', seedPrompt: 'You are a hiring assistant.', fixedFirstTurn: null },
    }));
    expect(rt.conversationControl).toEqual({
      mode: 'seed_prompt',
      seedPrompt: 'You are a hiring assistant.',
      fixedFirstTurn: null,
    });
  });

  test('fixed_first_turn carries the opening bot message', () => {
    const rt = deriveRuntimeConfig(completeConfig({
      conversationControl: { mode: 'fixed_first_turn', seedPrompt: '', fixedFirstTurn: 'Hi, ready when you are.' },
    }));
    expect(rt.conversationControl.mode).toBe('fixed_first_turn');
    expect(rt.conversationControl.fixedFirstTurn).toBe('Hi, ready when you are.');
    expect(rt.conversationControl.seedPrompt).toBeNull();
  });
});

describe('deriveRuntimeConfig — evaluation, consent, launch, provenance', () => {
  test('evaluation toggles map through', () => {
    const rt = deriveRuntimeConfig(completeConfig({
      evaluation: {
        turnReactions: { enabled: true, types: ['thumbs', 'star'] },
        questionnaire: { enabled: false, schema: null },
        spanHighlighting: { enabled: true },
      },
    }));
    expect(rt.evaluation.turnReactions).toEqual({ enabled: true, types: ['thumbs', 'star'] });
    expect(rt.evaluation.questionnaire.enabled).toBe(false);
    expect(rt.evaluation.spanHighlighting.enabled).toBe(true);
  });

  test('consent + launchCapture + configVersion are carried through', () => {
    const rt = deriveRuntimeConfig(completeConfig({
      consent: { text: 'Please agree', version: 2 },
      launchCapture: { enabled: true },
    }));
    expect(rt.consent).toEqual({ text: 'Please agree', version: 2 });
    expect(rt.launchCapture.enabled).toBe(true);
    expect(rt.configVersion).toBe(1);
  });

  test('reaction types array is copied, not shared', () => {
    const cfg = completeConfig();
    const rt = deriveRuntimeConfig(cfg);
    rt.evaluation.turnReactions.types.push('flag');
    expect(cfg.evaluation.turnReactions.types).not.toContain(undefined);
    expect(rt.evaluation.turnReactions.types).not.toBe(cfg.evaluation.turnReactions.types);
  });
});

describe('deriveRuntimeConfig — guards', () => {
  test('throws when the config is invalid (e.g. vLLM missing its baseUrl)', () => {
    expect(() => deriveRuntimeConfig({ models: [{ provider: 'vllm', modelId: 'org/m', baseUrl: '' }] }))
      .toThrow(/Invalid StudyConfig/);
  });

  test('tolerates a partial config by filling defaults, then derives', () => {
    const rt = deriveRuntimeConfig({ models: [{ provider: 'openai', modelId: 'gpt-4o' }] });
    expect(rt.model.modelId).toBe('gpt-4o');
    expect(rt.timerChatsMaxSeconds.length).toBe(2); // default conversationsPerAuditor
    expect(rt.conversationControl.mode).toBe('seed_prompt'); // default mode
  });
});
