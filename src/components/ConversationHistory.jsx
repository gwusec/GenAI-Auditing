// src/components/ConversationHistory.jsx
import React from 'react';
import { Typography, Paper, TextField, Chip, Box } from '@mui/material';
import ChatHistory from './ChatHistory';
import styles from './ConversationHistory.module.css';

const ConversationHistory = ({ conversation, surveyQuestions }) => {
    if (!conversation) {
        return null;
    }

    const { audit } = conversation;

    const defaultSurvey = { questions: [] };
    const effectiveSurveyQuestions = surveyQuestions || defaultSurvey;

    const questionLabels = effectiveSurveyQuestions.questions.reduce((acc, q) => ({
        ...acc,
        [q.id]: q.content || q.type,
    }), {});

    return (
        <>
            <Typography variant="h6" gutterBottom align="center" className={styles['header']}>
                Completed Conversation
            </Typography>
            <ChatHistory
                conversationId={conversation.id}
                enableHighlighting={false}
                disableTextSelection={true}
                highlights={audit?.highlights || []}
                isAudit={false}
                auditFinished={true}
            />
            {audit && (
                <Paper elevation={3} sx={{ p: 3, mb: 2 }} className="free-response">
                    <Typography variant="h6" gutterBottom align="center">
                        Your reported details
                    </Typography>
                    {Object.keys(audit.likertResponses).length > 0 && (
                        <>
                            <Typography variant="subtitle1" gutterBottom>
                                Matrix Responses
                            </Typography>
                            {Object.entries(audit.likertResponses).map(([key, value]) => {
                                const [questionId, row] = key.split('-');
                                const question = effectiveSurveyQuestions.questions.find(q => q.id === questionId);
                                return (
                                    <TextField
                                        key={key}
                                        label={`${questionLabels[questionId] || questionId}: ${row}`}
                                        value={value || ''}
                                        variant="outlined"
                                        fullWidth
                                        margin="normal"
                                        readOnly={true}
                                    />
                                );
                            })}
                        </>
                    )}
                    {audit.highlights.length > 0 && (
                        <>
                            <Typography variant="subtitle1" gutterBottom>
                                Highlighted Passages
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                                {audit.highlights.map((highlight, index) => (
                                    <Chip key={index} label={highlight.text} color="primary" size="small" />
                                ))}
                            </Box>
                        </>
                    )}
                    {Object.keys(audit.textResponses).length > 0 && (
                        <>
                            <Typography variant="subtitle1" gutterBottom>
                                Free Response Answers
                            </Typography>
                            {Object.entries(audit.textResponses).map(([key, value]) => (
                                <TextField
                                    key={key}
                                    label={questionLabels[key] || key}
                                    multiline
                                    rows={4}
                                    variant="outlined"
                                    fullWidth
                                    margin="normal"
                                    value={value || ''}
                                    readOnly={true}
                                />
                            ))}
                        </>
                    )}
                    {Object.keys(audit.likertResponses).length === 0 &&
                     audit.highlights.length === 0 &&
                     Object.keys(audit.textResponses).length === 0 && (
                        <Typography variant="body1" align="center">
                            No audit responses provided.
                        </Typography>
                    )}
                </Paper>
            )}
        </>
    );
};

export default ConversationHistory;