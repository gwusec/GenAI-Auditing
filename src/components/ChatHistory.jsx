// src/components/ChatHistory.jsx

import React, { useEffect, useState } from "react";
import conversationHandler from "../tools/ConversationHandler";
import ChatMessages from './ChatMessages';
import styles from "./ChatHistory.module.css";


const ChatHistory = ({
  conversationId,
  addHighlight,
  enableHighlighting,
  highlights = []
}) => {
  const [messages, setMessages] = useState([]);
  const [processedMessages, setProcessedMessages] = useState([]);

  useEffect(() => {
    const handleVisibleChatUpdated = () => {
      setMessages(conversationHandler.getVisibleConversation());
    };

    conversationHandler.registerOnVisibleChatUpdated(handleVisibleChatUpdated);
    // Initial load
    setMessages(conversationHandler.getVisibleConversation());

    return () => {
      conversationHandler.unregisterOnVisibleChatUpdated(
        handleVisibleChatUpdated
      );
    };
  }, [conversationId]);

  useEffect(() => {
    // Function to process message content with highlights
    const processMessageContent = (message) => {
      if (message.author === "user" || !highlights.length) {
        return message.content;
      }

      if (message.author === "bot" && highlights.length) {
        // Are there any highlights for this message?
        const highlightedPassages = highlights.filter((h) => h.messageId === message.id);

        // Return the message content if there are no highlights
        if (highlightedPassages.length === 0) {
          return message.content;
        }

        // Sort the highlights by startIndex
        highlightedPassages.sort((a, b) => a.startIndex - b.startIndex);

        // Generate the highlighted content with <mark> tags
        let result = [];
        let currentIndex = 0;

        highlightedPassages.forEach((highlight) => {
          const startIndex = highlight.startIndex;
          const endIndex = startIndex + highlight.text.length;

          // Add unmarked content
          if (currentIndex < startIndex) {
            result.push(message.content.slice(currentIndex, startIndex));
          }

          // Add highlighted content
          result.push(`<trails-audit-mark>${message.content.slice(startIndex, endIndex)}</trails-audit-mark>`);

          currentIndex = endIndex;
        });

        // Add remaining unmarked content after the last highlight
        result.push(message.content.slice(currentIndex));

        // Return the combined result as HTML
        return result.join("");
      }
    };

    // Process messages to include highlights
    setProcessedMessages(() => {
      return messages.map((message) => ({
        ...message,
        content: processMessageContent(message)
      }));
    });

  }, [messages, highlights]);

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const handleTextSelection = (messageId, author, content) => {
    
    if (!enableHighlighting || author !== "bot" || !addHighlight) return;
    const selection = window.getSelection();

    if (!selection.isCollapsed) {
      let selectedText = selection.toString().trim();

      let startIndex = -1;
      let selectionDirection = selection.anchorOffset > selection.focusOffset ? "backward" : "forward";
      if (selectionDirection === "forward") {
        startIndex = content
          .replace(/<trails-audit-mark>/g, "") // Replace all opening tags
          .replace(/<\/trails-audit-mark>/g, "") // Replace all closing tags
          .indexOf(selection.anchorNode.textContent) + selection.anchorOffset;
      } else if (selectionDirection === "backward") {
        startIndex = content
          .replace(/<trails-audit-mark>/g, "") // Replace all opening tags
          .replace(/<\/trails-audit-mark>/g, "") // Replace all closing tags
          .indexOf(selection.focusNode.textContent) + selection.focusOffset;
      }

      console.log("startIndex:", startIndex);
      
      if (startIndex !== -1) {
        // Check if the selection overlaps with any existing highlight
        const overlappingHighlight = highlights.find(
          (h) =>
            h.messageId === messageId &&
            (
              // is startIndex inside the highlight?
              (startIndex >= h.startIndex &&
                startIndex < h.startIndex + h.text.length) ||
                // is startIndex + selectedText.length inside the highlight?
                (startIndex + selectedText.length >= h.startIndex &&
                startIndex + selectedText.length < h.startIndex + h.text.length) ||
              // is the highlight inside startIndex and startIndex + selectedText.length?
              (startIndex < h.startIndex &&
                startIndex + selectedText.length >= h.startIndex + h.text.length) ||
              (h.startIndex < startIndex + selectedText.length &&
                h.startIndex + h.text.length > startIndex))
        );

        if (!overlappingHighlight) {
          addHighlight({
            messageId,
            text: selectedText,
            startIndex,
          });
        }
      }
      selection.removeAllRanges();
    }
  };

  return (
    <ChatMessages
      messages={processedMessages}
      isScrollToBottom={false}
      handleTextSelection={handleTextSelection}
      formatTimestamp={formatTimestamp}
    />
  );
};

export default ChatHistory;