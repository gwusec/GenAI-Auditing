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
        // Check for highlights in the message
        const highlightedPassages = highlights.filter((h) => h.messageId === message.id);

        // Return the message content if there are no highlights
        if (highlightedPassages.length === 0) {
          return message.content;
        }

        // Sort the highlights by startIndex
        highlightedPassages.sort((a, b) => a.startIndex - b.startIndex);

        // Generate the highlighted content with <mark> tags for formatting
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
          const highlightedText = message.content.slice(startIndex, endIndex);
          const blockMarkerRegex = /^([ \t]*(?:#{1,6}\s|[*+-]\s|\d+\.\s|>\s)+)(.*)/;
          const lines = highlightedText.split('\n');
          const safeLines = lines.map(line => {
            if (line.length === 0) return line;

            // Edge case for code blocks:
            // Preserve code block markers without wrapping them entirely if they start the line
            const codeBlockRegex = /^([ \t]*(?:```|~~~)[^ \t]*)(.*)/;
            let cbMatch = line.match(codeBlockRegex);
            if (cbMatch) {
              return cbMatch[2].length > 0 ? `${cbMatch[1]}<trails-audit-mark>${cbMatch[2]}</trails-audit-mark>` : line;
            }

            const blockMarkerRegex = /^([ \t]*(?:#{1,6}\s|[*+-]\s|\d+\.\s|>\s)+)(.*)/;
            const match = line.match(blockMarkerRegex);
            if (match) {
              return match[2].length > 0 ? `${match[1]}<trails-audit-mark>${match[2]}</trails-audit-mark>` : line;
            } else {
              return `<trails-audit-mark>${line}</trails-audit-mark>`;
            }
          });
          const safeHighlight = safeLines.join('\n');
          result.push(safeHighlight.replace(/<trails-audit-mark><\/trails-audit-mark>/g, ''));

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
      const container = document.getElementById(`message-${messageId}`);
      if (!container || selection.rangeCount === 0) return;

      const originalRange = selection.getRangeAt(0);
      let startNode = originalRange.startContainer;
      let startOff = originalRange.startOffset;
      let endNode = originalRange.endContainer;
      let endOff = originalRange.endOffset;

      const isStartInside = container.contains(startNode);
      const isEndInside = container.contains(endNode);

      if (!isStartInside && !isEndInside) {
        if (
          startNode.compareDocumentPosition(container) & Node.DOCUMENT_POSITION_FOLLOWING &&
          endNode.compareDocumentPosition(container) & Node.DOCUMENT_POSITION_PRECEDING
        ) {
          startNode = container; startOff = 0;
          endNode = container; endOff = container.childNodes.length;
        } else return;
      } else {
        if (!isStartInside) { startNode = container; startOff = 0; }
        if (!isEndInside) { endNode = container; endOff = container.childNodes.length; }
      }

      const clampedRange = document.createRange();
      clampedRange.setStart(startNode, startOff);
      clampedRange.setEnd(endNode, endOff);

      let selectedText = (isStartInside && isEndInside) ? selection.toString().trim() : clampedRange.toString().trim();
      if (!selectedText) return;

      const strippedContent = content
        .replace(/<trails-audit-[^>]*>/g, "")
        .replace(/<\/trails-audit-[^>]*>/g, "");

      let startIndex = -1;
      let matchLength = selectedText.length;

      const markdownContainer = container.querySelector('.markdown-body') || container;
      let domSelectionStart = 0;
      try {
        const preCaretRange = clampedRange.cloneRange();
        preCaretRange.selectNodeContents(markdownContainer);
        preCaretRange.setEnd(clampedRange.startContainer, clampedRange.startOffset);
        domSelectionStart = preCaretRange.toString().length;
      } catch (e) {
        console.warn("Could not calculate DOM offset", e);
      }

      // Try exact match on the full string
      const exactMatches = [];
      let exactIdx = strippedContent.indexOf(selectedText);
      while (exactIdx !== -1) {
        exactMatches.push({ index: exactIdx, length: selectedText.length });
        exactIdx = strippedContent.indexOf(selectedText, exactIdx + 1);
      }

      console.log("[DEBUG] domSelectionStart:", domSelectionStart);
      console.log("[DEBUG] originalRange:", originalRange.startContainer.nodeType, originalRange.startContainer.textContent?.substring(0, 30));
      console.log("[DEBUG] clampedRange start:", clampedRange.startContainer.nodeType, clampedRange.startContainer.textContent?.substring(0, 30), clampedRange.startOffset);
      console.log("[DEBUG] isStartInside:", isStartInside, "isEndInside:", isEndInside);
      console.log("[DEBUG] exactMatches:", exactMatches);

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
          const regexStr = words.map(escapeRegExp).join('[\\s\\W_]*?');
          try {
            const regex = new RegExp(regexStr, 'gi');
            let match;
            while ((match = regex.exec(strippedContent)) !== null) {
              const diff = Math.abs(match.index - domSelectionStart);
              console.log("[DEBUG] Regex match:", match[0].substring(0, 50), "at", match.index, "diff:", diff);
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

      // If all else fails, fallback to naive DOM node matching using range
      if (startIndex === -1) {
        const startText = clampedRange.startContainer.textContent;
        const endText = clampedRange.endContainer.textContent;

        const getAllIndices = (str, search) => {
          const indices = [];
          let i = str.indexOf(search);
          while (i !== -1) { indices.push(i); i = str.indexOf(search, i + 1); }
          return indices;
        };

        const sIndices = getAllIndices(strippedContent, startText);
        let bestSIdx = -1;
        let minSDiff = Infinity;
        for (let i of sIndices) {
          let diff = Math.abs(i - domSelectionStart);
          if (diff < minSDiff) { minSDiff = diff; bestSIdx = i; }
        }
        const sIdx = bestSIdx;

        const eIndices = getAllIndices(strippedContent, endText);
        let bestEIdx = -1;
        let minEDiff = Infinity;
        const domSelectionEnd = domSelectionStart + selectedText.length;
        for (let i of eIndices) {
          let diff = Math.abs(i - domSelectionEnd);
          if (diff < minEDiff) { minEDiff = diff; bestEIdx = i; }
        }
        const eIdx = bestEIdx;

        if (sIdx !== -1) {
          startIndex = sIdx + clampedRange.startOffset;
          if (eIdx !== -1) {
            matchLength = (eIdx + clampedRange.endOffset) - startIndex;
            if (matchLength < 0) matchLength = selectedText.length;
          }
        }
      }

      console.log("[DEBUG] Final startIndex:", startIndex, "matchLength:", matchLength);
      if (bestMatch) console.log("[DEBUG] Used bestMatch:", bestMatch);

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

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (!enableHighlighting || !addHighlight) return;
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const node = selection.anchorNode;
      if (!node) return;

      const element = node.nodeType === 3 ? node.parentNode : node;
      const container = element.closest ? element.closest('[id^="message-"]') : null;
      if (container && container.id && container.id.startsWith('message-')) {
        const messageId = container.id.replace('message-', '');
        const message = messages.find(m => m.id === messageId);
        if (message && message.author === 'bot') {
          handleTextSelection(messageId, message.author, message.content);
        }
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  });

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