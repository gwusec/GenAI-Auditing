// Phase C step 2 — turn-reaction model (AUD-5 / EVAL-1).

import { Conversation, ChatEvent, CHAT_EVENT_TYPE } from '../models';
import {
  makeReactionData,
  isReactionEnabled,
  currentReactions,
  REACTION_TYPES,
} from '../audit/reactions';

describe('makeReactionData', () => {
  test('builds a normalized reaction payload', () => {
    expect(makeReactionData({ messageId: 'm1', type: 'thumbs', value: 'up' }))
      .toEqual({ messageId: 'm1', type: 'thumbs', value: 'up', comment: null });
  });
  test('defaults value + comment to null', () => {
    expect(makeReactionData({ messageId: 'm1', type: 'star' }))
      .toEqual({ messageId: 'm1', type: 'star', value: null, comment: null });
  });
  test('rejects an unknown type or missing messageId', () => {
    expect(() => makeReactionData({ messageId: 'm', type: 'laugh' })).toThrow(/Unknown reaction type/);
    expect(() => makeReactionData({ type: 'thumbs' })).toThrow(/messageId is required/);
  });
  test('exposes the canonical reaction types', () => {
    expect(REACTION_TYPES).toEqual(['thumbs', 'star', 'flag', 'comment']);
  });
});

describe('isReactionEnabled', () => {
  test('checks membership against the study\'s enabled types', () => {
    expect(isReactionEnabled('flag', ['thumbs', 'flag'])).toBe(true);
    expect(isReactionEnabled('star', ['thumbs', 'flag'])).toBe(false);
    expect(isReactionEnabled('flag', undefined)).toBe(false);
  });
});

describe('ChatEvent NEW_REACTION validation', () => {
  test('accepts well-formed reaction data', () => {
    const ev = new ChatEvent(CHAT_EVENT_TYPE.NEW_REACTION, { messageId: 'm1', type: 'thumbs', value: 'up' });
    expect(ev.type).toBe('new_reaction');
  });
  test('rejects malformed reaction data', () => {
    expect(() => new ChatEvent(CHAT_EVENT_TYPE.NEW_REACTION, null)).toThrow(/Invalid data/);
    expect(() => new ChatEvent(CHAT_EVENT_TYPE.NEW_REACTION, { type: 'thumbs' })).toThrow(/Invalid data/);
    expect(() => new ChatEvent(CHAT_EVENT_TYPE.NEW_REACTION, { messageId: 'm' })).toThrow(/Invalid data/);
  });
});

describe('Conversation.getReactions', () => {
  test('projects reaction events in order with id + timestamp, ignoring chat turns', () => {
    const c = new Conversation('u');
    c.addChatEvent(new ChatEvent(CHAT_EVENT_TYPE.NEW_REACTION, makeReactionData({ messageId: 'm1', type: 'thumbs', value: 'up' })));
    c.addChatEvent(new ChatEvent(CHAT_EVENT_TYPE.NEW_REACTION, makeReactionData({ messageId: 'm1', type: 'flag', value: true })));
    const reactions = c.getReactions();
    expect(reactions).toHaveLength(2);
    expect(reactions[0]).toMatchObject({ messageId: 'm1', type: 'thumbs', value: 'up' });
    expect(typeof reactions[0].id).toBe('string');
    expect(typeof reactions[0].timestamp).toBe('number');
  });

  test('adding a reaction does not advance conversation state', () => {
    const c = new Conversation('u');
    c.addChatEvent(new ChatEvent(CHAT_EVENT_TYPE.NEW_REACTION, makeReactionData({ messageId: 'm1', type: 'star', value: true })));
    expect(c.state).toBe('chat');
  });
});

describe('currentReactions', () => {
  test('last value wins per (messageId,type) toggle', () => {
    const cur = currentReactions([
      { messageId: 'm1', type: 'thumbs', value: 'up' },
      { messageId: 'm1', type: 'thumbs', value: 'down' },
    ]);
    expect(cur).toEqual([{ messageId: 'm1', type: 'thumbs', value: 'down' }]);
  });

  test('a cleared toggle (value null, no comment) is dropped', () => {
    const cur = currentReactions([
      { messageId: 'm1', type: 'star', value: true },
      { messageId: 'm1', type: 'star', value: null },
    ]);
    expect(cur).toEqual([]);
  });

  test('comments are each kept individually', () => {
    const cur = currentReactions([
      { messageId: 'm1', type: 'comment', value: null, comment: 'first' },
      { messageId: 'm1', type: 'comment', value: null, comment: 'second' },
    ]);
    expect(cur).toHaveLength(2);
  });
});
