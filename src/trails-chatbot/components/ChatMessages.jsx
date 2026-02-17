// src/components/ChatMessages.jsx

import React, { useEffect, useRef } from 'react';
import {
    Alert,
    List,
    ListItem,
    Typography,
    Paper,
    IconButton,
    Divider,
    Chip,
    TextField,
    Box,
} from "@mui/material";
import {
    Edit as EditIcon,
    Save as SaveIcon,
    Cancel as CancelIcon,
} from "@mui/icons-material";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import LoadingDots from './LoadingDots';
import styles from './ChatMessages.module.css';

const ChatMessages = ({
    messages,
    onEditMessage,
    onCancelEdit,
    onSaveEdit,
    editingMessageId,
    editedContent,
    setEditedContent,
    formatTimestamp,
    handleTextSelection,
    isLoading = false,
    isScrollToBottom = false,
    error = null,
    setError = () => { },
    canEditLastMessage = () => false,
}) => {
    const messagesEndRef = useRef(null);

    useEffect(() => {
        console.log("Messages updated:", messages);
        if (isScrollToBottom) scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const renderMessages = () => {
        if (error) {
            return (
                <Alert
                    severity="error"
                    onClose={() => setError(null)}
                    className={styles['error-alert']}
                >
                    {error}
                </Alert>
            );
        }

        if (messages.length === 0) {
            return (
                <>
<>
  <ListItem className={styles['no-messages']} style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
    <Typography variant="body1" align="center">
      No messages yet. Send a message to start the conversation.
    </Typography>
  </ListItem>
  
  <ListItem className={styles['no-messages']} style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
    <Typography variant="body1" align="center">
      You can ask or request the AI chatbot anything you like that helps you determine if the AI chatbot produces outputs that are problematic, unfair, or questionable.
    </Typography>
  </ListItem>
</>
                </>
            );
        }

        return (
            <>
                {messages.map((message, index) => {
                    if (message.type === 'separator') {
                        return (
                            <Divider key={message.id} className={styles['separator']}>
                                <Typography variant="caption">{message.reason}</Typography>
                            </Divider>
                        );
                    }

                    const isEditedMessage = message.isEdited;
                    const isRestartedMessage = message.isRestarted;

                    return (
                        <ListItem
                            key={message.id}
                            onMouseUp={() =>
                                handleTextSelection &&
                                handleTextSelection(message.id, message.author, message.content)
                            }
                            sx={{
                                display: 'flex',
                                marginBottom: '16px',
                                flexWrap: 'wrap',
                                justifyContent: message.author === 'user' ? 'flex-start' : 'flex-end',
                                maxWidth: '100%',
                            }}
                        >
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    maxWidth: '70%',
                                }}
                                className={styles['message-bubble-container']}
                            >
                                {/* Username */}
                                <Typography
                                    variant="caption"
                                    sx={{
                                        marginBottom: '4px',
                                        fontSize: '0.85em',
                                        color: '#555',
                                        textAlign: message.author === 'user' ? 'left' : 'right', // Align based on author
                                        display: 'block', // Ensures the alignment applies properly
                                    }}
                                    className={styles['message-author']}
                                >
                                    <strong>{message.author === 'user' ? 'You' : 'AI Chatbot'}</strong>
                                </Typography>

                                {/* Message bubble */}
                                <Paper
                                    elevation={1}
                                    sx={{
                                        padding: '10px',
                                        wordBreak: 'break-word',
                                        fontSize: '1em',
                                        lineHeight: '1.5',
                                        width: 'fit-content',
                                        maxWidth: '100%',
                                        backgroundColor: message.author === 'user' ? '#e0f7fa' : '#e8eaf6',
                                        borderRadius: message.author === 'user' ? '0px 12px 12px 12px' : '12px 0px 12px 12px',
                                    }}
                                    className={`
                                        ${styles['message-paper']} 
                                        ${message.author === 'user' ? styles['user-message'] : styles['bot-message']}
                                    `}
                                >
                                    {/* Status chips */}
                                    {isRestartedMessage && (
                                        <Chip
                                            label="Restarted Conversation"
                                            size="small"
                                            sx={{
                                                marginBottom: '8px',
                                                backgroundColor: '#4caf50',
                                                color: 'white',
                                            }}
                                            className={`${styles['status-chip']} ${styles['restart-chip']}`}
                                        />
                                    )}
                                    {isEditedMessage && (
                                        <Chip
                                            label="Edited Message"
                                            size="small"
                                            sx={{
                                                marginBottom: '8px',
                                                backgroundColor: '#ff9800',
                                                color: 'white',
                                            }}
                                            className={`${styles['status-chip']} ${styles['edit-chip']}`}
                                        />
                                    )}
                                    {/* Message content */}
                                    <div className={styles['message-content']}>
                                        {editingMessageId === message.id ? (
                                            <div className={styles['edit-message-container']}>
                                                <TextField
                                                    fullWidth
                                                    multiline
                                                    value={editedContent}
                                                    onChange={(e) => setEditedContent(e.target.value)}
                                                    className={styles['edit-textfield']}
                                                />
                                                <IconButton
                                                    onClick={onSaveEdit}
                                                    size="small"
                                                    aria-label="Save edited message"
                                                    title="Save edited message"
                                                >
                                                    <SaveIcon fontSize="small" />
                                                </IconButton>
                                                <IconButton
                                                    onClick={onCancelEdit}
                                                    size="small"
                                                    aria-label="Cancel editing"
                                                    title="Cancel editing"
                                                >
                                                    <CancelIcon fontSize="small" />
                                                </IconButton>
                                            </div>
                                        ) : (
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                rehypePlugins={[rehypeRaw]}
                                                components={{
                                                    p: ({ node, ...props }) => (
                                                        <p {...props} className={styles['markdown-paragraph']} />
                                                    ),
                                                    a: ({ node, children, ...props }) => (
                                                        <a {...props} className={styles['markdown-link']}>
                                                            {children}
                                                        </a>
                                                    ),
                                                    code: ({ node, inline, className, children, ...props }) =>
                                                        inline ? (
                                                            <code {...props} className={styles['inline-code']}>
                                                                {children}
                                                            </code>
                                                        ) : (
                                                            <pre {...props} className={styles['block-code']}>
                                                                <code>{children}</code>
                                                            </pre>
                                                        ),
                                                    // Custom component for trails-audit-mark
                                                    'trails-audit-mark': ({ node, children, ...props }) => (
                                                        <mark {...props} className={styles['markdown-mark']}>
                                                            {children}
                                                        </mark>
                                                    ),
                                                }}
                                            >
                                                {message.content.toString()}
                                            </ReactMarkdown>
                                        )}
                                        {/* Timestamp */}
                                        <Typography variant="caption" className={styles['timestamp']}>
                                            {formatTimestamp(message.timestamp)}
                                        </Typography>
                                    </div>
                                </Paper>
                            </Box>

                            {/* Edit icon for user's most recent message */}
                            {message.author === 'user' &&
                                onEditMessage &&
                                canEditLastMessage &&
                                canEditLastMessage() &&
                                index === messages.length - 2 &&
                                !message.isRestarted &&
                                !editingMessageId && (
                                    <IconButton
                                        onClick={() => onEditMessage(message.id)}
                                        size="small"
                                        className={styles['edit-button']}
                                        aria-label="Edit message"
                                        title="Edit message"
                                    >
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                )}
                        </ListItem>
                    );
                })}

                {/* Loading indicator */}
                {isLoading && (
                    <ListItem
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            mb: 2,
                        }}>
                        <Paper elevation={1} className={styles['loading-paper']}>
                            <LoadingDots />
                        </Paper>
                    </ListItem>
                )}
            </>
        );
    };

    return (
        <List className={styles['chat-content']}>
            {renderMessages()}
            {/* Dummy div to scroll into view */}
            <div ref={messagesEndRef} />
        </List>
    );
};

export default ChatMessages;
