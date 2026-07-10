// AuditFlow — the config-driven auditor audit screen (Phase C audit-flow rewrite).
// Runs the enabled evaluation steps from the audit plan (span highlighting →
// questionnaire), rendering the reused ChatHistory highlighter and the SurveyJS
// questionnaire, and captures responses + hardened highlights. Replaces the legacy
// AuditForm when a study configures a SurveyJS questionnaire and/or span highlighting.

import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Divider, Alert, Button, Chip } from '@mui/material';
import conversationHandler from '../../tools/ConversationHandler';
import AppConfig from '../../tools/AppConfig';
import { STATE } from '../../tools/models';
import { resolveAuditPlan, AUDIT_STEP } from '../../tools/audit/auditPlan';
import { migrateLegacyHighlight } from '../../tools/audit/spanHighlights';
import Questionnaire from '../Questionnaire/Questionnaire';
import ChatHistory from '../ChatHistory/ChatHistory';

export default function AuditFlow({ conversationId, onAuditComplete = () => {}, setLoading = () => {} }) {
  const config = AppConfig.getAll().config || {};
  const evaluation = config.evaluation || {};
  const schema = (evaluation.questionnaire && evaluation.questionnaire.schema) || null;

  // Enabled audit steps (SC-6), gated so a questionnaire step only appears with a schema.
  const plan = resolveAuditPlan(evaluation, { hasSchema: Boolean(schema) });
  const [stepIndex, setStepIndex] = useState(0);
  const [highlights, setHighlights] = useState([]); // legacy shape for ChatHistory rendering
  const [messages, setMessages] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const step = plan[stepIndex];

  useEffect(() => {
    let active = true;
    conversationHandler.getConversationById(conversationId).then((conv) => {
      if (active && conv && conv.getChat) setMessages(conv.getChat());
    });
    return () => { active = false; };
  }, [conversationId]);

  const finish = async (questionnaireResponses = null) => {
    if (submitting) return;
    setSubmitting(true);
    setLoading(true);
    try {
      const auditData = {};
      if (questionnaireResponses) auditData.questionnaire = questionnaireResponses;
      if (highlights.length) auditData.highlights = highlights.map(migrateLegacyHighlight);
      await conversationHandler.updateConversationState(conversationId, STATE.COMPLETE);
      await conversationHandler.addAuditResponse(conversationId, auditData);
      onAuditComplete();
    } catch (e) {
      console.error('Audit submit failed:', e);
    } finally {
      setSubmitting(false);
      setLoading(false);
    }
  };

  // Nothing to audit -> complete immediately.
  useEffect(() => { if (plan.length === 0) finish(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addHighlight = (h) => setHighlights((prev) => [...prev, h]);
  const removeHighlight = (index) => setHighlights((prev) => prev.filter((_, i) => i !== index));

  const advanceFromHighlight = () => {
    if (stepIndex + 1 >= plan.length) finish();
    else setStepIndex(stepIndex + 1);
  };

  const Transcript = () => (
    <Box sx={{ width: '38%', p: 2, borderRight: '1px solid', borderColor: 'divider', overflowY: 'auto', maxHeight: '100vh' }}>
      <Typography variant="h6" align="center" gutterBottom>Your conversation</Typography>
      {messages.map((m) => (
        <Paper key={m.id} elevation={0} variant="outlined" sx={{ p: 1.25, mb: 1, borderRadius: 2, bgcolor: m.author === 'user' ? (t) => (t.palette.mode === 'dark' ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.10)') : 'background.paper' }}>
          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>{m.author === 'user' ? 'You' : 'AI Chatbot'}</Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{String(m.content)}</Typography>
        </Paper>
      ))}
    </Box>
  );

  const stepNumber = stepIndex + 1;
  const totalSteps = plan.length;

  // --- Span-highlight step ---
  if (step === AUDIT_STEP.SPAN_HIGHLIGHT) {
    const nextLabel = stepIndex + 1 >= plan.length ? 'Finish' : 'Continue to the questions →';
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
        <Box sx={{ px: 3, pt: 2 }}>
          <Typography variant="overline" color="text.secondary">Step {stepNumber} of {totalSteps}</Typography>
          <Typography variant="h6">Highlight anything problematic</Typography>
          <Typography variant="body2" color="text.secondary">
            Select any words in the chatbot's replies that seem unfair, biased, or harmful. Your highlights are saved automatically.
          </Typography>
          {highlights.length > 0 && (
            <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {highlights.map((h, i) => (
                <Chip key={i} label={h.text} size="small" onDelete={() => removeHighlight(i)} />
              ))}
            </Box>
          )}
        </Box>
        <Divider sx={{ my: 1 }} />
        <Box sx={{ flex: 1, overflowY: 'auto', px: 2 }}>
          <ChatHistory
            conversationId={conversationId}
            addHighlight={addHighlight}
            enableHighlighting={true}
            highlights={highlights}
          />
        </Box>
        <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', textAlign: 'right' }}>
          <Button variant="contained" onClick={advanceFromHighlight} disabled={submitting}>{nextLabel}</Button>
        </Box>
      </Box>
    );
  }

  // --- Questionnaire step ---
  if (step === AUDIT_STEP.QUESTIONNAIRE) {
    return (
      <Box sx={{ display: 'flex', height: '100%', width: '100%' }}>
        <Transcript />
        <Box sx={{ flex: 1, p: 3, overflowY: 'auto', maxHeight: '100vh' }}>
          <Typography variant="overline" color="text.secondary">Step {stepNumber} of {totalSteps}</Typography>
          <Typography variant="h6" gutterBottom>Please answer a few questions about this conversation</Typography>
          <Divider sx={{ mb: 2 }} />
          {schema
            ? <Questionnaire schema={schema} onComplete={(responses) => finish(responses)} />
            : <Alert severity="info">No questionnaire configured for this study.</Alert>}
        </Box>
      </Box>
    );
  }

  // Plan exhausted / empty — completing.
  return (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <Typography variant="body1">Finishing…</Typography>
    </Box>
  );
}
