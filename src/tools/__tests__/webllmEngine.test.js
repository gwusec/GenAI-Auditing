// WebLLM engine — pure-helper tests. The heavy @mlc-ai/web-llm module is loaded
// via dynamic import only inside catalog/load functions, so importing this module
// (and these helpers) does NOT pull in WebGPU/WASM — safe to unit-test in jsdom.

import { describe, test, expect, afterEach } from 'vitest';
import { describeModelId, hasWebGPUApi, checkWebGPU } from '../webllm/webllmEngine';

describe('describeModelId', () => {
  test('parses parameter size, quantization, and family from an MLC id', () => {
    expect(describeModelId('Llama-3.2-3B-Instruct-q4f16_1-MLC')).toEqual({
      parameterSize: '3B', quantization: 'q4f16_1', family: 'Llama-3.2', instruct: true,
    });
  });

  test('handles decimal sizes and non-instruct ids', () => {
    const d = describeModelId('gemma-2-2b-it-q4f16_1-MLC');
    expect(d.parameterSize).toBe('2B');
    expect(d.quantization).toBe('q4f16_1');
  });

  test('tolerates ids without a clear size or quant', () => {
    const d = describeModelId('SomeRandomModel-MLC');
    expect(d.parameterSize).toBeNull();
    expect(d.quantization).toBeNull();
    expect(typeof d.family).toBe('string');
  });
});

describe('WebGPU detection', () => {
  const origGpu = Object.getOwnPropertyDescriptor(global.navigator || {}, 'gpu');
  afterEach(() => {
    if (origGpu) Object.defineProperty(global.navigator, 'gpu', origGpu);
    else if (global.navigator && 'gpu' in global.navigator) { try { delete global.navigator.gpu; } catch (_) { /* noop */ } }
  });

  test('reports no WebGPU when navigator.gpu is absent (jsdom)', async () => {
    expect(hasWebGPUApi()).toBe(false);
    const r = await checkWebGPU();
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/WebGPU/i);
  });

  test('probes the adapter when navigator.gpu exists', async () => {
    Object.defineProperty(global.navigator, 'gpu', {
      configurable: true,
      value: { requestAdapter: async () => ({}) },
    });
    expect(hasWebGPUApi()).toBe(true);
    const r = await checkWebGPU();
    expect(r.ok).toBe(true);
  });

  test('fails closed when an adapter cannot be acquired', async () => {
    Object.defineProperty(global.navigator, 'gpu', {
      configurable: true,
      value: { requestAdapter: async () => null },
    });
    const r = await checkWebGPU();
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/adapter/i);
  });
});
