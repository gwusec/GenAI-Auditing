// src/components/AuditForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { AuditResponse, STATE } from '../../tools/models';
import conversationHandler from '../../tools/ConversationHandler';
import ChatHistory from '../ChatHistory/ChatHistory';
import { fairnessProperties } from '../../tools/principles';
import AuditPage0Tutorial from '../tutorials/AuditPage0Tutorial';
import AuditPage1Tutorial from '../tutorials/AuditPage1Tutorial';
import AuditPage2Tutorial from '../tutorials/AuditPage2Tutorial';
import styles from './AuditForm.module.css';
import { Typography, Box } from '../ui/layout';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { Alert } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table';
import { Info, Close } from '../ui/icons';

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
    const defaultSurvey = { questions: [] };
    const effectiveSurveyQuestions = surveyQuestions || defaultSurvey;

    const [auditData, setAuditData] = useState(new AuditResponse());
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);
    const [conversationState, setConversationState] = useState(
        getAvailableStates(effectiveSurveyQuestions)[0] || STATE.COMPLETE
    );
    const [tutorialCompleted, setTutorialCompleted] = useState(false);
    const [isCheckedNoProblematicOutputFound, setNoProblematicOutputFound] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        console.log("Initializing audit form...");
        const initAudit = async () => {
            const conversation = await conversationHandler.getConversationById(conversationId);
            if (conversation && conversation.audit) {
                setAuditData(conversation.audit);
            }
            setConversationState(
                conversation.state || getAvailableStates(effectiveSurveyQuestions)[0] || STATE.COMPLETE
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
        setAuditData(prev => ({
            ...prev,
            highlights: [...prev.highlights, highlight],
        }));
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
            } else if (question.type === 'textHighlight' && question.settings.required && question.settings.minHighlights > 0) {
                if (auditData.highlights.length < question.settings.minHighlights) {
                    newErrors[question.id] = `At least ${question.settings.minHighlights} highlights are required.`;
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
                <Box className="w-[45%] overflow-hidden pl-4 pr-4 pt-2 border-r border-[#ddd] flex flex-col h-full">
                    <div tutorial-step="chat-history">
                        <Typography variant="h6" gutterBottom align="center">
                            Your previous conversation
                        </Typography>
                        <Box className="overflow-y-auto flex-1 max-h-[calc(100vh-64px)]">
                            <ChatHistory
                                conversationId={conversationId}
                                addHighlight={handleHighlight}
                                removeHighlight={handleRemoveHighlight}
                                enableHighlighting={conversationState === STATE.AUDIT_HIGHLIGHT}
                                disableTextSelection={conversationState === STATE.AUDIT_TEXTRESPONSE}
                                highlights={auditData.highlights}
                                isAudit={true}
                                auditFinished={isSubmitted}
                            />
                        </Box>
                    </div>
                </Box>
                <Box className="w-[55%] overflow-y-auto flex flex-col items-center pr-2 pt-2 h-full">
                    <Box className="w-[95%] max-w-[800px]">
                        {!hasAuditContent && conversationState === STATE.COMPLETE && (
                            <Card className="p-6 mb-4">
                                <Typography variant="h6" gutterBottom align="center">
                                    No Audit Questions Available
                                </Typography>
                                <Typography variant="body1">
                                    There are no audit questions configured for this session. You can review the conversation or complete the audit.
                                </Typography>
                                <Box className="flex justify-end mt-4">
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={isSubmitted}
                                    >
                                        Complete Audit
                                    </Button>
                                </Box>
                            </Card>
                        )}
                        {conversationState === STATE.AUDIT_LIKERTRESPONSE && (
                            <>
                                <Card className={styles['fairness-properties']}>
                                    <Box className="flex items-center relative">
                                        <Typography variant="h6" gutterBottom align="center">
                                            Please rate the AI Chatbot's performance
                                        </Typography>
                                    </Box>
                                </Card>
                                <Card className={styles['fairness-properties']}>
                                    <Box className="flex items-center relative">
                                        <Typography variant="subtitle2" gutterBottom>
                                            Please verify that the AI chatbot upholds these principles:
                                        </Typography>
                                    </Box>
                                    <Box component="ul" className={styles['principles-list']}>
                                        {fairnessPropertiesRandomOrder.map((property, index) => (
                                            <li key={index}>{property}</li>
                                        ))}
                                    </Box>
                                </Card>
                                {effectiveSurveyQuestions.questions
                                    .filter(q => q.type === 'matrix')
                                    .map((question, qIndex) => (
                                        <Card key={question.id} className="p-6 mb-4 likert-scale" tutorial-step="chat-performance-rating">
                                            <Typography variant="subtitle2" gutterBottom>
                                                {question.content || 'Matrix Question'}
                                            </Typography>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[40%] font-bold">
                                                            Statements
                                                        </TableHead>
                                                        {question.settings.columns.map((column, index) => (
                                                            <TableHead
                                                                key={index}
                                                                className="font-bold text-center text-[0.75rem] leading-[1.2] whitespace-normal break-words px-[2px] py-[6px]"
                                                                style={{ width: `${60 / question.settings.columns.length}%` }}
                                                            >
                                                                <Typography
                                                                    component="div"
                                                                    variant="body2"
                                                                    className="whitespace-normal break-words"
                                                                >
                                                                    {column}
                                                                </Typography>
                                                            </TableHead>
                                                        ))}
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {question.settings.rows.map((row, rowIndex) => (
                                                        <TableRow key={rowIndex}>
                                                            <TableCell className="py-2 px-1">
                                                                {row}
                                                            </TableCell>
                                                            {question.settings.columns.map((column, colIndex) => (
                                                                <TableCell
                                                                    key={colIndex}
                                                                    className="text-center px-[2px] py-[6px]"
                                                                >
                                                                    <input
                                                                        type="radio"
                                                                        checked={auditData.likertResponses[`${question.id}-${row}`] === column}
                                                                        onChange={() => handleMatrixChange(question.id, row, column)}
                                                                        value={column}
                                                                        name={`${question.id}-${row}`}
                                                                        required={question.settings.required}
                                                                        className="h-4 w-4 accent-[hsl(var(--primary))]"
                                                                    />
                                                                </TableCell>
                                                            ))}
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                            {question.settings.rows.map(row => (
                                                errors[`${question.id}-${row}`] && (
                                                    <Alert key={`${question.id}-${row}`} variant="destructive" className="mt-2">
                                                        {errors[`${question.id}-${row}`]}
                                                    </Alert>
                                                )
                                            ))}
                                        </Card>
                                    ))}
                                <Box className="flex justify-between mt-4">
                                    <Button variant="ghost" onClick={handleReplayTutorial}>
                                        <Info />
                                        Replay Tutorial
                                    </Button>
                                    <Button
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
                            <>
                                {effectiveSurveyQuestions.questions
                                    .filter(q => q.type === 'textHighlight')
                                    .map((question, qIndex) => (
                                        <Box key={question.id}>
                                            <Card className="p-6 mb-4 highlight-section">
                                                <Typography variant="h6" gutterBottom align="center">
                                                    {question.content || 'Highlighting passages'}
                                                </Typography>
                                                <Typography variant="body1" paragraph>
                                                    {question.content}
                                                </Typography>
                                            </Card>
                                            <Card className="p-6 mb-4 highlight-section" tutorial-step="marked-passages">
                                                <Typography variant="body1">
                                                    Your marked passages will appear here:
                                                </Typography>
                                                <Box className="flex flex-wrap gap-2 mb-4 justify-center min-h-[200px]">
                                                    {auditData.highlights.map((highlight, index) => (
                                                        <Badge key={index}>
                                                            {highlight.text}
                                                            <button
                                                                type="button"
                                                                aria-label="Remove highlight"
                                                                onClick={() => handleRemoveHighlight(index)}
                                                                className="inline-flex items-center rounded-full hover:bg-foreground/10"
                                                            >
                                                                <Close size={12} />
                                                            </button>
                                                        </Badge>
                                                    ))}
                                                </Box>
                                            </Card>
                                            <Card className="p-6 mb-4 highlight-section" tutorial-step="no-marked-passages">
                                                <Typography variant="body1">
                                                    In case you didn't find any part of the output to be problematic, you can proceed to the next page.
                                                </Typography>
                                                <Box className="flex items-center mb-4">
                                                    <Checkbox
                                                        checked={isCheckedNoProblematicOutputFound}
                                                        onCheckedChange={(checked) => setNoProblematicOutputFound(checked === true)}
                                                        className="mr-2"
                                                    />
                                                    <Typography variant="body1">
                                                        I didn't find any problematic, unfair, or biased outputs in this conversation.
                                                    </Typography>
                                                </Box>
                                                {errors[question.id] && (
                                                    <Alert variant="destructive" className="mb-4">
                                                        {errors[question.id]}
                                                    </Alert>
                                                )}
                                                <Box className="flex justify-between">
                                                    <Button variant="ghost" onClick={handleReplayTutorial}>
                                                        <Info />
                                                        Replay Tutorial
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleStateChange(getNextState())}
                                                        disabled={
                                                            !isCheckedNoProblematicOutputFound &&
                                                            auditData.highlights.length < question.settings.minHighlights
                                                        }
                                                    >
                                                        Next
                                                    </Button>
                                                </Box>
                                            </Card>
                                        </Box>
                                    ))}
                            </>
                        )}
                        {conversationState === STATE.AUDIT_TEXTRESPONSE && (
                            <>
                                {effectiveSurveyQuestions.questions
                                    .filter(q => q.type === 'freeResponse')
                                    .map((question, qIndex) => (
                                        <Card key={question.id} className="p-6 mb-4 free-response">
                                            <Typography variant="h6" gutterBottom align="center">
                                                {question.content || 'Free Response Question'}
                                            </Typography>
                                            <Typography variant="body1">
                                                Please provide your feedback below.
                                            </Typography>
                                            <Box className="flex flex-wrap gap-2 mb-4 justify-center">
                                                {auditData.highlights.map((highlight, index) => (
                                                    <Badge key={index} className="m-1">
                                                        {highlight.text}
                                                    </Badge>
                                                ))}
                                            </Box>
                                            <div className="my-4 w-full">
                                                {question.content && (
                                                    <Label htmlFor={question.id} className="mb-1 block">
                                                        {question.content}
                                                    </Label>
                                                )}
                                                <Textarea
                                                    id={question.id}
                                                    rows={4}
                                                    name={question.id}
                                                    value={auditData.textResponses[question.id] || ''}
                                                    onChange={(e) => handleTextChange(question.id, e.target.value)}
                                                    maxLength={question.settings.maxLength}
                                                    required={question.settings.required}
                                                    className={errors[question.id] ? 'border-destructive' : undefined}
                                                />
                                                {errors[question.id] && (
                                                    <p className="mt-1 text-sm text-destructive">{errors[question.id]}</p>
                                                )}
                                            </div>
                                            {qIndex === effectiveSurveyQuestions.questions.filter(q => q.type === 'freeResponse').length - 1 && (
                                                <Box className="flex justify-between mt-4">
                                                    <Button variant="ghost" onClick={handleReplayTutorial}>
                                                        <Info />
                                                        Replay Tutorial
                                                    </Button>
                                                    <Button
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
                                        </Card>
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