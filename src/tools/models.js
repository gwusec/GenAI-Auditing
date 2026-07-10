// TRAILS-Chatbot/src/tools/models.js

import * as uuid from 'uuid';


// Enumeration of all possible event types in the system

// new user image prompt
// new bot image response
const CHAT_EVENT_TYPE = {
    NEW_CHAT: 'new_chat',
    NEW_USER_MESSAGE: 'new_user_message',
    NEW_BOT_MESSAGE: 'new_bot_message',
    RESTART_CHAT: 'restart_chat',
    EDIT_MESSAGE: 'edit_message',
    END_CHAT: 'end_chat',
    API_ERROR: 'api_error',
    // Phase C: an in-chat turn-level reaction on one chatbot message (AUD-5 / EVAL-1).
    // Data: { messageId, type, value, comment? }. Lives in the event log so it shares
    // the immutable stimulus and survives resume.
    NEW_REACTION: 'new_reaction'
};

// new state - image
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
        // Phase B: provenance ties this conversation's data to the exact study
        // condition + config version in force (PRD §9 D9). Null until seeded.
        this.provenance = null;
        // Phase B: seed framing carried for the context builder under seed_prompt
        // mode (the actual relay/context wiring lands in Phase D). Null otherwise.
        this.controlContext = null;
    }

    endConversation() {
        this.endTimestamp = Date.now();
    }

    // Phase B: record provenance (control mode, seed/first-turn text, model
    // config id + version, config version) for export-time stratification.
    setProvenance(provenance) {
        this.provenance = provenance;
    }

    // Phase B: record the seed framing the context builder should prepend
    // (seed_prompt mode); does not appear as a visible chat turn.
    setControlContext(controlContext) {
        this.controlContext = controlContext;
    }

    addChatEvent(event) {
        try {
            this.chatEvents.push(event);
            this.updateState(event);
        } catch (error) {
            console.error('Error adding chat event:', error);
        }
    }

    addAudit (data) {
        this.audit = { ...this.audit, ...data };
    }

    endAudit() {
        this.audit.endTimestamp = Date.now();
    }

    updateState(event) {
        if (this.state === STATE.CHAT && event.type === CHAT_EVENT_TYPE.END_CHAT) {
            this.state = STATE.AUDIT_LIKERTRESPONSE;
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

    // Phase C: project the turn-level reactions from the event log (AUD-5 / EVAL-1),
    // in append order, each carrying the event's id + timestamp.
    getReactions() {
        return this.chatEvents
        .filter(event => event.type === CHAT_EVENT_TYPE.NEW_REACTION)
        .map(event => ({ id: event.id, timestamp: event.timestamp, ...event.data }));
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
        } else if (type === CHAT_EVENT_TYPE.NEW_REACTION) {
            if (!data || typeof data !== 'object' || !data.messageId || !data.type) {
                throw new Error(`Invalid data for event type ${type}`);
            }
        } else if ([CHAT_EVENT_TYPE.NEW_CHAT, CHAT_EVENT_TYPE.RESTART_CHAT, CHAT_EVENT_TYPE.END_CHAT, CHAT_EVENT_TYPE.API_ERROR].includes(type)) {
            if (data !== null) {
                throw new Error(`Invalid data type for event type ${type}`);
            }
        }
    }
}

export { User, Conversation, Message, AuditResponse, ChatEvent, CHAT_EVENT_TYPE, STATE };
