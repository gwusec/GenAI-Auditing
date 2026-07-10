// AuditPage1Tutorial.jsx

import React, { useState, useEffect } from 'react';
import { Box, Typography } from '../ui/layout';
import { Button } from '../ui/button';
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
    <Box className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Overlay Background */}
      <Box className="absolute inset-0 bg-black/50" />

      {/* Highlight Box */}
      <Box
        className="absolute box-border pointer-events-none border-2 border-white"
        style={{
          top: highlightStyle.top,
          left: highlightStyle.left,
          width: highlightStyle.width,
          height: highlightStyle.height,
        }}
      />

      {/* Centered Tutorial Dialogue */}
      <Box className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-md max-w-[80%] text-center shadow-[0_0_10px_rgba(0,0,0,0.3)] z-[10000] pointer-events-auto">

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
        <Button onClick={handleNext} className="mt-4">
          {step < steps.length - 1 ? 'Next' : 'Close Tutorial'}
        </Button>
      </Box>
    </Box>
  );
};

export default AuditPage1Tutorial;

