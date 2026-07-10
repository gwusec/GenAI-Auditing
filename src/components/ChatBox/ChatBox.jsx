// src/components/ChatBox.jsx

import React, { useState, useEffect, useCallback } from 'react';
import conversationHandler from '../../tools/ConversationHandler';
import { Message, ChatEvent, CHAT_EVENT_TYPE } from '../../tools/models';
import MessageForm from '../MessageForm/MessageForm';
import { fairnessProperties } from '../../tools/principles';
import ChatBoxTutorial from '../tutorials/ChatBoxTutorial';
import styles from './ChatBox.module.css';
import ChatMessages from '../ChatMessages/ChatMessages';
import {
    Typography,
    Box,
    Button,
    Container,
    Chip,
    Tooltip,
} from "@mui/material";
import {
    Info as InfoIcon,
} from "@mui/icons-material";

const fairnessPropertiesRandomOrder = [...fairnessProperties].sort(() => 0.5 - Math.random());

const ChatBox = ({ conversation, isActive, setLoading, onTutorialComplete, onTutorialStart, onTutorialEnd }) => {
    const [messages, setMessages] = useState([]);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editedContent, setEditedContent] = useState('');
    const [showTutorial, setShowTutorial] = useState(false);
    const [tutorialCompleted, setTutorialCompleted] = useState(false);
    const [showAllPrinciples, setShowAllPrinciples] = useState(false);

    // Initial setup
    useEffect(() => {
        const updateMessages = () => {
            const conversation = conversationHandler.getVisibleConversation();
            setMessages(conversation);
        };
        
        // Check for tutorial
        const chatTutorialShown = localStorage.getItem("chatTutorialShown");
        if (!chatTutorialShown) {
            setShowTutorial(true);
        } else {
            setShowTutorial(false);
            if (!tutorialCompleted && onTutorialComplete) {
                onTutorialComplete();
                setTutorialCompleted(true);
            }
        }

        // Listen for updates
        updateMessages();
        conversationHandler.registerOnVisibleChatUpdated(updateMessages);

        // Cleanup
        return () => {
            conversationHandler.unregisterOnVisibleChatUpdated(updateMessages);
        };
    }, [conversation, onTutorialComplete, tutorialCompleted]);


    useEffect(() => {
        if (typeof setLoading === 'function') {
            setLoading(isLoading);
        }
    }, [isLoading, setLoading]);

    useEffect(() => {
        if (showTutorial) {
            if (onTutorialStart && typeof onTutorialStart === 'function') onTutorialStart();
        } else {
            if (onTutorialEnd && typeof onTutorialEnd === 'function') onTutorialEnd();
        }
    }, [showTutorial]);

    const handleSendChatMessage = async (content) => {
        if (!isActive || isLoading) return;
    
        setIsLoading(true);
        setError(null);
    
        try {
            if (!conversation || !conversation.id) {
                throw new Error('No active conversation');
            }
            // 1. Create and add user message
            const userMessage = new Message({
                author: 'user',
                content: content,
            });
            await conversationHandler.addChatEvent(conversation.id, new ChatEvent(CHAT_EVENT_TYPE.NEW_USER_MESSAGE, userMessage));
        } catch (error) {
            console.error('Error in chat sequence:', error);
            setError('Failed to send message. (1) Please try again, or (2) reload the page. If error persists, please contact researchers.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditMessage = async (messageId) => {
        if (!conversationHandler.canEditLastMessage()) return;
        setEditingMessageId(messageId);
        const messageToEdit = messages.find(msg => msg.id === messageId);
        setEditedContent(messageToEdit.content);
    };

    const handleCancelEdit = () => {
        setEditingMessageId(null);
        setEditedContent('');
    };

    const handleSaveEdit = async () => {
        if (!editingMessageId || isLoading) return;
        setIsLoading(true);
    
        try {
            const editedMessage = new Message({
                conversationID: conversation.id,
                author: 'user',
                content: editedContent,
                referencedMessageId: editingMessageId
            });
    
            const editEvent = new ChatEvent(CHAT_EVENT_TYPE.EDIT_MESSAGE, editedMessage, conversation.id);
        
            await conversationHandler.addChatEvent(conversation.id, editEvent);
        
            setEditingMessageId(null);
            setEditedContent('');
        } catch (error) {
            console.error('Error saving edited message:', error);
            setError('Failed to save edited message. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestartConversation = async () => {
        if (isLoading) return;
        try {
            const restartEvent = new ChatEvent(CHAT_EVENT_TYPE.RESTART_CHAT, null, conversation.id);
            await conversationHandler.addChatEvent(conversation.id, restartEvent);
        } catch (error) {
            console.error('Error restarting conversation:', error);
            setError('Failed to restart conversation. Please try again.');
        }
    };
    
    const handleTutorialCompleteInternal = useCallback(() => {
        setShowTutorial(false);
        localStorage.setItem("chatTutorialShown", "true");
        if (onTutorialComplete) {
            onTutorialComplete();
        }
        setTutorialCompleted(true);
    }, [onTutorialComplete]);
    
    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleString();
    };

    return (
        <Box className={styles['chat-container']}>
            {/* Chat header */}
            <Typography variant="subtitle1" className={styles['chat-header']}>
                Conversation
            </Typography>
            {/* Main content area */}
            <Box className={styles['main-content']}>
                {/* Message list area */}
                <Box className={styles['message-list-area']} tutorial-step="chat-content">
                    <Container 
                        maxWidth="md"
                    >
                        <ChatMessages
                            messages={messages}
                            onEditMessage={handleEditMessage}
                            onCancelEdit={handleCancelEdit}
                            onSaveEdit={handleSaveEdit}
                            editingMessageId={editingMessageId}
                            editedContent={editedContent}
                            setEditedContent={setEditedContent}
                            formatTimestamp={formatTimestamp}
                            isLoading={isLoading}
                            error={error}
                            setError={setError}
                            isScrollToBottom={true}
                            canEditLastMessage={() => conversationHandler.canEditLastMessage()}
                        />
                    </Container>
                </Box>
                {/* Input area and footer */}
                <Box>
                    <Container maxWidth="md">
                        {isActive && conversation.id && (
                            <Box className={styles['chat-footer']}>
                                {/* Fairness principles — a quiet, compact chip row (hover a chip
                                    for the full description; "+N more" reveals the rest). */}
                                <Box tutorial-step="fairness-properties" sx={{ mb: 1.25 }}>
                                    <Typography
                                        variant="caption"
                                        sx={{ display: 'block', color: 'text.secondary', fontWeight: 600, mb: 1, px: 0.5 }}
                                    >
                                        Please verify the AI chatbot upholds these principles
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                        {(showAllPrinciples ? fairnessPropertiesRandomOrder : fairnessPropertiesRandomOrder.slice(0, 4)).map((property, index) => {
                                            const [title] = property.split(':');
                                            return (
                                                <Tooltip key={index} title={property} arrow placement="top">
                                                    <Chip
                                                        label={title}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{
                                                            borderRadius: '999px',
                                                            color: 'text.secondary',
                                                            borderColor: 'divider',
                                                            fontWeight: 500,
                                                            transition: 'border-color .15s ease, color .15s ease',
                                                            '&:hover': { borderColor: 'primary.main', color: 'text.primary' },
                                                        }}
                                                    />
                                                </Tooltip>
                                            );
                                        })}
                                        {!showAllPrinciples && fairnessPropertiesRandomOrder.length > 4 && (
                                            <Chip
                                                label={`+${fairnessPropertiesRandomOrder.length - 4} more`}
                                                size="small"
                                                onClick={() => setShowAllPrinciples(true)}
                                                sx={{ borderRadius: '999px', bgcolor: 'action.hover', fontWeight: 500 }}
                                            />
                                        )}
                                        {showAllPrinciples && (
                                            <Chip
                                                label="Show less"
                                                size="small"
                                                onClick={() => setShowAllPrinciples(false)}
                                                sx={{ borderRadius: '999px', bgcolor: 'action.hover', fontWeight: 500 }}
                                            />
                                        )}
                                    </Box>
                                </Box>
                                {/* Message input form */}
                                <Box className={styles['input-area']} tutorial-step="message-form">
                                    <MessageForm 
                                        onsendChatMessage={handleSendChatMessage} 
                                        disabled={isLoading} 
                                    />
                                    {/* Action buttons */}
                                    <Box className={styles['action-buttons']}>
                                        <Button 
                                            startIcon={<InfoIcon />} 
                                            onClick={() => setShowTutorial(true)}
                                        >
                                            Replay Tutorial
                                        </Button>
                                        <Button
                                            tutorial-step="restart-conversation-button"
                                            variant="outlined"
                                            color="secondary"
                                            onClick={handleRestartConversation}
                                            className={styles['restart-button']}
                                        >
                                            Restart Conversation
                                        </Button>
                                    </Box>
                                </Box>
                            </Box>
                        )}
                    </Container>
                </Box>
            </Box>
    
            {/* Tutorial modal */}
            {showTutorial && <ChatBoxTutorial onComplete={handleTutorialCompleteInternal} />}
        </Box>
    );
};

export default ChatBox;
