// webllmEngine — a thin, robust wrapper around @mlc-ai/web-llm for running an LLM
// entirely in the auditor's browser via WebGPU. No server, no API key, no data
// leaving the machine. The heavy web-llm library is loaded with a dynamic import
// so it is code-split out of the main bundle and only downloaded when a WebLLM
// study is actually used.
//
// Responsibilities:
//   • WebGPU capability detection (with an adapter probe, not just feature-flag).
//   • The full prebuilt model catalog, decorated with human-friendly metadata.
//   • Loading a model with progress (weights are cached in the browser by web-llm,
//     so the second load of the same model is near-instant).
//   • Streaming chat completions with the study's decoding settings.
//
// The engine is a per-model singleton: asking for the same model reuses the loaded
// engine; asking for a different one unloads the old and loads the new.

let _mod = null;                // memoized @mlc-ai/web-llm module
let _engine = null;             // current MLCEngine
let _engineModelId = null;      // which model _engine holds
let _loadingPromise = null;     // in-flight load (dedupes concurrent callers)
let _loadingModelId = null;

async function mod() {
  if (!_mod) _mod = await import('@mlc-ai/web-llm');
  return _mod;
}

// --- WebGPU capability -------------------------------------------------------
export function hasWebGPUApi() {
  return typeof navigator !== 'undefined' && !!navigator.gpu;
}

// A real probe: some browsers expose navigator.gpu but have no working adapter
// (e.g. hardware/driver blocklists). Returns { ok, reason }.
export async function checkWebGPU() {
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    return { ok: false, reason: 'This browser has no WebGPU. Use a recent Chrome, Edge, or a WebGPU-enabled Firefox/Safari.' };
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { ok: false, reason: 'WebGPU is present but no graphics adapter is available (it may be disabled or blocklisted on this device).' };
    return { ok: true, reason: '' };
  } catch (e) {
    return { ok: false, reason: `WebGPU probe failed: ${e.message || e}` };
  }
}

// --- Catalog -----------------------------------------------------------------
// Parse "Llama-3.2-3B-Instruct-q4f16_1-MLC" into friendly pieces for the picker.
export function describeModelId(id) {
  const params = (id.match(/\b(\d+(?:\.\d+)?)B\b/i) || [])[1];
  const quant = (id.match(/q\d[a-z0-9_]*/i) || [])[0] || null;
  // Family = leading token run before the first size/quant marker.
  const family = id.replace(/-q\d.*$/i, '').replace(/-Instruct.*$/i, '').replace(/-\d+(\.\d+)?B.*$/i, '');
  return {
    parameterSize: params ? `${params}B` : null,
    quantization: quant,
    family: family || id,
    instruct: /instruct|chat|it\b/i.test(id),
  };
}

export async function getModelCatalog() {
  const w = await mod();
  const list = (w.prebuiltAppConfig && w.prebuiltAppConfig.model_list) || [];
  return list.map((m) => {
    const d = describeModelId(m.model_id);
    return {
      id: m.model_id,
      vramMB: typeof m.vram_required_MB === 'number' ? m.vram_required_MB : null,
      lowResource: !!m.low_resource_required,
      ...d,
    };
  });
}

// Recommended defaults: small, instruct-tuned models that load quickly on typical
// laptops — surfaced first in the picker so auditors aren't overwhelmed by 160+ ids.
export const RECOMMENDED_MODEL_IDS = [
  'Llama-3.2-3B-Instruct-q4f16_1-MLC',
  'Llama-3.2-1B-Instruct-q4f16_1-MLC',
  'Phi-3.5-mini-instruct-q4f16_1-MLC',
  'gemma-2-2b-it-q4f16_1-MLC',
  'Qwen2.5-3B-Instruct-q4f16_1-MLC',
  'Mistral-7B-Instruct-v0.3-q4f16_1-MLC',
];

// --- Load --------------------------------------------------------------------
// Ensure `modelId` is loaded; returns the engine. `onProgress({progress,text})`
// fires during download/compile. Concurrent callers for the same model share one load.
export async function ensureModel(modelId, { onProgress } = {}) {
  if (!modelId) throw new Error('No WebLLM model id provided.');
  if (_engine && _engineModelId === modelId) return _engine;
  if (_loadingPromise && _loadingModelId === modelId) return _loadingPromise;

  const w = await mod();
  // Switching models: dispose the previous engine first to free VRAM.
  if (_engine && _engineModelId !== modelId) {
    try { await _engine.unload(); } catch (_) { /* noop */ }
    _engine = null; _engineModelId = null;
  }

  _loadingModelId = modelId;
  _loadingPromise = (async () => {
    const engine = await w.CreateMLCEngine(modelId, {
      initProgressCallback: (report) => {
        if (onProgress) onProgress({ progress: report.progress ?? null, text: report.text || '' });
      },
    });
    _engine = engine;
    _engineModelId = modelId;
    return engine;
  })();

  try {
    return await _loadingPromise;
  } finally {
    _loadingPromise = null;
    _loadingModelId = null;
  }
}

export function isModelLoaded(modelId) {
  return !!_engine && _engineModelId === modelId;
}

export async function unloadModel() {
  if (_engine) { try { await _engine.unload(); } catch (_) { /* noop */ } }
  _engine = null; _engineModelId = null;
}

// --- Chat --------------------------------------------------------------------
// Stream a completion for `messages` ([{role,content}]). Applies decoding
// (temperature/topP/maxTokens). Calls onToken(delta) per chunk; returns the full text.
export async function streamChat(engine, messages, decoding = {}, { onToken, signal } = {}) {
  const params = {
    messages,
    stream: true,
    ...(Number.isFinite(decoding.temperature) ? { temperature: decoding.temperature } : {}),
    ...(Number.isFinite(decoding.topP) ? { top_p: decoding.topP } : {}),
    ...(Number.isFinite(decoding.maxTokens) ? { max_tokens: decoding.maxTokens } : {}),
  };
  const chunks = await engine.chat.completions.create(params);
  let full = '';
  for await (const chunk of chunks) {
    if (signal && signal.aborted) { try { await engine.interruptGenerate(); } catch (_) { /* noop */ } break; }
    const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content;
    if (delta) { full += delta; if (onToken) onToken(delta); }
  }
  return full;
}
