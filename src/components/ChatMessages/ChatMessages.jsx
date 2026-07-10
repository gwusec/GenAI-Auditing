// src/components/ChatMessages.jsx

import React, { useEffect, useRef, useState } from 'react';
import {
    List,
    ListItem,
    Typography,
    Divider,
    Box,
    Stack,
} from '../ui/layout';
import { Alert, AlertDescription } from '../ui/alert';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { Tooltip } from '../ui/tooltip';
import { Edit as EditIcon, Close as CancelIcon } from '../ui/icons';
import {
    Save as SaveIcon,
    ThumbsUp as ThumbUpIcon,
    ThumbsDown as ThumbDownIcon,
    Star as StarIcon,
    Flag as FlagIcon,
    MessageCircle as CommentIcon,
    User as PersonIcon,
    Sparkles as BotIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// Speaker avatar: teal bot mark for the chatbot, neutral person circle for the auditor.
function SpeakerAvatar({ author }) {
    const isUser = author === 'user';
    return (
        <div
            className={cn(
                'mt-[2px] flex h-8 w-8 flex-none items-center justify-center rounded-[10px]',
                isUser ? 'bg-accent text-muted-foreground' : 'bg-primary text-primary-foreground',
            )}
        >
            {isUser ? <PersonIcon size={18} /> : <BotIcon size={18} />}
        </div>
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
        <Box onMouseUp={(e) => e.stopPropagation()} className="mt-1">
            <Stack direction="row" spacing={0.5} alignItems="center">
                {types.includes('thumbs') && (
                    <>
                        <Tooltip title="Helpful"><Button variant="ghost" size="icon" className={cn('h-8 w-8', thumbs === 'up' && 'text-primary')} onClick={() => onReact('thumbs', thumbs === 'up' ? null : 'up')}><ThumbUpIcon size={18} /></Button></Tooltip>
                        <Tooltip title="Not helpful"><Button variant="ghost" size="icon" className={cn('h-8 w-8', thumbs === 'down' && 'text-destructive')} onClick={() => onReact('thumbs', thumbs === 'down' ? null : 'down')}><ThumbDownIcon size={18} /></Button></Tooltip>
                    </>
                )}
                {types.includes('star') && (
                    <Tooltip title="Star"><Button variant="ghost" size="icon" className={cn('h-8 w-8', star && 'text-warning')} onClick={() => onReact('star', star ? null : true)}>{star ? <StarIcon size={18} className="fill-current" /> : <StarIcon size={18} />}</Button></Tooltip>
                )}
                {types.includes('flag') && (
                    <Tooltip title="Flag as problematic"><Button variant="ghost" size="icon" className={cn('h-8 w-8', flag && 'text-destructive')} onClick={() => onReact('flag', flag ? null : true)}><FlagIcon size={18} /></Button></Tooltip>
                )}
                {types.includes('comment') && (
                    <Tooltip title="Add a comment"><Button variant="ghost" size="icon" className={cn('h-8 w-8', commentCount && 'text-primary')} onClick={() => setCommentOpen((o) => !o)}><CommentIcon size={18} /></Button></Tooltip>
                )}
                {commentCount > 0 && <Typography variant="caption" color="text.secondary">{commentCount} comment(s)</Typography>}
            </Stack>
            {commentOpen && (
                <Stack direction="row" spacing={1} className="mt-1">
                    <Input placeholder="Add a comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
                    <Button size="sm" onClick={() => { if (comment.trim()) { onReact('comment', null, comment.trim()); setComment(''); setCommentOpen(false); } }}>Add</Button>
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

    // Entrance animation should fire only for a genuinely new message (a live send),
    // never for the whole history on load / tab switch, and never for the bot's
    // committed reply (which the streaming bubble already animated in). We seed a
    // "seen" set on mount, then animate only when exactly one new id appears.
    const seenIdsRef = useRef(null);
    const freshIds = messages.filter((m) => seenIdsRef.current && !seenIdsRef.current.has(m.id));
    const animateId = freshIds.length === 1 ? freshIds[0].id : null;
    useEffect(() => {
        if (seenIdsRef.current === null) seenIdsRef.current = new Set(messages.map((m) => m.id));
        else messages.forEach((m) => seenIdsRef.current.add(m.id));
    }, [messages]);

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
                    variant="destructive"
                    className={cn('relative', styles['error-alert'])}
                >
                    <AlertDescription>{error}</AlertDescription>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setError(null)}
                        className="absolute right-2 top-2 h-6 w-6"
                        aria-label="Close"
                    >
                        <CancelIcon fontSize="small" />
                    </Button>
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
                            className={cn(
                                'mb-4 max-w-full',
                                message.author === 'user' ? 'justify-end' : 'justify-start',
                                (message.id === animateId && message.author === 'user') && styles['message-row'],
                            )}
                            onMouseUp={() =>
                                handleTextSelection &&
                                handleTextSelection(message.id, message.author, message.content)
                            }
                        >
                            <Box className={cn(
                                'flex items-start gap-2.5 min-w-0 max-w-[82%]',
                                message.author === 'user' ? 'flex-row-reverse' : 'flex-row',
                            )}>
                            <SpeakerAvatar author={message.author} />
                            <Box
                                className={cn('flex flex-col min-w-0 max-w-full', styles['message-bubble-container'])}
                            >
                                {/* Username */}
                                <Typography
                                    variant="caption"
                                    className={cn(
                                        'mb-1 block text-[0.85em]',
                                        message.author === 'user' ? 'text-right' : 'text-left',
                                        styles['message-author'],
                                    )}
                                >
                                    <strong>{message.author === 'user' ? 'You' : 'AI Chatbot'}</strong>
                                </Typography>

                                {/* Message bubble */}
                                <Card
                                    className={cn(
                                        'w-fit max-w-full break-words border px-[13px] py-2 text-[0.9rem] leading-[1.55]',
                                        message.author === 'user'
                                            ? 'border-transparent text-[#134e4a] dark:text-[#ccfbf1] bg-[rgba(13,148,136,0.12)] dark:bg-[rgba(20,184,166,0.20)] rounded-[16px_6px_16px_16px]'
                                            : 'border-border text-foreground bg-card rounded-[6px_16px_16px_16px]',
                                        styles['message-paper'],
                                        message.author === 'user' ? styles['user-message'] : styles['bot-message'],
                                    )}
                                >
                                    {/* Status chips */}
                                    {isRestartedMessage && (
                                        <Badge
                                            variant="success"
                                            className={cn('mb-2', styles['status-chip'], styles['restart-chip'])}
                                        >
                                            Restarted Conversation
                                        </Badge>
                                    )}
                                    {isEditedMessage && (
                                        <Badge
                                            variant="warning"
                                            className={cn('mb-2', styles['status-chip'], styles['edit-chip'])}
                                        >
                                            Edited Message
                                        </Badge>
                                    )}
                                    {/* Message content */}
                                    <div className={styles['message-content']}>
                                        {editingMessageId === message.id ? (
                                            <div className={styles['edit-message-container']}>
                                                <Textarea
                                                    value={editedContent}
                                                    onChange={(e) => setEditedContent(e.target.value)}
                                                    className={styles['edit-textfield']}
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={onSaveEdit}
                                                    aria-label="Save edited message"
                                                    title="Save edited message"
                                                >
                                                    <SaveIcon size={18} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={onCancelEdit}
                                                    aria-label="Cancel editing"
                                                    title="Cancel editing"
                                                >
                                                    <CancelIcon fontSize="small" />
                                                </Button>
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
                                </Card>

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
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => onEditMessage(message.id)}
                                        className={styles['edit-button']}
                                        aria-label="Edit message"
                                        title="Edit message"
                                    >
                                        <EditIcon fontSize="small" />
                                    </Button>
                                )}
                        </ListItem>
                    );
                })}

                {/* Live streaming reply: typing dots until the first token, then
                    the reply flows in with a blinking caret. */}
                {streaming !== null && (
                    <ListItem className={cn('justify-start mb-4 max-w-full', styles['message-row'])}>
                        <Box className="flex items-start gap-2.5 max-w-[82%] flex-row">
                            <SpeakerAvatar author="bot" />
                            <Box className="flex flex-col min-w-0">
                                <Typography
                                    variant="caption"
                                    className="mb-1 block text-left text-[0.85em]"
                                >
                                    <strong>AI Chatbot</strong>
                                </Typography>
                                <Card
                                    className="w-fit max-w-full break-words border border-border bg-card px-[13px] py-2 rounded-[6px_16px_16px_16px]"
                                >
                                    {streaming === '' ? (
                                        <LoadingDots />
                                    ) : (
                                        <Typography component="div" className="whitespace-pre-wrap text-[0.9rem] leading-[1.55]">
                                            {streaming}
                                            <span className={styles['stream-caret']} />
                                        </Typography>
                                    )}
                                </Card>
                            </Box>
                        </Box>
                    </ListItem>
                )}

                {/* Fallback loading indicator (only when not actively streaming). */}
                {isLoading && streaming === null && (
                    <ListItem className="flex-col items-end mb-4">
                        <Card className={styles['loading-paper']}>
                            <LoadingDots />
                        </Card>
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
