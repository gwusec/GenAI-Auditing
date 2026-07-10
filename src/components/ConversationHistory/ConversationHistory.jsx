// src/components/ConversationHistory.jsx
import React from 'react';
import { Typography, Box } from '../ui/layout';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import ChatHistory from '../ChatHistory/ChatHistory';
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
                <Card className="free-response p-6 mb-4 rounded-md">
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
                                    <div key={key} className="my-4">
                                        <Label>{`${questionLabels[questionId] || questionId}: ${row}`}</Label>
                                        <Input
                                            value={value || ''}
                                            readOnly={true}
                                            className="mt-1"
                                        />
                                    </div>
                                );
                            })}
                        </>
                    )}
                    {audit.highlights.length > 0 && (
                        <>
                            <Typography variant="subtitle1" gutterBottom>
                                Highlighted Passages
                            </Typography>
                            <Box className="flex flex-wrap gap-2 mb-4">
                                {audit.highlights.map((highlight, index) => (
                                    <Badge key={index}>{highlight.quotedText || highlight.text}</Badge>
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
                                <div key={key} className="my-4">
                                    <Label>{questionLabels[key] || key}</Label>
                                    <Textarea
                                        rows={4}
                                        value={value || ''}
                                        readOnly={true}
                                        className="mt-1"
                                    />
                                </div>
                            ))}
                        </>
                    )}
                    {audit.questionnaire && Object.keys(audit.questionnaire).length > 0 && (
                        <>
                            <Typography variant="subtitle1" gutterBottom>
                                Questionnaire Answers
                            </Typography>
                            {Object.entries(audit.questionnaire).map(([key, value]) => (
                                <div key={key} className="my-4">
                                    <Label>{key}</Label>
                                    <Input
                                        value={typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '')}
                                        readOnly={true}
                                        className="mt-1"
                                    />
                                </div>
                            ))}
                        </>
                    )}
                    {Object.keys(audit.likertResponses).length === 0 &&
                     audit.highlights.length === 0 &&
                     Object.keys(audit.textResponses).length === 0 &&
                     (!audit.questionnaire || Object.keys(audit.questionnaire).length === 0) && (
                        <Typography variant="body1" align="center">
                            No audit responses provided.
                        </Typography>
                    )}
                </Card>
            )}
        </>
    );
};

export default ConversationHistory;
