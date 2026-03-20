// src/components/SummaryPage.jsx

import React from 'react';
import { Typography, Paper, Box, Table, TableHead, TableBody, TableRow, TableCell, Chip, Button } from '@mui/material';
import ChatHistory from './ChatHistory';
import ExportManager from './ExportManager';
import styles from './SummaryPage.module.css';

/**
 * Renders the user's survey response based on the question type.
 */
const renderQuestionResponse = (question, audit, index) => {
    const { type, id, content, settings } = question;

    switch (type) {
        case 'matrix':
            return (
                <Box key={id} sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        {index + 1}. {content || 'Matrix/Likert Question'}
                    </Typography>
                    <Table size="small" sx={{ mb: 2 }}>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', width: '60%' }}>Statement</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', width: '40%' }}>Your Rating</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {settings?.rows?.map((row, rIdx) => (
                                <TableRow key={rIdx}>
                                    <TableCell>{row}</TableCell>
                                    <TableCell>{audit.likertResponses?.[`${id}-${row}`] || 'N/A'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Box>
            );

        case 'textHighlight': {
            const qHighlights = audit.highlights?.filter(h => h.questionId === id || !h.questionId) || [];
            return (
                <Box key={id} sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        {index + 1}. {content || 'Highlighting Passages'}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                        {qHighlights.length > 0 ? (
                            qHighlights.map((h, i) => (
                                <Chip key={i} label={h.text} color="primary" variant="outlined" />
                            ))
                        ) : (
                            <Typography variant="body2" color="textSecondary">No passages highlighted.</Typography>
                        )}
                    </Box>
                </Box>
            );
        }

        case 'freeResponse':
            return (
                <Box key={id} sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        {index + 1}. {content || 'Free Response'}
                    </Typography>
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f9f9f9' }}>
                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                            {audit.textResponses?.[id] || 'No response provided.'}
                        </Typography>
                    </Paper>
                </Box>
            );

        // TODO: Add support for new question types here in the future
        default:
            return (
                <Box key={id} sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        {index + 1}. {content || 'Unsupported Question Type'}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        Responses for this question type cannot be displayed yet.
                    </Typography>
                </Box>
            );
    }
};

const SummaryPage = ({ conversation, initialSurvey, startNextConversation, showNewChat, showExportManager, overallTimeRemaining, formatTime }) => {
    if (!conversation) {
        return null;
    }

    const { audit } = conversation;
    // If initialSurvey is missing, fallback to empty array
    const questions = initialSurvey?.questions || [];

    // Calculate simple conversation metrics: total messages, maybe more in future?
    const totalMessages = conversation.chatEvents?.filter(e => e.type === 'new_user_message' || e.type === 'new_bot_message').length || 0;

    // Calculate conversation duration in minutes
    let durationText = 'N/A';
    if (conversation.endTimestamp && conversation.startTimestamp) {
        const minutes = Math.round((conversation.endTimestamp - conversation.startTimestamp) / 1000 / 60);
        durationText = Math.max(1, minutes) + ' min';
    }

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            overflowY: 'auto',
            p: 2
        }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="h5" align="center" sx={{ fontWeight: 'bold', margin: 0 }}>
                    Thank You For Participating! Here's Your Chat Summary:
                </Typography>
            </Box>

            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
                <Paper elevation={2} sx={{ p: 3, minWidth: '220px', textAlign: 'center', borderRadius: 2 }}>
                    <Typography variant="subtitle1" color="textSecondary" gutterBottom>Messages Exchanged</Typography>
                    <Typography variant="h4" color="primary" fontWeight="bold">{totalMessages}</Typography>
                </Paper>
                <Paper elevation={2} sx={{ p: 3, minWidth: '220px', textAlign: 'center', borderRadius: 2 }}>
                    <Typography variant="subtitle1" color="textSecondary" gutterBottom>Conversation Duration</Typography>
                    <Typography variant="h4" color="primary" fontWeight="bold">{durationText}</Typography>
                </Paper>
                {overallTimeRemaining !== undefined && formatTime && (
                    <Paper elevation={2} sx={{ p: 3, minWidth: '220px', textAlign: 'center', borderRadius: 2 }}>
                        <Typography variant="subtitle1" color="textSecondary" gutterBottom>Study Time Remaining</Typography>
                        <Typography variant="h4" color="error" fontWeight="bold">{formatTime(overallTimeRemaining)}</Typography>
                    </Paper>
                )}
            </Box>

            {audit && questions.length > 0 && (
                <Paper elevation={3} sx={{ p: 4, mb: 4, borderRadius: 2 }}>
                    <Typography variant="h6" gutterBottom align="center" sx={{ mb: 3, fontWeight: 'bold' }}>
                        Your Survey Responses
                    </Typography>
                    {questions.map((question, index) => renderQuestionResponse(question, audit, index))}
                </Paper>
            )}

            <Paper elevation={3} sx={{ p: 0, borderRadius: 2, overflow: 'hidden', mb: 4 }}>
                <Typography variant="h6" gutterBottom align="center" className={styles['header']} sx={{ m: 0 }}>
                    Conversation Transcript
                </Typography>
                <Box sx={{ maxHeight: '600px', overflowY: 'auto' }}>
                    <ChatHistory
                        conversationId={conversation.id}
                        enableHighlighting={false}
                        disableTextSelection={true}
                        highlights={audit?.highlights || []}
                        isAudit={false}
                        auditFinished={true}
                    />
                </Box>
            </Paper>

            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mb: 4, flexWrap: 'wrap' }}>
                {showNewChat && startNextConversation && (
                    <Button
                        variant="contained"
                        color="primary"
                        size="large"
                        onClick={startNextConversation}
                        sx={{ borderRadius: 2, px: 4, py: 1.5, fontSize: '1.1rem' }}
                    >
                        Start New Chat
                    </Button>
                )}
                {showExportManager && (
                    <Box sx={{ minWidth: '200px' }}>
                        <ExportManager />
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default SummaryPage;
