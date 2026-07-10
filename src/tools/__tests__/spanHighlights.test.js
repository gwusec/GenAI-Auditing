// Phase C step 1 — span-offset hardening (EVAL-3 / D6).

import {
  createSpanHighlight,
  highlightResolves,
  resolveHighlights,
  migrateLegacyHighlight,
  toRenderableHighlight,
} from '../audit/spanHighlights';

const CANON = 'The quick brown fox jumps.';

describe('createSpanHighlight', () => {
  test('slices quotedText from the canonical string at the offsets', () => {
    const h = createSpanHighlight(CANON, { messageId: 'm1', startOffset: 4, endOffset: 9 });
    expect(h).toEqual({
      messageId: 'm1', startOffset: 4, endOffset: 9,
      quotedText: 'quick', explanation: '', label: null,
    });
  });

  test('carries explanation + label', () => {
    const h = createSpanHighlight(CANON, { messageId: 'm1', startOffset: 0, endOffset: 3, explanation: 'why', label: 'bias' });
    expect(h.explanation).toBe('why');
    expect(h.label).toBe('bias');
  });

  test('rejects out-of-bounds, inverted, or non-integer selections', () => {
    expect(() => createSpanHighlight(CANON, { messageId: 'm', startOffset: -1, endOffset: 3 })).toThrow(/out of bounds/);
    expect(() => createSpanHighlight(CANON, { messageId: 'm', startOffset: 0, endOffset: 999 })).toThrow(/out of bounds/);
    expect(() => createSpanHighlight(CANON, { messageId: 'm', startOffset: 9, endOffset: 4 })).toThrow(/startOffset must be < endOffset/);
    expect(() => createSpanHighlight(CANON, { messageId: 'm', startOffset: 1.5, endOffset: 3 })).toThrow(/integers/);
    expect(() => createSpanHighlight(CANON, { startOffset: 0, endOffset: 1 })).toThrow(/messageId is required/);
  });
});

describe('highlightResolves', () => {
  test('true when canonical[start:end] === quotedText', () => {
    const h = createSpanHighlight(CANON, { messageId: 'm1', startOffset: 10, endOffset: 15 });
    expect(highlightResolves(CANON, h)).toBe(true);
  });

  test('false when the canonical text changed under the offsets', () => {
    const h = createSpanHighlight(CANON, { messageId: 'm1', startOffset: 4, endOffset: 9 }); // 'quick'
    expect(highlightResolves('The slow brown fox jumps.', h)).toBe(false);
  });

  test('false for missing canonical or malformed offsets', () => {
    expect(highlightResolves(undefined, { startOffset: 0, endOffset: 1, quotedText: 'x' })).toBe(false);
    expect(highlightResolves(CANON, { startOffset: 0, endOffset: 999, quotedText: 'x' })).toBe(false);
  });
});

describe('resolveHighlights', () => {
  test('tags each highlight with resolved against its message canonical text', () => {
    const good = createSpanHighlight(CANON, { messageId: 'm1', startOffset: 4, endOffset: 9 });
    const stale = { messageId: 'm2', startOffset: 0, endOffset: 5, quotedText: 'WRONG' };
    const out = resolveHighlights([good, stale], { m1: CANON, m2: 'hello world' });
    expect(out[0].resolved).toBe(true);
    expect(out[1].resolved).toBe(false);
  });
});

describe('migrateLegacyHighlight', () => {
  test('converts { messageId, text, startIndex } to the hardened shape', () => {
    const out = migrateLegacyHighlight({ messageId: 'm1', text: 'quick', startIndex: 4 });
    expect(out).toEqual({
      messageId: 'm1', startOffset: 4, endOffset: 9,
      quotedText: 'quick', explanation: '', label: null,
    });
    // and it resolves against the canonical text
    expect(highlightResolves(CANON, out)).toBe(true);
  });

  test('is idempotent on an already-hardened highlight', () => {
    const h = createSpanHighlight(CANON, { messageId: 'm1', startOffset: 4, endOffset: 9 });
    expect(migrateLegacyHighlight(h)).toBe(h);
  });
});

// Regression: the post-audit summary hands HARDENED highlights to the legacy
// ChatHistory renderer, which reads `.text` / `.startIndex` — undefined on the
// hardened shape, crashing the app after audit submit (white screen).
describe('toRenderableHighlight', () => {
  test('maps a hardened highlight to the legacy render shape', () => {
    const h = createSpanHighlight(CANON, { messageId: 'm1', startOffset: 4, endOffset: 9 });
    const out = toRenderableHighlight(h);
    expect(out.text).toBe('quick');
    expect(out.startIndex).toBe(4);
    expect(out.messageId).toBe('m1');
    // hardened fields are preserved alongside
    expect(out.quotedText).toBe('quick');
    expect(out.endOffset).toBe(9);
  });

  test('passes a legacy highlight through unchanged in meaning', () => {
    const out = toRenderableHighlight({ messageId: 'm1', text: 'quick', startIndex: 4 });
    expect(out.text).toBe('quick');
    expect(out.startIndex).toBe(4);
  });

  test('never yields an undefined text or startIndex (crash guard)', () => {
    const out = toRenderableHighlight({ messageId: 'm1' });
    expect(typeof out.text).toBe('string');
    expect(Number.isInteger(out.startIndex)).toBe(true);
    expect(toRenderableHighlight(null)).toBeNull();
  });
});
