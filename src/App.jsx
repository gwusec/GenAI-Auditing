// src/App.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import apiClient from './tools/APIClient';
import { ChatEvent, CHAT_EVENT_TYPE, STATE } from './tools/models';
import conversationHandler from './tools/ConversationHandler';
import ChatBox from './components/ChatBox/ChatBox';
import AppConfig from './tools/AppConfig';
import ChatTimerSystem from './tools/ChatTimerSystem';
import { Typography } from './components/ui/layout';
import { Button } from './components/ui/button';
import { Tooltip } from './components/ui/tooltip';
import { Progress } from './components/ui/progress';
import { cn } from './lib/utils';
import styles from './App.module.css';
import SurveyPage from "./pages/SurveyPage";
import ChatPage from "./pages/ChatPage";
import AuditPage from "./pages/AuditPage";
import CompletePage from "./pages/CompletePage";

const AppState = {
    SURVEY: 'survey',
    CHAT: 'chat',
    AUDIT: 'audit',
    COMPLETE: 'complete',
};

// A study with no configured timer yields NaN "time remaining" (empty duration
// arrays → chatDurations[0] is undefined). Treat that as "no limit" rather than
// showing the misleading "less than 1 minute" fallback (B3).
const hasTimeLimit = (ms) => ms != null && !Number.isNaN(ms);
const formatTimeRemaining = (ms) => {
    const minutes = ms / 1000 / 60;
    if (minutes > 1) return `${Math.ceil(minutes)} minutes`;
    if (ms / 1000 === 0) return 'no time';
    return 'less than 1 minute';
};

function App({ llmProxyServerUrl, isViewOnly = false, viewOnlyData, config = {}, userId, debugMode = false, presetSurveyQuestions = null, onConversationStart = null, onConversationComplete = null }) {
    // When a study is pre-configured (auditor taking an investigator's study),
    // skip the in-app SurveyMaker step and start directly in CHAT using the
    // provided questionnaire. With no preset (standalone/legacy), behavior is
    // unchanged: start in SURVEY so the questionnaire is authored inline.
    const [currentAppState, setCurrentAppState] = useState(presetSurveyQuestions ? AppState.CHAT : AppState.SURVEY);
    const [conversations, setConversations] = useState([]);
    const [activeConversationIndex, setActiveConversationIndex] = useState(0);
    const [activeConversation, setActiveConversation] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [surveyQuestions, setSurveyQuestions] = useState(presetSurveyQuestions || null);
    const [showAPIErrorDialog, setShowAPIErrorDialog] = useState(false);
    const [showTimerChatTimeUpDialog, setShowTimerChatTimeUpDialog] = useState(false);

    const timerSystem = useMemo(() => {
        const timerStorageKey = config?.studyId && userId
            ? `chatTimerState:${config.studyId}:${userId}`
            : 'chatTimerState';
        return new ChatTimerSystem({ ...config, timerStorageKey });
    }, [config, userId]);
    const [timerState, setTimerState] = useState({
        percentageChatTimeRemaining: 100,
        overallTimeRemaining: timerSystem.state.overallTimeRemaining,
        currentChatTimeRemaining: timerSystem.state.currentChatTimeRemaining,
    });

    useEffect(() => {
        const handleTick = ({ percentageChatTimeRemaining, overallTimeRemaining, currentChatTimeRemaining }) => {
            setTimerState({ percentageChatTimeRemaining, overallTimeRemaining, currentChatTimeRemaining });
        };
        const handleWarning = () => {
            console.log("useTimer received warning event. Nothing happens here.");
        };
        const handleChatExpired = () => {
            console.log("Chat has expired.");
            timerSystem.pause();
            setShowTimerChatTimeUpDialog(true);
        };
        timerSystem.on('onTick', handleTick);
        timerSystem.on('onWarning', handleWarning);
        timerSystem.on('onExpired', handleChatExpired);
        timerSystem.on('onOverallExpired', handleChatExpired);
        return () => {
            timerSystem.off('onTick', handleTick);
            timerSystem.off('onWarning', handleWarning);
            timerSystem.off('onExpired', handleChatExpired);
            timerSystem.off('onOverallExpired', handleChatExpired);
        };
    }, [timerSystem]);

    useEffect(() => {
        AppConfig.initialize({ llmProxyServerUrl, isViewOnly, config, userId });
        if (llmProxyServerUrl) {
            apiClient.getInstance(llmProxyServerUrl.toString().trim());
        }
    }, [llmProxyServerUrl, isViewOnly, config, userId]);

    const startNextConversation = async () => {
        try {
            const newConversation = await conversationHandler.createNewConversation(config);
            setConversations(prev => [...prev, newConversation]);
            setActiveConversation(newConversation);
            setActiveConversationIndex(conversations.length);
            // Attach the new conversation to the auditor session (Feature 0), if wired.
            if (onConversationStart) {
                try { await onConversationStart(newConversation.id); } catch (_) { /* non-fatal */ }
            }
            await conversationHandler.setActiveConversation(newConversation.id);
            updateAppStateBasedOnConversation(newConversation.state);
            if (!timerSystem.state.hasStarted) {
                timerSystem.cleanup();
                timerSystem.start();
            }
            timerSystem.startNewChat();
        } catch (error) {
            console.error("Error starting new conversation:", error);
            setError("Failed to start a new conversation. Please try again.");
        }
    };

    useEffect(() => {
        if (currentAppState !== AppState.SURVEY || isViewOnly) {
            const initializeApp = async () => {
                console.log("Initializing TRAILS-Chatbot...");
                try {
                    conversationHandler.initialize(apiClient);
                    if (isViewOnly && viewOnlyData) {
                        await conversationHandler.deleteAllConversations();
                        await conversationHandler.importExportedConversations(viewOnlyData);
                    }
                    let existingConversations = await conversationHandler.getExistingConversations();
                    if (existingConversations.length === 0) {
                        await startNextConversation();
                        timerSystem.pause();
                    } else {
                        await conversationHandler.setActiveConversation(existingConversations[existingConversations.length - 1].id);
                        setConversations(existingConversations);
                        setActiveConversation(existingConversations[existingConversations.length - 1]);
                        setActiveConversationIndex(existingConversations.length - 1);
                        updateAppStateBasedOnConversation(existingConversations[existingConversations.length - 1].state);
                    }
                } catch (error) {
                    console.error("Error initializing app:", error);
                    setError("Failed to initialize the application. Please try again later.");
                }
            };
            console.log("Initializing app...");
            initializeApp();
        }
    }, [currentAppState, isViewOnly, viewOnlyData]);

    useEffect(() => {
        const handleAPIError = () => {
            setShowAPIErrorDialog(true);
        };
        conversationHandler.registerOnError(handleAPIError);
        return () => {
            conversationHandler.unregisterOnError(handleAPIError);
        };
    }, []);

    const updateAppStateBasedOnConversation = useCallback((conversationState) => {
        console.log("Updating app state based on conversation state:", conversationState);
        if (conversationState === STATE.CHAT) {
            setCurrentAppState(AppState.CHAT);
        } else if (
            conversationState === STATE.AUDIT_LIKERTRESPONSE ||
            conversationState === STATE.AUDIT_HIGHLIGHT ||
            conversationState === STATE.AUDIT_TEXTRESPONSE
        ) {
            console.log("Transitioning app state to AUDIT");
            setCurrentAppState(AppState.AUDIT);
        } else if (conversationState === STATE.COMPLETE) {
            setCurrentAppState(AppState.COMPLETE);
        } else {
            console.warn("Unknown conversation state:", conversationState);
        }
    }, []);

    useEffect(() => {
        const handleStateUpdate = async (newState) => {
            try {
                console.log("Conversation state updating:", newState);
                const updatedConversation = await conversationHandler.getActiveConversation();
                setActiveConversation(updatedConversation);
                console.log("Conversation state updated:", updatedConversation);
                updateAppStateBasedOnConversation(newState);
            } catch (error) {
                console.error("Error updating conversation state:", error);
                setError("Failed to update conversation state. Please try again.");
            }
        };
        conversationHandler.registerOnStateUpdated(handleStateUpdate);
        return () => {
            conversationHandler.unregisterOnStateUpdated(handleStateUpdate);
        };
    }, [updateAppStateBasedOnConversation]);

    // Notify the auditor session (Feature 0) once, when a conversation completes.
    // A ref set guards against the effect re-firing on unrelated re-renders.
    const completedConversationIds = useRef(new Set());
    useEffect(() => {
        if (currentAppState !== AppState.COMPLETE) return;
        const id = activeConversation?.id;
        if (!id || completedConversationIds.current.has(id)) return;
        completedConversationIds.current.add(id);
        if (onConversationComplete) {
            Promise.resolve(onConversationComplete(id)).catch(() => { /* non-fatal */ });
        }
    }, [currentAppState, activeConversation, onConversationComplete]);

    const handleTutorialComplete = useCallback(() => {
        if (currentAppState === AppState.CHAT) {
            if (timerSystem.state.isPaused) {
                console.log("Resuming timer during tutorial completion...");
                timerSystem.resume();
            }
        }
    }, [timerSystem, currentAppState]);

    useEffect(() => {
        if (currentAppState === AppState.AUDIT || showTimerChatTimeUpDialog || showAPIErrorDialog) {
            console.log("Pausing timer during state transition...");
            if (!timerSystem.state.isPaused) {
                timerSystem.pause();
            }
        } else if (currentAppState === AppState.CHAT && timerSystem.state.isPaused) {
            if (timerSystem.state.hasStarted && !showTimerChatTimeUpDialog && !showAPIErrorDialog) {
                console.log("Resuming timer during state transition...");
                timerSystem.resume();
            }
        }
    }, [currentAppState, timerSystem, showTimerChatTimeUpDialog, showAPIErrorDialog]);

    const handleEndChat = async () => {
        console.log("Ending chat...");
        if (!activeConversation) {
            console.error("No active conversation found in handleEndChat");
            const active = await conversationHandler.getActiveConversation();
            if (!active) {
                console.error("Failed to recover active conversation.");
                return;
            }
            setActiveConversation(active);
        }
        try {
            setIsLoading(true);
            console.log("Ending chat for conversation:", activeConversation.id);
            const endChatEvent = new ChatEvent(CHAT_EVENT_TYPE.END_CHAT, null);
            await conversationHandler.addChatEvent(activeConversation.id, endChatEvent);
            timerSystem.stopPhaseTimer();
            const updatedConversation = await conversationHandler.getConversationById(activeConversation.id);
            console.log("Updated conversation state:", updatedConversation.state);
            if (updatedConversation.state === STATE.AUDIT_LIKERTRESPONSE) {
                console.log("Transitioning to AUDIT");
                setCurrentAppState(AppState.AUDIT);
            } else {
                console.warn("Conversation state did not update to AUDIT as expected");
            }
        } catch (error) {
            console.error("Error ending chat:", error);
            setError("Failed to end conversation. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleTabChange = async (event, newValue) => {
        setActiveConversationIndex(newValue);
        const selectedConversation = conversations[newValue];
        await conversationHandler.setActiveConversation(selectedConversation.id);
        const conv = await conversationHandler.getConversationById(selectedConversation.id);
        setActiveConversation(conv);
        updateAppStateBasedOnConversation(conv.state);
    };

    const shouldShowSidebar = () => {
        return currentAppState !== AppState.AUDIT && currentAppState !== AppState.SURVEY;
    };

    const handleCloseErrorDialog = () => {
        setShowAPIErrorDialog(false);
    };

    const handleCloseTimerChatTimeUpDialog = () => {
        setShowTimerChatTimeUpDialog(false);
        handleEndChat();
    };

    return (
        <div className="flex h-screen">
            {currentAppState === AppState.SURVEY && (
                <SurveyPage
                    debugMode={debugMode}
                    isViewOnly={isViewOnly}
                    setCurrentAppState={setCurrentAppState}
                    setSurveyQuestions={setSurveyQuestions}
                    error={error}
                    setError={setError}
                    showAPIErrorDialog={showAPIErrorDialog}
                    handleCloseErrorDialog={handleCloseErrorDialog}
                />
            )}

            {(currentAppState !== AppState.SURVEY || isViewOnly) && (
                <>
                    {!isViewOnly && currentAppState === AppState.CHAT && showTimerChatTimeUpDialog && (
                        <ChatPage
                            {...{
                                isViewOnly,
                                isLoading,
                                currentAppState,
                                showTimerChatTimeUpDialog,
                                handleCloseTimerChatTimeUpDialog
                            }} />
                    )}

                    {shouldShowSidebar() && (
                        <div
                            className={cn(
                                styles['sidebar'],
                                'flex w-[300px] shrink-0 flex-col border-r bg-gradient-to-b from-card to-background',
                            )}
                        >
                            <Typography variant="h6" gutterBottom align="center" className="tracking-tight">
                                AI Chatbot
                            </Typography>
                            <div className="flex min-h-[200px] flex-col gap-1.5">
                                <div className="px-3.5 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                                    Your recent conversations
                                </div>
                                {conversations.map((conversation, index) => {
                                    const active = activeConversationIndex === index;
                                    return (
                                        <button
                                            key={conversation.id}
                                            onClick={() => handleTabChange(null, index)}
                                            className={cn(
                                                'rounded-[10px] px-3.5 py-2.5 text-left text-sm transition-colors',
                                                active
                                                    ? 'bg-primary/12 font-bold text-primary shadow-[inset_3px_0_0_hsl(var(--primary))]'
                                                    : 'font-medium text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
                                            )}
                                        >
                                            {`Conversation ${index + 1}`}
                                        </button>
                                    );
                                })}
                            </div>
                            {!isViewOnly && (
                                <div className="mt-auto rounded-xl border bg-card p-3.5">
                                    {timerSystem !== null && (
                                        <div tutorial-step="timer-time-limit">
                                            {timerSystem.state.currentChatIndex <= 1 ? (
                                                <>
                                                    <Typography variant="body1" className="mt-2">
                                                        {hasTimeLimit(timerState.currentChatTimeRemaining)
                                                            ? `Time remaining: ${formatTimeRemaining(timerState.currentChatTimeRemaining)}`
                                                            : 'No time limit'}
                                                    </Typography>
                                                    {hasTimeLimit(timerState.currentChatTimeRemaining) && (
                                                        <Tooltip title={`${Math.ceil(timerSystem.state.currentChatTimeRemaining / 1000 / 60)} minute(s) remaining`}>
                                                            <Progress value={timerState.percentageChatTimeRemaining} className="mt-1 h-2" />
                                                        </Tooltip>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <Typography variant="body1" className="mt-2">
                                                        {hasTimeLimit(timerState.overallTimeRemaining)
                                                            ? `Time remaining: ${formatTimeRemaining(timerState.overallTimeRemaining)}`
                                                            : 'No time limit'}
                                                    </Typography>
                                                    {hasTimeLimit(timerState.overallTimeRemaining) && (
                                                        <Tooltip title={`${Math.ceil(timerSystem.state.overallTimeRemaining / 1000 / 60)} minute(s) remaining`}>
                                                            <Progress value={timerState.percentageChatTimeRemaining} className="mt-1 h-2" />
                                                        </Tooltip>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                    <Button
                                        tutorial-step="end-chat-start-reporting-button"
                                        className="mt-4 mb-1 w-full py-2.5 leading-snug"
                                        onClick={handleEndChat}
                                        disabled={isLoading || currentAppState !== AppState.CHAT}
                                    >
                                        End Conversation &amp; Start Reporting
                                    </Button>
                                    <Typography variant="body2" className={styles['sidebar-guide-text']}>
                                        On average, people need 7 prompts in a conversation to review and make an assessment.
                                    </Typography>
                                </div>
                            )}
                        </div>
                    )}

                    <div
                        className="flex grow flex-col h-screen overflow-hidden"
                        style={{ width: shouldShowSidebar() ? 'calc(100% - 300px)' : '100%' }}
                    >
                        <div className="flex grow flex-col overflow-hidden">
                            {/* there may be some issues with bringing this part over. i'll observe any issues later.
                             Something like routing may solve this issue. */}
                            {activeConversation && currentAppState === AppState.CHAT && (
                                <ChatBox
                                    conversation={activeConversation}
                                    isActive={activeConversation.state === STATE.CHAT}
                                    setLoading={setIsLoading}
                                    onTutorialComplete={handleTutorialComplete}
                                    onTutorialStart={() => {
                                        if (!timerSystem.state.isPaused) {
                                            timerSystem.pause();
                                        }
                                    }}
                                    onTutorialEnd={() => {
                                        if (timerSystem.state.isPaused) {
                                            console.log("Resuming timer system tutorial...");
                                            timerSystem.resume();
                                        }
                                    }}
                                />
                            )}
                            {currentAppState === AppState.AUDIT && (
                                <AuditPage {...{
                                    activeConversation,
                                    setIsLoading,
                                    handleTutorialComplete,
                                    surveyQuestions,
                                    conversations,
                                    setConversations,
                                    setActiveConversation,
                                    setActiveConversationIndex,
                                    updateAppStateBasedOnConversation,
                                    setError
                                }} />
                            )}
                            {currentAppState === AppState.COMPLETE && (
                                <>
                                    <CompletePage
                                        {...{
                                            isViewOnly,
                                            activeConversation,
                                            surveyQuestions,
                                            conversations,
                                            timerSystem,
                                            STATE,
                                            startNextConversation,
                                            expectedConversations: config?.conversationsPerAuditor ?? null
                                        }} />
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default App;
export {AppState};
