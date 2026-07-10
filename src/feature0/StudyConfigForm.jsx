// StudyConfigForm — the investigator's "Study configuration" editor (Phase C step 5;
// SC-7 / D1). Rewritten for usability: collapsible sections instead of one long scroll,
// plain-language labels, time in MINUTES (not seconds), and a MODEL PICKER that loads the
// available models from the server so the investigator selects rather than types an id.
// A thin shell over the tested StudyConfig backbone (src/tools/studyConfig).

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Box, Stack, Typography, Grid, Divider } from '../components/ui/layout';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../components/ui/accordion';
import { Spinner } from '../components/ui/spinner';
import { Tooltip } from '../components/ui/tooltip';
import { Refresh as RefreshIcon, CheckCircle as CheckCircleIcon } from '../components/ui/icons';
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
    <Accordion type="single" collapsible defaultValue={defaultExpanded ? 'section' : undefined} className="mb-3 rounded-md border">
      <AccordionItem value="section" className="border-b-0">
        <AccordionTrigger className="px-4 hover:no-underline">
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography component="span" className="font-semibold">{title}</Typography>
              {badge}
            </Stack>
            {subtitle && <Typography component="span" variant="body2" color="text.secondary" className="block">{subtitle}</Typography>}
          </Box>
        </AccordionTrigger>
        <AccordionContent className="px-4"><Stack spacing={2}>{children}</Stack></AccordionContent>
      </AccordionItem>
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
        badge={testResult && testResult.ok ? <Badge variant="success"><CheckCircleIcon size={14} />Connected</Badge> : null}
      >
        <div>
          <Label className="mb-1.5 block">Where is the model hosted?</Label>
          <Select
            value={model.provider}
            onValueChange={(p) => {
              setModel({ provider: p, baseUrl: (PROVIDER_META[p] || {}).defaultBaseUrl || '' });
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {providerOptions.map((p) => <SelectItem key={p} value={p}>{(PROVIDER_META[p] || {}).label || p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {showSelfHostNote && (
          <Alert variant="info">
            <AlertDescription>
              This public audit offers the two connectors that keep data local:{' '}
              <b>Ollama</b> (a model server on your own machine) and <b>WebLLM</b> (runs
              entirely in the auditor&apos;s browser). Commercial providers — OpenAI,
              Anthropic, Gemini, vLLM — are fully supported too, but only in a{' '}
              <b>self-hosted deployment</b> of the open-source repo, where API keys stay
              on your own server. See the repo&apos;s self-host guide to enable them.
            </AlertDescription>
          </Alert>
        )}

        {meta.needsKey && (
          <Alert variant="info">
            <AlertDescription>
              {meta.label} needs an API key, which is configured <b>on the server</b> by
              whoever runs this deployment — set <code>{meta.keyEnv}</code> in the relay
              environment and restart. Keys are never stored with the study and never
              reach auditors&apos; browsers. Use <b>Test connection</b> below to check it.
            </AlertDescription>
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
              <div>
                <Label className="mb-1.5 block">Server address</Label>
                <Input value={model.baseUrl || ''}
                  onChange={(e) => setModel({ baseUrl: e.target.value })}
                  placeholder={meta.defaultBaseUrl || 'http://host:port'} />
                <p className="mt-1.5 text-xs text-muted-foreground">Your vLLM (OpenAI-compatible) endpoint, e.g. http://host:8000/v1</p>
              </div>
            )}

            {/* Model picker */}
            <div>
              <Label className="mb-1.5 block">Choose a model <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input
                  list="study-config-model-options"
                  value={model.modelId || ''}
                  onChange={(e) => setModel({ modelId: e.target.value })}
                  required
                  placeholder={modelPlaceholder}
                  className="pr-10"
                />
                <datalist id="study-config-model-options">
                  {modelOptions.map((m) => <option key={m} value={m} />)}
                </datalist>
                <div className="absolute right-1 top-1/2 -translate-y-1/2">
                  {loadingModels ? <Spinner size={18} /> : (!meta.inBrowser && (
                    <Tooltip title="Load available models">
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => fetchModels(draft.models[0])}><RefreshIcon size={18} /></Button>
                    </Tooltip>
                  ))}
                </div>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {meta.inBrowser
                  ? 'The WebLLM model id auditors will run in their browser.'
                  : (modelOptions.length ? 'Pick one of your installed models, or type a name.' : 'Type a model name, or click ⟳ to load your installed models.')}
              </p>
            </div>
          </>
        )}

        {/* Relay-side connection test — not applicable to in-browser WebLLM, which
            has its own "Download & test" inside its panel. */}
        {!meta.inBrowser && (
          <Box>
            <Button variant="outline" size="sm" onClick={runTest} disabled={testing}>
              {testing ? 'Testing…' : 'Test connection'}
            </Button>
            {testResult && (
              <Alert variant={testResult.ok ? 'success' : 'destructive'} className="mt-3">
                <AlertDescription>{testResult.message}</AlertDescription>
              </Alert>
            )}
          </Box>
        )}

        <Button variant="ghost" size="sm" onClick={() => setAdvancedModel((v) => !v)} className="self-start">
          {advancedModel ? 'Hide advanced settings' : 'Advanced settings (system prompt, creativity…)'}
        </Button>
        {advancedModel && (
          <Stack spacing={2}>
            <div>
              <Label className="mb-1.5 block">System prompt (instructions for the chatbot)</Label>
              <Textarea value={model.systemPrompt || ''}
                onChange={(e) => setModel({ systemPrompt: e.target.value })} rows={2} />
            </div>
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <Label className="mb-1.5 block">Creativity (temperature)</Label>
                <Input type="number" value={numVal(model.decoding.temperature)}
                  onChange={(e) => setDecoding({ temperature: toNum(e.target.value) })} step={0.1} min={0} />
              </Grid>
              <Grid item xs={4}>
                <Label className="mb-1.5 block">top_p</Label>
                <Input type="number" value={numVal(model.decoding.topP)}
                  onChange={(e) => setDecoding({ topP: toNum(e.target.value) })} step={0.05} min={0} max={1} />
              </Grid>
              <Grid item xs={4}>
                <Label className="mb-1.5 block">Max length (tokens)</Label>
                <Input type="number" value={numVal(model.decoding.maxTokens)}
                  onChange={(e) => setDecoding({ maxTokens: toNum(e.target.value) })} step={1} min={1} />
              </Grid>
            </Grid>
          </Stack>
        )}
      </Section>

      {/* 2. Conversation */}
      <Section title="2 · The conversation" subtitle="How the chat begins">
        <div>
          <Label className="mb-1.5 block">How should the conversation start?</Label>
          <Select value={cc.mode} onValueChange={(v) => setControl({ mode: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONTROL_MODES.map((m) => <SelectItem key={m} value={m}>{MODE_LABELS[m]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {cc.mode === 'seed_prompt' && (
          <div>
            <Label className="mb-1.5 block">Opening topic (optional)</Label>
            <Textarea value={cc.seedPrompt || ''}
              onChange={(e) => setControl({ seedPrompt: e.target.value })} rows={2} />
            <p className="mt-1.5 text-xs text-muted-foreground">A note that frames the conversation. Leave blank to let auditors start however they like.</p>
          </div>
        )}
        {cc.mode === 'fixed_first_turn' && (
          <div>
            <Label className="mb-1.5 block">The chatbot's first message <span className="text-destructive">*</span></Label>
            <Textarea value={cc.fixedFirstTurn || ''}
              onChange={(e) => setControl({ fixedFirstTurn: e.target.value })} rows={2} required />
            <p className="mt-1.5 text-xs text-muted-foreground">Every auditor sees this as the chatbot's opening message.</p>
          </div>
        )}
      </Section>

      {/* 3. Time & length */}
      <Section title="3 · Time & length" subtitle="How long auditors have, and how many chats">
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <Label className="mb-1.5 block">Minutes per conversation</Label>
            <Input type="number"
              value={secToMin(draft.limits.perConversationSeconds)}
              onChange={(e) => setLimit({ perConversationSeconds: minToSec(e.target.value) })} min={1} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Label className="mb-1.5 block">Total minutes (all conversations)</Label>
            <Input type="number"
              value={secToMin(draft.limits.overallSeconds)}
              onChange={(e) => setLimit({ overallSeconds: minToSec(e.target.value) })} min={1} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Label className="mb-1.5 block">How many conversations each</Label>
            <Input type="number"
              value={numVal(draft.limits.conversationsPerAuditor)}
              onChange={(e) => setLimit({ conversationsPerAuditor: toNum(e.target.value) })} min={1} step={1} />
          </Grid>
        </Grid>
      </Section>

      {/* 4. What auditors do */}
      <Section title="4 · What auditors do" subtitle="How auditors flag and rate the chatbot">
        <label className="flex items-center gap-2">
          <Switch checked={draft.evaluation.turnReactions.enabled} onCheckedChange={(v) => setEval('turnReactions', { enabled: v })} />
          <span className="text-sm">Let auditors react to individual messages as they chat</span>
        </label>
        {draft.evaluation.turnReactions.enabled && (
          <Box className="pb-2 pl-8">
            <Typography variant="caption" color="text.secondary">Which reactions?</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" className="mt-1">
              {REACTION_TYPES.map((t) => {
                const on = (draft.evaluation.turnReactions.types || []).includes(t);
                return <Badge key={t} variant={on ? 'default' : 'outline'} onClick={() => toggleReaction(t)} className="cursor-pointer">{REACTION_LABELS[t] || t}</Badge>;
              })}
            </Stack>
          </Box>
        )}
        <label className="flex items-center gap-2">
          <Switch checked={draft.evaluation.questionnaire.enabled} onCheckedChange={(v) => setEval('questionnaire', { enabled: v })} />
          <span className="text-sm">Ask a questionnaire after each conversation</span>
        </label>
        <label className="flex items-center gap-2">
          <Switch checked={draft.evaluation.spanHighlighting.enabled} onCheckedChange={(v) => setEval('spanHighlighting', { enabled: v })} />
          <span className="text-sm">Let auditors highlight problem phrases in the chatbot's replies</span>
        </label>
      </Section>

      {/* 5. Consent & recruitment */}
      <Section title="5 · Consent & recruitment" subtitle="Optional — consent text and study links">
        <div>
          <Label className="mb-1.5 block">Consent text (optional)</Label>
          <Textarea value={draft.consent?.text || ''}
            onChange={(e) => setConsent({ text: e.target.value || null })} rows={2} />
          <p className="mt-1.5 text-xs text-muted-foreground">If set, auditors must agree before starting. Leave blank for no consent step.</p>
        </div>
        <Divider />
        <label className="flex items-center gap-2">
          <Switch checked={Boolean(draft.launchCapture?.enabled)} onCheckedChange={(v) => setLaunch({ enabled: v })} />
          <span className="text-sm">Remember recruitment info from the join link (e.g. Prolific ID)</span>
        </label>
        {draft.launchCapture?.enabled && (
          <Alert variant="info"><AlertDescription>This links a session to a recruitment ID — mention it in your consent text.</AlertDescription></Alert>
        )}
      </Section>

      {/* Validation + save */}
      {!valid && (
        <Alert variant="warning" className="mt-2">
          <AlertDescription>
            <Typography variant="body2" className="mb-1 font-semibold">Before you can open the study, please fix:</Typography>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {errors.map((e, i) => <li key={i}><Typography variant="body2">{e}</Typography></li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      <Box className="mt-2">
        <Button onClick={() => onSave(draft)} disabled={busy}>Save configuration</Button>
        {valid && <Badge variant="success" className="ml-4">Ready to open</Badge>}
      </Box>
    </Stack>
  );
}
