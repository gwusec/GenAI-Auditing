import ChatLayout from "../layouts/ChatLayout";
import React, { useState } from "react";
import conversationHandler from "../tools/ConversationHandler";
import { CHAT_EVENT_TYPE, ChatEvent, STATE } from "../tools/models";
import { AppState } from "../App";

function ChatPage(
    {
        isViewOnly = false,
        activeConversation,
        setActiveConversation,
        setIsLoading,
        timerSystem,
        setCurrentAppState,
        setError,
        isLoading,
        currentAppState
    }
) {
    const [showTimerChatTimeUpDialog, setShowTimerChatTimeUpDialog] = useState(false);
    const handleCloseTimerChatTimeUpDialog = () => {
        setShowTimerChatTimeUpDialog(false);
        handleEndChat();
    };

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

    return (
        <ChatLayout {...{
            isViewOnly,
            isLoading,
            currentAppState,
            showTimerChatTimeUpDialog,
            handleCloseTimerChatTimeUpDialog,
        }} />
    )
}

export default ChatPage;