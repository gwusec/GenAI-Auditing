// Phase C step 3 — SurveyJS questionnaire helpers (SC-7 / EVAL-2).

import { validateSurveyJSON, countQuestions } from '../audit/questionnaire';

const GOOD = {
  title: 'Fairness audit',
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'radiogroup', name: 'biased', title: 'Was it biased?', choices: ['Yes', 'No'], isRequired: true },
        { type: 'comment', name: 'why', title: 'Explain' },
      ],
    },
  ],
};

describe('validateSurveyJSON', () => {
  test('accepts a valid schema object', () => {
    const r = validateSurveyJSON(GOOD);
    expect(r.valid).toBe(true);
    expect(r.error).toBeNull();
    expect(r.schema).toEqual(GOOD);
  });

  test('accepts a valid schema as a JSON string', () => {
    const r = validateSurveyJSON(JSON.stringify(GOOD));
    expect(r.valid).toBe(true);
    expect(r.schema.title).toBe('Fairness audit');
  });

  test('rejects a malformed JSON string', () => {
    const r = validateSurveyJSON('{ not valid json ');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/Invalid JSON/);
    expect(r.schema).toBeNull();
  });

  test('rejects a non-object schema', () => {
    expect(validateSurveyJSON('[]').valid).toBe(false);
    expect(validateSurveyJSON('42').valid).toBe(false);
    expect(validateSurveyJSON(null).valid).toBe(false);
  });
});

describe('countQuestions', () => {
  test('counts questions across pages', () => {
    expect(countQuestions(GOOD)).toBe(2);
  });
  test('counts questions in a flat elements schema', () => {
    expect(countQuestions({ elements: [{ type: 'text', name: 'a' }] })).toBe(1);
  });
  test('handles an empty schema', () => {
    expect(countQuestions({})).toBe(0);
  });
});
