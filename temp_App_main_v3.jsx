// src/App.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from './tools/APIClient';
import { ChatEvent, CHAT_EVENT_TYPE, STATE } from './tools/models';
import conversationHandler from './tools/ConversationHandler';
import ChatBox from './components/ChatBox';
import AuditForm from './components/AuditForm';
import ConversationHistory from './components/ConversationHistory';
import ErrorDialog from './components/ErrorDialog';
import AppConfig from './tools/AppConfig';
import ChatDialog from './components/ChatDialog';
import Debugger from './components/Debugger';
import ChatTimerSystem from './tools/ChatTimerSystem';
import SurveyMaker from './components/SurveyMaker';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CssBaseline,
    Box,
    Button,
    Typography,
    Tabs,
    Tab,
    Alert,
    Tooltip,
    LinearProgress,
} from '@mui/material';
import styles from './App.module.css';

const AppState = {
    SURVEY: 'survey',
    CHAT: 'chat',
    AUDIT: 'audit',
    COMPLETE: 'complete',
};

function App({ llmProxyServerUrl, isViewOnly = false, viewOnlyData, config = {}, userId, debugMode = false }) {
    const [currentAppState, setCurrentAppState] = useState(AppState.SURVEY);
    const [conversations, setConversations] = useState([]);
    const [activeConversationIndex, setActiveConversationIndex] = useState(0);
    const [activeConversation, setActiveConversation] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [surveyQuestions, setSurveyQuestions] = useState(null);
    const [showAPIErrorDialog, setShowAPIErrorDialog] = useState(false);
    const [showAfterChatOneDialog, setShowAfterChatOneDialog] = useState(false);
    const [showAfterChatTwoDialogNoTime, setShowAfterChatTwoDialogNoTime] = useState(false);
    const [showAfterChatTwoDialogWithTime, setShowAfterChatTwoDialogWithTime] = useState(false);
    const [showTimerChatTimeUpDialog, setShowTimerChatTimeUpDialog] = useState(false);

    const steps = ["Survey Creation", "Conversation", "Reporting"];
    const activeStep = currentAppState === AppState.SURVEY ? 0 : currentAppState === AppState.CHAT ? 1 : 2;

    const timerSystem = useMemo(() => new ChatTimerSystem(config), [config]);
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
            const newConversation = await conversationHandler.createNewConversation();
            setConversations(prev => [...prev, newConversation]);
            setActiveConversation(newConversation);
            setActiveConversationIndex(conversations.length);
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

    useEffect(() => {
        if (conversations.length === 1 && conversations[0].state === STATE.COMPLETE) {
            setShowAfterChatOneDialog(true);
        } else if (
            conversations.length === 2 &&
            conversations[0].state === STATE.COMPLETE &&
            conversations[1].state === STATE.COMPLETE &&
            timerSystem.canStartNewChat()
        ) {
            setShowAfterChatTwoDialogWithTime(true);
        } else if (
            conversations.length === 2 &&
            conversations[0].state === STATE.COMPLETE &&
            conversations[1].state === STATE.COMPLETE &&
            !timerSystem.canStartNewChat()
        ) {
            setShowAfterChatTwoDialogNoTime(true);
            setShowAfterChatTwoDialogWithTime(false);
            setShowAfterChatOneDialog(false);
        } else if (
            conversations.length > 2 &&
            conversations[0].state === STATE.COMPLETE &&
            conversations[1].state === STATE.COMPLETE &&
            conversations[conversations.length - 1].state === STATE.COMPLETE &&
            timerSystem.canStartNewChat()
        ) {
            setShowAfterChatTwoDialogNoTime(false);
            setShowAfterChatTwoDialogWithTime(true);
            setShowAfterChatOneDialog(false);
        } else if (
            conversations.length > 2 &&
            conversations[0].state === STATE.COMPLETE &&
            conversations[1].state === STATE.COMPLETE &&
            conversations[conversations.length - 1].state === STATE.COMPLETE &&
            !timerSystem.canStartNewChat()
        ) {
            setShowAfterChatTwoDialogNoTime(true);
            setShowAfterChatTwoDialogWithTime(false);
            setShowAfterChatOneDialog(false);
        }
    }, [conversations, timerSystem]);

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

    const handleAuditComplete = async () => {
        try {
            const exportData = await conversationHandler.exportConversations(conversations);
            console.log('Completed Conversation Export Data:', exportData);
            let existingConversations = await conversationHandler.getExistingConversations();
            await conversationHandler.setActiveConversation(existingConversations[existingConversations.length - 1].id);
            setConversations(existingConversations);
            setActiveConversation(existingConversations[existingConversations.length - 1]);
            setActiveConversationIndex(existingConversations.length - 1);
            updateAppStateBasedOnConversation(existingConversations[existingConversations.length - 1].state);
        } catch (error) {
            console.error("Error handling audit completion:", error);
            setError("Failed to complete audit. Please try again.");
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

    const handleCloseChatOneDialog = () => {
        setShowAfterChatOneDialog(false);
        startNextConversation();
    };

    const handleCloseChatTwoDialogNoTime = () => {
        setShowAfterChatTwoDialogNoTime(false);
    };

    const handleCloseChatTwoDialogWithTime = () => {
        setShowAfterChatTwoDialogWithTime(false);
        startNextConversation();
    };

    const handleCloseTimerChatTimeUpDialog = () => {
        setShowTimerChatTimeUpDialog(false);
        handleEndChat();
    };

    const handleSurveySave = (survey) => {
        setSurveyQuestions(survey);
        setCurrentAppState(AppState.CHAT);
    };

    return (
        <Box sx={{ display: 'flex', height: '100vh' }}>
            {debugMode && currentAppState === AppState.SURVEY && <Debugger />}
            <CssBaseline />
            {error && (
                <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            <ErrorDialog
                open={showAPIErrorDialog}
                onClose={handleCloseErrorDialog}
                title="Your chat is too long!"
                message="You cannot continue your chat with the AI chatbot, because your conversation is getting too long. Please end the current conversation by clicking 'End Conversation & Start Reporting'."
            />

            {currentAppState === AppState.SURVEY && !isViewOnly && (
                <SurveyMaker onSurveySave={handleSurveySave} />
            )}

            {(currentAppState !== AppState.SURVEY || isViewOnly) && (
                <>
                    {!isViewOnly && currentAppState === AppState.CHAT && showTimerChatTimeUpDialog && (
                        <Dialog
                            open={true}
                            disableEscapeKeyDown
                            onClose={(event, reason) => {
                                if (reason !== 'backdropClick') {
                                    handleCloseTimerChatTimeUpDialog(event);
                                }
                            }}
                            aria-labelledby="timer-chat-time-up-dialog"
                            maxWidth="sm"
                            fullWidth
                        >
                            <DialogTitle id="timer-chat-time-up-dialog-title">
                                You have reached the time limit in this conversation
                            </DialogTitle>
                            <DialogContent>
                                <Typography variant="body1" color="textSecondary">
                                    Please end the current chat by clicking 'End Conversation & Start Reporting'.
                                </Typography>
                            </DialogContent>
                            <DialogActions>
                                <Button
                                    tutorial-step="end-chat-start-reporting-button"
                                    variant="contained"
                                    color="primary"
                                    onClick={handleCloseTimerChatTimeUpDialog}
                                    disabled={isLoading || currentAppState !== AppState.CHAT}
                                    sx={{
                                        mt: 2,
                                        padding: '20px',
                                        marginTop: '15vh',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        borderRadius: '4px',
                                        height: '10vh',
                                        marginBottom: '1vh',
                                    }}
                                >
                                    End Conversation & Start Reporting
                                </Button>
                            </DialogActions>
                        </Dialog>
                    )}

                    {shouldShowSidebar() && (
                        <Box className={styles['sidebar']} sx={{ width: '300px', flexShrink: 0 }}>
                            <Typography variant="h6" gutterBottom align="center">
                                AI Chatbot
                            </Typography>
                            <Tabs
                                orientation="vertical"
                                variant="scrollable"
                                value={activeConversationIndex}
                                onChange={handleTabChange}
                                sx={{ borderRight: 1, borderColor: 'divider', minHeight: '200px' }}
                            >
                                <Tab
                                    label="Your recent conversations"
                                    value="recent-header"
                                    disabled
                                    sx={{ fontWeight: 'bold' }}
                                />
                                {conversations.map((conversation, index) => (
                                    <Tab
                                        key={conversation.id}
                                        label={`Conversation ${index + 1}`}
                                        value={index}
                                        sx={{
                                            padding: '8px 16px',
                                            borderRadius: '16px',
                                            marginBottom: '8px',
                                            backgroundColor: activeConversationIndex === index ? '#e0f7fa' : '#f5f5f5',
                                            color: activeConversationIndex === index ? '#00796b' : '#555',
                                            fontWeight: activeConversationIndex === index ? 'bold' : 'normal',
                                            '&:hover': { backgroundColor: '#b2ebf2' },
                                        }}
                                    />
                                ))}
                            </Tabs>
                            {!isViewOnly && (
                                <Box sx={{ mt: 12, backgroundColor: '#e0f7fa', padding: '10px' }}>
                                    {timerSystem !== null && (
                                        <Box tutorial-step="timer-time-limit">
                                            {timerSystem.state.currentChatIndex <= 1 ? (
                                                <>
                                                    <Typography variant="body1" sx={{ mt: 1 }}>
                                                        Time remaining: {timerState.currentChatTimeRemaining / 1000 / 60 > 1
                                                            ? Math.ceil(timerState.currentChatTimeRemaining / 1000 / 60) + ' minutes'
                                                            : timerState.currentChatTimeRemaining / 1000 === 0
                                                                ? ' no time'
                                                                : ' less than 1 minute'}
                                                    </Typography>
                                                    <Tooltip title={`${Math.ceil(timerSystem.state.currentChatTimeRemaining / 1000 / 60)} minute(s) remaining`}>
                                                        <LinearProgress
                                                            variant="determinate"
                                                            value={timerState.percentageChatTimeRemaining}
                                                            sx={{ width: '100%', height: 15 }}
                                                        />
                                                    </Tooltip>
                                                </>
                                            ) : (
                                                <>
                                                    <Typography variant="body1" sx={{ mt: 1 }}>
                                                        Time remaining: {timerState.overallTimeRemaining / 1000 / 60 > 1
                                                            ? Math.ceil(timerState.overallTimeRemaining / 1000 / 60) + ' minutes'
                                                            : timerState.overallTimeRemaining / 1000 === 0
                                                                ? ' no time'
                                                                : ' less than 1 minute'}
                                                    </Typography>
                                                    <Tooltip title={`${Math.ceil(timerSystem.state.overallTimeRemaining / 1000 / 60)} minute(s) remaining`}>
                                                        <LinearProgress
                                                            variant="determinate"
                                                            value={timerState.percentageChatTimeRemaining}
                                                            sx={{ width: '100%', height: 15 }}
                                                        />
                                                    </Tooltip>
                                                </>
                                            )}
                                        </Box>
                                    )}
                                    <Button
                                        tutorial-step="end-chat-start-reporting-button"
                                        variant="contained"
                                        color="primary"
                                        onClick={handleEndChat}
                                        disabled={isLoading || currentAppState !== AppState.CHAT}
                                        sx={{
                                            mt: 2,
                                            padding: '20px',
                                            marginTop: '20px',
                                            display: 'flex',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            borderRadius: '4px',
                                            height: '10vh',
                                            marginBottom: '1vh',
                                        }}
                                    >
                                        End Conversation & Start Reporting
                                    </Button>
                                    <Typography variant="body2" className={styles['sidebar-guide-text']}>
                                        On average, people need 7 prompts in a conversation to review and make an assessment.
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    )}

                    <Box
                        sx={{
                            flexGrow: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            height: '100vh',
                            overflow: 'hidden',
                            width: shouldShowSidebar() ? 'calc(100% - 300px)' : '100%',
                        }}
                    >
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                flexGrow: 1,
                                overflow: 'hidden',
                            }}
                        >
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
                            {activeConversation && currentAppState === AppState.AUDIT && (
                                <AuditForm
                                    conversationId={activeConversation.id}
                                    onAuditComplete={handleAuditComplete}
                                    setLoading={setIsLoading}
                                    onTutorialComplete={handleTutorialComplete}
                                    surveyQuestions={surveyQuestions}
                                />
                            )}
                            {activeConversation && currentAppState === AppState.COMPLETE && (
                                <>
                                    {!isViewOnly && (
                                        <>
                                            <ChatDialog
                                                open={showAfterChatOneDialog}
                                                onClose={handleCloseChatOneDialog}
                                                showNewChat={true}
                                                showExportManager={false}
                                            />
                                            <ChatDialog
                                                open={showAfterChatTwoDialogNoTime}
                                                onClose={handleCloseChatTwoDialogNoTime}
                                                showNewChat={false}
                                                showExportManager={true}
                                            />
                                            <ChatDialog
                                                open={showAfterChatTwoDialogWithTime}
                                                onClose={handleCloseChatTwoDialogWithTime}
                                                showNewChat={true}
                                                showExportManager={true}
                                            />
                                        </>
                                    )}
                                    <ConversationHistory
                                        conversation={activeConversation}
                                        surveyQuestions={surveyQuestions}
                                    />
                                </>
                            )}
                        </Box>
                    </Box>
                </>
            )}
        </Box>
    );
}

export default App;
