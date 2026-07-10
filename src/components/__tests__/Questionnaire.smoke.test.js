// Import-smoke test for the SurveyJS questionnaire component: validates it
// transpiles and its import graph (survey-core, survey-react-ui, theme CSS) resolves.

import Questionnaire from '../Questionnaire/Questionnaire';

test('Questionnaire imports and is a React component', () => {
  expect(typeof Questionnaire).toBe('function');
});
