import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";

function ErrorDialog({ open, onClose, title = "Error", message = "An unexpected error occurred." }) {
  return (
    <Dialog open={open} onClose={onClose} aria-labelledby="error-dialog-title" maxWidth="sm" fullWidth>
      <DialogTitle id="error-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body1" color="textSecondary">
          {message}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" variant="contained" autoFocus>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ErrorDialog;