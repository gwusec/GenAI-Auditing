// Integration glue: createNewConversation applies the study's conversation-control
// mode (Phase B wiring). db + APIClient are mocked so no store/network is touched.

vi.mock('../APIClient', () => ({ __esModule: true, default: {} }));
vi.mock('../db', () => ({
  __esModule: true,
  default: { createConversation: vi.fn(), updateConversation: vi.fn(), getConversationById: vi.fn() },
}));

import conversationHandler from '../ConversationHandler';
import db from '../db';
import { Conversation, CHAT_EVENT_TYPE } from '../models';
import { withStudyConfigDefaults } from '../studyConfig/schema';
import { deriveRuntimeConfig } from '../studyConfig/deriveRuntimeConfig';

const runtime = (control) =>
  deriveRuntimeConfig(withStudyConfigDefaults({
    models: [{ provider: 'vllm', modelId: 'org/m', baseUrl: 'http://vllm:8000/v1' }],
    conversationControl: control,
  }));

beforeEach(() => {
  db.createConversation.mockReset();
  db.updateConversation.mockReset();
  db.getConversationById.mockReset();
  db.createConversation.mockImplementation(async () => new Conversation('u'));
});

test('with no runtime config, creates a plain conversation (unchanged behavior)', async () => {
  const conv = await conversationHandler.createNewConversation();
  expect(conv.chatEvents).toEqual([]);
  expect(conv.provenance).toBeNull();
  expect(db.updateConversation).not.toHaveBeenCalled();
});

test('fixed_first_turn seeds the opening bot message + provenance, and persists', async () => {
  const conv = await conversationHandler.createNewConversation(
    runtime({ mode: 'fixed_first_turn', fixedFirstTurn: 'Hello there' })
  );
  const bot = conv.chatEvents.filter((e) => e.type === CHAT_EVENT_TYPE.NEW_BOT_MESSAGE);
  expect(bot).toHaveLength(1);
  expect(bot[0].data.content).toBe('Hello there');
  expect(conv.provenance.controlMode).toBe('fixed_first_turn');
  expect(conv.provenance.modelConfigId).toBe('vllm:org/m');
  expect(db.updateConversation).toHaveBeenCalledWith(conv.id, conv);
});

test('seed_prompt injects no visible turn but records controlContext + provenance', async () => {
  const conv = await conversationHandler.createNewConversation(
    runtime({ mode: 'seed_prompt', seedPrompt: 'Frame it' })
  );
  expect(conv.chatEvents).toEqual([]);
  expect(conv.controlContext).toEqual({ mode: 'seed_prompt', seedPrompt: 'Frame it' });
  expect(conv.provenance.controlMode).toBe('seed_prompt');
});

test('addReaction appends a NEW_REACTION event and persists', async () => {
  const conv = new Conversation('u');
  db.getConversationById.mockResolvedValue(conv);
  const reactions = await conversationHandler.addReaction(conv.id, { messageId: 'm1', type: 'thumbs', value: 'up' });
  expect(reactions).toHaveLength(1);
  expect(reactions[0]).toMatchObject({ messageId: 'm1', type: 'thumbs', value: 'up' });
  expect(db.updateConversation).toHaveBeenCalledWith(conv.id, conv);
});
