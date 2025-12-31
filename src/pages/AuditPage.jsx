import AuditLayout from "../layouts/AuditLayout";
import conversationHandler from './tools/ConversationHandler';
import { useCallback } from "react";
import React from "react";

function AuditPage(
    { // take these from App.jsx
        // handleTutorialComplete,
        surveyQuestions,
        conversations,
        setConversations,
        setActiveConversation,
        setActiveConversationIndex,
        updateAppStateBasedOnConversation,
        setError,
        activeConversation,
        setIsLoading,
    }
) {
    const handleTutorialComplete = useCallback(() => {
            if (currentAppState === AppState.CHAT) {
                if (timerSystem.state.isPaused) {
                    console.log("Resuming timer during tutorial completion...");
                    timerSystem.resume();
                }
            }
        }, [timerSystem, currentAppState]);

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

    return (
        <AuditLayout {...{
            activeConversation,
            handleAuditComplete,
            setIsLoading,
            handleTutorialComplete,
            surveyQuestions
        }} />
    )
}

export default AuditPage;