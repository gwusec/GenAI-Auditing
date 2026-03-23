// TRAILS-Chatbot/src/components/ExportManager.jsx

import React from 'react';
import { Button } from '@mui/material';
import conversationHandler from '../tools/ConversationHandler';

const ExportManager = ({ conversations }) => {
  const handleExport = async () => {
    try {
      const exportData = await conversationHandler.getExistingConversations();

      // Dispatch custom event with exported data
      const event = new CustomEvent('trails-chatbot:audit-finished', {
        detail: exportData,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);

      console.log('Exported Data:', JSON.stringify(exportData, null, 2));
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  return (
    <Button
      variant="contained"
      color="primary"
      onClick={handleExport}
      fullWidth
      sx={{ mt: 2 }}
    >
      Finish audit. Export conversation data.
    </Button>
  );
};

export default ExportManager;
