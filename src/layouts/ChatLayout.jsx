import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
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
                <Dialog
                    open={true}
                    disableEscapeKeyDown
                    onClose={(event, reason) => {
                        if (reason !== 'backdropClick') {
                            handleCloseTimerChatTimeUpDialog(event);
                        }
                    }}
                    aria-labelledby="timer-chat-time-up-dialog"
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle id="timer-chat-time-up-dialog-title">
                        You have reached the time limit in this conversation
                    </DialogTitle>
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
                                padding: '20px',
                                marginTop: '15vh',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                borderRadius: '4px',
                                height: '10vh',
                                marginBottom: '1vh',
                            }}
                        >
                            End Conversation & Start Reporting
                        </Button>
                    </DialogActions>
                </Dialog>
            )}
        </>
    )
}

export default ChatLayout;