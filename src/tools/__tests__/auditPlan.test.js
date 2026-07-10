// Phase C step 5 — config-driven audit-step planner (SC-6).

import { AUDIT_STEP, buildAuditPlan, resolveAuditPlan, nextAuditStep, isAuditComplete } from '../audit/auditPlan';

const evalCfg = (over) => ({
  turnReactions: { enabled: true, types: ['thumbs'] },
  questionnaire: { enabled: true, schema: null },
  spanHighlighting: { enabled: true },
  ...over,
});

describe('buildAuditPlan', () => {
  test('both methods on → highlight then questionnaire', () => {
    expect(buildAuditPlan(evalCfg())).toEqual([AUDIT_STEP.SPAN_HIGHLIGHT, AUDIT_STEP.QUESTIONNAIRE]);
  });

  test('questionnaire only', () => {
    expect(buildAuditPlan(evalCfg({ spanHighlighting: { enabled: false } })))
      .toEqual([AUDIT_STEP.QUESTIONNAIRE]);
  });

  test('span only', () => {
    expect(buildAuditPlan(evalCfg({ questionnaire: { enabled: false, schema: null } })))
      .toEqual([AUDIT_STEP.SPAN_HIGHLIGHT]);
  });

  test('both off → empty plan (turn reactions are not an audit step)', () => {
    expect(buildAuditPlan(evalCfg({ spanHighlighting: { enabled: false }, questionnaire: { enabled: false } })))
      .toEqual([]);
  });

  test('tolerates a missing/partial evaluation config', () => {
    expect(buildAuditPlan()).toEqual([]);
    expect(buildAuditPlan({})).toEqual([]);
  });
});

describe('resolveAuditPlan — SC-6 gating', () => {
  const H = AUDIT_STEP.SPAN_HIGHLIGHT;
  const Q = AUDIT_STEP.QUESTIONNAIRE;

  test('both methods on, schema present → highlight then questionnaire', () => {
    expect(resolveAuditPlan(evalCfg(), { hasSchema: true })).toEqual([H, Q]);
  });

  test('questionnaire enabled but no schema → questionnaire step dropped (no dead-end)', () => {
    expect(resolveAuditPlan(evalCfg({ spanHighlighting: { enabled: false } }), { hasSchema: false })).toEqual([]);
    expect(resolveAuditPlan(evalCfg(), { hasSchema: false })).toEqual([H]);
  });

  test('questionnaire off, highlighting on → highlight only', () => {
    expect(resolveAuditPlan(evalCfg({ questionnaire: { enabled: false, schema: null } }), { hasSchema: true })).toEqual([H]);
  });

  test('highlighting off, questionnaire on+schema → questionnaire only', () => {
    expect(resolveAuditPlan(evalCfg({ spanHighlighting: { enabled: false } }), { hasSchema: true })).toEqual([Q]);
  });

  test('both methods off → empty plan (audit auto-completes)', () => {
    expect(resolveAuditPlan(evalCfg({ spanHighlighting: { enabled: false }, questionnaire: { enabled: false } }), { hasSchema: true })).toEqual([]);
  });
});

describe('nextAuditStep / isAuditComplete', () => {
  const plan = [AUDIT_STEP.SPAN_HIGHLIGHT, AUDIT_STEP.QUESTIONNAIRE];

  test('walks the plan from the start', () => {
    expect(nextAuditStep(plan, null)).toBe(AUDIT_STEP.SPAN_HIGHLIGHT);
    expect(nextAuditStep(plan, AUDIT_STEP.SPAN_HIGHLIGHT)).toBe(AUDIT_STEP.QUESTIONNAIRE);
    expect(nextAuditStep(plan, AUDIT_STEP.QUESTIONNAIRE)).toBeNull();
  });

  test('isAuditComplete only after the last step', () => {
    expect(isAuditComplete(plan, null)).toBe(false);
    expect(isAuditComplete(plan, AUDIT_STEP.SPAN_HIGHLIGHT)).toBe(false);
    expect(isAuditComplete(plan, AUDIT_STEP.QUESTIONNAIRE)).toBe(true);
  });

  test('an empty plan is complete immediately', () => {
    expect(isAuditComplete([], null)).toBe(true);
  });
});
