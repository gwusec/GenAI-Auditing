// IndexedDBStore — the local-persistence implementation of ConversationStore.
// This is the current default and preserves the exact behavior of the previous
// src/tools/db.js (Dexie). No behavior change — just moved behind the seam.

import Dexie from 'dexie';
import { Conversation } from '../models';
import { BaseConversationStore } from './ConversationStore';

export class IndexedDBStore extends BaseConversationStore {
  constructor(dbName = 'llmChatDatabase') {
    super();
    this.db = new Dexie(dbName);
    this.db.version(1).stores({
      conversations: 'id, userID, startTimestamp, endTimestamp, state, events, audit',
    });
    this.db.conversations.mapToClass(Conversation);
  }

  async createConversation(userID) {
    const conversation = new Conversation(userID);
    await this.db.conversations.add(conversation);
    return conversation;
  }

  async getConversationById(id) {
    return this.db.conversations.get(id);
  }

  async getAllConversations() {
    const conversations = await this.db.conversations.toArray();
    return conversations.sort((a, b) => a.startTimestamp - b.startTimestamp);
  }

  async updateConversation(id, updatedData) {
    await this.db.conversations.update(id, updatedData);
    return this.getConversationById(id);
  }

  // Append a single chat event (+ optional state). Local storage is single-tab,
  // so read-modify-write is race-free here; the atomic RPC only matters for the
  // shared Supabase backend. Mirrors SupabaseStore.appendChatEvent so
  // ConversationHandler can call it uniformly.
  async appendChatEvent(id, event, state = null) {
    const conv = await this.db.conversations.get(id);
    if (!conv) return undefined;
    conv.chatEvents = [...(conv.chatEvents || []), event];
    if (state) conv.state = state;
    await this.db.conversations.update(id, conv);
    return conv;
  }

  async deleteConversation(id) {
    await this.db.conversations.delete(id);
  }

  async addConversation(conversation) {
    return this.db.conversations.add(conversation);
  }

  async resetDatabase() {
    await this.db.conversations.clear();
  }
}

export default IndexedDBStore;
