// conversationhandler.js

import apiClient from './APIClient';
import { CHAT_EVENT_TYPE, STATE, ChatEvent, Message } from './models';
import { EventEmitter } from 'events';
import db from './db';

class ConversationHandler extends EventEmitter {
    constructor() {
        super();
        this.currentConversation = null;
        this.visibleMessages = [];
        this.contextMessages = [];
        this.lastUserMessageIndex = -1;
    }

    initialize(apiClient, db) {
        this.apiClient = apiClient;
        this.db = db;
    }

    async setActiveConversation(conversationId) {
        this.currentConversation = await db.getConversationById(conversationId);
        this.buildVisibleMessages(this.currentConversation);
        // this.buildContext(this.currentConversation);
        await this.updateConversationState(conversationId, this.currentConversation.state);
        console.log('Active conversation set:', this.currentConversation);
        return this.currentConversation;
    }

    getActiveConversation() {
        return this.currentConversation;
    }

    async createNewConversation() {
        const conversation = await db.createConversation();
        return conversation;
    }

    async getConversationById(conversationId) {
        return db.getConversationById(conversationId);
    }

    async getExistingConversations() {
        return db.getAllConversations();
    }

    registerOnStateUpdated(callback) {
        this.on('stateUpdated', callback);
    }

    unregisterOnStateUpdated(callback) {
        this.removeListener('stateUpdated', callback);
    }

    registerOnVisibleChatUpdated(callback) {
        this.on('visibleChatUpdated', callback);
    }

    unregisterOnVisibleChatUpdated(callback) {
        this.removeListener('visibleChatUpdated', callback);
    }

    registerOnError(callback) {
        this.on('TRAILS_API_error', callback);
    }

    unregisterOnError(callback) {
        this.removeListener('TRAILS_API_error', callback);
    }

    async addChatEvent(conversationId, event) {
        if (!conversationId) throw new Error('Invalid conversation ID');
        if (!event) throw new Error('Event is undefined');

        try {
            const conversation = await db.getConversationById(conversationId);
            if (!conversation) {
                throw new Error(`Conversation with ID ${conversationId} not found`);
            }

            conversation.addChatEvent(event);
            await db.updateConversation(conversationId, conversation);

            switch (event.type) {   
                case CHAT_EVENT_TYPE.NEW_USER_MESSAGE:
                    // Build context and visible messages
                    this.buildVisibleMessages(conversation);
                    this.buildContext(conversation);

                    const newResponse = await apiClient.sendChatMessage(this.contextMessages);
                    if (newResponse?.status === "error400") {
                        const newBotEvent = new ChatEvent(CHAT_EVENT_TYPE.API_ERROR, null);
                        await this.addChatEvent(conversationId, newBotEvent);
                        break;
                    }
                    const newBotMessageContent = newResponse.data.body.message.content;

                    if (!newBotMessageContent) {
                        throw new Error('Invalid API response structure');
                    }

                    // Create bot message only once
                    const newBotMessage = new Message({
                        author: 'bot',
                        content: newBotMessageContent,
                        referencedMessageId: event.data.id,
                    });

                    // Create and add bot event
                    const newBotEvent = new ChatEvent(CHAT_EVENT_TYPE.NEW_BOT_MESSAGE, newBotMessage);
                    await this.addChatEvent(conversationId, newBotEvent);
                    break;

                case CHAT_EVENT_TYPE.NEW_BOT_MESSAGE:
                    this.buildVisibleMessages(conversation);
                    this.buildContext(conversation);
                    break;

                case CHAT_EVENT_TYPE.EDIT_MESSAGE:
                    // Build context and visible messages
                    this.buildVisibleMessages(conversation);
                    this.buildContext(conversation);

                    // Send message to API
                    const editResponse = await apiClient.sendChatMessage(this.contextMessages);
                    if (editResponse?.status === "error400") {
                        const newBotEvent = new ChatEvent(CHAT_EVENT_TYPE.API_ERROR, null);
                        await this.addChatEvent(conversationId, newBotEvent);
                        break;
                    }
                    const editbotMessageContent = editResponse.data.body.message.content;

                    if (!editbotMessageContent) {
                        throw new Error('Invalid API response structure');
                    }

                    // Create new bot message referencing the edited message
                    const editbotMessage = new Message({
                        author: 'bot',
                        content: editbotMessageContent,
                        referencedMessageId: event.data.id,
                    });

                    // Create and add bot event
                    const editbotEvent = new ChatEvent(CHAT_EVENT_TYPE.NEW_BOT_MESSAGE, editbotMessage);
                    await this.addChatEvent(conversationId, editbotEvent);
                    break;
        
                case CHAT_EVENT_TYPE.RESTART_CHAT:
                    // Rebuild context and visible messages
                    this.buildContext(conversation);
                    this.buildVisibleMessages(conversation);
                    break;

                case CHAT_EVENT_TYPE.END_CHAT:
                    console.log('end conversation event triggered');
                    await this.updateConversationState(conversationId, STATE.AUDIT_LIKERTRESPONSE);
                    console.log('update conversation state to audit likert response');
                    break;
                case CHAT_EVENT_TYPE.API_ERROR:
                    console.log('api error event triggered');
                    this.emit('TRAILS_API_error'); 
                    break;
                default:
                    break;
            }
        } catch (error) {
            console.error('Error in addChatEvent:', error);
            throw error;
        }
    }

    buildContext(conversation) {
        // Find last restart event
        let lastRestartIndex = -1;
        for (let i = conversation.chatEvents.length - 1; i >= 0; i--) {
            if (conversation.chatEvents[i].type === CHAT_EVENT_TYPE.RESTART_CHAT) {
                lastRestartIndex = i;
                break;
            }
        }

        // Clear context and rebuild
        this.contextMessages = [];
        this.lastUserMessageIndex = -1;
        const messageEdits = {};

        // Process events after last restart
        for (let i = lastRestartIndex + 1; i < conversation.chatEvents.length; i++) {
            const event = conversation.chatEvents[i];

            if (event.type === CHAT_EVENT_TYPE.EDIT_MESSAGE) {
                const editedMessage = event.data;
                const originalMessageId = editedMessage.referencedMessageId;

                // Record the edit
                messageEdits[originalMessageId] = editedMessage;

                // Remove original message and bot response from context
                this.contextMessages = this.contextMessages.filter(
                    msg => 
                        msg.id !== originalMessageId && 
                        msg.referencedMessageId !== originalMessageId
                );

                // Add the edited message to context
                this.contextMessages.push(editedMessage);
                this.lastUserMessageIndex = this.contextMessages.length - 1;

            } else if (
                event.type === CHAT_EVENT_TYPE.NEW_USER_MESSAGE ||
                event.type === CHAT_EVENT_TYPE.NEW_BOT_MESSAGE
            ) {
                const message = event.data;

                // Skip original messages that have been edited
                if (messageEdits.hasOwnProperty(message.id)) continue;

                // Skip bot responses to messages that have been edited
                if (
                    message.referencedMessageId &&
                    messageEdits.hasOwnProperty(message.referencedMessageId)
                ) continue;

                // Add message to context
                this.contextMessages.push(message);

                if (message.author === 'user') {
                    this.lastUserMessageIndex = this.contextMessages.length - 1;
                }
            }
        }
    }

    buildVisibleMessages(conversation) {
        this.visibleMessages = [];
        const messageEdits = {};
    
        conversation.chatEvents.forEach((event) => {
            if (event.type === CHAT_EVENT_TYPE.EDIT_MESSAGE) {
                const editedMessage = { ...event.data, isEdited: true };
                messageEdits[editedMessage.referencedMessageId] = editedMessage;
                this.visibleMessages.push(editedMessage);
            } else if (
                event.type === CHAT_EVENT_TYPE.NEW_USER_MESSAGE || 
                event.type === CHAT_EVENT_TYPE.NEW_BOT_MESSAGE
            ) {
                const message = { ...event.data };
    
                // Mark original messages as edited if they have been edited
                if (messageEdits.hasOwnProperty(message.id)) {
                    message.isEdited = true;
                }
    
                this.visibleMessages.push(message);
            } else if (event.type === CHAT_EVENT_TYPE.RESTART_CHAT) {
                // Handle restart events in visible messages
                this.visibleMessages.push({
                    id: event.id,
                    type: 'separator',
                    reason: 'Conversation Restarted',
                });
            }
        });
    
        this.emit('visibleChatUpdated');
        return this.visibleMessages;
    }

    getContext() {
        return this.contextMessages;
    }

    getVisibleConversation() {
        return this.visibleMessages;
    }

    canEditLastMessage() {
        return this.lastUserMessageIndex >= 0;
    }

    getLastUserMessage() {
        if (this.lastUserMessageIndex >= 0) {
            return this.contextMessages[this.lastUserMessageIndex];
        }
        return null;
    }

    async updateConversationState(conversationId, newState) {
        try {
            const conversation = await db.getConversationById(conversationId);
            if (conversation) {
                conversation.state = newState;
                await db.updateConversation(conversationId, conversation);
                this.emit('stateUpdated', newState);
                console.log('Conversation state updated at conversationhandler:', newState);
            }
        } catch (error) {
            console.error('Error updating conversation state:', error);
            throw error;
        }
    }

    async addAuditResponse(conversationId, auditResponse) {
        if (!conversationId) throw new Error('Invalid conversation ID');
        if (!auditResponse) throw new Error('Audit response is undefined');

        try {
            const conversation = await db.getConversationById(conversationId);
            if (!conversation) {
                throw new Error(`Conversation with ID ${conversationId} not found`);
            }

            // Add audit response to conversation
            conversation.addAudit(auditResponse);

            if (conversation.state === STATE.COMPLETE) {
                conversation.endAudit();
                conversation.endConversation();
                await this.updateConversationState(conversationId, STATE.COMPLETE);
            }

            await db.updateConversation(conversationId, conversation);
        } catch (error) {
            console.error('Error in addAuditResponse:', error);
            throw error;
        }
    }

    async exportConversations(conversations) {
        const exportData = {
            conversations: []
        };

        for (const conversation of conversations) {
            const conversationData = await db.getConversationById(conversation.id);
            exportData.conversations.push(conversationData);
        }

        return exportData;
    }

    destroy() {
        this.removeAllListeners();
    }

    // Import conversations
    async importExportedConversations(exportData) {
        for (const conversationData of exportData) {
            db.addConversation(conversationData);
        }
    }

    // Delete all conversations
    async deleteAllConversations() {
        return await db.resetDatabase();
    }
}

const conversationHandler = new ConversationHandler();

export default conversationHandler;