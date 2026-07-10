// TRAILS-Chatbot/src/components/MessageForm.jsx  
import React, { useState, useCallback, useRef } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import styles from "./MessageForm.module.css";

const MessageForm = ({ onsendChatMessage, onFocus, onBlur, disabled }) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef(null);
  const [isTextareaActive, setIsTextareaActive] = useState(false);

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

  return (
    <>
      <Box sx={{ position: 'relative' }}>
        {/* Safety notices — anchored just above the input (float upward on focus,
            so they never overlap the sidebar and cause no layout shift). */}
        {isTextareaActive && (
          <Box
            sx={{
              position: 'absolute', bottom: 'calc(100% + 8px)', left: 4, right: 4,
              display: 'flex', flexWrap: 'wrap', gap: 1, zIndex: 5, pointerEvents: 'none',
            }}
          >
            <span className={styles.notice}>Do not include personal information</span>
            <span className={styles.notice}>Your conversation is stored and used for research</span>
          </Box>
        )}
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
      </Box>
      <Typography variant="caption" className={styles["disclaimer-text"]}>
        Note: The AI chatbot may say sensitive things based on your interactions with it.
      </Typography>
    </>
  );
};

export default MessageForm;
