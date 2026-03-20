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
      if (!selectedText) return;

      const strippedContent = content
        .replace(/<trails-audit-[^>]*>/g, "")
        .replace(/<\/trails-audit-[^>]*>/g, "");

      let startIndex = -1;
      let matchLength = selectedText.length;

      // Calculate DOM character offset
      const container = document.getElementById(`message-${messageId}`);
      let domSelectionStart = 0;
      if (container && selection.rangeCount > 0) {
        try {
          const range = selection.getRangeAt(0);
          const preCaretRange = range.cloneRange();
          preCaretRange.selectNodeContents(container);
          preCaretRange.setEnd(range.startContainer, range.startOffset);
          domSelectionStart = preCaretRange.toString().length;
        } catch (e) {
          console.warn("Could not calculate DOM offset", e);
        }
      }

      // Try exact match on the full string
      const exactMatches = [];
      let exactIdx = strippedContent.indexOf(selectedText);
      while (exactIdx !== -1) {
        exactMatches.push({ index: exactIdx, length: selectedText.length });
        exactIdx = strippedContent.indexOf(selectedText, exactIdx + 1);
      }

      let bestMatch = null;
      let minDiff = Infinity;

      // Get exact matches
      exactMatches.forEach(match => {
        const diff = Math.abs(match.index - domSelectionStart);
        if (diff < minDiff) {
          minDiff = diff;
          bestMatch = match;
        }
      });

      // If that fails, do a Regex match that ignores markdown formatting between words
      if (!bestMatch) {
        const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const words = selectedText.split(/\s+/).filter(w => w.length > 0);
        if (words.length > 0) {
          const regexStr = words.map(escapeRegExp).join('[\\s\\*\\_\\~\\`\\#\\>\\[\\]\\(\\)]+');
          try {
            const regex = new RegExp(regexStr, 'gi');
            let match;
            while ((match = regex.exec(strippedContent)) !== null) {
              const diff = Math.abs(match.index - domSelectionStart);
              if (diff < minDiff) {
                minDiff = diff;
                bestMatch = { index: match.index, length: match[0].length };
              }
            }
          } catch (e) {
            console.error("Regex map failed:", e);
          }
        }
      }

      if (bestMatch) {
        startIndex = bestMatch.index;
        matchLength = bestMatch.length;
      }

      // If all else fails, fallback to naive DOM node matching
      if (startIndex === -1 && selection.anchorNode) {
        let selectionDirection = selection.anchorOffset > selection.focusOffset ? "backward" : "forward";
        let tempIdx = -1;
        if (selection.anchorNode === selection.focusNode) {
          if (selectionDirection === "forward") {
            tempIdx = strippedContent.indexOf(selection.anchorNode.textContent);
            if (tempIdx !== -1) startIndex = tempIdx + selection.anchorOffset;
          } else {
            tempIdx = strippedContent.indexOf(selection.focusNode.textContent);
            if (tempIdx !== -1) startIndex = tempIdx + selection.focusOffset;
          }
        } else {
          tempIdx = strippedContent.indexOf(selection.anchorNode.textContent);
          if (tempIdx !== -1) startIndex = tempIdx + selection.anchorOffset;
        }
      }

      console.log("startIndex:", startIndex);

      if (startIndex !== -1) {
        const exactMarkdownText = strippedContent.substring(startIndex, startIndex + matchLength);

        // Check if the selection overlaps with any existing highlight
        const overlappingHighlight = highlights.find(
          (h) =>
            h.messageId === messageId &&
            (
              (startIndex >= h.startIndex && startIndex < h.startIndex + h.text.length) ||
              (startIndex + exactMarkdownText.length >= h.startIndex && startIndex + exactMarkdownText.length < h.startIndex + h.text.length) ||
              (startIndex < h.startIndex && startIndex + exactMarkdownText.length >= h.startIndex + h.text.length) ||
              (h.startIndex < startIndex + exactMarkdownText.length && h.startIndex + h.text.length > startIndex)
            )
        );

        if (!overlappingHighlight) {
          addHighlight({
            messageId,
            text: exactMarkdownText,
            startIndex,
          });
        }
        selection.removeAllRanges();
      }
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