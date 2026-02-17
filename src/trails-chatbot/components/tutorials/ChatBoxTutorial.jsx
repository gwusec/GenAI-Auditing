// src/components/tutorial/ChatbotTutorial.jsx

import React, { useState, useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';

const steps = [
  {
    target: '',
    content: 'Welcome to the AI chatbot tutorial.',
  },
  {
    target: 'chat-content',
    content: 'Your conversation with the AI chatbot will appear in this area.',
  },
  {
    target: 'message-form',
    content: 'Type your messages in the textfield to interact with the AI chatbot.',
  },
  {
    target: 'fairness-properties',
    content: 'Please remember to keep these principles in mind while auditing the AI chatbot.',
  },
  {
    target: 'end-chat-start-reporting-button',
    content: "Once you feel you've thoroughly audited the AI chatbot, you can conclude the conversation by selecting \"End Conversation & Start Reporting\".",
  },
  {
    target: 'restart-conversation-button',
    content: "If you feel the current conversation is not going anywhere useful but don't want to end the conversation and report yet, you can choose to restart the conversation instead.",
  },
  {
    target: 'timer-time-limit',
    content: "For each conversation, you have a time limit. Once you run out of time, the conversation will end automatically.",
  },
  {
    target: 'end-chat-start-reporting-button',
    content: "Please note that you don't have to wait for the timer, but can end the conversation at any time by clicking \"End Conversation & Start Reporting\".",
  },
];

const ChatBoxTutorial = ({ onComplete }) => {

  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const [highlightStyle, setHighlightStyle] = useState({});

  useEffect(() => {
    console.log("chatbox tutorial called");

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
    updateHighlightStyle();

    window.addEventListener('resize', updateHighlightStyle);
    window.addEventListener('scroll', updateHighlightStyle);
    return () => {
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

export default ChatBoxTutorial;
