// auditPlan — the config-driven enabled-step list for the post-conversation audit
// (Phase C step 5; SC-6). Replaces the hard-coded `likert → highlight → text`
// machine: the steps that appear are derived from the study's evaluation toggles, so
// methods can be enabled independently. Turn reactions are NOT an audit step (they
// happen mid-chat); the audit steps are span highlighting and the questionnaire.
//
// Pure module: no React, no models coupling — it just plans the order.

export const AUDIT_STEP = {
  SPAN_HIGHLIGHT: 'span_highlight',
  QUESTIONNAIRE: 'questionnaire',
};

/**
 * Build the ordered list of audit steps from a study's evaluation config (SC-6).
 * Order: span highlighting (localized critique) → questionnaire (summative).
 * @param {object} evaluation config.evaluation
 * @returns {string[]} ordered audit steps (possibly empty)
 */
export function buildAuditPlan(evaluation = {}) {
  const plan = [];
  if (evaluation && evaluation.spanHighlighting && evaluation.spanHighlighting.enabled) {
    plan.push(AUDIT_STEP.SPAN_HIGHLIGHT);
  }
  if (evaluation && evaluation.questionnaire && evaluation.questionnaire.enabled) {
    plan.push(AUDIT_STEP.QUESTIONNAIRE);
  }
  return plan;
}

/**
 * Resolve the audit plan actually shown to the auditor: the enabled steps (SC-6),
 * minus a questionnaire step when no schema is configured (no dead-end). This is the
 * single source of truth for audit-step gating.
 * @param {object} evaluation config.evaluation
 * @param {{hasSchema?: boolean}} opts
 * @returns {string[]}
 */
export function resolveAuditPlan(evaluation = {}, { hasSchema = false } = {}) {
  return buildAuditPlan(evaluation).filter(
    (s) => s !== AUDIT_STEP.QUESTIONNAIRE || hasSchema
  );
}

/**
 * The next step after `current` (or null = before the first step). Returns null when
 * there is no next step (→ audit complete).
 * @param {string[]} plan
 * @param {string|null} current
 * @returns {string|null}
 */
export function nextAuditStep(plan, current = null) {
  if (current == null) return plan[0] ?? null;
  const i = plan.indexOf(current);
  return plan[i + 1] ?? null;
}

/**
 * Is the audit finished? True when there is no step after `current`. An empty plan
 * (no audit methods enabled) is complete immediately.
 * @param {string[]} plan
 * @param {string|null} current the step just completed (null = none started)
 * @returns {boolean}
 */
export function isAuditComplete(plan, current = null) {
  if (plan.length === 0) return true;
  if (current == null) return false;
  return nextAuditStep(plan, current) === null;
}
