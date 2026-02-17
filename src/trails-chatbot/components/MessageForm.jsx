// TRAILS-Chatbot/src/components/MessageForm.jsx  
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import styles from "./MessageForm.module.css";

const MessageForm = ({ onsendChatMessage, onFocus, onBlur, disabled }) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef(null);
  const [isTextareaActive, setIsTextareaActive] = useState(false);
  const [toastPosition, setToastPosition] = useState({ top: 0, left: 0 });
  const theme = useTheme();

  const handleSubmit = useCallback((e) => {
    if (textareaRef.current) {
      textareaRef.current.style = styles.textarea;
    }
    e.preventDefault();
    if (!message.trim() || disabled) return;

    onsendChatMessage(message.trim());
    setMessage('');
  }, [message, disabled, onsendChatMessage]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled) {
        handleSubmit(e);
      }
    }
  }, [handleSubmit, disabled]);

  const handleChange = (e) => {
    setMessage(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  useEffect(() => {
    if (isTextareaActive && textareaRef.current) {
      const { top, left } = textareaRef.current.getBoundingClientRect();
      setToastPosition({
        top: top + window.scrollY,
        left: left + window.scrollX - 200,
      });
    }
  }, [isTextareaActive]);

  return (
    <>
      <Box component="form" onSubmit={handleSubmit} display="flex" alignItems="flex-end" gap={2}>
        <div className={styles.container}>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsTextareaActive(true)}
            onBlur={() => setIsTextareaActive(false)}
            placeholder="Type a message... (Press Enter to send, Shift+Enter for new line)"
            className={styles.textarea}
          />
          {isTextareaActive && (
            <div>
              <div
                className={styles.toast}
                style={{
                  backgroundColor: theme.palette.info.main,
                  position: 'absolute',
                  top: `${toastPosition.top - 25}px`,
                  left: `${toastPosition.left}px`,
                }}
              >
                <Typography variant="inherit">
                  <b>Do not include personal information.</b>
                </Typography>
              </div>
              <div
                className={styles.toast}
                style={{
                  backgroundColor: theme.palette.info.main,
                  position: 'absolute',
                  top: `${toastPosition.top + 60}px`,
                  left: `${toastPosition.left}px`,
                }}
              >
                <Typography variant="inherit">
                  <b>Your conversation will be stored and used for research purposes.</b>
                </Typography>
              </div>
            </div>
          )}
        </div>
        <IconButton
          type="submit"
          disabled={!message.trim() || disabled}
          sx={{
            backgroundColor: 'primary.main',
            color: 'white',
            '&:hover': {
              backgroundColor: 'primary.dark',
            },
            '&:disabled': {
              backgroundColor: 'action.disabledBackground',
              color: 'action.disabled',
            },
          }}
        >
          <SendIcon fontSize="small" />
        </IconButton>
      </Box>
      <Typography variant="caption" className={styles["disclaimer-text"]}>
        Note: The AI chatbot may say sensitive things based on your interactions with it.
      </Typography>
    </>
  );
};

export default MessageForm;
