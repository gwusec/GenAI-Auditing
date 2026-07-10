// Characterization tests for src/tools/ConversationHandler.js
// Focus: the two PURE derivation methods that rebuild UI/LLM views from the
// append-only event log — buildVisibleMessages and buildContext. These do not
// touch the database, so we can exercise them directly on the singleton.

// The methods under test (buildVisibleMessages / buildContext) are pure and do
// not use the API client or the database. We mock those imports so loading the
// module does not pull in axios (ESM, untransformed by CRA jest) or Dexie.
vi.mock('../APIClient', () => ({ __esModule: true, default: {} }));
vi.mock('../db', () => ({ __esModule: true, default: {} }));

import conversationHandler from '../ConversationHandler';
import { CHAT_EVENT_TYPE } from '../models';

// Helpers to build raw event-log entries (plain objects, like persisted data).
const userMsg = (id, content, extra = {}) => ({
  id,
  author: 'user',
  content,
  referencedMessageId: null,
  isEdited: false,
  ...extra,
});
const botMsg = (id, content, referencedMessageId) => ({
  id,
  author: 'bot',
  content,
  referencedMessageId,
  isEdited: false,
});
const evt = (type, data, id = `evt-${Math.random()}`) => ({ id, type, data });

describe('ConversationHandler.buildVisibleMessages', () => {
  test('returns user + bot messages in event order', () => {
    const conversation = {
      chatEvents: [
        evt(CHAT_EVENT_TYPE.NEW_USER_MESSAGE, userMsg('u1', 'q1')),
        evt(CHAT_EVENT_TYPE.NEW_BOT_MESSAGE, botMsg('b1', 'a1', 'u1')),
      ],
    };
    const visible = conversationHandler.buildVisibleMessages(conversation);
    expect(visible.map((m) => m.content)).toEqual(['q1', 'a1']);
  });

  test('a RESTART_CHAT event inserts a separator entry', () => {
    const conversation = {
      chatEvents: [
        evt(CHAT_EVENT_TYPE.NEW_USER_MESSAGE, userMsg('u1', 'q1')),
        evt(CHAT_EVENT_TYPE.RESTART_CHAT, null, 'r1'),
        evt(CHAT_EVENT_TYPE.NEW_USER_MESSAGE, userMsg('u2', 'q2')),
      ],
    };
    const visible = conversationHandler.buildVisibleMessages(conversation);
    expect(visible).toHaveLength(3);
    expect(visible[1]).toMatchObject({ type: 'separator', reason: 'Conversation Restarted' });
  });

  test('an edited original message is marked isEdited, and the edit is shown too', () => {
    const conversation = {
      chatEvents: [
        evt(CHAT_EVENT_TYPE.NEW_USER_MESSAGE, userMsg('u1', 'original')),
        evt(CHAT_EVENT_TYPE.NEW_BOT_MESSAGE, botMsg('b1', 'reply', 'u1')),
        // edit references the original user message id
        evt(CHAT_EVENT_TYPE.EDIT_MESSAGE, userMsg('u1-edit', 'edited', { referencedMessageId: 'u1' })),
      ],
    };
    const visible = conversationHandler.buildVisibleMessages(conversation);
    // edited copy is appended and flagged
    const edited = visible.find((m) => m.content === 'edited');
    expect(edited.isEdited).toBe(true);
  });

  test('emits visibleChatUpdated', () => {
    const spy = vi.fn();
    conversationHandler.registerOnVisibleChatUpdated(spy);
    conversationHandler.buildVisibleMessages({ chatEvents: [] });
    expect(spy).toHaveBeenCalled();
    conversationHandler.unregisterOnVisibleChatUpdated(spy);
  });
});

describe('ConversationHandler.buildContext', () => {
  test('includes user + bot messages and tracks lastUserMessageIndex', () => {
    const conversation = {
      chatEvents: [
        evt(CHAT_EVENT_TYPE.NEW_USER_MESSAGE, userMsg('u1', 'q1')),
        evt(CHAT_EVENT_TYPE.NEW_BOT_MESSAGE, botMsg('b1', 'a1', 'u1')),
        evt(CHAT_EVENT_TYPE.NEW_USER_MESSAGE, userMsg('u2', 'q2')),
      ],
    };
    conversationHandler.buildContext(conversation);
    const ctx = conversationHandler.getContext();
    expect(ctx.map((m) => m.content)).toEqual(['q1', 'a1', 'q2']);
    // last entry is the most recent user message
    expect(conversationHandler.getLastUserMessage().content).toBe('q2');
  });

  test('context only includes events AFTER the last restart', () => {
    const conversation = {
      chatEvents: [
        evt(CHAT_EVENT_TYPE.NEW_USER_MESSAGE, userMsg('u1', 'before')),
        evt(CHAT_EVENT_TYPE.RESTART_CHAT, null, 'r1'),
        evt(CHAT_EVENT_TYPE.NEW_USER_MESSAGE, userMsg('u2', 'after')),
      ],
    };
    conversationHandler.buildContext(conversation);
    expect(conversationHandler.getContext().map((m) => m.content)).toEqual(['after']);
  });

  test('an edit removes the original user message and its bot reply, and adds the edited message', () => {
    const conversation = {
      chatEvents: [
        evt(CHAT_EVENT_TYPE.NEW_USER_MESSAGE, userMsg('u1', 'original')),
        evt(CHAT_EVENT_TYPE.NEW_BOT_MESSAGE, botMsg('b1', 'reply-to-original', 'u1')),
        evt(CHAT_EVENT_TYPE.EDIT_MESSAGE, userMsg('u1-edit', 'edited', { referencedMessageId: 'u1' })),
      ],
    };
    conversationHandler.buildContext(conversation);
    const contents = conversationHandler.getContext().map((m) => m.content);
    expect(contents).toContain('edited');
    expect(contents).not.toContain('original');
    expect(contents).not.toContain('reply-to-original');
  });

  test('canEditLastMessage reflects whether a user message exists in context', () => {
    conversationHandler.buildContext({ chatEvents: [] });
    expect(conversationHandler.canEditLastMessage()).toBe(false);
    conversationHandler.buildContext({
      chatEvents: [evt(CHAT_EVENT_TYPE.NEW_USER_MESSAGE, userMsg('u1', 'q1'))],
    });
    expect(conversationHandler.canEditLastMessage()).toBe(true);
  });
});
