import CompleteLayout from "../layouts/CompleteLayout";
import React from "react";

function CompletePage(
    {
        isViewOnly,
        showAfterChatOneDialog,
        handleCloseChatOneDialog,
        showAfterChatTwoDialogNoTime,
        handleCloseChatTwoDialogNoTime,
        showAfterChatTwoDialogWithTime,
        handleCloseChatTwoDialogWithTime,
        activeConversation,
        surveyQuestions
    }
) {
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