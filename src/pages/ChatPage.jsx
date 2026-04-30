import ChatLayout from "../layouts/ChatLayout";
import React from "react";

function ChatPage(
    {
        isViewOnly = false,
        isLoading,
        currentAppState,
        showTimerChatTimeUpDialog,
        handleCloseTimerChatTimeUpDialog
    }
) {
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
