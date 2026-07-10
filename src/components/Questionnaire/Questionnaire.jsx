// Questionnaire — renders the post-conversation questionnaire from SurveyJS JSON via
// the MIT Form Library (Phase C step 3; SC-7 / EVAL-2). The native response object is
// captured on completion (keyed to the conversation by the caller) and on each change
// so progress can be persisted for resume (AUD-8).

import React, { useMemo, useEffect } from 'react';
import { Model } from 'survey-core';
import { Survey } from 'survey-react-ui';
import 'survey-core/survey-core.min.css';

// Bridge our design tokens onto SurveyJS's CSS custom properties so the questionnaire
// inherits the accent, surfaces, typography, and light/dark mode instead of rendering
// in SurveyJS's stock blue-on-white. SurveyJS v2 reads these `--sjs-*` variables;
// setting them on a wrapper cascades to the form. Post-Phase-1B these point at the
// Tailwind CSS-variable tokens (src/index.css) rather than the old MUI theme object,
// so light/dark follows automatically when the `dark` class toggles on <html>.
const SURVEY_THEME_VARS = {
  '--sjs-font-family': '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  '--sjs-corner-radius': '10px',
  '--sjs-base-unit': '8px',
  // accent
  '--sjs-primary-backcolor': 'hsl(var(--primary))',
  '--sjs-primary-backcolor-light': 'hsl(var(--primary) / 0.12)',
  '--sjs-primary-backcolor-dark': 'hsl(var(--primary-dark))',
  '--sjs-primary-forecolor': 'hsl(var(--primary-foreground))',
  '--sjs-primary-forecolor-light': 'hsl(var(--primary-foreground))',
  // surfaces (question cards vs. page)
  '--sjs-general-backcolor': 'hsl(var(--card))',
  '--sjs-general-backcolor-dim': 'hsl(var(--background))',
  '--sjs-general-backcolor-dim-light': 'hsl(var(--card))',
  '--sjs-general-backcolor-dim-dark': 'hsl(var(--background))',
  // text
  '--sjs-general-forecolor': 'hsl(var(--foreground))',
  '--sjs-general-forecolor-light': 'hsl(var(--muted-foreground))',
  '--sjs-general-dim-forecolor': 'hsl(var(--foreground))',
  '--sjs-general-dim-forecolor-light': 'hsl(var(--muted-foreground))',
  // borders + soft shadow (mode-aware via the token vars)
  '--sjs-border-default': 'hsl(var(--border))',
  '--sjs-border-light': 'hsl(var(--border))',
  '--sjs-shadow-small': 'var(--shadow-small)',
  '--sjs-shadow-inner': 'var(--shadow-inner)',
};

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

  return (
    <div style={SURVEY_THEME_VARS}>
      <Survey model={survey} />
    </div>
  );
}
