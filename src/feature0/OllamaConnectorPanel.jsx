// OllamaConnectorPanel — a commercial-grade connector UI for Ollama. Instead of a
// bare "type a model id" box, the investigator gets:
//   • a live connection status for their Ollama server,
//   • a rich picker of installed models (size on disk, parameter count, quantization),
//   • and an in-app "pull a new model" flow with a live download progress bar.
// It owns none of the study state — it reads { baseUrl, modelId } and reports
// changes up via onChange, so it drops into StudyConfigForm's model[0] block.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Stack, Typography, TextField, Autocomplete, Chip, IconButton, Tooltip,
  Button, LinearProgress, Alert, CircularProgress, InputAdornment, Collapse,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import MemoryIcon from '@mui/icons-material/Memory';
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
    if (status === 'checking') return <Chip size="small" icon={<CircularProgress size={12} />} label="Checking…" />;
    if (status === 'ok') return <Chip size="small" color="success" icon={<CheckCircleIcon />} label={`Connected · ${models.length} model${models.length === 1 ? '' : 's'}`} />;
    if (status === 'error') return <Chip size="small" color="error" icon={<ErrorOutlineIcon />} label="Not reachable" />;
    return null;
  }, [status, models.length]);

  const selected = models.find((m) => m.name === modelId);

  return (
    <Stack spacing={2}>
      {/* Server address + status */}
      <TextField
        label="Ollama server address"
        value={baseUrl || ''}
        onChange={(e) => setBaseUrl(e.target.value)}
        fullWidth
        placeholder={defaultBaseUrl || 'http://host.docker.internal:11434'}
        helperText="Where Ollama is running. The default reaches Ollama on the machine hosting this app."
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip title="Re-check connection & reload models">
                <span>
                  <IconButton size="small" onClick={() => refresh(baseUrl)} disabled={status === 'checking'}>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </InputAdornment>
          ),
        }}
      />
      <Box sx={{ mt: -1 }}>{statusChip}</Box>
      {status === 'error' && statusMsg && <Alert severity="warning">{statusMsg}</Alert>}

      {/* Installed-model picker (rich options) */}
      <Autocomplete
        freeSolo
        options={models}
        value={selected || modelId || null}
        getOptionLabel={(o) => (typeof o === 'string' ? o : o.name || '')}
        isOptionEqualToValue={(o, v) => (o.name || o) === (v.name || v)}
        onChange={(e, val) => setModelId(typeof val === 'string' ? val : (val && val.name) || '')}
        onInputChange={(e, val, reason) => { if (reason === 'input') setModelId(val); }}
        renderOption={(props, option) => (
          <Box component="li" {...props} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start !important', gap: 0.25 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <MemoryIcon fontSize="small" color="action" />
              <Typography sx={{ fontWeight: 600 }}>{option.name}</Typography>
            </Stack>
            {modelMeta(option) && <Typography variant="caption" color="text.secondary" sx={{ pl: 3.5 }}>{modelMeta(option)}</Typography>}
          </Box>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Model auditors will talk to"
            required
            placeholder="llama3.1"
            helperText={
              models.length
                ? 'Pick one of your installed models, or pull a new one below.'
                : (status === 'ok' ? 'No models installed yet — pull one below.' : 'Set the server address to load your installed models.')
            }
          />
        )}
      />
      {selected && modelMeta(selected) && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
          Selected: <b>{selected.name}</b> — {modelMeta(selected)}
        </Typography>
      )}

      {/* Pull a new model */}
      <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2, p: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Add a model</Typography>
        <Typography variant="caption" color="text.secondary">
          Download any model from the Ollama library straight into your server.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }} alignItems="flex-start">
          <TextField
            size="small"
            fullWidth
            label="Model name"
            placeholder="e.g. qwen2.5:3b"
            value={pullName}
            onChange={(e) => setPullName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); startPull(); } }}
            disabled={pulling}
          />
          {pulling ? (
            <Button variant="outlined" color="inherit" startIcon={<CloseIcon />} onClick={cancelPull} sx={{ whiteSpace: 'nowrap' }}>
              Cancel
            </Button>
          ) : (
            <Button variant="contained" startIcon={<DownloadIcon />} onClick={() => startPull()} disabled={!pullName.trim() || !(baseUrl || '').trim()} sx={{ whiteSpace: 'nowrap' }}>
              Pull
            </Button>
          )}
        </Stack>

        {!pulling && !pullDone && !pullError && (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
            {SUGGESTED_PULLS.map((s) => (
              <Chip key={s} label={s} size="small" variant="outlined" onClick={() => { setPullName(s); startPull(s); }} disabled={!(baseUrl || '').trim()} />
            ))}
          </Stack>
        )}

        <Collapse in={pulling}>
          <Box sx={{ mt: 2 }}>
            <LinearProgress variant={pullPercent == null ? 'indeterminate' : 'determinate'} value={pullPercent ?? 0} sx={{ borderRadius: 1, height: 8 }} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {pullStatus}{pullPercent != null ? ` — ${pullPercent}%` : ''}
            </Typography>
          </Box>
        </Collapse>

        {pullError && <Alert severity="error" sx={{ mt: 1.5 }} onClose={() => setPullError('')}>{pullError}</Alert>}
        {pullDone && <Alert severity="success" sx={{ mt: 1.5 }} icon={<CheckCircleIcon fontSize="inherit" />} onClose={() => setPullDone('')}>Pulled <b>{pullDone}</b> and selected it.</Alert>}
      </Box>
    </Stack>
  );
}
