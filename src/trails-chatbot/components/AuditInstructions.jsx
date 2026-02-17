import React from 'react';
import { Typography, Paper, Button } from '@mui/material';
import './AuditInstructions.module.css';

// In AuditInstructions.jsx
const AuditInstructions = ({ onComplete }) => {
  return (
    <Paper className="instructions-container">
      <Typography variant="h4" gutterBottom>
        TRAILS RESEARCH
      </Typography>
      <Typography variant="body1" gutterBottom>
        This is the guide page for tutorial and/or instructions.
      </Typography>
      <Typography variant="body1">
        You can start multiple audits to check different aspects. Click 'Start New Audit' in the sidebar to proceed.
      </Typography>
      <Button variant="contained" color="primary" onClick={onComplete} sx={{ mt: 2 }}>
        I Understand, Proceed to Audit
      </Button>
    </Paper>
  );
};

export default AuditInstructions;
