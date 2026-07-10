// Phase C step 4 — authoring helpers + bundled templates (SC-7 / SC-8 / D1).

import {
  QUESTION_TYPES,
  blankQuestionnaire,
  makeQuestion,
  addPage,
  removePage,
  addQuestion,
  updateQuestion,
  removeQuestion,
  setTitle,
} from '../audit/authoring';
import { validateSurveyJSON } from '../audit/questionnaire';
import { QUESTIONNAIRE_TEMPLATES, getTemplate } from '../templates';

describe('authoring tier', () => {
  test('covers the D1 question types', () => {
    expect(QUESTION_TYPES.map((t) => t.key)).toEqual([
      'single', 'multiple', 'rating', 'matrix', 'shortText', 'longText',
    ]);
  });

  test('every tier type produces a valid SurveyJS question', () => {
    for (const t of QUESTION_TYPES) {
      const schema = addQuestion(blankQuestionnaire(), 0, t.key);
      const r = validateSurveyJSON(schema);
      expect(r.valid).toBe(true);
    }
  });

  test('makeQuestion gives choice/matrix/rating sensible defaults', () => {
    expect(makeQuestion('single').choices).toEqual(['Option 1', 'Option 2']);
    expect(makeQuestion('matrix')).toMatchObject({ type: 'matrix', rows: ['Statement 1'] });
    expect(makeQuestion('rating')).toMatchObject({ rateMin: 1, rateMax: 5 });
    expect(makeQuestion('shortText').type).toBe('text');
    expect(makeQuestion('longText').type).toBe('comment');
  });
});

describe('immutable schema operations', () => {
  test('add / update / remove a question without mutating the input', () => {
    const s0 = blankQuestionnaire();
    const s1 = addQuestion(s0, 0, 'single');
    expect(s0.pages[0].elements).toHaveLength(0); // s0 untouched
    expect(s1.pages[0].elements).toHaveLength(1);

    const s2 = updateQuestion(s1, 0, 0, { title: 'Was it fair?', isRequired: true });
    expect(s2.pages[0].elements[0].title).toBe('Was it fair?');
    expect(s2.pages[0].elements[0].isRequired).toBe(true);
    expect(s1.pages[0].elements[0].title).toBe('Untitled question'); // s1 untouched

    const s3 = removeQuestion(s2, 0, 0);
    expect(s3.pages[0].elements).toHaveLength(0);
  });

  test('add / remove pages; removing the last page leaves one empty page', () => {
    const s1 = addPage(blankQuestionnaire());
    expect(s1.pages).toHaveLength(2);
    const s2 = removePage(s1, 1);
    expect(s2.pages).toHaveLength(1);
    const s3 = removePage(s2, 0);
    expect(s3.pages).toHaveLength(1); // never zero
  });

  test('setTitle sets the questionnaire title', () => {
    expect(setTitle(blankQuestionnaire(), 'My audit').title).toBe('My audit');
  });
});

describe('bundled templates (SC-8)', () => {
  test('a fairness and a bias template ship', () => {
    expect(QUESTIONNAIRE_TEMPLATES.map((t) => t.id).sort()).toEqual(['bias', 'fairness']);
  });

  test('both templates are valid SurveyJS schemas', () => {
    for (const t of QUESTIONNAIRE_TEMPLATES) {
      expect(validateSurveyJSON(t.schema).valid).toBe(true);
    }
  });

  test('getTemplate returns an editable deep copy', () => {
    const a = getTemplate('fairness');
    a.title = 'changed';
    const b = getTemplate('fairness');
    expect(b.title).toBe('Fairness audit'); // original unaffected
  });

  test('getTemplate returns null for an unknown id', () => {
    expect(getTemplate('nope')).toBeNull();
  });
});
