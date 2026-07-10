// Characterization tests for src/tools/models.js
// These lock CURRENT behavior (quirks included) as a safety net for later refactors.

import {
  Conversation,
  Message,
  ChatEvent,
  AuditResponse,
  CHAT_EVENT_TYPE,
  STATE,
} from '../models';

describe('models.js — constants', () => {
  test('CHAT_EVENT_TYPE has the expected event names', () => {
    expect(CHAT_EVENT_TYPE).toEqual({
      NEW_CHAT: 'new_chat',
      NEW_USER_MESSAGE: 'new_user_message',
      NEW_BOT_MESSAGE: 'new_bot_message',
      RESTART_CHAT: 'restart_chat',
      EDIT_MESSAGE: 'edit_message',
      END_CHAT: 'end_chat',
      API_ERROR: 'api_error',
      NEW_REACTION: 'new_reaction',
    });
  });

  test('STATE has the expected conversation states', () => {
    expect(STATE).toEqual({
      CHAT: 'chat',
      AUDIT_LIKERTRESPONSE: 'audit_likertresponse',
      AUDIT_HIGHLIGHT: 'audit_highlight',
      AUDIT_TEXTRESPONSE: 'audit_textresponse',
      COMPLETE: 'complete',
    });
  });
});

describe('Message', () => {
  test('initializes with author/content and sane defaults', () => {
    const m = new Message({ author: 'user', content: 'hello' });
    expect(m.author).toBe('user');
    expect(m.content).toBe('hello');
    expect(m.referencedMessageId).toBeNull();
    expect(m.isEdited).toBe(false);
    expect(typeof m.id).toBe('string');
    expect(typeof m.timestamp).toBe('number');
  });

  test('markAsEdited sets isEdited true', () => {
    const m = new Message({ author: 'user', content: 'x' });
    m.markAsEdited();
    expect(m.isEdited).toBe(true);
  });
});

describe('ChatEvent — validation', () => {
  test('throws on an invalid event type', () => {
    expect(() => new ChatEvent('not_a_real_type', null)).toThrow(/Invalid event type/);
  });

  test('message events require a Message instance as data', () => {
    expect(() => new ChatEvent(CHAT_EVENT_TYPE.NEW_USER_MESSAGE, { not: 'a message' }))
      .toThrow(/Invalid data type/);
    const msg = new Message({ author: 'user', content: 'hi' });
    expect(() => new ChatEvent(CHAT_EVENT_TYPE.NEW_USER_MESSAGE, msg)).not.toThrow();
  });

  test('control events (end_chat, new_chat, etc.) require null data', () => {
    expect(() => new ChatEvent(CHAT_EVENT_TYPE.END_CHAT, null)).not.toThrow();
    expect(() => new ChatEvent(CHAT_EVENT_TYPE.END_CHAT, { foo: 1 })).toThrow(/Invalid data type/);
  });
});

describe('Conversation — state machine', () => {
  test('starts in CHAT state with an empty event log and an AuditResponse', () => {
    const c = new Conversation('user123');
    expect(c.state).toBe(STATE.CHAT);
    expect(c.chatEvents).toEqual([]);
    expect(c.audit).toBeInstanceOf(AuditResponse);
    expect(c.endTimestamp).toBeNull();
  });

  test('END_CHAT transitions CHAT -> AUDIT_LIKERTRESPONSE', () => {
    const c = new Conversation('u');
    c.addChatEvent(new ChatEvent(CHAT_EVENT_TYPE.END_CHAT, null));
    expect(c.state).toBe(STATE.AUDIT_LIKERTRESPONSE);
  });

  test('audit states advance in order on each subsequent event', () => {
    const c = new Conversation('u');
    c.addChatEvent(new ChatEvent(CHAT_EVENT_TYPE.END_CHAT, null)); // -> likert
    expect(c.state).toBe(STATE.AUDIT_LIKERTRESPONSE);

    // any further event advances the audit state machine
    c.addChatEvent(new ChatEvent(CHAT_EVENT_TYPE.END_CHAT, null)); // -> highlight
    expect(c.state).toBe(STATE.AUDIT_HIGHLIGHT);

    c.addChatEvent(new ChatEvent(CHAT_EVENT_TYPE.END_CHAT, null)); // -> textresponse
    expect(c.state).toBe(STATE.AUDIT_TEXTRESPONSE);

    c.addChatEvent(new ChatEvent(CHAT_EVENT_TYPE.END_CHAT, null)); // -> complete
    expect(c.state).toBe(STATE.COMPLETE);
  });

  test('adding an event after COMPLETE is swallowed by addChatEvent (error caught internally)', () => {
    const c = new Conversation('u');
    // drive to COMPLETE
    for (let i = 0; i < 4; i++) {
      c.addChatEvent(new ChatEvent(CHAT_EVENT_TYPE.END_CHAT, null));
    }
    expect(c.state).toBe(STATE.COMPLETE);
    const eventsBefore = c.chatEvents.length;
    // addChatEvent catches the "already ended" error internally and does not throw
    expect(() => c.addChatEvent(new ChatEvent(CHAT_EVENT_TYPE.END_CHAT, null))).not.toThrow();
    // the event was still pushed before updateState threw
    expect(c.chatEvents.length).toBe(eventsBefore + 1);
  });

  test('updateState directly throws once COMPLETE', () => {
    const c = new Conversation('u');
    for (let i = 0; i < 4; i++) {
      c.addChatEvent(new ChatEvent(CHAT_EVENT_TYPE.END_CHAT, null));
    }
    expect(() => c.updateState(new ChatEvent(CHAT_EVENT_TYPE.END_CHAT, null)))
      .toThrow(/already ended/);
  });

  test('getChat returns only user/bot/edit message payloads in order', () => {
    const c = new Conversation('u');
    const userMsg = new Message({ author: 'user', content: 'q1' });
    const botMsg = new Message({ author: 'bot', content: 'a1' });
    c.addChatEvent(new ChatEvent(CHAT_EVENT_TYPE.NEW_USER_MESSAGE, userMsg));
    c.addChatEvent(new ChatEvent(CHAT_EVENT_TYPE.NEW_BOT_MESSAGE, botMsg));

    const chat = c.getChat();
    expect(chat).toHaveLength(2);
    expect(chat[0].content).toBe('q1');
    expect(chat[1].content).toBe('a1');
  });

  test('endConversation / endAudit set timestamps', () => {
    const c = new Conversation('u');
    expect(c.endTimestamp).toBeNull();
    c.endConversation();
    expect(typeof c.endTimestamp).toBe('number');
    expect(c.audit.endTimestamp).toBeNull();
    c.endAudit();
    expect(typeof c.audit.endTimestamp).toBe('number');
  });

  test('addAudit merges data into the audit object', () => {
    const c = new Conversation('u');
    c.addAudit({ likertResponses: { problematic: '(1)' } });
    expect(c.audit.likertResponses).toEqual({ problematic: '(1)' });
    // merge preserves other audit fields
    expect(Array.isArray(c.audit.highlights)).toBe(true);
  });
});
