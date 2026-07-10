// Relay-level unit tests (P3 §4.1): the relay must honor the study's decoding
// settings and apply the study's system/seed prompt instead of the old hardcoded
// "You are a helpful assistant." default. These test the pure helpers the /chat
// handler uses, so no network or port binding is involved.

import { describe, test, expect } from 'vitest';
import { resolveDecoding, ensureSystemMessage } from '../relayHelpers.js';

describe('resolveDecoding', () => {
  test('carries the study-configured temperature/topP/maxTokens', () => {
    expect(resolveDecoding({ decoding: { temperature: 0.2, topP: 0.5, maxTokens: 256 } }))
      .toEqual({ temperature: 0.2, topP: 0.5, maxTokens: 256 });
  });

  test('falls back to safe defaults when decoding is absent', () => {
    expect(resolveDecoding({})).toEqual({ temperature: 0.7, topP: undefined, maxTokens: 2000 });
    expect(resolveDecoding(undefined)).toEqual({ temperature: 0.7, topP: undefined, maxTokens: 2000 });
  });

  test('temperature 0 is honored (not treated as missing)', () => {
    expect(resolveDecoding({ decoding: { temperature: 0 } }).temperature).toBe(0);
  });

  test('rejects out-of-range or malformed values and uses defaults', () => {
    const d = resolveDecoding({ decoding: { temperature: -1, topP: 2, maxTokens: 0 } });
    expect(d).toEqual({ temperature: 0.7, topP: undefined, maxTokens: 2000 });
  });
});

describe('ensureSystemMessage', () => {
  test('applies the study system/seed prompt when the caller has no system turn', () => {
    const out = ensureSystemMessage([{ role: 'user', content: 'hi' }], 'You are a hiring manager.');
    expect(out[0]).toEqual({ role: 'system', content: 'You are a hiring manager.' });
    expect(out[1]).toEqual({ role: 'user', content: 'hi' });
  });

  test('falls back to the generic default only when no study prompt is set', () => {
    const out = ensureSystemMessage([{ role: 'user', content: 'hi' }], '');
    expect(out[0]).toEqual({ role: 'system', content: 'You are a helpful assistant.' });
  });

  test('never overrides an inline system message supplied by the caller', () => {
    const msgs = [{ role: 'system', content: 'inline' }, { role: 'user', content: 'hi' }];
    expect(ensureSystemMessage(msgs, 'study prompt')).toEqual(msgs);
  });
});
