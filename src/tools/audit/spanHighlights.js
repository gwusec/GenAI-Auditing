// spanHighlights — span-annotation capture hardened per PRD §6.4 / §9 D6.
//
// Correctness rule: a highlight's offsets index the **canonical stored message
// string** from the event log — not the rendered DOM, not a streaming buffer.
// We store `quotedText` alongside the offsets and, on read, assert
// `canonical.slice(startOffset, endOffset) === quotedText`; a mismatch is FLAGGED
// (resolved:false), never silently rendered.
//
// Pure module: no React, no DOM. Highlight shape:
//   { messageId, startOffset, endOffset, quotedText, explanation, label }

const isInt = (n) => Number.isInteger(n);

/**
 * Build a highlight from a selection over the canonical message string. The
 * quotedText is sliced from the canonical string itself, so it can never drift
 * from the offsets at capture time. Throws on out-of-bounds / empty selections.
 *
 * @param {string} canonicalText the immutable stored message text
 * @param {{messageId:string,startOffset:number,endOffset:number,explanation?:string,label?:(string|null)}} sel
 * @returns {object} a highlight
 */
export function createSpanHighlight(canonicalText, sel) {
  if (typeof canonicalText !== 'string') throw new Error('canonicalText must be a string');
  const { messageId, startOffset, endOffset, explanation = '', label = null } = sel || {};
  if (!messageId) throw new Error('messageId is required');
  if (!isInt(startOffset) || !isInt(endOffset)) throw new Error('offsets must be integers');
  if (startOffset < 0 || endOffset > canonicalText.length) throw new Error('offsets out of bounds');
  if (startOffset >= endOffset) throw new Error('startOffset must be < endOffset');

  return {
    messageId,
    startOffset,
    endOffset,
    quotedText: canonicalText.slice(startOffset, endOffset),
    explanation,
    label,
  };
}

/**
 * Does a highlight still resolve to the same substring of the canonical text?
 * (The read-time / export-time guard.)
 * @returns {boolean}
 */
export function highlightResolves(canonicalText, highlight) {
  if (typeof canonicalText !== 'string' || !highlight) return false;
  const { startOffset, endOffset, quotedText } = highlight;
  if (!isInt(startOffset) || !isInt(endOffset)) return false;
  if (startOffset < 0 || endOffset > canonicalText.length || startOffset >= endOffset) return false;
  return canonicalText.slice(startOffset, endOffset) === quotedText;
}

/**
 * Resolve a list of highlights against a map of canonical message strings,
 * tagging each with `resolved`. Consumers must check `resolved` and surface
 * mismatches (flag) rather than rendering them as valid.
 * @param {Array} highlights
 * @param {Record<string,string>} canonicalByMessageId
 * @returns {Array} highlights with a `resolved` boolean added
 */
export function resolveHighlights(highlights, canonicalByMessageId = {}) {
  return (highlights || []).map((h) => ({
    ...h,
    resolved: highlightResolves(canonicalByMessageId[h.messageId], h),
  }));
}

/**
 * Normalize a highlight of EITHER shape (legacy `{text,startIndex}` or hardened
 * `{quotedText,startOffset,endOffset}`) to the render shape the legacy
 * ChatHistory renderer consumes: `{ ...highlight, text, startIndex }`.
 * The inverse companion of migrateLegacyHighlight. This is what prevents the
 * post-audit summary from crashing on `highlight.text.length` when it is handed
 * hardened highlights (the completion white-screen bug).
 * @param {object} h
 * @returns {object|null}
 */
export function toRenderableHighlight(h) {
  if (!h) return null;
  const text = h.text != null ? h.text : (h.quotedText != null ? h.quotedText : '');
  const startIndex = isInt(h.startIndex) ? h.startIndex
    : isInt(h.startOffset) ? h.startOffset : 0;
  return { ...h, text, startIndex };
}

/**
 * Migrate a legacy highlight (`{ messageId, text, startIndex }`) to the hardened
 * shape. Idempotent: a highlight already in the new shape is returned unchanged.
 * @param {object} legacy
 * @returns {object|null}
 */
export function migrateLegacyHighlight(legacy) {
  if (!legacy) return null;
  if (legacy.quotedText != null && isInt(legacy.startOffset) && isInt(legacy.endOffset)) {
    return legacy; // already hardened
  }
  const start = isInt(legacy.startIndex) ? legacy.startIndex
    : isInt(legacy.startOffset) ? legacy.startOffset : 0;
  const text = legacy.text != null ? legacy.text : (legacy.quotedText != null ? legacy.quotedText : '');
  return {
    messageId: legacy.messageId,
    startOffset: start,
    endOffset: start + text.length,
    quotedText: text,
    explanation: legacy.explanation != null ? legacy.explanation : '',
    label: legacy.label != null ? legacy.label : null,
  };
}
