// questionnaire — SurveyJS Form Library helpers (Phase C step 3; SC-7 / EVAL-2).
// The post-conversation questionnaire is authored + stored as SurveyJS JSON and
// rendered by the MIT Form Library. This module validates a schema against the
// library before it is saved or shown, so a malformed schema can't brick an
// auditor session (PRD §9 D1). Pure (no React); imports only the framework-agnostic
// `survey-core`.

import { Model } from 'survey-core';

/**
 * Validate a SurveyJS schema (object or JSON string) against the Form Library.
 * @param {object|string} input
 * @returns {{valid:boolean, error:(string|null), schema:(object|null)}}
 */
export function validateSurveyJSON(input) {
  let schema = input;
  if (typeof input === 'string') {
    try {
      schema = JSON.parse(input);
    } catch (e) {
      return { valid: false, error: `Invalid JSON: ${e.message}`, schema: null };
    }
  }
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return { valid: false, error: 'Schema must be a JSON object', schema: null };
  }
  try {
    // Constructing a Model parses the schema; it throws on structurally invalid input.
    // eslint-disable-next-line no-new
    new Model(schema);
  } catch (e) {
    return { valid: false, error: `Not a valid SurveyJS schema: ${e.message}`, schema: null };
  }
  return { valid: true, error: null, schema };
}

/**
 * Count the questions in a schema (across pages/elements) — a small convenience for
 * the authoring UI ("12 questions").
 * @param {object} schema
 * @returns {number}
 */
export function countQuestions(schema) {
  let n = 0;
  const walk = (els) => (els || []).forEach((e) => {
    if (e && Array.isArray(e.elements)) walk(e.elements);
    else if (e && e.type) n += 1;
  });
  if (schema && Array.isArray(schema.pages)) schema.pages.forEach((p) => walk(p.elements));
  if (schema && Array.isArray(schema.elements)) walk(schema.elements);
  return n;
}
