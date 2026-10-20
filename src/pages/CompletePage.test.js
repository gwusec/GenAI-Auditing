import { configuredStudyCompletion } from './CompletePage';

const COMPLETE = 'complete';
const conv = (state) => ({ state });

describe('configuredStudyCompletion', () => {
  test('requires another conversation until the configured N is complete', () => {
    expect(configuredStudyCompletion([conv(COMPLETE)], COMPLETE, 2)).toEqual({ needsAnother: true });
  });

  test('stops exactly at the configured N', () => {
    expect(configuredStudyCompletion([conv(COMPLETE), conv(COMPLETE)], COMPLETE, 2))
      .toEqual({ needsAnother: false });
  });

  test('does not activate for legacy flow or an unfinished latest conversation', () => {
    expect(configuredStudyCompletion([conv(COMPLETE)], COMPLETE, null)).toBeNull();
    expect(configuredStudyCompletion([conv(COMPLETE), conv('chat')], COMPLETE, 2)).toBeNull();
  });
});
