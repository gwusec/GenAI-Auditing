// streamSSE — consume a POST endpoint that streams Server-Sent Events in the
// browser. Reuses the same `parseSSEEvents` the chat client uses, so a single
// parser covers both the /chat token stream and the Ollama /api/pull progress
// stream. Calls `onEvent` for every decoded event; pass an AbortSignal to cancel.

import { parseSSEEvents } from './APIClient';

export async function streamPost(url, body, { onEvent, signal } = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
    signal,
  });
  if (!res.ok || !res.body) {
    let msg = `Request failed (${res.status})`;
    try { const j = await res.json(); if (j && j.error) msg = j.error; } catch (_) { /* keep default */ }
    throw new Error(msg);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = parseSSEEvents(buffer);
    buffer = rest;
    for (const ev of events) { if (onEvent) onEvent(ev); }
  }
}

export default streamPost;
