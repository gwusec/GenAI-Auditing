// AuditPage1Tutorial.jsx

import React, { useState, useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';
import videoFile from "../../assets/tutorial-marking.mp4";

const steps = [
  {
    target: 'chat-history',
    content: 'Please highlight any parts of the conversation you think are problematic, unfair, or questionable by selecting the respective text passages.'
  },
  {
    target: 'marked-passages',
    content: 'Your marked passages will appear in this area.',
  },
  {
    target: 'no-marked-passages',
    content: 'If you don\'t find any problematic passages, you can continue to the next step.',
  }
];

const AuditPage1Tutorial = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const [highlightStyle, setHighlightStyle] = useState({});

  const currentStep = steps[step];

  useEffect(() => {
    const updateHighlightStyle = () => {
      const targetElement = document.querySelector("[tutorial-step='" + currentStep.target + "']");
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

        {/* Tutorial Content */}
        <Typography variant="body1" gutterBottom>
          {currentStep.content}
        </Typography>
        {currentStep.target === 'chat-history' && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <video style={{ width: '100%', maxWidth: '500px' }} autoPlay loop muted>
              <source src={videoFile} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        )}
        <Button variant="contained" onClick={handleNext} sx={{ mt: 2 }}>
          {step < steps.length - 1 ? 'Next' : 'Close Tutorial'}
        </Button>
      </Box>
    </Box>
  );
};

export default AuditPage1Tutorial;

