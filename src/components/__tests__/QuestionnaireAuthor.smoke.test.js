// Import-smoke for the authoring UI: validates it transpiles and its import graph
// (shadcn/ui primitives, authoring helpers, questionnaire validator, templates) resolves.

import QuestionnaireAuthor from '../QuestionnaireAuthor/QuestionnaireAuthor';

test('QuestionnaireAuthor imports and is a React component', () => {
  expect(typeof QuestionnaireAuthor).toBe('function');
});
