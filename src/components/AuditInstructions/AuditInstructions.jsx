import React from 'react';
import { Typography } from '../ui/layout';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import './AuditInstructions.module.css';

// In AuditInstructions.jsx
const AuditInstructions = ({ onComplete }) => {
  return (
    <Card className="instructions-container">
      <Typography variant="h4" gutterBottom>
        TRAILS RESEARCH
      </Typography>
      <Typography variant="body1" gutterBottom>
        This is the guide page for tutorial and/or instructions.
      </Typography>
      <Typography variant="body1">
        You can start multiple audits to check different aspects. Click 'Start New Audit' in the sidebar to proceed.
      </Typography>
      <Button onClick={onComplete} className="mt-4">
        I Understand, Proceed to Audit
      </Button>
    </Card>
  );
};

export default AuditInstructions;
