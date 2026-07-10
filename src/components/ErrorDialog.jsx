import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Typography } from "./ui/layout";

function ErrorDialog({ open, onClose, title = "Error", message = "An unexpected error occurred." }) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg" aria-labelledby="error-dialog-title">
        <DialogHeader>
          <DialogTitle id="error-dialog-title">{title}</DialogTitle>
        </DialogHeader>
        <Typography variant="body1" color="textSecondary">
          {message}
        </Typography>
        <DialogFooter>
          <Button onClick={onClose} autoFocus>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ErrorDialog;
