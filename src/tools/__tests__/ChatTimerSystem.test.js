// Characterization tests for src/tools/ChatTimerSystem.js
// Uses fake timers. Captures current start/pause/resume/new-chat/expiry behavior
// and localStorage persistence.

import ChatTimerSystem from '../ChatTimerSystem';

const CONFIG = {
  timerMaxOverallChatTimeSeconds: 100,
  timerChatsMaxSeconds: [5, 5],
  timerWarningChatTimeIsUpSeconds: 2,
  timerMinChatTimeRemainingToStartNewChatSeconds: 10,
};

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('ChatTimerSystem — initialization', () => {
  test('initializes paused, not started, with config-derived remaining times', () => {
    const t = new ChatTimerSystem(CONFIG);
    expect(t.state.isPaused).toBe(true);
    expect(t.state.hasStarted).toBe(false);
    expect(t.state.currentChatIndex).toBe(-1);
    expect(t.state.overallTimeRemaining).toBe(100 * 1000);
    expect(t.state.currentChatTimeRemaining).toBe(5 * 1000); // chatDurations[0]
    t.cleanup();
  });

  test('persists state to localStorage on construction', () => {
    const t = new ChatTimerSystem(CONFIG);
    const saved = JSON.parse(window.localStorage.getItem('chatTimerState'));
    expect(saved).toMatchObject({ hasStarted: false, isPaused: true, currentChatIndex: -1 });
    t.cleanup();
  });

  test('supports a study- and user-scoped storage key', () => {
    const t = new ChatTimerSystem({ ...CONFIG, timerStorageKey: 'chatTimerState:study:user' });
    expect(window.localStorage.getItem('chatTimerState')).toBeNull();
    expect(window.localStorage.getItem('chatTimerState:study:user')).not.toBeNull();
    t.cleanup();
  });
});

describe('ChatTimerSystem — start / pause / resume', () => {
  test('start() flips hasStarted and throws if started twice', () => {
    const t = new ChatTimerSystem(CONFIG);
    t.start();
    expect(t.state.hasStarted).toBe(true);
    expect(() => t.start()).toThrow(/already started/);
    t.cleanup();
  });

  test('pause() is idempotent and resume() unpauses', () => {
    const t = new ChatTimerSystem(CONFIG);
    t.start();
    t.pause();
    expect(t.state.isPaused).toBe(true);
    t.pause(); // no-op, should not throw
    expect(t.state.isPaused).toBe(true);
    t.resume();
    expect(t.state.isPaused).toBe(false);
    t.cleanup();
  });
});

describe('ChatTimerSystem — new chat lifecycle', () => {
  test('canStartNewChat is true before reaching the configured chat count', () => {
    const t = new ChatTimerSystem(CONFIG);
    expect(t.state.currentChatIndex).toBe(-1);
    expect(t.canStartNewChat()).toBe(true);
    t.cleanup();
  });

  test('startNewChat increments the chat index and resets the phase time', () => {
    const t = new ChatTimerSystem(CONFIG);
    t.start();
    const ok = t.startNewChat();
    expect(ok).toBe(true);
    expect(t.state.currentChatIndex).toBe(0);
    expect(t.state.currentChatTimeRemaining).toBe(5 * 1000); // chatDurations[0]
    t.cleanup();
  });

  test('requires the remaining-time threshold after the configured chat count', () => {
    const t = new ChatTimerSystem(CONFIG);
    t.state.currentChatIndex = 1; // second and final configured chat
    t.state.overallTimeRemaining = 9 * 1000;
    expect(t.canStartNewChat()).toBe(false);
    t.state.overallTimeRemaining = 10 * 1000;
    expect(t.canStartNewChat()).toBe(true);
    t.cleanup();
  });

  test('getCurrentChatDuration returns per-chat duration, then overall once past the list', () => {
    const t = new ChatTimerSystem(CONFIG);
    t.state.currentChatIndex = 0;
    expect(t.getCurrentChatDuration()).toBe(5);
    t.state.currentChatIndex = 5; // beyond chatDurations.length (2)
    expect(t.getCurrentChatDuration()).toBe(100); // falls back to overallDuration
    t.cleanup();
  });
});

describe('ChatTimerSystem — ticking and expiry', () => {
  test('phase timer decrements once per second while running', () => {
    const t = new ChatTimerSystem(CONFIG);
    t.start();
    t.startNewChat(); // index 0, 5s phase, resumes
    const before = t.state.currentChatTimeRemaining;
    vi.advanceTimersByTime(2000);
    expect(t.state.currentChatTimeRemaining).toBeLessThan(before);
    t.cleanup();
  });

  test('onExpired fires when the phase timer runs out', () => {
    const t = new ChatTimerSystem(CONFIG);
    const onExpired = vi.fn();
    t.on('onExpired', onExpired);
    t.start();
    t.startNewChat(); // 5s phase
    vi.advanceTimersByTime(7000); // run past expiry
    expect(onExpired).toHaveBeenCalled();
    t.cleanup();
  });

  test('stopPhaseTimer zeroes the current chat time', () => {
    const t = new ChatTimerSystem(CONFIG);
    t.start();
    t.startNewChat();
    t.stopPhaseTimer();
    expect(t.state.currentChatTimeRemaining).toBe(0);
    t.cleanup();
  });
});

describe('ChatTimerSystem — listeners', () => {
  test('on/off add and remove tick listeners', () => {
    const t = new ChatTimerSystem(CONFIG);
    const onTick = vi.fn();
    t.on('onTick', onTick);
    t.start();
    t.startNewChat();
    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalled();
    const callCount = onTick.mock.calls.length;
    t.off('onTick', onTick);
    vi.advanceTimersByTime(2000);
    expect(onTick.mock.calls.length).toBe(callCount); // no further calls after off()
    t.cleanup();
  });
});
