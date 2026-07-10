// AuditPage0Tutorial.jsx

import React, { useState, useEffect } from 'react';
import { Box, Typography } from '../ui/layout';
import { Button } from '../ui/button';

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
    <Box className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Overlay Background */}
      <Box className="absolute inset-0 bg-black/50" />

      {/* Highlight Box */}
      <Box
        className="absolute box-border pointer-events-none rounded border-2 border-white"
        style={{
          top: highlightStyle.top,
          left: highlightStyle.left,
          width: highlightStyle.width,
          height: highlightStyle.height,
        }}
      />

      {/* Centered Tutorial Dialogue */}
      <Box className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-md max-w-[80%] text-center shadow-[0_0_10px_rgba(0,0,0,0.3)] z-[10000] pointer-events-auto">

        <Typography variant="body1" gutterBottom>
          {steps[step].content}
        </Typography>
        <Button onClick={handleNext} className="mt-4">
          {step < steps.length - 1 ? 'Next' : 'Close Tutorial'}
        </Button>
      </Box>
    </Box>
  );
};

export default AuditPage0Tutorial;
