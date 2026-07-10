// Pure relay helpers — no express/network deps, so they can be unit-tested from
// the root Vitest suite (which doesn't install the relay's own dependencies).
// These implement the P3 wiring: the study's decoding settings and system/seed
// prompt must actually drive the model call instead of the old hardcoded values.

const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant.';

// Resolve the study's decoding settings off the relay object, falling back to
// safe defaults. The study authors temperature/topP/maxTokens (schema.js); the
// relay used to hardcode 0.7 / 2000 and ignore these, so a study's decoding
// settings had no effect on the model. Each provider body maps these fields to
// its own parameter names (temperature/top_p/max_tokens, generationConfig, etc.).
function resolveDecoding(relay) {
  const d = (relay && typeof relay.decoding === 'object' && relay.decoding) || {};
  const temperature = (typeof d.temperature === 'number' && d.temperature >= 0) ? d.temperature : 0.7;
  const topP = (typeof d.topP === 'number' && d.topP > 0 && d.topP <= 1) ? d.topP : undefined;
  const maxTokens = (Number.isInteger(d.maxTokens) && d.maxTokens > 0) ? d.maxTokens : 2000;
  return { temperature, topP, maxTokens };
}

// Ensure the outgoing messages carry a system message. Priority: an inline
// system message from the caller (kept as-is) > the study's system/seed prompt
// (relay.systemPrompt) > the generic default. This replaces the old behavior of
// always forcing "You are a helpful assistant." regardless of the study config,
// which silently discarded a bias-audit study's framing (audit Gap #4).
function ensureSystemMessage(messages, relaySystemPrompt) {
  const list = Array.isArray(messages) ? messages : [];
  if (list.some((m) => m && m.role === 'system')) return list;
  const studyPrompt = (relaySystemPrompt && String(relaySystemPrompt).trim()) || '';
  const content = studyPrompt || DEFAULT_SYSTEM_PROMPT;
  return [{ role: 'system', content }, ...list];
}

// A rolling-window request counter with a ceiling, keyed by an arbitrary id
// (e.g. an auditor pid). Used as a SERVER-SIDE backstop to the client-side
// conversation/time limits (MOD-4/MOD-7): even a tampered client can't exceed the
// ceiling. Pure + in-memory; self-cleans stale buckets via sweep(). The clock is
// injectable so window behavior is deterministic to unit-test.
// hit(key) -> { allowed, count }.
function createRateCeiling({ max, windowMs, now = () => Date.now() }) {
  const buckets = new Map();

  const hit = (key) => {
    const t = now();
    const entry = buckets.get(key);
    if (!entry || t - entry.windowStart >= windowMs) {
      buckets.set(key, { count: 1, windowStart: t });
      return { allowed: 1 <= max, count: 1 };
    }
    entry.count += 1;
    return { allowed: entry.count <= max, count: entry.count };
  };

  const sweep = () => {
    const cutoff = now() - windowMs;
    for (const [key, entry] of buckets.entries()) {
      if (entry.windowStart < cutoff) buckets.delete(key);
    }
  };

  return { hit, sweep, _buckets: buckets };
}

module.exports = { DEFAULT_SYSTEM_PROMPT, resolveDecoding, ensureSystemMessage, createRateCeiling };
