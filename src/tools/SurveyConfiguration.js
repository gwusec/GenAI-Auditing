// src/tools/SurveyConfiguration.js

// Abstract Question class
class Question {
    constructor(id, content) {
        if (this.constructor === Question) {
            throw new Error('Cannot instantiate abstract class Question');
        }
        this.id = id;
        this.content = content;
    }

    getType() {
        throw new Error('Method getType must be implemented');
    }

    getId() {
        return this.id;
    }

    getContent() {
        return this.content;
    }

    setContent(content) {
        this.content = content;
    }

    getSettings() {
        throw new Error('Method getSettings must be implemented');
    }

    setSettings(settings) {
        throw new Error('Method setSettings must be implemented');
    }

    validateSettings() {
        throw new Error('Method validateSettings must be implemented');
    }

    renderForm() {
        throw new Error('Method renderForm must be implemented');
    }

    toJSON() {
        return {
            id: this.id,
            type: this.getType(),
            content: this.content,
            settings: this.getSettings().toObject(),
        };
    }
}

// Abstract Settings class
class Settings {
    toObject() {
        throw new Error('Method toObject must be implemented');
    }
}

// Matrix Settings
class MatrixSettings extends Settings {
    constructor(rows = [], columns = [], required = false) {
        super();
        this.rows = rows;
        this.columns = columns;
        this.required = required;
    }

    toObject() {
        return {
            rows: this.rows,
            columns: this.columns,
            required: this.required,
        };
    }
}

// Free Response Settings
class FreeResponseSettings extends Settings {
    constructor(maxLength = 1000, minLength = 0, required = false) {
        super();
        this.maxLength = maxLength;
        this.minLength = minLength;
        this.required = required;
    }

    toObject() {
        return {
            maxLength: this.maxLength,
            minLength: this.minLength,
            required: this.required,
        };
    }
}

// Text Highlight Settings
class TextHighlightSettings extends Settings {
    constructor(textSource = 'conversation', minHighlights = 0, required = false) {
        super();
        this.textSource = textSource;
        this.minHighlights = minHighlights;
        this.required = required;
    }

    toObject() {
        return {
            textSource: this.textSource,
            minHighlights: this.minHighlights,
            required: this.required,
        };
    }
}

// Matrix Question
class MatrixQuestion extends Question {
    constructor(id, content, settings = new MatrixSettings()) {
        super(id, content);
        this.settings = settings;
    }

    getType() {
        return 'matrix';
    }

    getSettings() {
        return this.settings;
    }

    setSettings(settings) {
        this.settings = new MatrixSettings(
            settings.rows || this.settings.rows,
            settings.columns || this.settings.columns,
            settings.required !== undefined ? settings.required : this.settings.required
        );
    }

    validateSettings() {
        // Allow empty arrays during creation, but require non-empty on save
        return (
            Array.isArray(this.settings.rows) &&
            Array.isArray(this.settings.columns) &&
            (this.settings.rows.length === 0 || this.settings.rows.every(row => typeof row === 'string' && row.trim() !== '')) &&
            (this.settings.columns.length === 0 || this.settings.columns.every(col => typeof col === 'string' && col.trim() !== ''))
        );
    }

    renderForm() {
        return null;
    }
}

// Free Response Question
class FreeResponseQuestion extends Question {
    constructor(id, content, settings = new FreeResponseSettings()) {
        super(id, content);
        this.settings = settings;
    }

    getType() {
        return 'freeResponse';
    }

    getSettings() {
        return this.settings;
    }

    setSettings(settings) {
        this.settings = new FreeResponseSettings(
            settings.maxLength || this.settings.maxLength,
            settings.minLength || this.settings.minLength,
            settings.required !== undefined ? settings.required : this.settings.required
        );
    }

    validateSettings() {
        return (
            typeof this.settings.maxLength === 'number' &&
            this.settings.maxLength > 0 &&
            typeof this.settings.minLength === 'number' &&
            this.settings.minLength >= 0 &&
            this.settings.minLength <= this.settings.maxLength
        );
    }

    renderForm() {
        return null;
    }
}

// Text Highlight Question
class TextHighlightQuestion extends Question {
    constructor(id, content, settings = new TextHighlightSettings()) {
        super(id, content);
        this.settings = settings;
    }

    getType() {
        return 'textHighlight';
    }

    getSettings() {
        return this.settings;
    }

    setSettings(settings) {
        this.settings = new TextHighlightSettings(
            settings.textSource || this.settings.textSource,
            settings.minHighlights || this.settings.minHighlights,
            settings.required !== undefined ? settings.required : this.settings.required
        );
    }

    validateSettings() {
        return (
            typeof this.settings.textSource === 'string' &&
            this.settings.textSource.trim() !== '' &&
            typeof this.settings.minHighlights === 'number' &&
            this.settings.minHighlights >= 0
        );
    }

    renderForm() {
        return null;
    }
}

// Survey Configuration Manager
class SurveyConfigurationManager {
    constructor() {
        this.questions = [];
    }

    addQuestion(type, content, settings) {
        const id = `${type}-${this.questions.length + 1}`;
        let question;
        switch (type) {
            case 'matrix':
                question = new MatrixQuestion(id, content, new MatrixSettings(settings.rows, settings.columns, settings.required));
                break;
            case 'freeResponse':
                question = new FreeResponseQuestion(id, content, new FreeResponseSettings(settings.maxLength, settings.minLength, settings.required));
                break;
            case 'textHighlight':
                question = new TextHighlightQuestion(id, content, new TextHighlightSettings(settings.textSource, settings.minHighlights, settings.required));
                break;
            default:
                throw new Error(`Unknown question type: ${type}`);
        }
        this.questions.push(question);
        return question;
    }

    removeQuestion(id) {
        this.questions = this.questions.filter(q => q.getId() !== id);
    }

    updateQuestion(id, content, settings) {
        const question = this.findQuestion(id);
        if (question) {
            question.setContent(content);
            question.setSettings(settings);
        }
    }

    getQuestions() {
        return this.questions;
    }

    createQuestion(type, content, settings) {
        return this.addQuestion(type, content, settings);
    }

    findQuestion(id) {
        return this.questions.find(q => q.getId() === id);
    }

    clear() {
        this.questions = [];
    }

    loadFromJSON(json) {
        this.clear();
        if (json && json.questions
            && Array.isArray(json.questions)) {
            json.questions.forEach(q => {
                this.addQuestion(q.type, q.content, q.settings);
            });
        }
    }

    toJSON() {
        return {
            questions: this.questions.map(q => q.toJSON()),
        };
    }
}

export {
    Question,
    MatrixQuestion,
    FreeResponseQuestion,
    TextHighlightQuestion,
    Settings,
    MatrixSettings,
    FreeResponseSettings,
    TextHighlightSettings,
    SurveyConfigurationManager,
};