import { Button } from "../components/ui/button";
import { Typography } from "../components/ui/layout";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { AppState } from "../App";

function ChatLayout({
    isViewOnly = false,
    isLoading,
    currentAppState,
    showTimerChatTimeUpDialog,
    handleCloseTimerChatTimeUpDialog,
}) {
    return (
        <>
            {!isViewOnly && showTimerChatTimeUpDialog && (
                <Dialog open={true}>
                    <DialogContent
                        className="sm:max-w-lg"
                        showCloseButton={false}
                        aria-labelledby="timer-chat-time-up-dialog"
                        onEscapeKeyDown={(event) => event.preventDefault()}
                        onInteractOutside={(event) => event.preventDefault()}
                    >
                        <DialogHeader>
                            <DialogTitle id="timer-chat-time-up-dialog-title">
                                You have reached the time limit in this conversation
                            </DialogTitle>
                        </DialogHeader>
                        <Typography variant="body1" color="textSecondary">
                            Please end the current chat by clicking 'End Conversation & Start Reporting'.
                        </Typography>
                        <DialogFooter>
                            <Button
                                tutorial-step="end-chat-start-reporting-button"
                                onClick={handleCloseTimerChatTimeUpDialog}
                                disabled={isLoading || currentAppState !== AppState.CHAT}
                                className="mt-[15vh] mb-[1vh] flex h-[10vh] items-center justify-center rounded p-5"
                            >
                                End Conversation & Start Reporting
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </>
    )
}

export default ChatLayout;
