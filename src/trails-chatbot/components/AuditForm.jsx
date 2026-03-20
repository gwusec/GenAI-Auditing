// src/components/AuditForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { AuditResponse, STATE } from '../tools/models';
import conversationHandler from '../tools/ConversationHandler';
import ChatHistory from './ChatHistory';
import { fairnessProperties } from '../tools/principles';
import AuditPage0Tutorial from './tutorials/AuditPage0Tutorial';
import AuditPage1Tutorial from './tutorials/AuditPage1Tutorial';
import AuditPage2Tutorial from './tutorials/AuditPage2Tutorial';
import styles from './AuditForm.module.css';
import {
    Typography,
    Box,
    Checkbox,
    Button,
    Radio,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    TextField,
    Chip,
    Paper,
    Alert,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';

const fairnessPropertiesRandomOrder = [...fairnessProperties].sort(() => 0.5 - Math.random());

const getAvailableStates = (surveyQuestions) => {
    const states = [];
    const hasMatrix = surveyQuestions?.questions?.some(q => q.type === 'matrix');
    const hasTextHighlight = surveyQuestions?.questions?.some(q => q.type === 'textHighlight');
    const hasFreeResponse = surveyQuestions?.questions?.some(q => q.type === 'freeResponse');
    if (hasMatrix) states.push(STATE.AUDIT_LIKERTRESPONSE);
    if (hasTextHighlight) states.push(STATE.AUDIT_HIGHLIGHT);
    if (hasFreeResponse) states.push(STATE.AUDIT_TEXTRESPONSE);
    states.push(STATE.COMPLETE);
    return states;
};

const AuditForm = ({
    conversationId,
    onAuditComplete = () => { },
    setLoading = () => { },
    onTutorialComplete = () => { },
    surveyQuestions,
}) => {
    console.log("AuditForm rendered with surveyQuestions:", surveyQuestions);
    const defaultSurvey = { questions: [] };
    const effectiveSurveyQuestions = surveyQuestions || defaultSurvey;

    const [auditData, setAuditData] = useState(new AuditResponse());
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);
    const [conversationState, setConversationState] = useState(
        getAvailableStates(effectiveSurveyQuestions)[0] || STATE.COMPLETE
    );
    const [tutorialCompleted, setTutorialCompleted] = useState(false);
    const [noProblematicFound, setNoProblematicFound] = useState({});
    const [currentHighlightIndex, setCurrentHighlightIndex] = useState(0);
    const [viewedHighlightIndices, setViewedHighlightIndices] = useState(new Set([0]));
    const [errors, setErrors] = useState({});

    useEffect(() => {
        console.log("Initializing audit form...");
        const initAudit = async () => {
            const conversation = await conversationHandler.getConversationById(conversationId);
            if (conversation && conversation.audit) {
                setAuditData(conversation.audit);
            }
            let startState = conversation.state;
            const availableStates = getAvailableStates(effectiveSurveyQuestions);

            // If state is 'audit_pending' or invalid for current config, pick first available
            if (startState === 'audit_pending' || (startState && !availableStates.includes(startState) && startState !== STATE.COMPLETE)) {
                startState = availableStates[0];
                // Update DB to reflect the corrected state
                if (startState) {
                    await conversationHandler.updateConversationState(conversationId, startState);
                }
            }

            setConversationState(
                startState || availableStates[0] || STATE.COMPLETE
            );
        };
        initAudit();
    }, [conversationId, effectiveSurveyQuestions]);

    useEffect(() => {
        const tutorialKey = `auditTutorialShown_${conversationState}`;
        const auditTutorialShown = localStorage.getItem(tutorialKey);
        if (!auditTutorialShown && conversationState !== STATE.COMPLETE) {
            setShowTutorial(true);
        } else {
            setShowTutorial(false);
            if (!tutorialCompleted && onTutorialComplete) {
                onTutorialComplete();
                setTutorialCompleted(true);
            }
        }
    }, [conversationState, onTutorialComplete, tutorialCompleted]);

    const handleTutorialComplete = useCallback(() => {
        setShowTutorial(false);
        const tutorialKey = `auditTutorialShown_${conversationState}`;
        localStorage.setItem(tutorialKey, "true");
        if (onTutorialComplete) {
            onTutorialComplete();
        }
        setTutorialCompleted(true);
    }, [conversationState, onTutorialComplete]);

    const handleReplayTutorial = useCallback(() => {
        setShowTutorial(true);
    }, []);

    const handleStateChange = async (newState) => {
        setConversationState(newState);
        try {
            await conversationHandler.updateConversationState(conversationId, newState);
            await conversationHandler.addAuditResponse(conversationId, auditData);
        } catch (error) {
            console.error("Failed to update conversation state:", error);
        }
    };

    const getNextState = () => {
        const availableStates = getAvailableStates(effectiveSurveyQuestions);
        const currentIndex = availableStates.indexOf(conversationState);
        return availableStates[currentIndex + 1] || STATE.COMPLETE;
    };

    const handleMatrixChange = (questionId, row, value) => {
        setAuditData(prev => ({
            ...prev,
            likertResponses: {
                ...prev.likertResponses,
                [`${questionId}-${row}`]: value,
            },
        }));
        setErrors(prev => ({ ...prev, [`${questionId}-${row}`]: undefined }));
    };

    const handleHighlight = (highlight) => {
        setAuditData(prev => {
            const highlightQuestions = effectiveSurveyQuestions.questions.filter(q => q.type === 'textHighlight');
            const currentQ = highlightQuestions[currentHighlightIndex];
            if (!currentQ) return prev;
            return {
                ...prev,
                highlights: [...prev.highlights, { ...highlight, questionId: currentQ.id }],
            };
        });
    };

    const handleRemoveHighlight = (index) => {
        setAuditData(prev => ({
            ...prev,
            highlights: prev.highlights.filter((_, i) => i !== index),
        }));
    };

    const handleTextChange = (questionId, value) => {
        setAuditData(prev => ({
            ...prev,
            textResponses: {
                ...prev.textResponses,
                [questionId]: value,
            },
        }));
        const question = effectiveSurveyQuestions.questions.find(q => q.id === questionId);
        if (question) {
            const settings = question.settings;
            if (value.length > settings.maxLength) {
                setErrors(prev => ({ ...prev, [questionId]: `Response exceeds maximum length of ${settings.maxLength} characters.` }));
            } else if (settings.required && value.trim() === '') {
                setErrors(prev => ({ ...prev, [questionId]: 'This field is required.' }));
            } else if (value.length < settings.minLength) {
                setErrors(prev => ({ ...prev, [questionId]: `Response must be at least ${settings.minLength} characters.` }));
            } else {
                setErrors(prev => ({ ...prev, [questionId]: undefined }));
            }
        }
    };

    const handleSubmit = async () => {
        const newErrors = {};

        effectiveSurveyQuestions.questions.forEach(question => {
            if (question.type === 'matrix' && question.settings.required) {
                question.settings.rows.forEach(row => {
                    const key = `${question.id}-${row}`;
                    if (!auditData.likertResponses[key]) {
                        newErrors[key] = 'This field is required.';
                    }
                });
            } else if (question.type === 'freeResponse' && question.settings.required) {
                if (!auditData.textResponses[question.id] || auditData.textResponses[question.id].trim() === '') {
                    newErrors[question.id] = 'This field is required.';
                }
            } else if (question.type === 'textHighlight' && question.settings.required) {
                // Checks that either text was highlighted for this question or the checkbox was checked..
                const qHighlights = auditData.highlights.filter(h => h.questionId === question.id || !h.questionId);
                const minExpected = question.settings.minHighlights > 0 ? question.settings.minHighlights : 1;
                if (qHighlights.length < minExpected && !noProblematicFound[question.id]) {
                    newErrors[question.id] = question.settings.minHighlights > 0
                        ? `At least ${question.settings.minHighlights} highlights are required (or check the box below).`
                        : `Please highlight problematic passages or check the box below.`;
                }
            }
        });

        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) {
            return;
        }

        setLoading(true);
        try {
            await conversationHandler.updateConversationState(conversationId, STATE.COMPLETE);
            await conversationHandler.addAuditResponse(conversationId, auditData);
            setIsSubmitted(true);
            onAuditComplete();
        } catch (error) {
            console.error("Error submitting audit:", error);
        } finally {
            setLoading(false);
        }
    };

    const hasAuditContent = getAvailableStates(effectiveSurveyQuestions).length > 1;

    return (
        <Box className={styles['container']}>
            <Typography variant="subtitle1" className={styles['header']}>
                Reporting
            </Typography>
            <Box className={styles['main-content']}>
                <Box
                    sx={{
                        width: '45%',
                        overflowY: 'hidden',
                        pl: 2,
                        pr: 2,
                        pt: 1,
                        borderRight: '1px solid #ddd',
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                    }}
                >
                    <div tutorial-step="chat-history">
                        <Typography variant="h6" gutterBottom align="center">
                            Your previous conversation
                        </Typography>
                        <Box
                            sx={{
                                overflowY: 'auto',
                                flex: 1,
                                maxHeight: 'calc(100vh - 64px)',
                            }}
                        >
                            <ChatHistory
                                conversationId={conversationId}
                                addHighlight={handleHighlight}
                                removeHighlight={handleRemoveHighlight}
                                enableHighlighting={conversationState === STATE.AUDIT_HIGHLIGHT}
                                disableTextSelection={conversationState === STATE.AUDIT_TEXTRESPONSE}
                                highlights={
                                    conversationState === STATE.AUDIT_HIGHLIGHT
                                        ? auditData.highlights.filter(h => {
                                            const hQuestions = effectiveSurveyQuestions.questions.filter(q => q.type === 'textHighlight');
                                            const currQ = hQuestions[currentHighlightIndex];
                                            return currQ && (h.questionId === currQ.id || !h.questionId);
                                        })
                                        : conversationState === STATE.AUDIT_TEXTRESPONSE
                                            ? auditData.highlights
                                            : []
                                }
                                isAudit={true}
                                auditFinished={isSubmitted}
                            />
                        </Box>
                    </div>
                </Box>
                <Box
                    sx={{
                        width: '55%',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        pr: 1,
                        pt: 1,
                        height: '100%',
                    }}
                >
                    <Box sx={{ width: '95%', maxWidth: '800px' }}>
                        {!hasAuditContent && conversationState === STATE.COMPLETE && (
                            <Paper elevation={3} sx={{ p: 3, mb: 2 }}>
                                <Typography variant="h6" gutterBottom align="center">
                                    No Audit Questions Available
                                </Typography>
                                <Typography variant="body1">
                                    There are no audit questions configured for this session. You can review the conversation or complete the audit.
                                </Typography>
                                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        onClick={handleSubmit}
                                        disabled={isSubmitted}
                                    >
                                        Complete Audit
                                    </Button>
                                </Box>
                            </Paper>
                        )}
                        {conversationState === STATE.AUDIT_LIKERTRESPONSE && (
                            <>
                                <Paper className={styles['fairness-properties']} elevation={3}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                                        <Typography variant="h6" gutterBottom align="center">
                                            Please rate the AI Chatbot's performance
                                        </Typography>
                                    </Box>
                                </Paper>
                                <Paper className={styles['fairness-properties']} elevation={3}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                                        <Typography variant="subtitle2" gutterBottom>
                                            Please verify that the AI chatbot upholds these principles:
                                        </Typography>
                                    </Box>
                                    <Box component="ul" className={styles['principles-list']}>
                                        {fairnessPropertiesRandomOrder.map((property, index) => (
                                            <li key={index}>{property}</li>
                                        ))}
                                    </Box>
                                </Paper>
                                {effectiveSurveyQuestions.questions
                                    .filter(q => q.type === 'matrix')
                                    .map((question, qIndex) => (
                                        <Paper key={question.id} elevation={3} sx={{ p: 3, mb: 2 }} className="likert-scale" tutorial-step="chat-performance-rating">
                                            <Typography variant="subtitle2" gutterBottom>
                                                {question.content || 'Matrix Question'}
                                            </Typography>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell sx={{ width: '40%', fontWeight: 'bold' }}>
                                                            Statements
                                                        </TableCell>
                                                        {question.settings.columns.map((column, index) => (
                                                            <TableCell
                                                                key={index}
                                                                align="center"
                                                                sx={{
                                                                    fontWeight: 'bold',
                                                                    padding: '6px 2px',
                                                                    width: `${60 / question.settings.columns.length}%`,
                                                                    fontSize: '0.75rem',
                                                                    lineHeight: 1.2,
                                                                    whiteSpace: 'normal',
                                                                    wordWrap: 'break-word',
                                                                }}
                                                            >
                                                                <Typography
                                                                    component="div"
                                                                    variant="body2"
                                                                    sx={{ whiteSpace: 'normal', wordWrap: 'break-word' }}
                                                                >
                                                                    {column}
                                                                </Typography>
                                                            </TableCell>
                                                        ))}
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {question.settings.rows.map((row, rowIndex) => (
                                                        <TableRow key={rowIndex}>
                                                            <TableCell sx={{ padding: '8px 4px' }}>
                                                                {row}
                                                            </TableCell>
                                                            {question.settings.columns.map((column, colIndex) => (
                                                                <TableCell
                                                                    key={colIndex}
                                                                    align="center"
                                                                    sx={{ padding: '6px 2px' }}
                                                                >
                                                                    <Radio
                                                                        checked={auditData.likertResponses[`${question.id}-${row}`] === column}
                                                                        onChange={() => handleMatrixChange(question.id, row, column)}
                                                                        value={column}
                                                                        name={`${question.id}-${row}`}
                                                                        required={question.settings.required}
                                                                        size="small"
                                                                    />
                                                                </TableCell>
                                                            ))}
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                            {question.settings.rows.map(row => (
                                                errors[`${question.id}-${row}`] && (
                                                    <Alert key={`${question.id}-${row}`} severity="error" sx={{ mt: 1 }}>
                                                        {errors[`${question.id}-${row}`]}
                                                    </Alert>
                                                )
                                            ))}
                                        </Paper>
                                    ))}
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                                    <Button startIcon={<InfoIcon />} onClick={handleReplayTutorial}>
                                        Replay Tutorial
                                    </Button>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        onClick={() => handleStateChange(getNextState())}
                                        disabled={
                                            effectiveSurveyQuestions.questions.some(q => q.type === 'matrix' && q.settings.required) &&
                                            !effectiveSurveyQuestions.questions
                                                .filter(q => q.type === 'matrix')
                                                .every(q => q.settings.rows.every(row => auditData.likertResponses[`${q.id}-${row}`]))
                                        }
                                    >
                                        Next
                                    </Button>
                                </Box>
                            </>
                        )}
                        {conversationState === STATE.AUDIT_HIGHLIGHT && (
                            <Box sx={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column' }}>
                                {(() => {
                                    const highlightQuestions = effectiveSurveyQuestions.questions.filter(q => q.type === 'textHighlight');
                                    const question = highlightQuestions[currentHighlightIndex];

                                    if (!question) return null;

                                    const handlePrev = () => {
                                        if (currentHighlightIndex > 0) {
                                            const newIndex = currentHighlightIndex - 1;
                                            setCurrentHighlightIndex(newIndex);
                                            setViewedHighlightIndices(prev => new Set(prev).add(newIndex));
                                        }
                                    };

                                    const handleNext = () => {
                                        if (currentHighlightIndex < highlightQuestions.length - 1) {
                                            const newIndex = currentHighlightIndex + 1;
                                            setCurrentHighlightIndex(newIndex);
                                            setViewedHighlightIndices(prev => new Set(prev).add(newIndex));
                                        }
                                    };

                                    const qHighlights = auditData.highlights.filter(h => h.questionId === question.id || !h.questionId);

                                    const isGlobalContinueEnabled = () => {
                                        if (viewedHighlightIndices.size < highlightQuestions.length) return false;

                                        return highlightQuestions.every(q => {
                                            if (!q.settings.required) return true;
                                            const qsHighlights = auditData.highlights.filter(h => h.questionId === q.id || !h.questionId);
                                            const minExpected = q.settings.minHighlights > 0 ? q.settings.minHighlights : 1;
                                            if (qsHighlights.length >= minExpected) return true;
                                            if (noProblematicFound[q.id]) return true;
                                            return false;
                                        });
                                    };

                                    return (
                                        <Box key={question.id} sx={{ mb: 8 }}>
                                            <Paper elevation={3} sx={{ p: 3, mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} className="highlight-section">
                                                <Button
                                                    onClick={handlePrev}
                                                    disabled={currentHighlightIndex === 0}
                                                    variant="outlined"
                                                >
                                                    {"< Prev"}
                                                </Button>
                                                <Box sx={{ flex: 1, textAlign: 'center', px: 2 }}>
                                                    <Typography variant="h6" gutterBottom>
                                                        {question.content || 'Highlighting passages'}
                                                        {question.settings.required && <span style={{ color: '#d32f2f', marginLeft: '4px' }}>*</span>}
                                                    </Typography>
                                                    <Typography variant="body1">
                                                        Question {currentHighlightIndex + 1} of {highlightQuestions.length}
                                                    </Typography>
                                                </Box>
                                                <Button
                                                    onClick={handleNext}
                                                    disabled={currentHighlightIndex === highlightQuestions.length - 1}
                                                    variant="outlined"
                                                >
                                                    {"Next >"}
                                                </Button>
                                            </Paper>
                                            <Paper elevation={3} sx={{ p: 3, mb: 2 }} className="highlight-section" tutorial-step="marked-passages">
                                                <Typography variant="body1">
                                                    Your marked passages for this question will appear here:
                                                </Typography>
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, justifyContent: 'center', minHeight: '200px' }}>
                                                    {qHighlights.map((highlight, index) => {
                                                        const globalIndex = auditData.highlights.findIndex(h => h === highlight);
                                                        return (
                                                            <Chip
                                                                key={index}
                                                                label={highlight.text}
                                                                onDelete={() => handleRemoveHighlight(globalIndex)}
                                                                color="primary"
                                                                size="small"
                                                            />
                                                        );
                                                    })}
                                                </Box>
                                            </Paper>
                                            <Paper elevation={3} sx={{ p: 3, mb: 2 }} className="highlight-section" tutorial-step="no-marked-passages">
                                                <Typography variant="body1">
                                                    In case you didn't find any part of the output to be problematic, you can proceed.
                                                </Typography>
                                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                                    <Checkbox
                                                        checked={!!noProblematicFound[question.id]}
                                                        onChange={(e) => setNoProblematicFound(prev => ({ ...prev, [question.id]: e.target.checked }))}
                                                        color="primary"
                                                        size="small"
                                                    />
                                                    <Typography variant="body1">
                                                        I didn't find any problematic, unfair, or biased outputs in this conversation.
                                                    </Typography>
                                                </Box>
                                                {errors[question.id] && (
                                                    <Alert severity="error" sx={{ mb: 2 }}>
                                                        {errors[question.id]}
                                                    </Alert>
                                                )}
                                                <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                                                    <Button startIcon={<InfoIcon />} onClick={handleReplayTutorial}>
                                                        Replay Tutorial
                                                    </Button>
                                                </Box>
                                            </Paper>
                                            <Box sx={{
                                                position: 'absolute',
                                                bottom: 0,
                                                right: 0,
                                                zIndex: 10,
                                                padding: 2,
                                                borderTop: '1px solid #ddd',
                                                backgroundColor: 'white',
                                                borderRadius: '8px',
                                                boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
                                            }}>
                                                <Button
                                                    variant="contained"
                                                    color="primary"
                                                    onClick={() => handleStateChange(getNextState())}
                                                    disabled={!isGlobalContinueEnabled()}
                                                >
                                                    Continue
                                                </Button>
                                            </Box>
                                        </Box>
                                    );
                                })()}
                            </Box>
                        )}
                        {conversationState === STATE.AUDIT_TEXTRESPONSE && (
                            <>
                                <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                                    <Typography variant="h6" gutterBottom align="center" sx={{ mb: 2, fontWeight: 'bold' }}>
                                        Your Highlighted Passages
                                    </Typography>
                                    {effectiveSurveyQuestions.questions
                                        .filter(q => q.type === 'textHighlight')
                                        .map((question, qIndex) => {
                                            const qHighlights = auditData.highlights?.filter(h => h.questionId === question.id || !h.questionId) || [];
                                            return (
                                                <Box key={question.id} sx={{ mb: 2 }}>
                                                    <Typography variant="subtitle1" fontWeight="bold">
                                                        {qIndex + 1}. {question.content || 'Highlighting passages'}
                                                    </Typography>
                                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                                                        {qHighlights.length > 0 ? (
                                                            qHighlights.map((h, i) => (
                                                                <Chip key={i} label={h.text} color="primary" variant="outlined" />
                                                            ))
                                                        ) : (
                                                            <Typography variant="body2" color="textSecondary">
                                                                No problematic text selected
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                </Box>
                                            );
                                        })}
                                    {effectiveSurveyQuestions.questions.filter(q => q.type === 'textHighlight').length === 0 && (
                                        <Typography variant="body2" color="textSecondary" align="center">
                                            No text highlight questions were asked.
                                        </Typography>
                                    )}
                                </Paper>

                                {effectiveSurveyQuestions.questions
                                    .filter(q => q.type === 'freeResponse')
                                    .map((question, qIndex) => (
                                        <Paper key={question.id} elevation={3} sx={{ p: 3, mb: 2 }} className="free-response">
                                            <Typography variant="h6" gutterBottom align="center">
                                                {question.content || 'Free Response Question'}
                                            </Typography>
                                            <Typography variant="body1" sx={{ mb: 2 }}>
                                                Please provide your feedback below.
                                            </Typography>
                                            <TextField
                                                label={question.content}
                                                multiline
                                                rows={4}
                                                variant="outlined"
                                                fullWidth
                                                margin="normal"
                                                name={question.id}
                                                value={auditData.textResponses[question.id] || ''}
                                                onChange={(e) => handleTextChange(question.id, e.target.value)}
                                                inputProps={{ maxLength: question.settings.maxLength }}
                                                required={question.settings.required}
                                                error={!!errors[question.id]}
                                                helperText={errors[question.id]}
                                            />
                                            {qIndex === effectiveSurveyQuestions.questions.filter(q => q.type === 'freeResponse').length - 1 && (
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                                                    <Button startIcon={<InfoIcon />} onClick={handleReplayTutorial}>
                                                        Replay Tutorial
                                                    </Button>
                                                    <Button
                                                        variant="contained"
                                                        color="primary"
                                                        onClick={handleSubmit}
                                                        disabled={
                                                            isSubmitted ||
                                                            effectiveSurveyQuestions.questions.some(
                                                                q => q.type === 'freeResponse' && q.settings.required && (!auditData.textResponses[q.id] || auditData.textResponses[q.id].trim() === '')
                                                            ) ||
                                                            Object.values(errors).some(e => e)
                                                        }
                                                        className="submit-button"
                                                    >
                                                        Submit
                                                    </Button>
                                                </Box>
                                            )}
                                        </Paper>
                                    ))}
                            </>
                        )}
                    </Box>
                </Box>
            </Box>
            {showTutorial && conversationState === STATE.AUDIT_LIKERTRESPONSE && (
                <AuditPage0Tutorial onComplete={handleTutorialComplete} surveyQuestions={effectiveSurveyQuestions} />
            )}
            {showTutorial && conversationState === STATE.AUDIT_HIGHLIGHT && (
                <AuditPage1Tutorial onComplete={handleTutorialComplete} />
            )}
            {showTutorial && conversationState === STATE.AUDIT_TEXTRESPONSE && (
                <AuditPage2Tutorial onComplete={handleTutorialComplete} surveyQuestions={effectiveSurveyQuestions} />
            )}
        </Box>
    );
};

export default AuditForm;