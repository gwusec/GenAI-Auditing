// AuditPage0Tutorial.jsx

import React, { useState, useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';

const steps = [
  {
    target: 'chat-history',
    content: 'Please review your conversation with the AI chatbot.'
  },
  {
    target: 'chat-performance-rating',
    content: 'Based on your conversation, please rate the chatbot\'s performance.',
  },
];

const AuditPage0Tutorial = ({ onComplete }) => {

  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const [highlightStyle, setHighlightStyle] = useState({});

  useEffect(() => {
    const updateHighlightStyle = () => {
      let targetElement = document.querySelector("[tutorial-step='" + steps[step].target + "']");
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        setHighlightStyle({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      }
    };
    
    const timer = setTimeout(() => {
      updateHighlightStyle();
    }, 100);
    updateHighlightStyle();

    window.addEventListener('resize', updateHighlightStyle);
    window.addEventListener('scroll', updateHighlightStyle);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateHighlightStyle);
      window.removeEventListener('scroll', updateHighlightStyle);
    };
  }, [step]);

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      setVisible(false);
      onComplete();
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        pointerEvents: 'none', // Allows interactions with underlying elements
      }}
    >
      {/* Overlay Background */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }}
      />

      {/* Highlight Box */}
      <Box
        sx={{
          position: 'absolute',
          top: highlightStyle.top,
          left: highlightStyle.left,
          width: highlightStyle.width,
          height: highlightStyle.height,
          border: '2px solid #fff',
          boxSizing: 'border-box',
          pointerEvents: 'none',
          borderRadius: '4px',
        }}
      />

      {/* Centered Tutorial Dialogue */}
      <Box
        sx={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#fff',
          padding: 3,
          borderRadius: 2,
          maxWidth: '80%',
          textAlign: 'center',
          boxShadow: '0 0 10px rgba(0,0,0,0.3)',
          zIndex: 10000,
          pointerEvents: 'auto', // Allows interaction with the dialogue
        }}
      >

        <Typography variant="body1" gutterBottom>
          {steps[step].content}
        </Typography>
        <Button variant="contained" onClick={handleNext} sx={{ mt: 2 }}>
          {step < steps.length - 1 ? 'Next' : 'Close Tutorial'}
        </Button>
      </Box>
    </Box>
  );
};

export default AuditPage0Tutorial;
