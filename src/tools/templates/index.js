// Bundled audit questionnaire templates (SC-8). Ready-to-use SurveyJS schemas an
// investigator can adopt and edit in the authoring UI. At least one fairness + one
// bias template ship.

import fairness from './fairness.surveyjs.json';
import bias from './bias.surveyjs.json';

export const QUESTIONNAIRE_TEMPLATES = [
  { id: 'fairness', label: 'Fairness audit', schema: fairness },
  { id: 'bias', label: 'Bias audit', schema: bias },
];

export function getTemplate(id) {
  const t = QUESTIONNAIRE_TEMPLATES.find((x) => x.id === id);
  // return a deep copy so callers can edit without mutating the bundled schema
  return t ? JSON.parse(JSON.stringify(t.schema)) : null;
}

export default QUESTIONNAIRE_TEMPLATES;
