// src/components/SurveyMaker.jsx
import React, { useState } from 'react';
import { Box, Typography, List, ListItem } from '../ui/layout';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Alert } from '../ui/alert';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { Add, Delete } from '../ui/icons';
import { cn } from '../../lib/utils';
import {
    SurveyConfigurationManager,
    MatrixQuestion,
    FreeResponseQuestion,
    TextHighlightQuestion,
} from '../../tools/SurveyConfiguration';
import styles from './SurveyMaker.module.css';

const SurveyMaker = ({ onSurveySave }) => {
    const [manager] = useState(new SurveyConfigurationManager());
    const [questions, setQuestions] = useState(manager.getQuestions());
    const [newQuestionType, setNewQuestionType] = useState('matrix');
    const [errors, setErrors] = useState({});

    // Add a new question
    const addQuestion = () => {
        const content = '';
        let settings;
        switch (newQuestionType) {
            case 'matrix':
                settings = { rows: [], columns: [], required: false };
                break;
            case 'freeResponse':
                settings = { maxLength: 1000, minLength: 0, required: false };
                break;
            case 'textHighlight':
                settings = { textSource: 'conversation', minHighlights: 0, required: false };
                break;
            default:
                return;
        }
        manager.addQuestion(newQuestionType, content, settings);
        setQuestions([...manager.getQuestions()]);
        setErrors({});
    };

    // Remove a question
    const removeQuestion = (id) => {
        manager.removeQuestion(id);
        setQuestions([...manager.getQuestions()]);
        setErrors(prev => {
            const newErrors = { ...prev };
            Object.keys(newErrors).forEach(key => {
                if (key.startsWith(`${id}-`)) delete newErrors[key];
            });
            return newErrors;
        });
    };

    // Update a question
    const updateQuestion = (id, content, settings) => {
        manager.updateQuestion(id, content, settings);
        setQuestions([...manager.getQuestions()]);
        validateQuestion(id, content, settings);
    };

    // Validate a question
    const validateQuestion = (id, content, settings) => {
        const question = manager.findQuestion(id);
        const newErrors = {};

        if (!content || content.trim() === '') {
            newErrors[`${id}-content`] = 'Content is required.';
        }

        if (!question.validateSettings()) {
            newErrors[`${id}-settings`] = `Invalid settings for ${question.getType()} question. Ensure all fields are valid.`;
        }

        setErrors(prev => ({ ...prev, ...newErrors }));
        return Object.keys(newErrors).length === 0;
    };

    // Save the survey
    const handleSave = () => {
        const newErrors = {};

        questions.forEach(q => {
            if (!q.getContent() || q.getContent().trim() === '') {
                newErrors[`${q.getId()}-content`] = 'Content is required.';
            }
            if (!q.validateSettings()) {
                newErrors[`${q.getId()}-settings`] = `Invalid settings for ${q.getType()} question.`;
            }
            if (q.getType() === 'matrix' && (q.settings.rows.length === 0 || q.settings.columns.length === 0)) {
                newErrors[`${q.getId()}-settings`] = 'Matrix questions must have at least one row and one column.';
            }
        });

        if (questions.length === 0) {
            newErrors['global'] = 'At least one question must be defined.';
        }

        const allIds = questions.map(q => q.getId());
        if (new Set(allIds).size !== allIds.length) {
            newErrors['global'] = 'Question IDs must be unique.';
        }

        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) {
            return;
        }

        const survey = manager.toJSON();
        onSurveySave(survey);

        const blob = new Blob([JSON.stringify(survey, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'surveyQuestions.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    // Skip with default survey
    const handleSkip = () => {
        onSurveySave({ questions: [] });
    };

    // Render form for each question type
    const renderQuestionForm = (question) => {
        const id = question.getId();
        const content = question.getContent();
        const settings = question.getSettings().toObject();

        const updateField = (field, value) => {
            if (field === 'content') {
                updateQuestion(id, value, settings);
            } else {
                updateQuestion(id, content, { ...settings, [field]: value });
            }
        };

        switch (question.getType()) {
            case 'matrix':
                const addRow = () => {
                    updateField('rows', [...settings.rows, `Row ${settings.rows.length + 1}`]);
                };
                const updateRow = (index, value) => {
                    const newRows = [...settings.rows];
                    newRows[index] = value;
                    updateField('rows', newRows);
                };
                const removeRow = (index) => {
                    const newRows = settings.rows.filter((_, i) => i !== index);
                    updateField('rows', newRows);
                };
                const addColumn = () => {
                    updateField('columns', [...settings.columns, `Column ${settings.columns.length + 1}`]);
                };
                const updateColumn = (index, value) => {
                    const newColumns = [...settings.columns];
                    newColumns[index] = value;
                    updateField('columns', newColumns);
                };
                const removeColumn = (index) => {
                    const newColumns = settings.columns.filter((_, i) => i !== index);
                    updateField('columns', newColumns);
                };

                return (
                    <Box className="w-full">
                        <div className={cn('my-4', styles['form-field'])}>
                            <Label className="mb-1 block">Question ID</Label>
                            <Input value={id} disabled />
                        </div>
                        <div className={cn('my-4', styles['form-field'])}>
                            <Label className="mb-1 block">Question Content</Label>
                            <Input
                                value={content}
                                onChange={(e) => updateField('content', e.target.value)}
                                required
                                className={errors[`${id}-content`] ? 'border-destructive' : undefined}
                            />
                            <p className={cn('mt-1 text-xs', errors[`${id}-content`] ? 'text-destructive' : 'text-muted-foreground')}>
                                {errors[`${id}-content`] || 'Main question or instruction for the matrix'}
                            </p>
                        </div>
                        <Typography variant="subtitle2" className="mt-4 mb-2">
                            Rows
                        </Typography>
                        {errors[`${id}-settings`] && settings.rows.length === 0 && (
                            <Alert variant="destructive" className="mb-2">
                                At least one row is required.
                            </Alert>
                        )}
                        <List dense>
                            {settings.rows.map((row, index) => (
                                <ListItem key={index} className="py-1 gap-2">
                                    <div className="flex-1">
                                        <Label className="mb-1 block">{`Row ${index + 1}`}</Label>
                                        <Input
                                            value={row}
                                            onChange={(e) => updateRow(index, e.target.value)}
                                            className={(!!errors[`${id}-settings`] && !row.trim()) ? 'border-destructive' : undefined}
                                        />
                                        {(!row.trim() && errors[`${id}-settings`]) && (
                                            <p className="mt-1 text-xs text-destructive">Row label cannot be empty</p>
                                        )}
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => removeRow(index)}>
                                        <Delete />
                                    </Button>
                                </ListItem>
                            ))}
                        </List>
                        <Button variant="ghost" size="sm" className="mb-4" onClick={addRow}>
                            <Add />
                            Add Row
                        </Button>
                        <Typography variant="subtitle2" className="mt-4 mb-2">
                            Columns
                        </Typography>
                        {errors[`${id}-settings`] && settings.columns.length === 0 && (
                            <Alert variant="destructive" className="mb-2">
                                At least one column is required.
                            </Alert>
                        )}
                        <List dense>
                            {settings.columns.map((column, index) => (
                                <ListItem key={index} className="py-1 gap-2">
                                    <div className="flex-1">
                                        <Label className="mb-1 block">{`Column ${index + 1}`}</Label>
                                        <Input
                                            value={column}
                                            onChange={(e) => updateColumn(index, e.target.value)}
                                            className={(!!errors[`${id}-settings`] && !column.trim()) ? 'border-destructive' : undefined}
                                        />
                                        {(!column.trim() && errors[`${id}-settings`]) && (
                                            <p className="mt-1 text-xs text-destructive">Column label cannot be empty</p>
                                        )}
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => removeColumn(index)}>
                                        <Delete />
                                    </Button>
                                </ListItem>
                            ))}
                        </List>
                        <Button variant="ghost" size="sm" className="mb-4" onClick={addColumn}>
                            <Add />
                            Add Column
                        </Button>
                        <label className="flex items-center gap-2">
                            <Checkbox
                                checked={settings.required}
                                onCheckedChange={(checked) => updateField('required', checked === true)}
                            />
                            <span className="text-sm">Required</span>
                        </label>
                    </Box>
                );
            case 'freeResponse':
                return (
                    <Box className="w-full">
                        <div className={cn('my-4', styles['form-field'])}>
                            <Label className="mb-1 block">Question ID</Label>
                            <Input value={id} disabled />
                        </div>
                        <div className={cn('my-4', styles['form-field'])}>
                            <Label className="mb-1 block">Question Content</Label>
                            <Input
                                value={content}
                                onChange={(e) => updateField('content', e.target.value)}
                                required
                                className={errors[`${id}-content`] ? 'border-destructive' : undefined}
                            />
                            <p className={cn('mt-1 text-xs', errors[`${id}-content`] ? 'text-destructive' : 'text-muted-foreground')}>
                                {errors[`${id}-content`] || 'The question prompt'}
                            </p>
                        </div>
                        <div className={cn('my-4', styles['form-field'])}>
                            <Label className="mb-1 block">Max Length</Label>
                            <Input
                                type="number"
                                value={settings.maxLength}
                                onChange={(e) => updateField('maxLength', parseInt(e.target.value) || 1000)}
                                required
                                className={errors[`${id}-settings`] ? 'border-destructive' : undefined}
                            />
                            <p className={cn('mt-1 text-xs', errors[`${id}-settings`] ? 'text-destructive' : 'text-muted-foreground')}>
                                {errors[`${id}-settings`] || 'Maximum characters allowed'}
                            </p>
                        </div>
                        <div className={cn('my-4', styles['form-field'])}>
                            <Label className="mb-1 block">Min Length</Label>
                            <Input
                                type="number"
                                value={settings.minLength}
                                onChange={(e) => updateField('minLength', parseInt(e.target.value) || 0)}
                                required
                                className={errors[`${id}-settings`] ? 'border-destructive' : undefined}
                            />
                            <p className={cn('mt-1 text-xs', errors[`${id}-settings`] ? 'text-destructive' : 'text-muted-foreground')}>
                                {errors[`${id}-settings`] || 'Minimum characters required'}
                            </p>
                        </div>
                        <label className="flex items-center gap-2">
                            <Checkbox
                                checked={settings.required}
                                onCheckedChange={(checked) => updateField('required', checked === true)}
                            />
                            <span className="text-sm">Required</span>
                        </label>
                    </Box>
                );
            case 'textHighlight':
                return (
                    <Box className="w-full">
                        <div className={cn('my-4', styles['form-field'])}>
                            <Label className="mb-1 block">Question ID</Label>
                            <Input value={id} disabled />
                        </div>
                        <div className={cn('my-4', styles['form-field'])}>
                            <Label className="mb-1 block">Instructions</Label>
                            <Input
                                value={content}
                                onChange={(e) => updateField('content', e.target.value)}
                                required
                                className={errors[`${id}-content`] ? 'border-destructive' : undefined}
                            />
                            <p className={cn('mt-1 text-xs', errors[`${id}-content`] ? 'text-destructive' : 'text-muted-foreground')}>
                                {errors[`${id}-content`] || 'Instructions for highlighting text'}
                            </p>
                        </div>
                        <div className={cn('my-4', styles['form-field'])}>
                            <Label className="mb-1 block">Text Source</Label>
                            <Input
                                value={settings.textSource}
                                onChange={(e) => updateField('textSource', e.target.value)}
                                required
                                className={errors[`${id}-settings`] ? 'border-destructive' : undefined}
                            />
                            <p className={cn('mt-1 text-xs', errors[`${id}-settings`] ? 'text-destructive' : 'text-muted-foreground')}>
                                {errors[`${id}-settings`] || 'e.g., conversation'}
                            </p>
                        </div>
                        <div className={cn('my-4', styles['form-field'])}>
                            <Label className="mb-1 block">Minimum Highlights</Label>
                            <Input
                                type="number"
                                value={settings.minHighlights}
                                onChange={(e) => updateField('minHighlights', parseInt(e.target.value) || 0)}
                                required
                                className={errors[`${id}-settings`] ? 'border-destructive' : undefined}
                            />
                            <p className={cn('mt-1 text-xs', errors[`${id}-settings`] ? 'text-destructive' : 'text-muted-foreground')}>
                                {errors[`${id}-settings`] || 'Minimum number of highlights required'}
                            </p>
                        </div>
                        <label className="flex items-center gap-2">
                            <Checkbox
                                checked={settings.required}
                                onCheckedChange={(checked) => updateField('required', checked === true)}
                            />
                            <span className="text-sm">Required</span>
                        </label>
                    </Box>
                );
            default:
                return null;
        }
    };

    return (
        <Box className="p-6 max-w-[800px] mx-auto">
            <Typography variant="h4" gutterBottom>
                Create Your Survey
            </Typography>
            <Typography variant="body1" className="mb-4">
                Define the questions for auditing the AI chatbot. Add matrix questions (grid-style with rows and columns), free-response questions, or text highlight tasks.
            </Typography>
            {errors.global && (
                <Alert variant="destructive" className="mb-4">
                    {errors.global}
                </Alert>
            )}

            <div className="mb-4 w-full">
                <Label className="mb-1 block">Question Type</Label>
                <Select
                    value={newQuestionType}
                    onValueChange={(v) => setNewQuestionType(v)}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="matrix">Matrix Question</SelectItem>
                        <SelectItem value="freeResponse">Free-Response Question</SelectItem>
                        <SelectItem value="textHighlight">Text Highlight Task</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <Button variant="ghost" className="mb-4" onClick={addQuestion}>
                <Add />
                Add Question
            </Button>

            <List>
                {questions.map((question) => (
                    <ListItem
                        key={question.getId()}
                        className="relative flex-col items-start mb-4 p-4 bg-[#f5f5f5] rounded"
                    >
                        <Box className="w-full">
                            {renderQuestionForm(question)}
                        </Box>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <Button variant="ghost" size="icon" onClick={() => removeQuestion(question.getId())}>
                                <Delete />
                            </Button>
                        </div>
                    </ListItem>
                ))}
            </List>

            <Box className="flex gap-4">
                <Button onClick={handleSave}>
                    Save Survey and Start Chat
                </Button>
                <Button variant="outline" onClick={handleSkip}>
                    Skip and Use Default
                </Button>
            </Box>
        </Box>
    );
};

export default SurveyMaker;