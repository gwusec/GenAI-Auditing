// TRAILS-Chatbot/src/components/MessageForm.jsx  
import React, { useState, useCallback, useRef } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import styles from "./MessageForm.module.css";

const MessageForm = ({ onsendChatMessage, onFocus, onBlur, disabled }) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef(null);

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
      <Box component="form" onSubmit={handleSubmit} display="flex" alignItems="flex-end" gap={2}>
        <div className={styles.container}>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={onFocus}
            onBlur={onBlur}
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
      {/* Persistent, quiet safety notes below the input (no floating / overlap). */}
      <Box className={styles['composer-notes']}>
        <span className={styles.notice}>Don&apos;t include personal information</span>
        <span className={styles.notice}>Stored and used for research</span>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          The chatbot may say sensitive things based on your interactions.
        </Typography>
      </Box>
    </>
  );
};

export default MessageForm;
