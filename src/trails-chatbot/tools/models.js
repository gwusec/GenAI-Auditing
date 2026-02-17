// TRAILS-Chatbot/src/tools/models.js

import * as uuid from 'uuid';


// Enumeration of all possible event types in the system

const CHAT_EVENT_TYPE = {
    NEW_CHAT: 'new_chat',
    NEW_USER_MESSAGE: 'new_user_message',
    NEW_BOT_MESSAGE: 'new_bot_message',
    RESTART_CHAT: 'restart_chat',
    EDIT_MESSAGE: 'edit_message',
    END_CHAT: 'end_chat',
    API_ERROR: 'api_error'
};

const STATE = {
    CHAT: 'chat',
    AUDIT_LIKERTRESPONSE: 'audit_likertresponse',
    AUDIT_HIGHLIGHT: 'audit_highlight',
    AUDIT_TEXTRESPONSE: 'audit_textresponse',
    COMPLETE: 'complete'
}

class User {
    constructor(id) {
        this.id = id;
    }
}

class Conversation {
    constructor(userID) {
        this.id = uuid.v4();
        this.userID = userID;
        this.startTimestamp = Date.now();
        this.endTimestamp = null;
        this.chatEvents = [];
        this.audit = new AuditResponse();
        this.state = STATE.CHAT;
    }

    endConversation() {
        this.endTimestamp = Date.now();
    }

    addChatEvent(event) {
        try {
            this.chatEvents.push(event);
            this.updateState(event);
        } catch (error) {
            console.error('Error adding chat event:', error);
        }
    }

    addAudit(data) {
        this.audit = { ...this.audit, ...data };
    }

    endAudit() {
        this.audit.endTimestamp = Date.now();
    }

    updateState(event) {
        if (this.state === STATE.CHAT && event.type === CHAT_EVENT_TYPE.END_CHAT) {
            // Do not hardcode next state. Let AuditForm.jsx determine it.
            this.state = 'audit_pending';
        } else if (this.state === STATE.AUDIT_LIKERTRESPONSE) {
            this.state = STATE.AUDIT_HIGHLIGHT;
        } else if (this.state === STATE.AUDIT_HIGHLIGHT) {
            this.state = STATE.AUDIT_TEXTRESPONSE;
        } else if (this.state === STATE.AUDIT_TEXTRESPONSE) {
            this.state = STATE.COMPLETE;
        } else if (this.state === STATE.COMPLETE) {
            throw new Error('Conversation has already ended');
        }
    }

    getChat() { //implement going through events instead to build chat
        return this.chatEvents
            .filter(event => [CHAT_EVENT_TYPE.NEW_USER_MESSAGE, CHAT_EVENT_TYPE.NEW_BOT_MESSAGE, CHAT_EVENT_TYPE.EDIT_MESSAGE].includes(event.type))
            .map(event => event.data);
    }
}

class Message {
    constructor({ author, content, referencedMessageId = null, isEdited = false }) {
        this.id = uuid.v4();
        this.author = author; // 'user' or 'bot' or 'system'
        this.content = content;
        this.timestamp = Date.now();
        this.referencedMessageId = referencedMessageId;
        this.isEdited = isEdited;
    }

    markAsEdited() {
        this.isEdited = true;
    }
}

class AuditResponse {
    constructor() {
        this.id = uuid.v4();
        this.startTimestamp = Date.now();
        this.endTimestamp = null;
        this.likertResponses = {}; // Initialize as empty object
        this.highlights = [];
        this.textResponses = {}; // Initialize as empty object
    }
}

class ChatEvent {
    constructor(type, data) {
        this.id = uuid.v4();
        this.type = type;
        this.timestamp = Date.now();
        this.data = data;

        // Validate event type
        if (!Object.values(CHAT_EVENT_TYPE).includes(type)) {
            throw new Error(`Invalid event type: ${type}`);
        }
        if ([CHAT_EVENT_TYPE.NEW_USER_MESSAGE, CHAT_EVENT_TYPE.NEW_BOT_MESSAGE, CHAT_EVENT_TYPE.EDIT_MESSAGE].includes(type)) {
            if (!(data instanceof Message)) {
                throw new Error(`Invalid data type for event type ${type}`);
            }
        } else if ([CHAT_EVENT_TYPE.NEW_CHAT, CHAT_EVENT_TYPE.RESTART_CHAT, CHAT_EVENT_TYPE.END_CHAT, CHAT_EVENT_TYPE.API_ERROR].includes(type)) {
            if (data !== null) {
                throw new Error(`Invalid data type for event type ${type}`);
            }
        }
    }
}

export { User, Conversation, Message, AuditResponse, ChatEvent, CHAT_EVENT_TYPE, STATE };
