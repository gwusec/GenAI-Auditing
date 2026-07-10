import React from "react";
import ExportManager from "./ExportManager";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Typography, Stack } from "./ui/layout";

function ChatDialog({ open, onClose, showNewChat = true, showExportManager = true }) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="sm:max-w-lg"
        aria-labelledby="error-dialog-title"
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle id="error-dialog-title">Thank You!</DialogTitle>
        </DialogHeader>
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
        <DialogFooter>
          <Stack spacing={2} direction="column" className="w-full">
            {showNewChat && (
              <Button onClick={onClose} autoFocus>
                Start New Chat & Audit
              </Button>
            )}
            {showExportManager && <ExportManager />}
          </Stack>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ChatDialog;
