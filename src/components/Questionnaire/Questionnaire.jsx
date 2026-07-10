// Questionnaire — renders the post-conversation questionnaire from SurveyJS JSON via
// the MIT Form Library (Phase C step 3; SC-7 / EVAL-2). The native response object is
// captured on completion (keyed to the conversation by the caller) and on each change
// so progress can be persisted for resume (AUD-8).

import React, { useMemo, useEffect } from 'react';
import { Model } from 'survey-core';
import { Survey } from 'survey-react-ui';
import 'survey-core/survey-core.min.css';

export default function Questionnaire({
  schema,
  data = null,
  onComplete = () => {},
  onChange = () => {},
}) {
  const survey = useMemo(() => {
    const model = new Model(schema || {});
    if (data) model.data = data;
    return model;
  }, [schema]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleComplete = (sender) => onComplete(sender.data);
    const handleChange = (sender) => onChange(sender.data);
    survey.onComplete.add(handleComplete);
    survey.onValueChanged.add(handleChange);
    return () => {
      survey.onComplete.remove(handleComplete);
      survey.onValueChanged.remove(handleChange);
    };
  }, [survey, onComplete, onChange]);

  return <Survey model={survey} />;
}
