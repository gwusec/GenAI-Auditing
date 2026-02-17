// ConversationHistory.jsx

import React from 'react';
import { Typography, Paper, TextField } from '@mui/material';
import ChatHistory from './ChatHistory';
import styles from './ConversationHistory.module.css';

const ConversationHistory = ({ conversation }) => {
  if (!conversation) {
    return null;
  }

  const { audit } = conversation;
  
  return (
    <>
      <Typography variant="h6" gutterBottom align="center" className={styles['header']}>
        Completed Conversation
      </Typography>

      <ChatHistory
        conversationId={conversation.id}
        enableHighlighting={false}
        disableTextSelection={true}
        highlights={audit?.highlights || []}
        isAudit={false}
        auditFinished={true}
      />

      {audit && (
        <Paper elevation={3} sx={{ p: 3, mb: 2 }} className="free-response">
          <Typography variant="h6" gutterBottom align="center">
            Your reported details
          </Typography>
          <TextField
            label="Please explain what is problematic about those outputs."
            multiline
            rows={4}
            variant="outlined"
            fullWidth
            margin="normal"
            name="explainProblematic"
            value={audit.textResponses?.explainProblematic || ''}
            readOnly={true}
          />
          <TextField
            label="What kinds of biases/harms/problems are present in this output?"
            multiline
            rows={4}
            variant="outlined"
            fullWidth
            margin="normal"
            name="biasesHarms"
            value={audit.textResponses?.biasesHarms || ''}
            readOnly={true}
          />
        </Paper>
      )}
    </>
  );
};

export default ConversationHistory;
