// StudyConfigForm — the investigator's "Study configuration" editor (Phase C step 5;
// SC-7 / D1). Rewritten for usability: collapsible sections instead of one long scroll,
// plain-language labels, time in MINUTES (not seconds), and a MODEL PICKER that loads the
// available models from the server so the investigator selects rather than types an id.
// A thin shell over the tested StudyConfig backbone (src/tools/studyConfig).

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Box, Stack, Typography, TextField, MenuItem, Switch, FormControlLabel, Chip, Alert,
  Button, Grid, Accordion, AccordionSummary, AccordionDetails, Collapse, Autocomplete,
  CircularProgress, IconButton, Tooltip, Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  withStudyConfigDefaults, validateStudyConfig, modelToRelay,
  CONTROL_MODES, PROVIDER_META, REACTION_TYPES,
  availableProviders, commercialConnectorsEnabled,
} from '../tools/studyConfig';
import OllamaConnectorPanel from './OllamaConnectorPanel';
import WebLLMConnectorPanel from './WebLLMConnectorPanel';

const MODE_LABELS = {
  seed_prompt: 'Start with a free conversation',
  fixed_first_turn: 'Start with a fixed chatbot message',
};
const REACTION_LABELS = { thumbs: '👍 / 👎', star: '⭐ Star', flag: '🚩 Flag', comment: '💬 Comment' };

const toNum = (v) => (v === '' || v == null ? NaN : Number(v));
const numVal = (v) => (Number.isFinite(v) ? v : '');
const secToMin = (s) => (Number.isFinite(s) ? Math.round((s / 60) * 100) / 100 : '');
const minToSec = (m) => (m === '' || m == null || Number.isNaN(Number(m)) ? NaN : Math.round(Number(m) * 60));

function Section({ title, subtitle, children, defaultExpanded = false, badge = null }) {
  return (
    <Accordion defaultExpanded={defaultExpanded} disableGutters sx={{ borderRadius: 2, '&:before': { display: 'none' }, border: '1px solid', borderColor: 'divider', mb: 1.5 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography sx={{ fontWeight: 600 }}>{title}</Typography>
            {badge}
          </Stack>
          {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
        </Box>
      </AccordionSummary>
      <AccordionDetails><Stack spacing={2}>{children}</Stack></AccordionDetails>
    </Accordion>
  );
}

export default function StudyConfigForm({ config, onSave = () => {}, busy = false }) {
  const [draft, setDraft] = useState(() => withStudyConfigDefaults(config || {}));
  const { valid, errors } = useMemo(() => validateStudyConfig(draft), [draft]);

  const setModel = (patch) => setDraft((d) => ({ ...d, models: [{ ...d.models[0], ...patch }] }));
  const setDecoding = (patch) => setDraft((d) => ({ ...d, models: [{ ...d.models[0], decoding: { ...d.models[0].decoding, ...patch } }] }));
  const setControl = (patch) => setDraft((d) => ({ ...d, conversationControl: { ...d.conversationControl, ...patch } }));
  const setLimit = (patch) => setDraft((d) => ({ ...d, limits: { ...d.limits, ...patch } }));
  const setEval = (section, patch) => setDraft((d) => ({ ...d, evaluation: { ...d.evaluation, [section]: { ...d.evaluation[section], ...patch } } }));
  const setConsent = (patch) => setDraft((d) => ({ ...d, consent: { ...d.consent, ...patch } }));
  const setLaunch = (patch) => setDraft((d) => ({ ...d, launchCapture: { ...d.launchCapture, ...patch } }));
  const toggleReaction = (type) => setDraft((d) => {
    const cur = d.evaluation.turnReactions.types || [];
    const next = cur.includes(type) ? cur.filter((t) => t !== type) : [...cur, type];
    return { ...d, evaluation: { ...d.evaluation, turnReactions: { ...d.evaluation.turnReactions, types: next } } };
  });

  const model = draft.models[0];
  const meta = PROVIDER_META[model.provider] || {};

  // Which providers the "Where is the model hosted?" picker offers. The public
  // build shows only local / in-browser providers (Ollama + WebLLM); a self-hosted
  // deployment unlocks the commercial cloud providers. If the current config names
  // a provider that isn't in the list (e.g. a study authored on a self-host build,
  // opened here), keep it selectable so the <select> value still renders.
  const showSelfHostNote = !commercialConnectorsEnabled();
  const providerOptions = useMemo(() => {
    const list = availableProviders();
    return list.includes(model.provider) ? list : [model.provider, ...list];
  }, [model.provider]);

  // --- Model list (populate the picker from the server) ---
  const [modelOptions, setModelOptions] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [advancedModel, setAdvancedModel] = useState(false);

  const fetchModels = useCallback(async (m) => {
    // In-browser providers (WebLLM) don't have a server to enumerate; their model
    // catalog is bundled client-side, so skip the relay round-trip.
    if ((PROVIDER_META[m?.provider] || {}).inBrowser) { setModelOptions([]); return; }
    setLoadingModels(true);
    try {
      const resp = await fetch('/api/list-models', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relay: modelToRelay(m) }),
      });
      const data = await resp.json();
      setModelOptions(Array.isArray(data.models) ? data.models : []);
    } catch (_) {
      setModelOptions([]);
    } finally {
      setLoadingModels(false);
    }
  }, []);

  // Load models on mount + whenever the provider changes.
  useEffect(() => { fetchModels(draft.models[0]); }, [model.provider]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Test connection ---
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const runTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const resp = await fetch('/api/test-model', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relay: modelToRelay(draft.models[0]) }),
      });
      setTestResult(await resp.json());
    } catch (e) {
      setTestResult({ ok: false, message: `Couldn't run the test: ${e.message}` });
    } finally { setTesting(false); }
  };

  const cc = draft.conversationControl;
  const modelPlaceholder = { ollama: 'llama3.1', webllm: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', vllm: 'org/model-name', openai: 'gpt-4o', anthropic: 'claude-3-5-sonnet-latest', gemini: 'gemini-1.5-pro' }[model.provider] || 'model';

  return (
    <Stack spacing={0.5}>
      {/* 1. Chatbot model */}
      <Section
        title="1 · The chatbot" defaultExpanded
        subtitle="Which AI model auditors will talk to"
        badge={testResult && testResult.ok ? <Chip icon={<CheckCircleIcon />} label="Connected" color="success" size="small" /> : null}
      >
        <TextField
          select label="Where is the model hosted?" value={model.provider}
          onChange={(e) => {
            const p = e.target.value;
            setModel({ provider: p, baseUrl: (PROVIDER_META[p] || {}).defaultBaseUrl || '' });
          }}
          fullWidth
        >
          {providerOptions.map((p) => <MenuItem key={p} value={p}>{(PROVIDER_META[p] || {}).label || p}</MenuItem>)}
        </TextField>

        {showSelfHostNote && (
          <Alert severity="info" variant="outlined" sx={{ '& a': { color: 'inherit' } }}>
            This public audit offers the two connectors that keep data local:{' '}
            <b>Ollama</b> (a model server on your own machine) and <b>WebLLM</b> (runs
            entirely in the auditor&apos;s browser). Commercial providers — OpenAI,
            Anthropic, Gemini, vLLM — are fully supported too, but only in a{' '}
            <b>self-hosted deployment</b> of the open-source repo, where API keys stay
            on your own server. See the repo&apos;s self-host guide to enable them.
          </Alert>
        )}

        {meta.needsKey && (
          <Alert severity="info">
            {meta.label} needs an API key, which is configured <b>on the server</b> by
            whoever runs this deployment — set <code>{meta.keyEnv}</code> in the relay
            environment and restart. Keys are never stored with the study and never
            reach auditors&apos; browsers. Use <b>Test connection</b> below to check it.
          </Alert>
        )}

        {model.provider === 'ollama' ? (
          // Rich, commercial-grade Ollama panel: live connection status, an
          // installed-model picker with metadata, and an in-app model-pull flow.
          <OllamaConnectorPanel
            baseUrl={model.baseUrl}
            modelId={model.modelId}
            defaultBaseUrl={meta.defaultBaseUrl}
            onChange={setModel}
          />
        ) : model.provider === 'webllm' ? (
          // In-browser (WebGPU) model: WebGPU check, full catalog, download & test.
          <WebLLMConnectorPanel modelId={model.modelId} onChange={setModel} />
        ) : (
          <>
            {meta.needsBaseUrl && (
              <TextField
                label="Server address" value={model.baseUrl || ''}
                onChange={(e) => setModel({ baseUrl: e.target.value })} fullWidth
                placeholder={meta.defaultBaseUrl || 'http://host:port'}
                helperText="Your vLLM (OpenAI-compatible) endpoint, e.g. http://host:8000/v1"
              />
            )}

            {/* Model picker */}
            <Autocomplete
              freeSolo options={modelOptions} value={model.modelId || ''}
              onChange={(e, val) => setModel({ modelId: val || '' })}
              onInputChange={(e, val) => setModel({ modelId: val })}
              renderInput={(params) => (
                <TextField
                  {...params} label="Choose a model" required placeholder={modelPlaceholder}
                  helperText={
                    meta.inBrowser
                      ? 'The WebLLM model id auditors will run in their browser.'
                      : (modelOptions.length ? 'Pick one of your installed models, or type a name.' : 'Type a model name, or click ⟳ to load your installed models.')
                  }
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingModels ? <CircularProgress size={18} /> : (!meta.inBrowser && (
                          <Tooltip title="Load available models">
                            <IconButton size="small" onClick={() => fetchModels(draft.models[0])}><RefreshIcon fontSize="small" /></IconButton>
                          </Tooltip>
                        ))}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </>
        )}

        {/* Relay-side connection test — not applicable to in-browser WebLLM, which
            has its own "Download & test" inside its panel. */}
        {!meta.inBrowser && (
          <Box>
            <Button variant="outlined" size="small" onClick={runTest} disabled={testing}>
              {testing ? 'Testing…' : 'Test connection'}
            </Button>
            {testResult && (
              <Alert severity={testResult.ok ? 'success' : 'error'} sx={{ mt: 1.5 }}>
                {testResult.message}
              </Alert>
            )}
          </Box>
        )}

        <Button size="small" onClick={() => setAdvancedModel((v) => !v)} sx={{ alignSelf: 'flex-start' }}>
          {advancedModel ? 'Hide advanced settings' : 'Advanced settings (system prompt, creativity…)'}
        </Button>
        <Collapse in={advancedModel}>
          <Stack spacing={2}>
            <TextField
              label="System prompt (instructions for the chatbot)" value={model.systemPrompt || ''}
              onChange={(e) => setModel({ systemPrompt: e.target.value })} fullWidth multiline minRows={2}
            />
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <TextField type="number" label="Creativity (temperature)" fullWidth value={numVal(model.decoding.temperature)}
                  onChange={(e) => setDecoding({ temperature: toNum(e.target.value) })} inputProps={{ step: 0.1, min: 0 }} />
              </Grid>
              <Grid item xs={4}>
                <TextField type="number" label="top_p" fullWidth value={numVal(model.decoding.topP)}
                  onChange={(e) => setDecoding({ topP: toNum(e.target.value) })} inputProps={{ step: 0.05, min: 0, max: 1 }} />
              </Grid>
              <Grid item xs={4}>
                <TextField type="number" label="Max length (tokens)" fullWidth value={numVal(model.decoding.maxTokens)}
                  onChange={(e) => setDecoding({ maxTokens: toNum(e.target.value) })} inputProps={{ step: 1, min: 1 }} />
              </Grid>
            </Grid>
          </Stack>
        </Collapse>
      </Section>

      {/* 2. Conversation */}
      <Section title="2 · The conversation" subtitle="How the chat begins">
        <TextField select label="How should the conversation start?" value={cc.mode}
          onChange={(e) => setControl({ mode: e.target.value })} fullWidth>
          {CONTROL_MODES.map((m) => <MenuItem key={m} value={m}>{MODE_LABELS[m]}</MenuItem>)}
        </TextField>
        {cc.mode === 'seed_prompt' && (
          <TextField label="Opening topic (optional)" value={cc.seedPrompt || ''}
            onChange={(e) => setControl({ seedPrompt: e.target.value })} fullWidth multiline minRows={2}
            helperText="A note that frames the conversation. Leave blank to let auditors start however they like." />
        )}
        {cc.mode === 'fixed_first_turn' && (
          <TextField label="The chatbot's first message" value={cc.fixedFirstTurn || ''}
            onChange={(e) => setControl({ fixedFirstTurn: e.target.value })} fullWidth multiline minRows={2} required
            helperText="Every auditor sees this as the chatbot's opening message." />
        )}
      </Section>

      {/* 3. Time & length */}
      <Section title="3 · Time & length" subtitle="How long auditors have, and how many chats">
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField type="number" label="Minutes per conversation" fullWidth
              value={secToMin(draft.limits.perConversationSeconds)}
              onChange={(e) => setLimit({ perConversationSeconds: minToSec(e.target.value) })} inputProps={{ min: 1 }} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField type="number" label="Total minutes (all conversations)" fullWidth
              value={secToMin(draft.limits.overallSeconds)}
              onChange={(e) => setLimit({ overallSeconds: minToSec(e.target.value) })} inputProps={{ min: 1 }} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField type="number" label="How many conversations each" fullWidth
              value={numVal(draft.limits.conversationsPerAuditor)}
              onChange={(e) => setLimit({ conversationsPerAuditor: toNum(e.target.value) })} inputProps={{ min: 1, step: 1 }} />
          </Grid>
        </Grid>
      </Section>

      {/* 4. What auditors do */}
      <Section title="4 · What auditors do" subtitle="How auditors flag and rate the chatbot">
        <FormControlLabel
          control={<Switch checked={draft.evaluation.turnReactions.enabled} onChange={(e) => setEval('turnReactions', { enabled: e.target.checked })} />}
          label="Let auditors react to individual messages as they chat" />
        <Collapse in={draft.evaluation.turnReactions.enabled}>
          <Box sx={{ pl: 4, pb: 1 }}>
            <Typography variant="caption" color="text.secondary">Which reactions?</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
              {REACTION_TYPES.map((t) => {
                const on = (draft.evaluation.turnReactions.types || []).includes(t);
                return <Chip key={t} label={REACTION_LABELS[t] || t} color={on ? 'primary' : 'default'} variant={on ? 'filled' : 'outlined'} onClick={() => toggleReaction(t)} />;
              })}
            </Stack>
          </Box>
        </Collapse>
        <FormControlLabel
          control={<Switch checked={draft.evaluation.questionnaire.enabled} onChange={(e) => setEval('questionnaire', { enabled: e.target.checked })} />}
          label="Ask a questionnaire after each conversation" />
        <FormControlLabel
          control={<Switch checked={draft.evaluation.spanHighlighting.enabled} onChange={(e) => setEval('spanHighlighting', { enabled: e.target.checked })} />}
          label="Let auditors highlight problem phrases in the chatbot's replies" />
      </Section>

      {/* 5. Consent & recruitment */}
      <Section title="5 · Consent & recruitment" subtitle="Optional — consent text and study links">
        <TextField label="Consent text (optional)" value={draft.consent?.text || ''}
          onChange={(e) => setConsent({ text: e.target.value || null })} fullWidth multiline minRows={2}
          helperText="If set, auditors must agree before starting. Leave blank for no consent step." />
        <Divider />
        <FormControlLabel
          control={<Switch checked={Boolean(draft.launchCapture?.enabled)} onChange={(e) => setLaunch({ enabled: e.target.checked })} />}
          label="Remember recruitment info from the join link (e.g. Prolific ID)" />
        {draft.launchCapture?.enabled && (
          <Alert severity="info">This links a session to a recruitment ID — mention it in your consent text.</Alert>
        )}
      </Section>

      {/* Validation + save */}
      {!valid && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Before you can open the study, please fix:</Typography>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {errors.map((e, i) => <li key={i}><Typography variant="body2">{e}</Typography></li>)}
          </ul>
        </Alert>
      )}
      <Box sx={{ mt: 1 }}>
        <Button variant="contained" onClick={() => onSave(draft)} disabled={busy}>Save configuration</Button>
        {valid && <Chip label="Ready to open" color="success" size="small" sx={{ ml: 2 }} />}
      </Box>
    </Stack>
  );
}
