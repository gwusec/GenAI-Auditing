// TRAILS-Chatbot/src/components/FinalAssessment.jsx

import React from 'react';
import { Typography, Box, Button } from '@mui/material';
import db from '../tools/db';

const FinalAssessment = ({ userId, onStartNewAudit, onEndConversation }) => {
  const handleStartNewAudit = async () => {
    const newConversation = await db.createConversation(userId);
    onStartNewAudit(newConversation.id);
  };

  return (
    <Box sx={{ textAlign: 'center', mt: 4 }}>
      <Typography variant="h5" gutterBottom>
        Thank you for participating in the audit!
      </Typography>
      <Typography variant="body1" gutterBottom>
        Your feedback is valuable to us. You can start a new audit or end the conversation.
      </Typography>
      <Box sx={{ mt: 3 }}>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleStartNewAudit}
          sx={{ mr: 2 }}
        >
          Start New Audit
        </Button>
        <Button 
          variant="contained" 
          color="secondary" 
          onClick={onEndConversation}
        >
          End Conversation
        </Button>
      </Box>
    </Box>
  );
};

export default FinalAssessment;