// StudySetup — a step wizard where an investigator configures a study: details,
// configuration, the questionnaire (authored with the SurveyJS QuestionnaireAuthor,
// stored at config.evaluation.questionnaire.schema), and share/preview.

import React, { useState } from 'react';
import {
  Box, Button, TextField, Typography, Paper, Stack, Divider, Chip, Snackbar,
  Card, CardContent, Step, StepButton, Stepper, IconButton, Tooltip, Alert,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
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
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', pb: 8 }}>
      {/* Header */}
      <Box sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', px: 3, py: 2, position: 'sticky', top: 0, zIndex: 10 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <IconButton onClick={onBack} aria-label="Back to studies">
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="overline" color="text.secondary">Study setup</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.01em' }}>{study.title}</Typography>
          </Box>
        </Stack>
      </Box>

      <Box sx={{ maxWidth: 880, mx: 'auto', px: 2, mt: 3 }}>
        <Stepper activeStep={step} nonLinear sx={{ mb: 4 }}>
          {['Details', 'Configuration', 'Questionnaire', 'Share & preview'].map((label, i) => (
            <Step key={label} completed={
              i === 0 ? Boolean(title.trim())
                : i === 1 ? configValid
                  : i === 2 ? hasQuestionnaire
                    : false
            }>
              <StepButton onClick={() => setStep(i)}>{label}</StepButton>
            </Step>
          ))}
        </Stepper>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        {step === 0 && (
        <Card variant="outlined" sx={{ mb: 3, borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>1 · Study details</Typography>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
              <TextField
                label="Description (what auditors will see)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth multiline minRows={2}
              />
              <Box><Button variant="contained" onClick={saveDetails} disabled={!title.trim()}>Save details</Button></Box>
            </Stack>
          </CardContent>
        </Card>

        )}

        {step === 1 && (
        <Card variant="outlined" sx={{ mb: 3, borderRadius: 2 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Typography variant="h6">2 · Configuration</Typography>
              {configValid && <Chip icon={<CheckCircleIcon />} label="Valid" color="success" size="small" />}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Define the auditor experience — conversation control, model, limits, evaluation
              methods, consent, and recruitment. The study can't be opened until this is valid.
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <StudyConfigForm config={study.config} onSave={saveConfig} />
          </CardContent>
        </Card>

        )}

        {step === 2 && (
        <Card variant="outlined" sx={{ mb: 3, borderRadius: 2 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Typography variant="h6">3 · Questionnaire</Typography>
              {hasQuestionnaire && <Chip icon={<CheckCircleIcon />} label="Configured" color="success" size="small" />}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              The questions auditors answer after each conversation. Start from a template, add
              questions visually, or paste your own — then save.
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
              <QuestionnaireAuthor value={questionnaireSchema} onSave={saveQuestionnaireSchema} />
            </Box>
          </CardContent>
        </Card>

        )}

        {step === 3 && (
        <Card variant="outlined" sx={{ mb: 3, borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>4 · Share &amp; preview</Typography>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {/* Lifecycle */}
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Status:</Typography>
                <Chip
                  label={status}
                  color={status === 'open' ? 'success' : status === 'closed' ? 'default' : 'warning'}
                  size="small"
                />
                {status !== 'open' ? (
                  <Tooltip title={configValid ? '' : 'Complete the configuration first'}>
                    <span>
                      <Button variant="contained" size="small" disabled={!configValid}
                        onClick={() => setStatus('open')}>
                        Open study
                      </Button>
                    </span>
                  </Tooltip>
                ) : (
                  <Button variant="outlined" size="small" color="warning"
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
                <Button variant="outlined" onClick={generateCode}>Generate access code</Button>
                {code && (
                  <Paper variant="outlined" sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6" sx={{ letterSpacing: 2, fontFamily: 'monospace' }}>{code}</Typography>
                    <Tooltip title="Copy code">
                      <IconButton size="small" onClick={() => copy(code)}><ContentCopyIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  </Paper>
                )}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Share the code with auditors — they enter it on the home screen to take this study.
              </Typography>
              <Divider />
              <Box>
                <Button
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  onClick={() => previewStudy(study)}
                  disabled={!hasQuestionnaire}
                >
                  Preview as auditor
                </Button>
                {!hasQuestionnaire && (
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                    Save a questionnaire first to preview.
                  </Typography>
                )}
              </Box>
            </Stack>
          </CardContent>
        </Card>
        )}

        {/* Wizard navigation */}
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 1, mb: 6 }}>
          <Button disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            ← Back
          </Button>
          {step < 3 && (
            <Button variant="contained" onClick={() => setStep((s) => Math.min(3, s + 1))}>
              Next →
            </Button>
          )}
        </Stack>
      </Box>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={2500}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
