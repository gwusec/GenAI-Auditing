// authoring — pure helpers for the in-house questionnaire authoring UI (Phase C
// step 4; SC-7 / D1). The authoring UI is a generator/editor over a SUBSET of
// SurveyJS JSON — these helpers build and mutate that JSON immutably so the React
// component stays thin and the logic is unit-tested. Anything outside the tier is
// reached via the raw-JSON escape hatch (validated by validateSurveyJSON).

import * as uuid from 'uuid';

/** The D1 authoring tier: the question types the visual UI exposes. */
export const QUESTION_TYPES = [
  { key: 'single', label: 'Single choice', surveyType: 'radiogroup' },
  { key: 'multiple', label: 'Multiple choice', surveyType: 'checkbox' },
  { key: 'rating', label: 'Likert / rating scale', surveyType: 'rating' },
  { key: 'matrix', label: 'Likert matrix / grid', surveyType: 'matrix' },
  { key: 'shortText', label: 'Short text', surveyType: 'text' },
  { key: 'longText', label: 'Long text', surveyType: 'comment' },
];

const newName = () => `q_${uuid.v4().slice(0, 8)}`;

/** A fresh empty questionnaire with one page. */
export function blankQuestionnaire() {
  return { title: '', description: '', pages: [{ name: 'page1', elements: [] }] };
}

/** A new question element of the given tier type, with sane defaults. */
export function makeQuestion(typeKey) {
  const t = QUESTION_TYPES.find((x) => x.key === typeKey) || QUESTION_TYPES[0];
  const base = { type: t.surveyType, name: newName(), title: 'Untitled question', isRequired: false };
  switch (t.surveyType) {
    case 'radiogroup':
    case 'checkbox':
      return { ...base, choices: ['Option 1', 'Option 2'] };
    case 'rating':
      return { ...base, rateMin: 1, rateMax: 5 };
    case 'matrix':
      return {
        ...base,
        columns: ['Strongly disagree', 'Disagree', 'Agree', 'Strongly agree'],
        rows: ['Statement 1'],
      };
    default:
      return base; // text / comment
  }
}

const mapPages = (schema, pageIndex, fn) => ({
  ...schema,
  pages: (schema.pages || []).map((p, i) => (i === pageIndex ? fn(p) : p)),
});

export function setTitle(schema, title) {
  return { ...schema, title };
}

export function addPage(schema) {
  const pages = [...(schema.pages || [])];
  pages.push({ name: `page${pages.length + 1}`, elements: [] });
  return { ...schema, pages };
}

export function removePage(schema, pageIndex) {
  const pages = (schema.pages || []).filter((_, i) => i !== pageIndex);
  return { ...schema, pages: pages.length ? pages : blankQuestionnaire().pages };
}

export function addQuestion(schema, pageIndex, typeKey) {
  return mapPages(schema, pageIndex, (p) => ({ ...p, elements: [...(p.elements || []), makeQuestion(typeKey)] }));
}

export function updateQuestion(schema, pageIndex, qIndex, patch) {
  return mapPages(schema, pageIndex, (p) => ({
    ...p,
    elements: (p.elements || []).map((e, j) => (j === qIndex ? { ...e, ...patch } : e)),
  }));
}

export function removeQuestion(schema, pageIndex, qIndex) {
  return mapPages(schema, pageIndex, (p) => ({
    ...p,
    elements: (p.elements || []).filter((_, j) => j !== qIndex),
  }));
}
