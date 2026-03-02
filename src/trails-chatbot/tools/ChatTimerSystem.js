import PHASE_DURATIONS from './timerConfig';

class ChatTimerSystem {
    constructor(config = {}) {
        console.log("Initializing timer system...");
        // Load config if provided, load default config otherwise
        this.config = {
            overallDuration: config.timerMaxOverallChatTimeSeconds ?? PHASE_DURATIONS.timerMaxOverallChatTimeSeconds,
            chatDurations: config.timerChatsMaxSeconds ?? PHASE_DURATIONS.timerChatsMaxSeconds,
            warningThreshold: config.timerWarningChatTimeIsUpSeconds ?? PHASE_DURATIONS.timerWarningChatTimeIsUpSeconds,
            minNewChatThreshold: config.timerMinChatTimeRemainingToStartNewChatSeconds ?? PHASE_DURATIONS.timerMinChatTimeRemainingToStartNewChatSeconds
        };

        // Load persisted state from browser cache
        const savedState = JSON.parse(localStorage.getItem('chatTimerState'));

        // Restore state
        this.state = savedState
            ? {
                ...savedState,
            }
            : {
                overallTimeRemaining: this.config.overallDuration * 1000,
                currentChatTimeRemaining: this.config.chatDurations[0] * 1000,
                currentChatIndex: -1,
                isWarningShown: false,
                isPaused: true,
                hasStarted: false
            };

        this.listeners = { onTick: new Set(), onWarning: new Set(), onExpired: new Set(), onOverallExpired: new Set() };
        this.intervals = { overall: null, currentPhase: null };
        this.persistState();

        if (this.state.hasStarted && !this.state.isPaused) {
            console.log("Resuming timer system...");
            // Restart timers if needed
            if (!this.intervals.currentPhase && this.state.currentChatTimeRemaining > 0) {
                console.log("Restarting phase timer after state restore...");
                this.startPhaseTimer();
            }

            if (!this.intervals.overall && this.state.overallTimeRemaining > 0) {
                console.log("Restarting overall timer after state restore...");
                // resume overall timer instead of starting a new one
                this.startOverallTimer();
            }
        }
    }

    start() {
        console.log("Starting timer system...");
        if (this.state.hasStarted) {
            throw new Error("Timer system has already started.");
        }
        this.state.hasStarted = true;
        console.log("Current state:", this.state);

        if (this.state.overallTimeRemaining > 0) {
            this.startOverallTimer();
            console.log("Overall timer started.");
        }
        if (this.state.currentChatTimeRemaining > 0) {
            this.startPhaseTimer();
            console.log("Phase timer started.");
        }

        this.persistState();
    }

    pause() {
        // Only pause if not already paused
        if (!this.state.isPaused) {
            console.log("Pausing timer system...");
            this.state.isPaused = true;
            this.persistState();
        } else {
            console.log("Timer system is already paused.");
        }
    }

    resume() {
        // Only resume if currently paused
        if (this.state.isPaused) {
            console.log("Resuming timer system...");
            this.state.isPaused = false;

            // Restart timers if needed
            if (!this.intervals.currentPhase && this.state.currentChatTimeRemaining > 0) {
                console.log("Restarting phase timer...");
                this.startPhaseTimer();
            }

            if (!this.intervals.overall && this.state.overallTimeRemaining > 0) {
                console.log("Restarting overall timer...");
                // resume overall timer instead of starting a new one
                this.startOverallTimer();
            }

            this.persistState();
        }
    }

    startNewChat() {
        if (this.canStartNewChat()) {
            console.log("Starting new chat...");
            this.state.currentChatIndex += 1;
            this.state.currentChatTimeRemaining = this.getCurrentChatDuration() * 1000;
            // Reset any warning states
            this.state.isWarningShown = false;

            // Clear any existing phase timer
            if (this.intervals.currentPhase) {
                clearInterval(this.intervals.currentPhase);
                this.intervals.currentPhase = null;
            }
            // Start phase timer only if this.getCurrentChatDuration() > 0 (i.e., first two chats)
            if (this.getCurrentChatDuration() > 0) {
                this.startPhaseTimer();
            }
            // this.state.isPaused = true;

            if (this.state.isPaused) {
                this.resume();
            }

            this.persistState();
            this.forceTickUpdate();
            return true;
        }
        return false;
    }

    canStartNewChat() {
        let minAmountOfChats = this.config.chatDurations.length;
        if (this.state.currentChatIndex < minAmountOfChats) {
            return true;
        }
        return this.state.overallTimeRemaining >= this.config.minNewChatThreshold * 1000;
    }

    startOverallTimer() {
        if (this.intervals.overall || this.state.overallTimeRemaining <= 0) {
            if (this.state.overallTimeRemaining <= 0) {
                this.notifyListeners('onOverallExpired');
            }
            return;
        }

        console.log("Starting overall timer...");

        const tick = () => {
            // Overall timer never pauses once started
            const prevOverallTimeRemaining = this.state.overallTimeRemaining;
            this.state.overallTimeRemaining = Math.max(0, prevOverallTimeRemaining - 1000);

            // WARNING CHECK FOR OVERALL TIMER
            if (
                prevOverallTimeRemaining > this.config.warningThreshold * 1000 &&
                this.state.overallTimeRemaining <= this.config.warningThreshold * 1000
            ) {
                console.log("Warning threshold reached for overall timer");
                this.notifyListeners('onWarning', 'overall');
            }

            if (this.state.overallTimeRemaining <= 0 && this.state.currentChatTimeRemaining <= 0) {
                this.notifyListeners('onOverallExpired');
                clearInterval(this.intervals.overall);
                this.intervals.overall = null;
            }

            this.persistState(); // Save updated state after each tick

            // Notify listeners of tick
            this.notifyListeners('onTick', {
                percentageChatTimeRemaining:
                    this.state.currentChatIndex < this.config.chatDurations.length ?
                        this.state.currentChatTimeRemaining / (this.getCurrentChatDuration() * 1000) * 100 :
                        this.state.overallTimeRemaining / (this.config.overallDuration * 1000) * 100,
                overallTimeRemaining: this.state.overallTimeRemaining,
                currentChatTimeRemaining: this.state.currentChatTimeRemaining
            });
        };

        this.intervals.overall = setInterval(tick, 1000);
        tick(); // Initial tick
    }

    startPhaseTimer() {
        if (this.intervals.currentPhase) {
            console.log("Clearing existing phase timer...");
            clearInterval(this.intervals.currentPhase);
        }

        const duration = this.state.currentChatTimeRemaining;
        console.log(`Starting phase timer with remaining duration: ${duration}ms`);

        const tick = () => {
            // If paused, do not decrement or trigger warnings.
            if (this.state.isPaused) {
                return;
            }

            const prevTimeRemaining = this.state.currentChatTimeRemaining;
            this.state.currentChatTimeRemaining = Math.max(0, prevTimeRemaining - 1000);

            // Trigger warning if within threshold and not yet shown
            if (
                prevTimeRemaining > this.config.warningThreshold * 1000 &&
                this.state.currentChatTimeRemaining <= this.config.warningThreshold * 1000
            ) {
                console.log("Warning threshold reached");
                this.notifyListeners('onWarning', 'phase');
            }

            // Handle expiration
            if (this.state.currentChatTimeRemaining <= 0 && prevTimeRemaining > 0) {
                console.log("Phase timer expired - notifying onExpired");
                this.notifyListeners('onExpired', this.state.currentChatIndex);
                clearInterval(this.intervals.currentPhase);
                this.intervals.currentPhase = null;
            }

            this.persistState();

            // Notify listeners of tick
            this.notifyListeners('onTick', {
                percentageChatTimeRemaining:
                    this.state.currentChatIndex < this.config.chatDurations.length ?
                        this.state.currentChatTimeRemaining / (this.getCurrentChatDuration() * 1000) * 100 :
                        this.state.overallTimeRemaining / (this.config.overallDuration * 1000) * 100,
                overallTimeRemaining: this.state.overallTimeRemaining,
                currentChatTimeRemaining: this.state.currentChatTimeRemaining
            });
        };

        this.intervals.currentPhase = setInterval(tick, 1000);
        tick(); // Initial tick
    }

    stopPhaseTimer() {
        if (this.intervals.currentPhase) {
            clearInterval(this.intervals.currentPhase);
            this.intervals.currentPhase = null;
        }
        // Optionally reset current chat time if desired:
        this.state.currentChatTimeRemaining = 0;
        this.persistState();
    }


    persistState() {
        if (window.__isRestarting) return;
        const stateToSave = {
            overallTimeRemaining: this.state.overallTimeRemaining,
            currentChatTimeRemaining: this.state.currentChatTimeRemaining,
            currentChatIndex: this.state.currentChatIndex,
            isPaused: this.state.isPaused,
            hasStarted: this.state.hasStarted,
            isWarningShown: this.state.isWarningShown
        };
        localStorage.setItem('chatTimerState', JSON.stringify(stateToSave));
    }

    forceTickUpdate() {
        this.notifyListeners('onTick', {
            percentageChatTimeRemaining:
                this.state.currentChatIndex < this.config.chatDurations.length ?
                    this.state.currentChatTimeRemaining / (this.getCurrentChatDuration() * 1000) * 100 :
                    this.state.overallTimeRemaining / (this.config.overallDuration * 1000) * 100,
            overallTimeRemaining: this.state.overallTimeRemaining,
            currentChatTimeRemaining: this.state.currentChatTimeRemaining
        });
    }

    loadPersistedState() {
        const saved = localStorage.getItem('chatTimerState');
        if (saved) {
            const parsed = JSON.parse(saved);
            this.state = { ...this.state, ...parsed };
        }
    }

    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].add(callback);
        }
    }

    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].delete(callback);
        }
    }

    notifyListeners(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }

    cleanup() {
        Object.values(this.intervals).forEach(interval => {
            if (interval) clearInterval(interval);
        });
        this.intervals = { overall: null, currentPhase: null };
    }

    getCurrentChatDuration() {
        if (this.state.currentChatIndex < this.config.chatDurations.length) {
            return this.config.chatDurations[this.state.currentChatIndex];
        } else {
            // No phase timer for subsequent chats
            return this.config.overallDuration;
        }
    }

    getTimeRemaining() {
        return {
            overall: this.state.overallTimeRemaining,
            current: this.state.currentChatTimeRemaining,
            currentChatIndex: this.state.currentChatIndex
        };
    }
}

export default ChatTimerSystem;