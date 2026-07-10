// WebLLMConnectorPanel — the investigator's picker for an in-browser (WebGPU)
// model. WebLLM downloads the model into the auditor's browser and runs inference
// locally: no server, no API key, nothing leaves the machine. This panel:
//   • checks the current browser's WebGPU support up front,
//   • offers the full prebuilt WebLLM catalog (recommended models surfaced first),
//     annotated with parameter size, quantization, and VRAM needs,
//   • and lets the investigator DOWNLOAD & TEST the chosen model right here (with a
//     live progress bar) to confirm it runs before assigning it to auditors.
// It owns no study state: reads { modelId } and reports changes via onChange.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Stack, Typography, Autocomplete, TextField, Alert, Button, LinearProgress,
  Chip, CircularProgress,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import MemoryIcon from '@mui/icons-material/Memory';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import {
  checkWebGPU, getModelCatalog, ensureModel, RECOMMENDED_MODEL_IDS,
} from '../tools/webllm/webllmEngine';

function fmtVram(mb) {
  if (!Number.isFinite(mb) || mb <= 0) return null;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB VRAM` : `${Math.round(mb)} MB VRAM`;
}
function metaLine(m) {
  return [m.parameterSize, m.quantization, fmtVram(m.vramMB)].filter(Boolean).join('  ·  ');
}

export default function WebLLMConnectorPanel({ modelId, onChange }) {
  const setModelId = (v) => onChange({ modelId: v });

  // --- WebGPU capability ---
  const [gpu, setGpu] = useState({ state: 'checking', reason: '' });
  useEffect(() => {
    let alive = true;
    checkWebGPU().then((r) => { if (alive) setGpu({ state: r.ok ? 'ok' : 'no', reason: r.reason }); })
      .catch((e) => { if (alive) setGpu({ state: 'no', reason: e.message || String(e) }); });
    return () => { alive = false; };
  }, []);

  // --- Catalog ---
  const [catalog, setCatalog] = useState([]);
  const [catalogError, setCatalogError] = useState('');
  useEffect(() => {
    let alive = true;
    getModelCatalog()
      .then((list) => {
        if (!alive) return;
        const withFlags = list.map((m) => ({ ...m, recommended: RECOMMENDED_MODEL_IDS.includes(m.id) }));
        // Recommended first (in the curated order), then everything else alphabetically.
        withFlags.sort((a, b) => {
          if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
          if (a.recommended && b.recommended) return RECOMMENDED_MODEL_IDS.indexOf(a.id) - RECOMMENDED_MODEL_IDS.indexOf(b.id);
          return a.id.localeCompare(b.id);
        });
        setCatalog(withFlags);
      })
      .catch((e) => { if (alive) setCatalogError(e.message || 'Could not load the WebLLM catalog.'); });
    return () => { alive = false; };
  }, []);

  const selected = useMemo(() => catalog.find((m) => m.id === modelId) || null, [catalog, modelId]);

  // --- Download & test ---
  const [testing, setTesting] = useState(false);
  const [testPct, setTestPct] = useState(null);
  const [testText, setTestText] = useState('');
  const [testOk, setTestOk] = useState(false);
  const [testErr, setTestErr] = useState('');
  const testedRef = useRef(null);

  const runTest = useCallback(async () => {
    if (!modelId || testing) return;
    setTesting(true); setTestOk(false); setTestErr(''); setTestPct(null); setTestText('Starting…');
    try {
      await ensureModel(modelId, {
        onProgress: ({ progress, text }) => {
          setTestPct(progress != null ? Math.round(progress * 100) : null);
          if (text) setTestText(text);
        },
      });
      setTestOk(true); testedRef.current = modelId; setTestText('');
    } catch (e) {
      setTestErr(e.message || 'The model could not be loaded in this browser.');
    } finally {
      setTesting(false);
    }
  }, [modelId, testing]);

  const gpuBanner = gpu.state === 'checking'
    ? <Alert severity="info" icon={<CircularProgress size={16} />}>Checking this browser for WebGPU…</Alert>
    : gpu.state === 'ok'
      ? <Alert severity="success">This browser supports WebGPU — WebLLM can run models locally here.</Alert>
      : <Alert severity="warning">{gpu.reason} Auditors will need a WebGPU-capable browser to run this study.</Alert>;

  return (
    <Stack spacing={2}>
      {gpuBanner}

      {catalogError && <Alert severity="error">{catalogError}</Alert>}

      <Autocomplete
        options={catalog}
        loading={!catalog.length && !catalogError}
        groupBy={(o) => (o.recommended ? 'Recommended' : 'All models')}
        value={selected}
        getOptionLabel={(o) => (typeof o === 'string' ? o : o.id || '')}
        isOptionEqualToValue={(o, v) => o.id === (v.id || v)}
        onChange={(e, val) => setModelId(val ? val.id : '')}
        renderOption={(props, option) => (
          <Box component="li" {...props} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start !important', gap: 0.25 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <MemoryIcon fontSize="small" color="action" />
              <Typography sx={{ fontWeight: 600 }}>{option.id}</Typography>
            </Stack>
            {metaLine(option) && <Typography variant="caption" color="text.secondary" sx={{ pl: 3.5 }}>{metaLine(option)}</Typography>}
          </Box>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Model auditors will run in their browser"
            required
            placeholder="Llama-3.2-3B-Instruct-q4f16_1-MLC"
            helperText={`Pick from ${catalog.length || '160+'} prebuilt models. Smaller (1–3B) models load fastest; larger ones need more VRAM.`}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {!catalog.length && !catalogError ? <CircularProgress size={18} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />

      {selected && (
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: -1 }}>
          {selected.parameterSize && <Chip size="small" label={selected.parameterSize} />}
          {selected.quantization && <Chip size="small" variant="outlined" label={selected.quantization} />}
          {fmtVram(selected.vramMB) && <Chip size="small" variant="outlined" label={fmtVram(selected.vramMB)} />}
          {selected.lowResource && <Chip size="small" color="success" variant="outlined" label="Runs on low-end devices" />}
        </Stack>
      )}

      {/* Download & test the model in THIS browser to confirm it runs. */}
      <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2, p: 2 }}>
        <Typography variant="subtitle2">Try it in this browser</Typography>
        <Typography variant="caption" color="text.secondary">
          Download and load the model here to confirm it runs before you open the study.
          The weights are cached, so auditors on this machine won&apos;t re-download them.
        </Typography>
        <Box sx={{ mt: 1.5 }}>
          {testOk && testedRef.current === modelId ? (
            <Chip color="success" icon={<CheckCircleIcon />} label="Loaded & ready — runs in your browser" />
          ) : (
            <Button
              variant="outlined" startIcon={testing ? <CircularProgress size={16} /> : <PlayArrowIcon />}
              onClick={runTest} disabled={!modelId || testing || gpu.state === 'no'}
            >
              {testing ? 'Loading…' : 'Download & test'}
            </Button>
          )}
        </Box>
        {testing && (
          <Box sx={{ mt: 1.5 }}>
            <LinearProgress variant={testPct == null ? 'indeterminate' : 'determinate'} value={testPct ?? 0} sx={{ borderRadius: 1, height: 8 }} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {testText}{testPct != null ? ` — ${testPct}%` : ''}
            </Typography>
          </Box>
        )}
        {testErr && <Alert severity="error" sx={{ mt: 1.5 }} onClose={() => setTestErr('')}>{testErr}</Alert>}
      </Box>
    </Stack>
  );
}
