// TRAILS-Chatbot/src/components/FinalAssessment.jsx

import React from 'react';
import { Typography, Box } from './ui/layout';
import { Button } from './ui/button';
import db from '../tools/db';

const FinalAssessment = ({ userId, onStartNewAudit, onEndConversation }) => {
  const handleStartNewAudit = async () => {
    const newConversation = await db.createConversation(userId);
    onStartNewAudit(newConversation.id);
  };

  return (
    <Box className="text-center mt-8">
      <Typography variant="h5" gutterBottom>
        Thank you for participating in the audit!
      </Typography>
      <Typography variant="body1" gutterBottom>
        Your feedback is valuable to us. You can start a new audit or end the conversation.
      </Typography>
      <Box className="mt-6">
        <Button
          onClick={handleStartNewAudit}
          className="mr-4"
        >
          Start New Audit
        </Button>
        <Button
          variant="secondary"
          onClick={onEndConversation}
        >
          End Conversation
        </Button>
      </Box>
    </Box>
  );
};

export default FinalAssessment;