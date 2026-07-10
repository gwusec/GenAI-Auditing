// Phase B step 3 — conversation-control seeding, tested against the event log
// (no live model).

import { Conversation, CHAT_EVENT_TYPE, STATE } from '../models';
import { withStudyConfigDefaults } from '../studyConfig/schema';
import { deriveRuntimeConfig } from '../studyConfig/deriveRuntimeConfig';
import {
  applyConversationControl,
  buildConversationProvenance,
} from '../studyConfig/conversationControl';

const runtime = (controlOverrides) =>
  deriveRuntimeConfig(
    withStudyConfigDefaults({
      models: [{ provider: 'vllm', modelId: 'org/model', baseUrl: 'http://vllm:8000/v1' }],
      conversationControl: controlOverrides,
    })
  );

describe('applyConversationControl — fixed_first_turn', () => {
  const rc = runtime({ mode: 'fixed_first_turn', fixedFirstTurn: 'Hi, ready when you are.' });

  test('injects exactly one opening bot message into the event log', () => {
    const c = new Conversation('u');
    applyConversationControl(c, rc);

    const botEvents = c.chatEvents.filter((e) => e.type === CHAT_EVENT_TYPE.NEW_BOT_MESSAGE);
    expect(botEvents).toHaveLength(1);
    const msg = botEvents[0].data;
    expect(msg.author).toBe('bot');
    expect(msg.content).toBe('Hi, ready when you are.');
  });

  test('the opening message is the first visible chat turn', () => {
    const c = new Conversation('u');
    applyConversationControl(c, rc);
    const chat = c.getChat();
    expect(chat[0].author).toBe('bot');
    expect(chat[0].content).toBe('Hi, ready when you are.');
  });

  test('does not advance conversation state out of chat', () => {
    const c = new Conversation('u');
    applyConversationControl(c, rc);
    expect(c.state).toBe(STATE.CHAT);
  });

  test('does not set seed controlContext', () => {
    const c = new Conversation('u');
    applyConversationControl(c, rc);
    expect(c.controlContext).toBeNull();
  });

  test('throws if the opening text is empty', () => {
    const bad = { ...rc, conversationControl: { mode: 'fixed_first_turn', fixedFirstTurn: '  ' } };
    expect(() => applyConversationControl(new Conversation('u'), bad)).toThrow(/non-empty opening text/);
  });
});

describe('applyConversationControl — seed_prompt', () => {
  const rc = runtime({ mode: 'seed_prompt', seedPrompt: 'You are a hiring assistant.' });

  test('injects no chat events (seed is not a visible turn)', () => {
    const c = new Conversation('u');
    applyConversationControl(c, rc);
    expect(c.chatEvents).toEqual([]);
    expect(c.getChat()).toEqual([]);
  });

  test('records the seed framing on controlContext for the context builder', () => {
    const c = new Conversation('u');
    applyConversationControl(c, rc);
    expect(c.controlContext).toEqual({ mode: 'seed_prompt', seedPrompt: 'You are a hiring assistant.' });
  });

  test('an empty seed prompt is allowed (free chat) and injects nothing', () => {
    const c = new Conversation('u');
    applyConversationControl(c, runtime({ mode: 'seed_prompt', seedPrompt: '' }));
    expect(c.chatEvents).toEqual([]);
    expect(c.controlContext).toEqual({ mode: 'seed_prompt', seedPrompt: null });
  });
});

describe('provenance (PRD §9 D9)', () => {
  test('is stamped for fixed_first_turn with the first-turn text + model id/version', () => {
    const rc = runtime({ mode: 'fixed_first_turn', fixedFirstTurn: 'Opening line' });
    const c = new Conversation('u');
    applyConversationControl(c, rc);
    expect(c.provenance).toEqual({
      controlMode: 'fixed_first_turn',
      seedOrFirstTurnText: 'Opening line',
      modelConfigId: 'vllm:org/model',
      modelConfigVersion: 1,
      configVersion: 1,
    });
  });

  test('is stamped for seed_prompt with the seed text', () => {
    const rc = runtime({ mode: 'seed_prompt', seedPrompt: 'Frame it' });
    const c = new Conversation('u');
    applyConversationControl(c, rc);
    expect(c.provenance.controlMode).toBe('seed_prompt');
    expect(c.provenance.seedOrFirstTurnText).toBe('Frame it');
    expect(c.provenance.modelConfigId).toBe('vllm:org/model');
  });

  test('buildConversationProvenance is a pure function of the runtime config', () => {
    const rc = runtime({ mode: 'seed_prompt', seedPrompt: 'x' });
    expect(buildConversationProvenance(rc)).toEqual({
      controlMode: 'seed_prompt',
      seedOrFirstTurnText: 'x',
      modelConfigId: 'vllm:org/model',
      modelConfigVersion: 1,
      configVersion: 1,
    });
  });
});
