import ChatDialog from "../components/ChatDialog";
import ConversationHistory from "../components/ConversationHistory";
import React from "react";

function Complete(
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
        <>
            {!isViewOnly && activeConversation && (
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
    )
}

export default Complete;