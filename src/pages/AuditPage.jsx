import AuditLayout from "../layouts/AuditLayout";
import conversationHandler from "../tools/ConversationHandler";
import React from "react";

function AuditPage(
    {
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
    }
) {
    const handleAuditComplete = async () => {
        try {
            const exportData = await conversationHandler.exportConversations(conversations);
            console.log('Completed Conversation Export Data:', exportData);
            const existingConversations = await conversationHandler.getExistingConversations();
            const latestConversation = existingConversations[existingConversations.length - 1];

            await conversationHandler.setActiveConversation(latestConversation.id);
            setConversations(existingConversations);
            setActiveConversation(latestConversation);
            setActiveConversationIndex(existingConversations.length - 1);
            updateAppStateBasedOnConversation(latestConversation.state);
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
