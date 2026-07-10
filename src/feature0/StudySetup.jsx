// StudySetup — a step wizard where an investigator configures a study: details,
// configuration, the questionnaire (authored with the SurveyJS QuestionnaireAuthor,
// stored at config.evaluation.questionnaire.schema), and share/preview.

import React, { useState, useEffect } from 'react';
import { Box, Typography, Stack, Divider } from '../components/ui/layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Tooltip } from '../components/ui/tooltip';
import {
  ArrowBack as ArrowBackIcon, ContentCopy as ContentCopyIcon,
  PlayArrow as PlayArrowIcon, CheckCircle as CheckCircleIcon, Close,
} from '../components/ui/icons';
import { cn } from '../lib/utils';
import QuestionnaireAuthor from '../components/QuestionnaireAuthor/QuestionnaireAuthor';
import StudyConfigForm from './StudyConfigForm';
import { useFeature0 } from './Feature0Context';
import { withStudyConfigDefaults, validateStudyConfig } from '../tools/studyConfig';

export default function StudySetup({ study: initialStudy, onBack }) {
  const { studies, user, previewStudy } = useFeature0();
  const [study, setStudy] = useState(initialStudy);
  const [title, setTitle] = useState(initialStudy.title);
  const [description, setDescription] = useState(initialStudy.description || '');
  const [code, setCode] = useState(null);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);

  // Auto-dismiss the toast (preserves MUI Snackbar autoHideDuration=2500).
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const questionnaireSchema =
    (study.config && study.config.evaluation && study.config.evaluation.questionnaire
      && study.config.evaluation.questionnaire.schema) || null;
  const hasQuestionnaire = Boolean(questionnaireSchema) || Boolean(study.config && study.config.surveyQuestions);
  const configValid = validateStudyConfig(withStudyConfigDefaults(study.config || {})).valid;
  const status = study.status || 'draft';

  const persist = async (patch) => {
    setError(null);
    try {
      const updated = await studies.updateStudy(study.id, user.id, patch);
      setStudy(updated);
      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const saveDetails = async () => {
    await persist({ title: title.trim(), description: description.trim() });
    setToast('Study details saved');
  };

  // Save the SurveyJS questionnaire schema into the study config (evaluation.questionnaire.schema).
  const saveQuestionnaireSchema = async (schema) => {
    const cfg = withStudyConfigDefaults(study.config || {});
    const next = {
      ...cfg,
      evaluation: { ...cfg.evaluation, questionnaire: { ...cfg.evaluation.questionnaire, schema } },
    };
    if (study.config && study.config.surveyQuestions) next.surveyQuestions = study.config.surveyQuestions;
    await persist({ config: next });
    setToast('Questionnaire saved');
  };

  const saveConfig = async (config) => {
    // Preserve the legacy questionnaire blob (authored separately until Phase C)
    // alongside the StudyConfig fields.
    const next = { ...config };
    if (study.config && study.config.surveyQuestions) next.surveyQuestions = study.config.surveyQuestions;
    await persist({ config: next });
    setToast('Configuration saved');
  };

  const setStatus = async (nextStatus) => {
    setError(null);
    try {
      const updated = nextStatus === 'open'
        ? await studies.openStudy(study.id, user.id)
        : await studies.closeStudy(study.id, user.id);
      setStudy(updated);
      setToast(nextStatus === 'open' ? 'Study opened' : 'Study closed');
    } catch (err) {
      setError(err.message);
    }
  };

  const generateCode = async () => {
    setError(null);
    try {
      const c = await studies.createAccessCode(study.id, user.id, {});
      setCode(c.code);
    } catch (err) {
      setError(err.message);
    }
  };

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); setToast('Copied to clipboard'); } catch (_) { /* noop */ }
  };

  // One step visible at a time (a real wizard, not a long scroll).
  const [step, setStep] = useState(0);

  return (
    <Box className="min-h-screen bg-background pb-16">
      {/* Header */}
      <Box className="sticky top-0 z-10 border-b bg-card px-6 py-4">
        <Stack direction="row" alignItems="center" spacing={2}>
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to studies">
            <ArrowBackIcon />
          </Button>
          <Box>
            <Typography variant="overline" color="text.secondary">Study setup</Typography>
            <Typography variant="h5" className="font-bold leading-[1.1] tracking-[-0.01em]">{study.title}</Typography>
          </Box>
        </Stack>
      </Box>

      <Box className="mx-auto mt-6 max-w-[880px] px-4">
        <div className="mb-8 flex flex-wrap items-center gap-2">
          {['Details', 'Configuration', 'Questionnaire', 'Share & preview'].map((label, i) => {
            const completed =
              i === 0 ? Boolean(title.trim())
                : i === 1 ? configValid
                  : i === 2 ? hasQuestionnaire
                    : false;
            const active = step === i;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setStep(i)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                  active ? 'bg-primary/12 font-semibold text-primary' : 'text-muted-foreground hover:bg-foreground/5',
                )}
              >
                <span className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full border text-xs',
                  completed ? 'border-success bg-success text-success-foreground'
                    : active ? 'border-primary text-primary' : 'border-border',
                )}>
                  {completed ? <CheckCircleIcon size={16} /> : i + 1}
                </span>
                {label}
              </button>
            );
          })}
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <div className="flex items-start justify-between gap-2">
              <AlertDescription>{error}</AlertDescription>
              <Button variant="ghost" size="icon" className="-mr-1 -mt-1 h-6 w-6 shrink-0" onClick={() => setError(null)}>
                <Close />
              </Button>
            </div>
          </Alert>
        )}

        {step === 0 && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <Typography variant="h6" gutterBottom>1 · Study details</Typography>
            <Stack spacing={2} className="mt-2">
              <div>
                <Label className="mb-1.5 block">Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 block">Description (what auditors will see)</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
              <Box><Button onClick={saveDetails} disabled={!title.trim()}>Save details</Button></Box>
            </Stack>
          </CardContent>
        </Card>

        )}

        {step === 1 && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <Stack direction="row" alignItems="center" spacing={1} className="mb-2">
              <Typography variant="h6">2 · Configuration</Typography>
              {configValid && <Badge variant="success"><CheckCircleIcon size={14} />Valid</Badge>}
            </Stack>
            <Typography variant="body2" color="text.secondary" className="mb-4">
              Define the auditor experience — conversation control, model, limits, evaluation
              methods, consent, and recruitment. The study can't be opened until this is valid.
            </Typography>
            <Divider className="mb-4" />
            <StudyConfigForm config={study.config} onSave={saveConfig} />
          </CardContent>
        </Card>

        )}

        {step === 2 && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <Stack direction="row" alignItems="center" spacing={1} className="mb-2">
              <Typography variant="h6">3 · Questionnaire</Typography>
              {hasQuestionnaire && <Badge variant="success"><CheckCircleIcon size={14} />Configured</Badge>}
            </Stack>
            <Typography variant="body2" color="text.secondary" className="mb-4">
              The questions auditors answer after each conversation. Start from a template, add
              questions visually, or paste your own — then save.
            </Typography>
            <Divider className="mb-4" />
            <Box className="rounded bg-card">
              <QuestionnaireAuthor value={questionnaireSchema} onSave={saveQuestionnaireSchema} />
            </Box>
          </CardContent>
        </Card>

        )}

        {step === 3 && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <Typography variant="h6" gutterBottom>4 · Share &amp; preview</Typography>
            <Stack spacing={2} className="mt-2">
              {/* Lifecycle */}
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                <Typography variant="body2" className="font-semibold">Status:</Typography>
                <Badge variant={status === 'open' ? 'success' : status === 'closed' ? 'secondary' : 'warning'}>
                  {status}
                </Badge>
                {status !== 'open' ? (
                  <Tooltip title={configValid ? '' : 'Complete the configuration first'}>
                    <span>
                      <Button size="sm" disabled={!configValid}
                        onClick={() => setStatus('open')}>
                        Open study
                      </Button>
                    </span>
                  </Tooltip>
                ) : (
                  <Button variant="outline" size="sm"
                    className="border-warning text-warning hover:bg-warning/10"
                    onClick={() => setStatus('closed')}>
                    Close study
                  </Button>
                )}
                <Typography variant="caption" color="text.secondary">
                  Auditors can join only while the study is open.
                </Typography>
              </Stack>
              <Divider />
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                <Button variant="outline" onClick={generateCode}>Generate access code</Button>
                {code && (
                  <Card className="flex items-center gap-2 px-4 py-2">
                    <Typography variant="h6" className="font-mono tracking-[2px]">{code}</Typography>
                    <Tooltip title="Copy code">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copy(code)}><ContentCopyIcon size={18} /></Button>
                    </Tooltip>
                  </Card>
                )}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Share the code with auditors — they enter it on the home screen to take this study.
              </Typography>
              <Divider />
              <Box>
                <Button
                  onClick={() => previewStudy(study)}
                  disabled={!hasQuestionnaire}
                >
                  <PlayArrowIcon />
                  Preview as auditor
                </Button>
                {!hasQuestionnaire && (
                  <Typography variant="caption" color="text.secondary" className="ml-4">
                    Save a questionnaire first to preview.
                  </Typography>
                )}
              </Box>
            </Stack>
          </CardContent>
        </Card>
        )}

        {/* Wizard navigation */}
        <Stack direction="row" justifyContent="space-between" className="mb-12 mt-2">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            ← Back
          </Button>
          {step < 3 && (
            <Button onClick={() => setStep((s) => Math.min(3, s + 1))}>
              Next →
            </Button>
          )}
        </Stack>
      </Box>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {toast}
        </div>
      )}
    </Box>
  );
}
