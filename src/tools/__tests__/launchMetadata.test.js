// Phase B step 6 — launch metadata capture (SC-13 / D7).

import { parseLaunchMetadata } from '../sessions/launchMetadata';

describe('parseLaunchMetadata', () => {
  test('returns null when capture is disabled (regardless of params)', () => {
    expect(parseLaunchMetadata('?PROLIFIC_PID=abc', { enabled: false })).toBeNull();
    expect(parseLaunchMetadata('?PROLIFIC_PID=abc')).toBeNull(); // default disabled
  });

  test('captures query params as an opaque string map when enabled', () => {
    expect(parseLaunchMetadata('?PROLIFIC_PID=abc&STUDY=z', { enabled: true }))
      .toEqual({ PROLIFIC_PID: 'abc', STUDY: 'z' });
  });

  test('tolerates a leading ? or a bare query string', () => {
    expect(parseLaunchMetadata('a=1&b=2', { enabled: true })).toEqual({ a: '1', b: '2' });
  });

  test('accepts a URLSearchParams instance', () => {
    const usp = new URLSearchParams('x=9');
    expect(parseLaunchMetadata(usp, { enabled: true })).toEqual({ x: '9' });
  });

  test('enabled with no params yields an empty object (not null)', () => {
    expect(parseLaunchMetadata('', { enabled: true })).toEqual({});
    expect(parseLaunchMetadata('?', { enabled: true })).toEqual({});
  });

  test('does not interpret values; last value wins for duplicate keys', () => {
    expect(parseLaunchMetadata('k=1&k=2', { enabled: true })).toEqual({ k: '2' });
  });
});
