// Questionnaire — renders the post-conversation questionnaire from SurveyJS JSON via
// the MIT Form Library (Phase C step 3; SC-7 / EVAL-2). The native response object is
// captured on completion (keyed to the conversation by the caller) and on each change
// so progress can be persisted for resume (AUD-8).

import React, { useMemo, useEffect } from 'react';
import { Model } from 'survey-core';
import { Survey } from 'survey-react-ui';
import { useTheme, alpha } from '@mui/material/styles';
import 'survey-core/survey-core.min.css';

// Bridge the MUI theme onto SurveyJS's CSS custom properties so the questionnaire
// inherits our accent, surfaces, typography, and light/dark mode instead of
// rendering in SurveyJS's stock blue-on-white (which looks bolted-on). SurveyJS v2
// reads these `--sjs-*` variables; setting them on a wrapper cascades to the form.
function surveyThemeVars(theme) {
  const p = theme.palette;
  return {
    '--sjs-font-family': theme.typography.fontFamily,
    '--sjs-corner-radius': '10px',
    '--sjs-base-unit': '8px',
    // accent
    '--sjs-primary-backcolor': p.primary.main,
    '--sjs-primary-backcolor-light': alpha(p.primary.main, 0.12),
    '--sjs-primary-backcolor-dark': p.primary.dark,
    '--sjs-primary-forecolor': p.primary.contrastText,
    '--sjs-primary-forecolor-light': p.primary.contrastText,
    // surfaces (question cards vs. page)
    '--sjs-general-backcolor': p.background.paper,
    '--sjs-general-backcolor-dim': p.background.default,
    '--sjs-general-backcolor-dim-light': p.background.paper,
    '--sjs-general-backcolor-dim-dark': p.background.default,
    // text
    '--sjs-general-forecolor': p.text.primary,
    '--sjs-general-forecolor-light': p.text.secondary,
    '--sjs-general-dim-forecolor': p.text.primary,
    '--sjs-general-dim-forecolor-light': p.text.secondary,
    // borders + soft shadow tuned to the mode
    '--sjs-border-default': p.divider,
    '--sjs-border-light': p.divider,
    '--sjs-shadow-small': `0 1px 2px ${alpha('#0f172a', p.mode === 'dark' ? 0.5 : 0.08)}`,
    '--sjs-shadow-inner': `inset 0 1px 2px ${alpha('#0f172a', p.mode === 'dark' ? 0.5 : 0.08)}`,
  };
}

export default function Questionnaire({
  schema,
  data = null,
  onComplete = () => {},
  onChange = () => {},
}) {
  const theme = useTheme();
  const themeVars = useMemo(() => surveyThemeVars(theme), [theme]);

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
    <div style={themeVars}>
      <Survey model={survey} />
    </div>
  );
}
