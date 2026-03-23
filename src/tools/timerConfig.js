// tools/timerConfig.js

const PHASE_DURATIONS = {
    timerMaxOverallChatTimeSeconds: 30 * 60, // default 15 min = 900s
    timerChatsMaxSeconds: [3 * 60, 3 * 60], // default 7 min each chat in seconds if not provided
    timerAuditMaxSeconds: null, // no audit timer by default
    timerWarningChatTimeIsUpSeconds: 120, // default 2 min warning
    timerMinChatTimeRemainingToStartNewChatSeconds: 180, // default 3 min
};

export default PHASE_DURATIONS;