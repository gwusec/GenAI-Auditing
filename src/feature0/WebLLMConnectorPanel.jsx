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
import { Stack, Typography } from '../components/ui/layout';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Alert } from '../components/ui/alert';
import { Progress } from '../components/ui/progress';
import { Spinner } from '../components/ui/spinner';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectLabel, SelectItem,
} from '../components/ui/select';
import {
  CheckCircle as CheckCircleIcon,
  Memory as MemoryIcon,
  PlayArrow as PlayArrowIcon,
  Close as CloseIcon,
} from '../components/ui/icons';
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
    ? <Alert variant="info"><Spinner size={16} /><span>Checking this browser for WebGPU…</span></Alert>
    : gpu.state === 'ok'
      ? <Alert variant="success">This browser supports WebGPU — WebLLM can run models locally here.</Alert>
      : <Alert variant="warning">{gpu.reason} Auditors will need a WebGPU-capable browser to run this study.</Alert>;

  const catalogLoading = !catalog.length && !catalogError;
  const recommendedModels = catalog.filter((m) => m.recommended);
  const otherModels = catalog.filter((m) => !m.recommended);
  const renderModelItem = (option) => (
    <SelectItem key={option.id} value={option.id}>
      <span className="flex items-center gap-2">
        <MemoryIcon className="size-4 text-muted-foreground" />
        <span className="font-semibold">{option.id}</span>
      </span>
      {metaLine(option) && <span className="block pl-6 text-xs text-muted-foreground">{metaLine(option)}</span>}
    </SelectItem>
  );

  return (
    <Stack spacing={2}>
      {gpuBanner}

      {catalogError && <Alert variant="destructive">{catalogError}</Alert>}

      <div>
        <Label htmlFor="webllm-model">Model auditors will run in their browser <span className="text-destructive">*</span></Label>
        <Select value={modelId || ''} onValueChange={(val) => setModelId(val)} disabled={catalogLoading}>
          <SelectTrigger id="webllm-model" className="mt-1.5">
            {catalogLoading && <Spinner size={16} className="mr-2" />}
            <SelectValue placeholder={catalogLoading ? 'Loading models…' : 'Llama-3.2-3B-Instruct-q4f16_1-MLC'} />
          </SelectTrigger>
          <SelectContent>
            {recommendedModels.length > 0 && (
              <SelectGroup>
                <SelectLabel>Recommended</SelectLabel>
                {recommendedModels.map(renderModelItem)}
              </SelectGroup>
            )}
            {otherModels.length > 0 && (
              <SelectGroup>
                <SelectLabel>All models</SelectLabel>
                {otherModels.map(renderModelItem)}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {`Pick from ${catalog.length || '160+'} prebuilt models. Smaller (1–3B) models load fastest; larger ones need more VRAM.`}
        </p>
      </div>

      {selected && (
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" className="-mt-2">
          {selected.parameterSize && <Badge variant="secondary">{selected.parameterSize}</Badge>}
          {selected.quantization && <Badge variant="outline">{selected.quantization}</Badge>}
          {fmtVram(selected.vramMB) && <Badge variant="outline">{fmtVram(selected.vramMB)}</Badge>}
          {selected.lowResource && <Badge variant="success">Runs on low-end devices</Badge>}
        </Stack>
      )}

      {/* Download & test the model in THIS browser to confirm it runs. */}
      <div className="rounded-md border border-dashed p-4">
        <Typography variant="subtitle2">Try it in this browser</Typography>
        <Typography variant="caption" color="text.secondary">
          Download and load the model here to confirm it runs before you open the study.
          The weights are cached, so auditors on this machine won&apos;t re-download them.
        </Typography>
        <div className="mt-3">
          {testOk && testedRef.current === modelId ? (
            <Badge variant="success"><CheckCircleIcon className="size-3.5" />Loaded &amp; ready — runs in your browser</Badge>
          ) : (
            <Button
              variant="outline"
              onClick={runTest} disabled={!modelId || testing || gpu.state === 'no'}
            >
              {testing ? <Spinner size={16} /> : <PlayArrowIcon />}
              {testing ? 'Loading…' : 'Download & test'}
            </Button>
          )}
        </div>
        {testing && (
          <div className="mt-3">
            <Progress value={testPct} className="h-2 rounded" />
            <Typography variant="caption" color="text.secondary" className="mt-1 block">
              {testText}{testPct != null ? ` — ${testPct}%` : ''}
            </Typography>
          </div>
        )}
        {testErr && (
          <Alert variant="destructive" className="mt-3 flex items-start justify-between gap-2">
            <span>{testErr}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setTestErr('')}>
              <CloseIcon />
            </Button>
          </Alert>
        )}
      </div>
    </Stack>
  );
}
