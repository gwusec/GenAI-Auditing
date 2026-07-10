// src/components/tutorial/ChatbotTutorial.jsx

import React, { useState, useEffect } from 'react';
import { Box, Typography } from '../ui/layout';
import { Button } from '../ui/button';

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

export default ChatBoxTutorial;
