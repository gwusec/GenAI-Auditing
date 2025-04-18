// AuditPage2Tutorial.jsx

import React, { useState, useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';

const steps = [
  {
    target: '.free-response',
    content: 'Provide detailed feedback on the chatbot\'s performance.',
  },
  {
    target: '.submit-button',
    content: 'After completing the audit, click Submit to finish.',
  },
];

const AuditPage2Tutorial = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const [highlightStyle, setHighlightStyle] = useState({});


  const currentStep = steps[step];

  useEffect(() => {
    const updateHighlightStyle = () => {
      const targetElement = document.querySelector(currentStep.target);
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        setHighlightStyle({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });

        // Scroll to the target element to ensure it's visible
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    updateHighlightStyle();

    // Recalculate on window resize or scroll
    window.addEventListener('resize', updateHighlightStyle);
    window.addEventListener('scroll', updateHighlightStyle);
    return () => {
      window.removeEventListener('resize', updateHighlightStyle);
      window.removeEventListener('scroll', updateHighlightStyle);
    };
  }, [step, currentStep.target]);

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
        pointerEvents: 'none',
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
          pointerEvents: 'auto',
        }}
      >
        <Typography variant="body1" gutterBottom>
          {currentStep.content}
        </Typography>
        <Button variant="contained" onClick={handleNext} sx={{ mt: 2 }}>
          {step < steps.length - 1 ? 'Next' : 'Close Tutorial'}
        </Button>
      </Box>
    </Box>
  );
};

export default AuditPage2Tutorial;
