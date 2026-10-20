import CompleteLayout from "../layouts/CompleteLayout";
import React, { useEffect, useState } from "react";

export function configuredStudyCompletion(conversations, completeState, expectedConversations) {
    if (!Number.isInteger(expectedConversations) || expectedConversations < 1) return null;
    const completedCount = conversations.filter((c) => c.state === completeState).length;
    const latestIsComplete = conversations.length > 0 &&
        conversations[conversations.length - 1].state === completeState;
    if (!latestIsComplete) return null;
    return { needsAnother: completedCount < expectedConversations };
}

function CompletePage(
    {
        isViewOnly,
        activeConversation,
        surveyQuestions,
        conversations,
        timerSystem,
        STATE,
        startNextConversation,
        expectedConversations = null,
    }
) {
    const [showAfterChatOneDialog, setShowAfterChatOneDialog] = useState(false);
    const [showAfterChatTwoDialogNoTime, setShowAfterChatTwoDialogNoTime] = useState(false);
    const [showAfterChatTwoDialogWithTime, setShowAfterChatTwoDialogWithTime] = useState(false);

    const handleCloseChatTwoDialogNoTime = () => {
        setShowAfterChatTwoDialogNoTime(false);
    };

    const handleCloseChatOneDialog = () => {
        setShowAfterChatOneDialog(false);
        startNextConversation();
    };

    const handleCloseChatTwoDialogWithTime = () => {
        setShowAfterChatTwoDialogWithTime(false);
        startNextConversation();
    };

    useEffect(() => {
        const configured = configuredStudyCompletion(
            conversations,
            STATE.COMPLETE,
            expectedConversations,
        );

        // Study sessions are intentionally fixed at N conversations. The legacy
        // standalone flow below may still offer extra chats while time remains.
        if (configured) {
            setShowAfterChatOneDialog(configured.needsAnother);
            setShowAfterChatTwoDialogWithTime(false);
            setShowAfterChatTwoDialogNoTime(!configured.needsAnother);
            return;
        }

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
    }, [conversations, timerSystem, STATE, expectedConversations]);

    return (
        <CompleteLayout {...{
            isViewOnly,
            showAfterChatOneDialog,
            handleCloseChatOneDialog,
            showAfterChatTwoDialogNoTime,
            handleCloseChatTwoDialogNoTime,
            showAfterChatTwoDialogWithTime,
            handleCloseChatTwoDialogWithTime,
            activeConversation,
            surveyQuestions
        }} />
    )
}

export default CompletePage;
