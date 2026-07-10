// src/components/ChatMessages.jsx

import React, { useEffect, useRef, useState } from 'react';
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
    Stack,
    Button,
    Tooltip,
    Avatar,
} from "@mui/material";
import {
    Edit as EditIcon,
    Save as SaveIcon,
    Cancel as CancelIcon,
    ThumbUpAlt as ThumbUpIcon,
    ThumbDownAlt as ThumbDownIcon,
    Star as StarIcon,
    StarBorder as StarBorderIcon,
    Flag as FlagIcon,
    ChatBubbleOutline as CommentIcon,
    Person as PersonIcon,
    AutoAwesome as BotIcon,
} from "@mui/icons-material";

// Speaker avatar: teal bot mark for the chatbot, neutral person circle for the auditor.
function SpeakerAvatar({ author }) {
    const isUser = author === 'user';
    return (
        <Avatar
            variant="rounded"
            sx={{
                width: 32, height: 32, flex: 'none', mt: '2px',
                borderRadius: '10px',
                bgcolor: isUser ? 'action.selected' : 'primary.main',
                color: isUser ? 'text.secondary' : 'primary.contrastText',
            }}
        >
            {isUser ? <PersonIcon sx={{ fontSize: 18 }} /> : <BotIcon sx={{ fontSize: 18 }} />}
        </Avatar>
    );
}
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import LoadingDots from '../LoadingDots/LoadingDots';
import conversationHandler from '../../tools/ConversationHandler';
import AppConfig from '../../tools/AppConfig';
import { currentReactions } from '../../tools/audit/reactions';
import styles from './ChatMessages.module.css';

// Inline turn-level reaction controls under a chatbot message (AUD-5 / EVAL-1).
function MessageReactions({ messageId, types, reactions, onReact }) {
    const [commentOpen, setCommentOpen] = useState(false);
    const [comment, setComment] = useState('');
    const cur = (type) => reactions.find((r) => r.messageId === messageId && r.type === type);
    const thumbs = (cur('thumbs') || {}).value;
    const star = Boolean((cur('star') || {}).value);
    const flag = Boolean((cur('flag') || {}).value);
    const commentCount = reactions.filter((r) => r.messageId === messageId && r.type === 'comment' && r.comment).length;

    return (
        <Box onMouseUp={(e) => e.stopPropagation()} sx={{ mt: 0.5 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
                {types.includes('thumbs') && (
                    <>
                        <Tooltip title="Helpful"><IconButton size="small" color={thumbs === 'up' ? 'primary' : 'default'} onClick={() => onReact('thumbs', thumbs === 'up' ? null : 'up')}><ThumbUpIcon fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Not helpful"><IconButton size="small" color={thumbs === 'down' ? 'error' : 'default'} onClick={() => onReact('thumbs', thumbs === 'down' ? null : 'down')}><ThumbDownIcon fontSize="small" /></IconButton></Tooltip>
                    </>
                )}
                {types.includes('star') && (
                    <Tooltip title="Star"><IconButton size="small" color={star ? 'warning' : 'default'} onClick={() => onReact('star', star ? null : true)}>{star ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}</IconButton></Tooltip>
                )}
                {types.includes('flag') && (
                    <Tooltip title="Flag as problematic"><IconButton size="small" color={flag ? 'error' : 'default'} onClick={() => onReact('flag', flag ? null : true)}><FlagIcon fontSize="small" /></IconButton></Tooltip>
                )}
                {types.includes('comment') && (
                    <Tooltip title="Add a comment"><IconButton size="small" color={commentCount ? 'primary' : 'default'} onClick={() => setCommentOpen((o) => !o)}><CommentIcon fontSize="small" /></IconButton></Tooltip>
                )}
                {commentCount > 0 && <Typography variant="caption" color="text.secondary">{commentCount} comment(s)</Typography>}
            </Stack>
            {commentOpen && (
                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                    <TextField size="small" placeholder="Add a comment…" value={comment} onChange={(e) => setComment(e.target.value)} fullWidth />
                    <Button size="small" variant="contained" onClick={() => { if (comment.trim()) { onReact('comment', null, comment.trim()); setComment(''); setCommentOpen(false); } }}>Add</Button>
                </Stack>
            )}
        </Box>
    );
}

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

    // Turn-level reactions (config-gated). Uses the singletons so no prop-drilling
    // through ChatPage/ChatLayout is needed.
    const reactionCfg = (AppConfig.getAll().config && AppConfig.getAll().config.evaluation
        && AppConfig.getAll().config.evaluation.turnReactions) || { enabled: false, types: [] };
    const [reactions, setReactions] = useState([]);

    // Live streaming reply: null = idle, '' = awaiting first token (typing dots),
    // else the accumulating text. Driven by ConversationHandler.
    const [streaming, setStreaming] = useState(null);
    useEffect(() => {
        const cb = (content) => setStreaming(content);
        conversationHandler.registerOnStreamingUpdated(cb);
        return () => conversationHandler.unregisterOnStreamingUpdated(cb);
    }, []);

    useEffect(() => {
        const conv = conversationHandler.getActiveConversation();
        setReactions(conv && conv.getReactions ? conv.getReactions() : []);
        const onUpd = (list) => setReactions(list || []);
        conversationHandler.on('reactionsUpdated', onUpd);
        return () => conversationHandler.removeListener('reactionsUpdated', onUpd);
    }, [messages]);

    const react = async (messageId, type, value, comment = null) => {
        const conv = conversationHandler.getActiveConversation();
        if (!conv) return;
        try {
            const updated = await conversationHandler.addReaction(conv.id, { messageId, type, value, comment });
            setReactions(updated);
        } catch (e) {
            console.warn('Reaction failed:', e.message);
        }
    };

    useEffect(() => {
        if (isScrollToBottom) scrollToBottom();
    }, [messages, streaming]);

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
                            className={styles['message-row']}
                            onMouseUp={() =>
                                handleTextSelection &&
                                handleTextSelection(message.id, message.author, message.content)
                            }
                            sx={{
                                display: 'flex',
                                marginBottom: '16px',
                                justifyContent: message.author === 'user' ? 'flex-start' : 'flex-end',
                                maxWidth: '100%',
                            }}
                        >
                            <Box sx={{
                                display: 'flex',
                                gap: 1.25,
                                alignItems: 'flex-start',
                                flexDirection: message.author === 'user' ? 'row' : 'row-reverse',
                                maxWidth: '82%',
                                minWidth: 0,
                            }}>
                            <SpeakerAvatar author={message.author} />
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    minWidth: 0,
                                    maxWidth: '100%',
                                }}
                                className={styles['message-bubble-container']}
                            >
                                {/* Username */}
                                <Typography
                                    variant="caption"
                                    sx={{
                                        marginBottom: '4px',
                                        fontSize: '0.85em',
                                        color: 'text.secondary',
                                        textAlign: message.author === 'user' ? 'left' : 'right', // Align based on author
                                        display: 'block', // Ensures the alignment applies properly
                                    }}
                                    className={styles['message-author']}
                                >
                                    <strong>{message.author === 'user' ? 'You' : 'AI Chatbot'}</strong>
                                </Typography>

                                {/* Message bubble */}
                                <Paper
                                    elevation={0}
                                    sx={{
                                        padding: '10px 14px',
                                        wordBreak: 'break-word',
                                        fontSize: '1em',
                                        lineHeight: '1.5',
                                        width: 'fit-content',
                                        maxWidth: '100%',
                                        border: '1px solid',
                                        borderColor: message.author === 'user' ? 'transparent' : 'divider',
                                        color: message.author === 'user'
                                            ? (t) => (t.palette.mode === 'dark' ? '#ccfbf1' : '#134e4a')
                                            : 'text.primary',
                                        backgroundColor: message.author === 'user'
                                            ? (t) => (t.palette.mode === 'dark' ? 'rgba(20,184,166,0.20)' : 'rgba(13,148,136,0.12)')
                                            : 'background.paper',
                                        borderRadius: message.author === 'user' ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
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
                                            color="success"
                                            sx={{ marginBottom: '8px' }}
                                            className={`${styles['status-chip']} ${styles['restart-chip']}`}
                                        />
                                    )}
                                    {isEditedMessage && (
                                        <Chip
                                            label="Edited Message"
                                            size="small"
                                            color="warning"
                                            sx={{ marginBottom: '8px' }}
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

                                {/* Turn-level reactions on chatbot messages */}
                                {reactionCfg.enabled && message.author !== 'user' && !editingMessageId && (
                                    <MessageReactions
                                        messageId={message.id}
                                        types={reactionCfg.types || []}
                                        reactions={currentReactions(reactions)}
                                        onReact={(type, value, comment) => react(message.id, type, value, comment)}
                                    />
                                )}
                            </Box>
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

                {/* Live streaming reply: typing dots until the first token, then
                    the reply flows in with a blinking caret. */}
                {streaming !== null && (
                    <ListItem className={styles['message-row']} sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2, maxWidth: '100%' }}>
                        <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', flexDirection: 'row-reverse', maxWidth: '82%' }}>
                            <SpeakerAvatar author="bot" />
                            <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <Typography
                                    variant="caption"
                                    sx={{ mb: '4px', fontSize: '0.85em', color: 'text.secondary', textAlign: 'right', display: 'block' }}
                                >
                                    <strong>AI Chatbot</strong>
                                </Typography>
                                <Paper
                                    elevation={0}
                                    sx={{
                                        padding: '10px 14px', border: '1px solid', borderColor: 'divider',
                                        backgroundColor: 'background.paper', borderRadius: '14px 4px 14px 14px',
                                        wordBreak: 'break-word', width: 'fit-content', maxWidth: '100%',
                                    }}
                                >
                                    {streaming === '' ? (
                                        <LoadingDots />
                                    ) : (
                                        <Typography component="div" sx={{ whiteSpace: 'pre-wrap', fontSize: '1em', lineHeight: 1.5 }}>
                                            {streaming}
                                            <span className={styles['stream-caret']} />
                                        </Typography>
                                    )}
                                </Paper>
                            </Box>
                        </Box>
                    </ListItem>
                )}

                {/* Fallback loading indicator (only when not actively streaming). */}
                {isLoading && streaming === null && (
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
