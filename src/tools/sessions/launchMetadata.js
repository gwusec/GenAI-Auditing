// launchMetadata — capture opaque launch URL query params for an AuditorSession
// (Phase B step 6; SC-13 / PRD §9 D7). Used at auditor join time, e.g. to record
// `?PROLIFIC_PID=...` so investigators can reconcile payment externally — kept
// separate from audit data, never interpreted, only captured when the study opts in.
//
// Pure function: pass it `window.location.search` (or any query string) + the
// study's launchCapture toggle.

/**
 * @param {string|URLSearchParams} search a query string ("?a=1&b=2"), a bare
 *   "a=1&b=2", or a URLSearchParams
 * @param {{enabled:boolean}} options the study's launchCapture setting
 * @returns {object|null} a flat string→string map of params when capture is enabled
 *   ({} if there were none); null when capture is disabled
 */
export function parseLaunchMetadata(search, { enabled } = {}) {
  if (!enabled) return null;

  let params;
  if (search instanceof URLSearchParams) {
    params = search;
  } else if (typeof search === 'string') {
    const qs = search.startsWith('?') ? search.slice(1) : search;
    params = new URLSearchParams(qs);
  } else {
    params = new URLSearchParams();
  }

  // Opaque capture: keep every key as a string, last value wins for duplicates.
  const out = {};
  for (const [key, value] of params.entries()) {
    out[key] = value;
  }
  return out;
}

export default parseLaunchMetadata;
