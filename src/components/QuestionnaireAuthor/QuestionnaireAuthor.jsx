// QuestionnaireAuthor — the in-house questionnaire authoring UI (Phase C step 4;
// SC-7 / D1). A visual editor over the tested authoring helpers that emits SurveyJS
// JSON, plus a raw-JSON escape hatch. Both paths run validateSurveyJSON before save,
// so a malformed schema can't be saved (PRD §9 D1). The visual editor covers the D1
// tier; anything beyond it is reached via the Raw JSON tab.

import React, { useState, useMemo } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, TextField, MenuItem, Switch,
  FormControlLabel, Button, IconButton, Divider, Tabs, Tab, Alert, Chip, Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import {
  QUESTION_TYPES, blankQuestionnaire, addPage, removePage,
  addQuestion, updateQuestion, removeQuestion, setTitle,
} from '../../tools/audit/authoring';
import { validateSurveyJSON, countQuestions } from '../../tools/audit/questionnaire';
import { QUESTIONNAIRE_TEMPLATES, getTemplate } from '../../tools/templates';

const linesToArray = (text) => text.split('\n').map((s) => s.trim()).filter(Boolean);
const arrayToLines = (arr = []) =>
  arr.map((x) => (typeof x === 'string' ? x : (x.text ?? x.value ?? ''))).join('\n');

const surveyTypeToKey = (t) => (QUESTION_TYPES.find((q) => q.surveyType === t) || {}).label || t;

function ChoiceLines({ label, value, onChange }) {
  return (
    <TextField
      label={label} value={arrayToLines(value)} onChange={(e) => onChange(linesToArray(e.target.value))}
      fullWidth multiline minRows={2} size="small"
      helperText="One per line"
    />
  );
}

function QuestionEditor({ q, onPatch, onRemove }) {
  return (
    <Card variant="outlined" sx={{ mb: 1.5 }}>
      <CardContent sx={{ pb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Chip label={surveyTypeToKey(q.type)} size="small" />
          <Box sx={{ flexGrow: 1 }} />
          <FormControlLabel
            control={<Switch checked={!!q.isRequired} onChange={(e) => onPatch({ isRequired: e.target.checked })} size="small" />}
            label="Required"
          />
          <Tooltip title="Remove question">
            <IconButton size="small" onClick={onRemove}><DeleteIcon fontSize="small" /></IconButton>
          </Tooltip>
        </Stack>
        <Stack spacing={1.5}>
          <TextField
            label="Question / instructions" value={q.title || ''} size="small" fullWidth
            onChange={(e) => onPatch({ title: e.target.value })}
          />
          {(q.type === 'radiogroup' || q.type === 'checkbox') && (
            <ChoiceLines label="Choices" value={q.choices} onChange={(choices) => onPatch({ choices })} />
          )}
          {q.type === 'matrix' && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <ChoiceLines label="Rows (statements)" value={q.rows} onChange={(rows) => onPatch({ rows })} />
              <ChoiceLines label="Columns (scale)" value={q.columns} onChange={(columns) => onPatch({ columns })} />
            </Stack>
          )}
          {q.type === 'rating' && (
            <Stack direction="row" spacing={1.5}>
              <TextField type="number" size="small" label="Min" value={q.rateMin ?? 1}
                onChange={(e) => onPatch({ rateMin: Number(e.target.value) })} />
              <TextField type="number" size="small" label="Max" value={q.rateMax ?? 5}
                onChange={(e) => onPatch({ rateMax: Number(e.target.value) })} />
            </Stack>
          )}
          <TextField
            label="Show only if (optional, e.g. {q1} = 'Yes')" value={q.visibleIf || ''} size="small" fullWidth
            onChange={(e) => onPatch({ visibleIf: e.target.value || undefined })}
            helperText="Basic conditional visibility"
          />
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function QuestionnaireAuthor({ value, onSave = () => {} }) {
  const [schema, setSchema] = useState(() => value || blankQuestionnaire());
  const [tab, setTab] = useState(0); // 0 visual, 1 raw json
  const [addType, setAddType] = useState('single');
  const [rawText, setRawText] = useState('');
  const [rawError, setRawError] = useState(null);

  const validation = useMemo(() => validateSurveyJSON(schema), [schema]);

  const adoptTemplate = (id) => {
    const t = id === 'blank' ? blankQuestionnaire() : getTemplate(id);
    if (t) setSchema(t);
  };

  const enterJsonTab = () => { setRawText(JSON.stringify(schema, null, 2)); setRawError(null); setTab(1); };
  const applyJson = () => {
    const r = validateSurveyJSON(rawText);
    if (!r.valid) { setRawError(r.error); return; }
    setSchema(r.schema);
    setRawError(null);
    setTab(0);
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <TextField
          select size="small" label="Start from a template" value="" sx={{ minWidth: 200 }}
          onChange={(e) => adoptTemplate(e.target.value)}
        >
          <MenuItem value="blank">Blank</MenuItem>
          {QUESTIONNAIRE_TEMPLATES.map((t) => <MenuItem key={t.id} value={t.id}>{t.label}</MenuItem>)}
        </TextField>
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="body2" color="text.secondary">{countQuestions(schema)} question(s)</Typography>
        {validation.valid
          ? <Chip label="Valid" color="success" size="small" />
          : <Chip label="Invalid" color="error" size="small" />}
      </Stack>

      <Tabs value={tab} onChange={(_, v) => (v === 1 ? enterJsonTab() : setTab(0))} sx={{ mb: 2 }}>
        <Tab label="Visual" />
        <Tab label="Raw JSON" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <TextField
            label="Questionnaire title" value={schema.title || ''} fullWidth sx={{ mb: 2 }}
            onChange={(e) => setSchema(setTitle(schema, e.target.value))}
          />
          {(schema.pages || []).map((page, pi) => (
            <Card key={pi} variant="outlined" sx={{ mb: 2, bgcolor: 'grey.50' }}>
              <CardContent>
                <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2">Page {pi + 1}</Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  {(schema.pages.length > 1) && (
                    <Button size="small" color="inherit" onClick={() => setSchema(removePage(schema, pi))}>Remove page</Button>
                  )}
                </Stack>
                <Divider sx={{ mb: 1.5 }} />
                {(page.elements || []).map((q, qi) => (
                  <QuestionEditor
                    key={q.name || qi} q={q}
                    onPatch={(patch) => setSchema(updateQuestion(schema, pi, qi, patch))}
                    onRemove={() => setSchema(removeQuestion(schema, pi, qi))}
                  />
                ))}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                  <TextField
                    select size="small" value={addType} onChange={(e) => setAddType(e.target.value)} sx={{ minWidth: 180 }}
                  >
                    {QUESTION_TYPES.map((t) => <MenuItem key={t.key} value={t.key}>{t.label}</MenuItem>)}
                  </TextField>
                  <Button size="small" startIcon={<AddIcon />} onClick={() => setSchema(addQuestion(schema, pi, addType))}>
                    Add question
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))}
          <Button startIcon={<AddIcon />} onClick={() => setSchema(addPage(schema))}>Add page</Button>
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <TextField
            value={rawText} onChange={(e) => setRawText(e.target.value)}
            fullWidth multiline minRows={12}
            slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 13 } } }}
          />
          {rawError && <Alert severity="error" sx={{ mt: 1 }}>{rawError}</Alert>}
          <Button variant="outlined" sx={{ mt: 1 }} onClick={applyJson}>Apply JSON</Button>
        </Box>
      )}

      <Divider sx={{ my: 2 }} />
      {!validation.valid && <Alert severity="warning" sx={{ mb: 2 }}>{validation.error}</Alert>}
      <Button
        variant="contained"
        disabled={!validation.valid}
        onClick={() => onSave(validateSurveyJSON(schema).schema)}
      >
        Save questionnaire
      </Button>
    </Box>
  );
}
