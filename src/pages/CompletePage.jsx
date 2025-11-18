import CompleteLayout from "../layouts/CompleteLayout";
import React, { useState, useEffect } from "react";

function CompletePage(
    {
        isViewOnly,
        activeConversation,
        surveyQuestions,
        conversations,
        timerSystem,
        STATE,
        startNextConversation
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