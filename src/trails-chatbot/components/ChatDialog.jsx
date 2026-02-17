import React from "react";
import ExportManager from "./ExportManager";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Stack
} from "@mui/material";

function ChatDialog({ open, onClose, showNewChat = true, showExportManager = true }) {
  return (
    <Dialog open={open} aria-labelledby="error-dialog-title" maxWidth="sm" fullWidth
      disableEscapeKeyDown   // Prevent closing dialog with ESC key
      onClose={(event, reason) => {
        if (reason !== "backdropClick") {
          onClose(event); // Only call onClose if it's not a backdrop click
        }
      }}>
      <DialogTitle id="error-dialog-title">Thank You!</DialogTitle>
      <DialogContent>
        {showNewChat && showExportManager ? (
          <Typography variant="body1" color="textSecondary">
            You have enough time left to start another conversation. Would you like to
            start one?
          </Typography>
        ) : showNewChat ? (
          <Typography variant="body1" color="textSecondary">
            Please start the second conversation.
          </Typography>
        ) : showExportManager ? (
          <Typography variant="body1" color="textSecondary">
            Please continue with the survey.
          </Typography>
        ) : (
          <Typography variant="body1" color="textSecondary">
            Please start the first conversation.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Stack spacing={2} direction="column" width="100%">
          {showNewChat && (
            <Button onClick={onClose} color="primary" variant="contained" autoFocus>
              Start New Chat & Audit
            </Button>
          )}
          {showExportManager && <ExportManager />}
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

export default ChatDialog;