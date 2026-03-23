// TRAILS-Chatbot/src/tools/db.js

import Dexie from 'dexie';
import { Conversation } from './models';

export const db = new Dexie('llmChatDatabase');

db.version(1).stores({
    conversations: 'id, userID, startTimestamp, endTimestamp, state, events, audit',
});
db.conversations.mapToClass(Conversation);

db.initializeDatabase = async () => {
};

// Create a new conversation
db.createConversation = async (userID) => {
    const conversation = new Conversation(userID);
    await db.conversations.add(conversation);
    return conversation;
};

// Read a conversation by ID
db.getConversationById = async (id) => {
    return await db.conversations.get(id);
};

// Read all conversations
db.getAllConversations = async () => {
    const conversations = await db.conversations.toArray();
    return conversations.sort((a, b) => a.startTimestamp - b.startTimestamp);
};

// Read conversations by User ID
db.getConversationsByUserId = async (userID) => {
    const conversations = await db.conversations.where('userID').equals(userID).toArray();
    return conversations.sort((a, b) => a.startTimestamp - b.startTimestamp);
};

// Update a conversation by ID
db.updateConversation = async (id, updatedData) => {
    await db.conversations.update(id, updatedData);
    return await db.getConversationById(id);
};

// Delete a conversation by ID
db.deleteConversation = async (id) => {
    await db.conversations.delete(id);
};

// Add a new conversation to the database from a conversation object
db.addConversation = async (conversation) => {
    return await db.conversations.add(conversation);
};

// Clear the database
db.resetDatabase = async () => {
    await db.conversations.clear();
};

export default db;