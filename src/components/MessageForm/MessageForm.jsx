// TRAILS-Chatbot/src/components/MessageForm.jsx
import React, { useState, useCallback, useRef } from 'react';
import { Box, Typography } from '../ui/layout';
import { Button } from '../ui/button';
import { Send as SendIcon } from '../ui/icons';
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
      <Box component="form" onSubmit={handleSubmit} className="flex items-end gap-4">
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
        <Button
          type="submit"
          size="icon"
          disabled={!message.trim() || disabled}
        >
          <SendIcon fontSize="small" />
        </Button>
      </Box>
      {/* Persistent, quiet safety notes below the input (no floating / overlap). */}
      <Box className={styles['composer-notes']}>
        <span className={styles.notice}>Don&apos;t include personal information</span>
        <span className={styles.notice}>Stored and used for research</span>
        <Typography variant="caption" className="text-muted-foreground opacity-70">
          The chatbot may say sensitive things based on your interactions.
        </Typography>
      </Box>
    </>
  );
};

export default MessageForm;
