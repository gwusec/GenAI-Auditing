// app.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from './tools/APIClient';
import { ChatEvent, CHAT_EVENT_TYPE, STATE } from './tools/models';
import conversationHandler from './tools/ConversationHandler';
import ChatBox from "./components/ChatBox";
import AuditForm from './components/AuditForm';
import SummaryPage from './components/SummaryPage';
import ErrorDialog from "./components/ErrorDialog";
import AppConfig from "./tools/AppConfig";
import Debugger from './components/Debugger';
import ChatTimerSystem from './tools/ChatTimerSystem';

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
  LinearProgress
} from '@mui/material';
import styles from './App.module.css';

const AppState = {
  CHAT: 'chat',
  AUDIT: 'audit',
  COMPLETE: 'complete',
};

// Add timer times as object here. 
function App({ llmProxyServerUrl, isViewOnly = false, viewOnlyData, config = {}, userId, debugMode = false, initialSurvey }) {

  const [currentAppState, setCurrentAppState] = useState(AppState.CHAT);
  const [conversations, setConversations] = useState([]);
  const [activeConversationIndex, setActiveConversationIndex] = useState(0);
  const [activeConversation, setActiveConversation] = useState(null);

  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [showAPIErrorDialog, setShowAPIErrorDialog] = useState(false);
  const [showAfterChatOneDialog, setShowAfterChatOneDialog] = useState(false);
  const [showAfterChatTwoDialogNoTime, setShowAfterChatTwoDialogNoTime] = useState(false);
  const [showAfterChatTwoDialogWithTime, setShowAfterChatTwoDialogWithTime] = useState(false);
  const [showTimerChatTimeUpDialog, setShowTimerChatTimeUpDialog] = useState(false);
  const [showOverallTimeUpDialog, setShowOverallTimeUpDialog] = useState(false);

  // Steps for the Stepper
  const steps = ["Conversation", "Reporting"];
  const activeStep = currentAppState === AppState.CHAT ? 0 : 1;

  /** ########## Timer ########### */

  const timerSystem = useMemo(() => new ChatTimerSystem(config), [config]);
  const [timerState, setTimerState] = useState({
    percentageChatTimeRemaining: 100,
    overallTimeRemaining: timerSystem.state.overallTimeRemaining,
    currentChatTimeRemaining: timerSystem.state.currentChatTimeRemaining
  });

  useEffect(() => {
    const handleTick = ({ percentageChatTimeRemaining, overallTimeRemaining, currentChatTimeRemaining }) => {
      setTimerState({ percentageChatTimeRemaining, overallTimeRemaining, currentChatTimeRemaining });
    };

    const handleWarning = () => {
      console.log("useTimer received warning event. Nothing happens here.");
    };

    const handlePhaseExpired = () => {
      console.log("Phase Chat has expired.");
      if (!timerSystem.state.isPaused) timerSystem.pause();
      setShowTimerChatTimeUpDialog(true);
    };

    const handleOverallExpired = () => {
      console.log("Overall Chat has expired.");
      if (!timerSystem.state.isPaused) timerSystem.pause();
      setShowOverallTimeUpDialog(true);
    };

    timerSystem.on('onTick', handleTick);
    timerSystem.on('onWarning', handleWarning);
    timerSystem.on('onExpired', handlePhaseExpired);
    timerSystem.on('onOverallExpired', handleOverallExpired);

    return () => {
      timerSystem.off('onTick', handleTick);
      timerSystem.off('onWarning', handleWarning);
      timerSystem.off('onExpired', handlePhaseExpired);
      timerSystem.off('onOverallExpired', handleOverallExpired);
    };
  }, []);




  // Initialize the singleton config and additional settings
  useEffect(() => {
    AppConfig.initialize({ llmProxyServerUrl, isViewOnly, config, userId });
    const baseUrl = typeof llmProxyServerUrl === 'string' ? llmProxyServerUrl.trim() : '';
    apiClient.getInstance(baseUrl);
  }, [llmProxyServerUrl, isViewOnly, config, userId]);

  const startNextConversation = async () => {
    try {
      const newConversation = await conversationHandler.createNewConversation(userId);
      setConversations(prev => [...prev, newConversation]);
      setActiveConversation(newConversation);
      setActiveConversationIndex(conversations.length);
      await conversationHandler.setActiveConversation(newConversation.id);
      // Set the current app state based on the active conversation's state
      updateAppStateBasedOnConversation(newConversation.state);

      // Start the timer
      if (!timerSystem.state.hasStarted) {
        timerSystem.cleanup();
        timerSystem.start();
      }
      timerSystem.startNewChat();
    } catch (error) {
      console.error("Error starting new conversation:", error);
      setError("Failed to start a new conversation. Please try again.");
    }
  }

  // Initialize the app
  useEffect(() => {
    const initializeApp = async () => {
      console.log("Initializing TRAILS-Chatbot...");
      try {

        // Initialize conversationHandler with apiClient
        conversationHandler.initialize(apiClient);

        if (isViewOnly && viewOnlyData) {
          // Load existing conversations from viewOnlyData
          await conversationHandler.deleteAllConversations();
          await conversationHandler.importExportedConversations(viewOnlyData);
        }
        // Load existing conversations or create a new one if none exist
        let existingConversations = await conversationHandler.getExistingConversations(userId);
        console.log("Existing conversations:", existingConversations);

        if (existingConversations.length === 0) {
          // Create a new conversation if none exists
          await startNextConversation();
        } else {
          // Use the first existing conversation (CHANGE: use last one)
          await conversationHandler.setActiveConversation(existingConversations[existingConversations.length - 1].id);
          console.log("Using existing conversation:", existingConversations[existingConversations.length - 1]);
          setConversations(existingConversations);
          setActiveConversation(existingConversations[existingConversations.length - 1]);
          setActiveConversationIndex(existingConversations.length - 1);
          updateAppStateBasedOnConversation(existingConversations[existingConversations.length - 1].state);
        }
        // Set the current app state based on the active conversation's state
        // if (timerSystem?.state?.currentChatTimeRemaining == 0) {
        //   console.log("Chat has expired - no time remaining.");
        //   setShowTimerChatTimeUpDialog(timerSystem.state.currentChatTimeRemaining == 0);
        // }
      } catch (error) {
        console.error("Error initializing app:", error);
        setError("Failed to initialize the application. Please try again later.");
      }
    };
    console.log("Initializing app...");
    initializeApp();
  }, [userId]);

  // State update listener
  useEffect(() => {
    const handleAPIError = () => {
      setShowAPIErrorDialog(true);
    }
    conversationHandler.registerOnError(handleAPIError);
    return () => {
      conversationHandler.unregisterOnError(handleAPIError);
    };
  }, []);

  useEffect(() => {
    if (conversations.length === 1 &&
      conversations[0].state === STATE.COMPLETE) {
      setShowAfterChatOneDialog(true)
    } else if (conversations.length == 2 &&
      conversations[0].state === STATE.COMPLETE &&
      conversations[1].state === STATE.COMPLETE &&
      timerSystem.canStartNewChat()) {
      setShowAfterChatTwoDialogWithTime(true);
    } else if (conversations.length == 2 &&
      conversations[0].state === STATE.COMPLETE &&
      conversations[1].state === STATE.COMPLETE &&
      !timerSystem.canStartNewChat()) {
      setShowAfterChatTwoDialogNoTime(true);
      setShowAfterChatTwoDialogWithTime(false);
      setShowAfterChatOneDialog(false);
    } else if (conversations.length > 2 &&
      conversations[0].state === STATE.COMPLETE &&
      conversations[1].state === STATE.COMPLETE &&
      conversations[conversations.length - 1].state === STATE.COMPLETE &&
      timerSystem.canStartNewChat()) {
      setShowAfterChatTwoDialogNoTime(false);
      setShowAfterChatTwoDialogWithTime(true);
      setShowAfterChatOneDialog(false);
    } else if (conversations.length > 2 &&
      conversations[0].state === STATE.COMPLETE &&
      conversations[1].state === STATE.COMPLETE &&
      conversations[conversations.length - 1].state === STATE.COMPLETE &&
      !timerSystem.canStartNewChat()) {
      setShowAfterChatTwoDialogNoTime(true);
      setShowAfterChatTwoDialogWithTime(false);
      setShowAfterChatOneDialog(false);
    }
  }, [conversations]);

  // Update the app state based on the conversation's state
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
    }
    else {
      console.warn("Unknown conversation state:", conversationState);
    }
  }, []);

  // State update listener
  useEffect(() => {
    // Subscribe to state updates from conversationHandler
    const handleStateUpdate = async (newState) => {
      try {
        console.log("Conversation state updating:", newState);
        const updatedConversation = await conversationHandler.getActiveConversation();
        setActiveConversation(updatedConversation);
        setConversations(prev => prev.map(c => c.id === updatedConversation.id ? updatedConversation : c));
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

  // Callback for tutorial completion. To do: check if timer excludes tutorial time
  const handleTutorialComplete = useCallback(() => {
    if (currentAppState === AppState.CHAT) {
      if (timerSystem.state.isPaused) {
        console.log("Resuming timer during tutorial completion...");
        timerSystem.resume();
      }
    }
  }, [timerSystem, currentAppState]);

  // Pause the timer when the app state changes
  useEffect(() => {
    if (currentAppState === AppState.AUDIT || currentAppState === AppState.COMPLETE || showTimerChatTimeUpDialog || showOverallTimeUpDialog || showAPIErrorDialog) {
      console.log("Pausing timer during state transition...");
      if (!timerSystem.state.isPaused) {
        timerSystem.pause();
      }
    } else {
    }
  }, [currentAppState, timerSystem, showTimerChatTimeUpDialog, showOverallTimeUpDialog, showAPIErrorDialog]);

  const handleEndChat = async () => {
    console.log("Ending chat...");
    if (!activeConversation) {
      console.error("No active conversation found in handleEndChat");
      if (!activeConversation) {
        console.warn("No active conversation found. Attempting recovery.");
        const active = await conversationHandler.getActiveConversation();
        if (!active) {
          console.error("Failed to recover active conversation.");
          return; // Exit early if no conversation is found
        }
        setActiveConversation(active);
      }
    }
    try {
      setIsLoading(true);
      console.log("Ending chat for conversation:", activeConversation.id);
      const endChatEvent = new ChatEvent(CHAT_EVENT_TYPE.END_CHAT, null);
      await conversationHandler.addChatEvent(activeConversation.id, endChatEvent);
      timerSystem.stopPhaseTimer();
      const updatedConversation = await conversationHandler.getConversationById(activeConversation.id);
      console.log("Updated conversation state:", updatedConversation.state);
      // Check if state is ANY, not just LIKERT
      if ([STATE.AUDIT_LIKERTRESPONSE, STATE.AUDIT_HIGHLIGHT, STATE.AUDIT_TEXTRESPONSE, STATE.COMPLETE].includes(updatedConversation.state)) {
        console.log("Transitioning to AUDIT");
        setCurrentAppState(AppState.AUDIT);
      } else {
        console.warn("Conversation state did not update to AUDIT as expected", updatedConversation.state);
        // Force transition to AUDIT if we just ended chat as a fallback
        setCurrentAppState(AppState.AUDIT);
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
      console.log("Existing conversations:", existingConversations);
      // Use the first existing conversation
      await conversationHandler.setActiveConversation(existingConversations[existingConversations.length - 1].id);
      console.log("Using existing conversation:", existingConversations[existingConversations.length - 1]);
      setConversations(existingConversations);
      setActiveConversation(existingConversations[existingConversations.length - 1]);
      setActiveConversationIndex(existingConversations.length - 1);
      updateAppStateBasedOnConversation(existingConversations[existingConversations.length - 1].state);
    } catch (error) {
      console.error("Error handling audit completion:", error);
      setError("Failed to complete audit. Please try again.");
    }
  };

  // Handle tab change. To do: Show conversation history with message form disabled if the conversation is finished.
  const handleTabChange = async (event, newValue) => {
    setActiveConversationIndex(newValue);
    const selectedConversation = conversations[newValue];
    await conversationHandler.setActiveConversation(selectedConversation.id);
    const conv = await conversationHandler.getConversationById(selectedConversation.id);
    setActiveConversation(conv);
    // Update the app state based on the selected conversation's state
    updateAppStateBasedOnConversation(conv.state);
  };

  // Check if the sidebar should be shown
  const shouldShowSidebar = () => {
    return currentAppState !== AppState.AUDIT;
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

  const formatTime = (ms) => {
    if (ms <= 0) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
      {debugMode && (
        <Debugger />
      )}
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

      {!isViewOnly && currentAppState === AppState.CHAT && showTimerChatTimeUpDialog && (
        <Dialog
          open={true}
          disableEscapeKeyDown   // Prevent closing dialog with ESC key
          onClose={(event, reason) => {
            if (reason !== "backdropClick") {
              handleCloseTimerChatTimeUpDialog(event); // Only call onClose if it's not a backdrop click
            }
          }}
          aria-labelledby="timer-chat-time-up-dialog" maxWidth="sm" fullWidth>
          <DialogTitle id="timer-chat-time-up-dialog-title">You have reached the time limit in this conversation</DialogTitle>
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
                padding: "20px",
                marginTop: "15vh",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                borderRadius: "4px",
                height: "10vh",
                marginBottom: "1vh",
              }}
            >
              End Conversation & Start Reporting
            </Button>

          </DialogActions>
        </Dialog>
      )}

      {!isViewOnly && currentAppState === AppState.CHAT && showOverallTimeUpDialog && (
        <Dialog
          open={true}
          disableEscapeKeyDown
          onClose={(event, reason) => {
            if (reason !== "backdropClick") {
              setShowOverallTimeUpDialog(false);
              handleEndChat();
            }
          }}
          aria-labelledby="overall-time-up-dialog" maxWidth="sm" fullWidth>
          <DialogTitle id="overall-time-up-dialog-title">You have reached the overall time limit for this study</DialogTitle>
          <DialogContent>
            <Typography variant="body1" color="textSecondary">
              Your overall time has expired. Please end the current conversation and process your data.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                setShowOverallTimeUpDialog(false);
                handleEndChat();
              }}
              sx={{
                mt: 2,
                padding: "20px",
                marginTop: "15vh",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                borderRadius: "4px",
                height: "10vh",
                marginBottom: "1vh",
              }}
            >
              End Conversation & Export Data
            </Button>
          </DialogActions>
        </Dialog>
      )}


      {shouldShowSidebar() && (
        <Box
          className={styles["sidebar"]}
          sx={{ width: "300px", flexShrink: 0 }}
        >
          <Typography variant="h6" gutterBottom align="center">
            AI Chatbot
          </Typography>
          <Tabs
            orientation="vertical"
            variant="scrollable"
            value={activeConversationIndex}
            onChange={handleTabChange}
            sx={{ borderRight: 1, borderColor: "divider", minHeight: "200px" }}
          >
            <Tab
              label='Your recent conversations'
              value='recent-header'
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
                  '&:hover': {
                    backgroundColor: '#b2ebf2',
                  },
                }}
              />
            ))}
          </Tabs>

          {!isViewOnly && (
            <>

              <Box
                sx={{ mt: 12, backgroundColor: "#e0f7fa", padding: "10px" }}>

                {/* Progress Bar for remaining time */}
                {timerSystem !== null && (
                  <Box tutorial-step='timer-time-limit'>
                    {timerSystem.state.currentChatIndex <= 1 ?
                      <>
                        <Typography variant="body1" sx={{ mt: 1 }}>
                          Phase Time remaining: {formatTime(timerState.currentChatTimeRemaining)}
                        </Typography>
                        <Tooltip
                          title={`${Math.ceil(timerSystem.state.currentChatTimeRemaining / 1000 / 60)} minute(s) remaining`}
                        >
                          <LinearProgress
                            variant="determinate"
                            value={timerState.percentageChatTimeRemaining}
                            sx={{ width: '100%', height: 15 }}
                          />
                        </Tooltip>
                      </> :
                      <>
                        <Typography variant="body1" sx={{ mt: 1 }}>
                          Overall Time remaining: {formatTime(timerState.overallTimeRemaining)}
                        </Typography>
                        <Tooltip
                          title={`${Math.ceil(timerSystem.state.overallTimeRemaining / 1000 / 60)} minute(s) remaining`}
                        >
                          <LinearProgress
                            variant="determinate"
                            value={timerState.percentageChatTimeRemaining}
                            sx={{ width: '100%', height: 15 }}
                          />
                        </Tooltip>
                      </>
                    }
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
                    padding: "20px",
                    marginTop: "20px",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    borderRadius: "4px",
                    height: "10vh",
                    marginBottom: "1vh",
                  }}
                >
                  End Conversation & Start Reporting
                </Button>
                <Typography
                  variant="body2"
                  className={styles["sidebar-guide-text"]}
                >
                  On average, people need 7 prompts in a conversation to review and make an assessment.
                </Typography>
              </Box>
            </>
          )}
        </Box>
      )}

      <Box
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflow: "hidden",
          width: shouldShowSidebar() ? "calc(100% - 300px)" : "100%",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            overflow: "hidden",
          }}
        >
          {activeConversation && currentAppState === AppState.CHAT && (
            <ChatBox
              conversation={activeConversation}
              isActive={activeConversation.state === STATE.CHAT}
              setLoading={setIsLoading}
              onTutorialComplete={handleTutorialComplete}
              onTutorialStart={() => {
                if (!timerSystem.state.isPaused) { // Only pause if not already paused
                  timerSystem.pause();
                }
              }}
              onTutorialEnd={() => {
                if (timerSystem.state.isPaused) { // Only resume if currently paused
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
              surveyQuestions={initialSurvey}
            />
          )}
          {activeConversation && currentAppState === AppState.COMPLETE && (
            <>
              {/* !isViewOnly && (
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
              ) */}
              <SummaryPage
                conversation={activeConversation}
                initialSurvey={initialSurvey}
                startNextConversation={startNextConversation}
                showNewChat={showAfterChatOneDialog || showAfterChatTwoDialogWithTime}
                showExportManager={showAfterChatTwoDialogNoTime || showAfterChatTwoDialogWithTime}
                overallTimeRemaining={timerState.overallTimeRemaining}
                formatTime={formatTime}
              />
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default App;