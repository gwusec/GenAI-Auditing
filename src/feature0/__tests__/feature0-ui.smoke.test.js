// Import-smoke test for the Feature 0 UI. Importing each component validates it
// transpiles and its import graph (MUI, icons, context, seams, SurveyMaker)
// resolves — the same class of error a production build would surface.

import Feature0Context, { Feature0Provider, useFeature0, DEFAULT_QUESTIONNAIRE } from '../Feature0Context';
import InvestigatorAuth from '../InvestigatorAuth';
import AuditorJoin from '../AuditorJoin';
import StudyDashboard from '../StudyDashboard';
import StudySetup from '../StudySetup';
import StudyConfigForm from '../StudyConfigForm';
import Feature0Gate from '../Feature0Gate';
import ConsentGate from '../ConsentGate';

test('Feature 0 context module exports provider, hook, and a valid default questionnaire', () => {
  expect(Feature0Context).toBeTruthy();
  expect(typeof Feature0Provider).toBe('function');
  expect(typeof useFeature0).toBe('function');
  // default questionnaire must be the { questions: [...] } shape AuditForm expects
  expect(Array.isArray(DEFAULT_QUESTIONNAIRE.questions)).toBe(true);
  expect(DEFAULT_QUESTIONNAIRE.questions.length).toBeGreaterThan(0);
  DEFAULT_QUESTIONNAIRE.questions.forEach((q) => {
    expect(typeof q.id).toBe('string');
    expect(['matrix', 'textHighlight', 'freeResponse']).toContain(q.type);
  });
});

test('Feature 0 UI components import and are React components', () => {
  for (const C of [InvestigatorAuth, AuditorJoin, StudyDashboard, StudySetup, StudyConfigForm, Feature0Gate, ConsentGate]) {
    expect(typeof C).toBe('function');
  }
});
