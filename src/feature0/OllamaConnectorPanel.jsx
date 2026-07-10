// OllamaConnectorPanel — a commercial-grade connector UI for Ollama. Instead of a
// bare "type a model id" box, the investigator gets:
//   • a live connection status for their Ollama server,
//   • a rich picker of installed models (size on disk, parameter count, quantization),
//   • and an in-app "pull a new model" flow with a live download progress bar.
// It owns none of the study state — it reads { baseUrl, modelId } and reports
// changes up via onChange, so it drops into StudyConfigForm's model[0] block.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stack, Typography } from '../components/ui/layout';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Alert } from '../components/ui/alert';
import { Progress } from '../components/ui/progress';
import { Spinner } from '../components/ui/spinner';
import { Tooltip } from '../components/ui/tooltip';
import {
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  ErrorOutline as ErrorOutlineIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
} from '../components/ui/icons';
import { streamPost } from '../tools/streamSSE';

function fmtBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

// A one-line summary of a model's shape: "3B · Q4_K_M · 2.0 GB" (omitting blanks).
function modelMeta(m) {
  return [m.parameterSize, m.quantization, fmtBytes(m.size)].filter(Boolean).join('  ·  ');
}

// A few popular models the investigator can pull with one click if their library is empty.
const SUGGESTED_PULLS = ['llama3.1', 'llama3.2', 'qwen2.5', 'gemma2', 'phi3.5', 'mistral'];

export default function OllamaConnectorPanel({ baseUrl, modelId, onChange, defaultBaseUrl }) {
  const setBaseUrl = (v) => onChange({ baseUrl: v });
  const setModelId = (v) => onChange({ modelId: v });

  const [status, setStatus] = useState('idle'); // idle | checking | ok | error
  const [statusMsg, setStatusMsg] = useState('');
  const [models, setModels] = useState([]);      // [{ name, size, parameterSize, quantization, ... }]

  const refresh = useCallback(async (url) => {
    const target = (url ?? baseUrl ?? '').trim();
    if (!target) { setStatus('idle'); setModels([]); setStatusMsg(''); return; }
    setStatus('checking'); setStatusMsg('');
    try {
      const resp = await fetch('/api/ollama/models', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: target }),
      });
      const data = await resp.json();
      if (data.ok) {
        setModels(Array.isArray(data.models) ? data.models : []);
        setStatus('ok');
        setStatusMsg('');
      } else {
        setModels([]); setStatus('error'); setStatusMsg(data.error || 'Could not reach Ollama.');
      }
    } catch (e) {
      setModels([]); setStatus('error'); setStatusMsg(e.message || 'Could not reach Ollama.');
    }
  }, [baseUrl]);

  // Auto-check when the panel mounts / the server address settles (debounced).
  const debounceRef = useRef(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => refresh(baseUrl), 500);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [baseUrl, refresh]);

  // --- Pull a new model -----------------------------------------------------
  const [pullName, setPullName] = useState('');
  const [pulling, setPulling] = useState(false);
  const [pullStatus, setPullStatus] = useState('');
  const [pullPercent, setPullPercent] = useState(null); // null = indeterminate
  const [pullError, setPullError] = useState('');
  const [pullDone, setPullDone] = useState('');
  const abortRef = useRef(null);

  const startPull = useCallback(async (name) => {
    const model = (name ?? pullName).trim();
    if (!model || pulling) return;
    setPulling(true); setPullError(''); setPullDone(''); setPullStatus('Starting…'); setPullPercent(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamPost('/api/ollama/pull', { baseUrl: (baseUrl || '').trim(), model }, {
        signal: controller.signal,
        onEvent: (ev) => {
          if (ev.error) { setPullError(ev.error); return; }
          if (ev.done) return;
          if (typeof ev.percent === 'number') setPullPercent(ev.percent);
          else if (ev.status && !/^downloading/i.test(ev.status)) setPullPercent(null);
          if (ev.status) setPullStatus(ev.status);
        },
      });
      if (!controller.signal.aborted && !abortRef.current?._errored) {
        setPullDone(model);
        setPullName('');
        setModelId(model);          // select the freshly pulled model
        await refresh(baseUrl);     // and re-list so it appears in the picker
      }
    } catch (e) {
      if (!controller.signal.aborted) setPullError(e.message || 'Pull failed.');
    } finally {
      setPulling(false);
      abortRef.current = null;
    }
  }, [pullName, pulling, baseUrl, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelPull = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setPulling(false); setPullStatus(''); setPullPercent(null);
  }, []);

  const statusChip = useMemo(() => {
    if (status === 'checking') return <Badge variant="outline"><Spinner size={12} />Checking…</Badge>;
    if (status === 'ok') return <Badge variant="success"><CheckCircleIcon className="size-3.5" />{`Connected · ${models.length} model${models.length === 1 ? '' : 's'}`}</Badge>;
    if (status === 'error') return <Badge variant="destructive"><ErrorOutlineIcon className="size-3.5" />Not reachable</Badge>;
    return null;
  }, [status, models.length]);

  const selected = models.find((m) => m.name === modelId);

  return (
    <Stack spacing={2}>
      {/* Server address + status */}
      <div>
        <Label htmlFor="ollama-base-url">Ollama server address</Label>
        <div className="relative mt-1.5">
          <Input
            id="ollama-base-url"
            value={baseUrl || ''}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={defaultBaseUrl || 'http://host.docker.internal:11434'}
            className="pr-10"
          />
          <div className="absolute right-1 top-1/2 -translate-y-1/2">
            <Tooltip title="Re-check connection & reload models">
              <span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => refresh(baseUrl)} disabled={status === 'checking'}>
                  <RefreshIcon />
                </Button>
              </span>
            </Tooltip>
          </div>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Where Ollama is running. The default reaches Ollama on the machine hosting this app.
        </p>
      </div>
      <div className="-mt-2">{statusChip}</div>
      {status === 'error' && statusMsg && <Alert variant="warning">{statusMsg}</Alert>}

      {/* Installed-model picker (free-text with installed-model suggestions) */}
      <div>
        <Label htmlFor="ollama-model">Model auditors will talk to <span className="text-destructive">*</span></Label>
        <Input
          id="ollama-model"
          list="ollama-model-options"
          required
          className="mt-1.5"
          placeholder="llama3.1"
          value={modelId || ''}
          onChange={(e) => setModelId(e.target.value)}
        />
        <datalist id="ollama-model-options">
          {models.map((m) => (
            <option key={m.name} value={m.name}>{modelMeta(m)}</option>
          ))}
        </datalist>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {models.length
            ? 'Pick one of your installed models, or pull a new one below.'
            : (status === 'ok' ? 'No models installed yet — pull one below.' : 'Set the server address to load your installed models.')}
        </p>
      </div>
      {selected && modelMeta(selected) && (
        <Typography variant="caption" color="text.secondary" className="-mt-2">
          Selected: <b>{selected.name}</b> — {modelMeta(selected)}
        </Typography>
      )}

      {/* Pull a new model */}
      <div className="rounded-md border border-dashed p-4">
        <Typography variant="subtitle2" className="mb-1">Add a model</Typography>
        <Typography variant="caption" color="text.secondary">
          Download any model from the Ollama library straight into your server.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} className="mt-3" alignItems="flex-start">
          <div className="w-full">
            <Label htmlFor="ollama-pull-name" className="sr-only">Model name</Label>
            <Input
              id="ollama-pull-name"
              placeholder="e.g. qwen2.5:3b"
              value={pullName}
              onChange={(e) => setPullName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); startPull(); } }}
              disabled={pulling}
            />
          </div>
          {pulling ? (
            <Button variant="outline" onClick={cancelPull} className="whitespace-nowrap">
              <CloseIcon />
              Cancel
            </Button>
          ) : (
            <Button onClick={() => startPull()} disabled={!pullName.trim() || !(baseUrl || '').trim()} className="whitespace-nowrap">
              <DownloadIcon />
              Pull
            </Button>
          )}
        </Stack>

        {!pulling && !pullDone && !pullError && (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" className="mt-3">
            {SUGGESTED_PULLS.map((s) => (
              <Button key={s} variant="outline" size="sm" className="rounded-full" onClick={() => { setPullName(s); startPull(s); }} disabled={!(baseUrl || '').trim()}>
                {s}
              </Button>
            ))}
          </Stack>
        )}

        {pulling && (
          <div className="mt-4">
            <Progress value={pullPercent} className="h-2 rounded" />
            <Typography variant="caption" color="text.secondary" className="mt-1 block">
              {pullStatus}{pullPercent != null ? ` — ${pullPercent}%` : ''}
            </Typography>
          </div>
        )}

        {pullError && (
          <Alert variant="destructive" className="mt-3 flex items-start justify-between gap-2">
            <span>{pullError}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setPullError('')}>
              <CloseIcon />
            </Button>
          </Alert>
        )}
        {pullDone && (
          <Alert variant="success" className="mt-3 flex items-start justify-between gap-2">
            <span className="flex items-center gap-2"><CheckCircleIcon className="size-4" />Pulled <b>{pullDone}</b> and selected it.</span>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setPullDone('')}>
              <CloseIcon />
            </Button>
          </Alert>
        )}
      </div>
    </Stack>
  );
}
