// QuestionnaireAuthor — the in-house questionnaire authoring UI (Phase C step 4;
// SC-7 / D1). A visual editor over the tested authoring helpers that emits SurveyJS
// JSON, plus a raw-JSON escape hatch. Both paths run validateSurveyJSON before save,
// so a malformed schema can't be saved (PRD §9 D1). The visual editor covers the D1
// tier; anything beyond it is reached via the Raw JSON tab.

import React, { useState, useMemo } from 'react';
import { Box, Stack, Typography, Divider } from '../ui/layout';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Button } from '../ui/button';
import { Alert } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Tooltip } from '../ui/tooltip';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../ui/select';
import { Delete, Add } from '../ui/icons';
import { cn } from '../../lib/utils';
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
    <div className="w-full">
      <Label className="mb-1 block">{label}</Label>
      <Textarea
        value={arrayToLines(value)} onChange={(e) => onChange(linesToArray(e.target.value))}
        rows={2}
      />
      <p className="mt-1 text-xs text-muted-foreground">One per line</p>
    </div>
  );
}

function QuestionEditor({ q, onPatch, onRemove }) {
  return (
    <Card className="mb-3">
      <CardContent className="pb-3">
        <Stack direction="row" alignItems="center" spacing={1} className="mb-2">
          <Badge>{surveyTypeToKey(q.type)}</Badge>
          <Box className="grow" />
          <label className="flex items-center gap-2">
            <Switch checked={!!q.isRequired} onCheckedChange={(checked) => onPatch({ isRequired: checked === true })} />
            <span className="text-sm">Required</span>
          </label>
          <Tooltip title="Remove question">
            <Button variant="ghost" size="icon" onClick={onRemove}><Delete /></Button>
          </Tooltip>
        </Stack>
        <Stack spacing={1.5}>
          <div className="w-full">
            <Label className="mb-1 block">Question / instructions</Label>
            <Input
              value={q.title || ''}
              onChange={(e) => onPatch({ title: e.target.value })}
            />
          </div>
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
              <div>
                <Label className="mb-1 block">Min</Label>
                <Input type="number" value={q.rateMin ?? 1}
                  onChange={(e) => onPatch({ rateMin: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="mb-1 block">Max</Label>
                <Input type="number" value={q.rateMax ?? 5}
                  onChange={(e) => onPatch({ rateMax: Number(e.target.value) })} />
              </div>
            </Stack>
          )}
          <div className="w-full">
            <Label className="mb-1 block">{"Show only if (optional, e.g. {q1} = 'Yes')"}</Label>
            <Input
              value={q.visibleIf || ''}
              onChange={(e) => onPatch({ visibleIf: e.target.value || undefined })}
            />
            <p className="mt-1 text-xs text-muted-foreground">Basic conditional visibility</p>
          </div>
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

  const tabBtn = 'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all';
  const tabActive = 'bg-card text-foreground shadow-sm';
  const tabInactive = 'text-muted-foreground hover:text-foreground';

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" className="mb-4" flexWrap="wrap">
        <div className="min-w-[200px]">
          <Label className="mb-1 block">Start from a template</Label>
          <Select value="" onValueChange={(v) => adoptTemplate(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Start from a template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="blank">Blank</SelectItem>
              {QUESTIONNAIRE_TEMPLATES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Box className="grow" />
        <Typography variant="body2" color="text.secondary">{countQuestions(schema)} question(s)</Typography>
        {validation.valid
          ? <Badge variant="success">Valid</Badge>
          : <Badge variant="destructive">Invalid</Badge>}
      </Stack>

      <div className="mb-4 inline-flex h-9 items-center gap-1 rounded-lg bg-muted p-1">
        <button type="button" onClick={() => setTab(0)} className={cn(tabBtn, tab === 0 ? tabActive : tabInactive)}>Visual</button>
        <button type="button" onClick={() => enterJsonTab()} className={cn(tabBtn, tab === 1 ? tabActive : tabInactive)}>Raw JSON</button>
      </div>

      {tab === 0 && (
        <Box>
          <div className="mb-4">
            <Label className="mb-1 block">Questionnaire title</Label>
            <Input
              value={schema.title || ''}
              onChange={(e) => setSchema(setTitle(schema, e.target.value))}
            />
          </div>
          {(schema.pages || []).map((page, pi) => (
            <Card key={pi} className="mb-4 bg-muted/50">
              <CardContent>
                <Stack direction="row" alignItems="center" className="mb-2">
                  <Typography variant="subtitle2">Page {pi + 1}</Typography>
                  <Box className="grow" />
                  {(schema.pages.length > 1) && (
                    <Button size="sm" variant="ghost" onClick={() => setSchema(removePage(schema, pi))}>Remove page</Button>
                  )}
                </Stack>
                <Divider className="mb-3" />
                {(page.elements || []).map((q, qi) => (
                  <QuestionEditor
                    key={q.name || qi} q={q}
                    onPatch={(patch) => setSchema(updateQuestion(schema, pi, qi, patch))}
                    onRemove={() => setSchema(removeQuestion(schema, pi, qi))}
                  />
                ))}
                <Stack direction="row" spacing={1} alignItems="center" className="mt-2">
                  <Select value={addType} onValueChange={(v) => setAddType(v)}>
                    <SelectTrigger className="min-w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUESTION_TYPES.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" onClick={() => setSchema(addQuestion(schema, pi, addType))}>
                    <Add />
                    Add question
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))}
          <Button variant="ghost" onClick={() => setSchema(addPage(schema))}><Add />Add page</Button>
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <Textarea
            value={rawText} onChange={(e) => setRawText(e.target.value)}
            rows={12}
            className="font-mono text-[13px]"
          />
          {rawError && <Alert variant="destructive" className="mt-2">{rawError}</Alert>}
          <Button variant="outline" className="mt-2" onClick={applyJson}>Apply JSON</Button>
        </Box>
      )}

      <Divider className="my-4" />
      {!validation.valid && <Alert variant="warning" className="mb-4">{validation.error}</Alert>}
      <Button
        disabled={!validation.valid}
        onClick={() => onSave(validateSurveyJSON(schema).schema)}
      >
        Save questionnaire
      </Button>
    </Box>
  );
}
