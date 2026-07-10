// AuditFlow — the config-driven auditor audit screen (Phase C audit-flow rewrite).
// Runs the enabled evaluation steps from the audit plan (span highlighting →
// questionnaire), rendering the reused ChatHistory highlighter and the SurveyJS
// questionnaire, and captures responses + hardened highlights. Replaces the legacy
// AuditForm when a study configures a SurveyJS questionnaire and/or span highlighting.

import React, { useEffect, useState } from 'react';
import { Box, Typography, Divider } from '../ui/layout';
import { Card } from '../ui/card';
import { Alert } from '../ui/alert';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Close } from '../ui/icons';
import { cn } from '../../lib/utils';
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
    <Box className="w-[38%] p-4 border-r overflow-y-auto max-h-screen">
      <Typography variant="h6" align="center" gutterBottom>Your conversation</Typography>
      {messages.map((m) => (
        <Card key={m.id} className={cn('p-2.5 mb-2 rounded-md', m.author === 'user' ? 'bg-primary/10' : 'bg-card')}>
          <Typography variant="caption" className="font-semibold block">{m.author === 'user' ? 'You' : 'AI Chatbot'}</Typography>
          <Typography variant="body2" className="whitespace-pre-wrap">{String(m.content)}</Typography>
        </Card>
      ))}
    </Box>
  );

  const stepNumber = stepIndex + 1;
  const totalSteps = plan.length;

  // --- Span-highlight step ---
  if (step === AUDIT_STEP.SPAN_HIGHLIGHT) {
    const nextLabel = stepIndex + 1 >= plan.length ? 'Finish' : 'Continue to the questions →';
    return (
      <Box className="flex flex-col h-full w-full">
        <Box className="px-6 pt-4">
          <Typography variant="overline" color="text.secondary">Step {stepNumber} of {totalSteps}</Typography>
          <Typography variant="h6">Highlight anything problematic</Typography>
          <Typography variant="body2" color="text.secondary">
            Select any words in the chatbot's replies that seem unfair, biased, or harmful. Your highlights are saved automatically.
          </Typography>
          {highlights.length > 0 && (
            <Box className="mt-2 flex gap-2 flex-wrap">
              {highlights.map((h, i) => (
                <Badge key={i}>
                  {h.text}
                  <button
                    type="button"
                    aria-label="Remove highlight"
                    onClick={() => removeHighlight(i)}
                    className="inline-flex items-center rounded-full hover:bg-foreground/10"
                  >
                    <Close size={12} />
                  </button>
                </Badge>
              ))}
            </Box>
          )}
        </Box>
        <Divider className="my-2" />
        <Box className="flex-1 overflow-y-auto px-4">
          <ChatHistory
            conversationId={conversationId}
            addHighlight={addHighlight}
            enableHighlighting={true}
            highlights={highlights}
          />
        </Box>
        <Box className="p-4 border-t text-right">
          <Button onClick={advanceFromHighlight} disabled={submitting}>{nextLabel}</Button>
        </Box>
      </Box>
    );
  }

  // --- Questionnaire step ---
  if (step === AUDIT_STEP.QUESTIONNAIRE) {
    return (
      <Box className="flex h-full w-full">
        <Transcript />
        <Box className="flex-1 p-6 overflow-y-auto max-h-screen">
          <Typography variant="overline" color="text.secondary">Step {stepNumber} of {totalSteps}</Typography>
          <Typography variant="h6" gutterBottom>Please answer a few questions about this conversation</Typography>
          <Divider className="mb-4" />
          {schema
            ? <Questionnaire schema={schema} onComplete={(responses) => finish(responses)} />
            : <Alert variant="info">No questionnaire configured for this study.</Alert>}
        </Box>
      </Box>
    );
  }

  // Plan exhausted / empty — completing.
  return (
    <Box className="p-8 text-center">
      <Typography variant="body1">Finishing…</Typography>
    </Box>
  );
}
