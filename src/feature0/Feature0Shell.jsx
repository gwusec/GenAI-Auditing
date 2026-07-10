// Feature0Shell — the Feature 0 entry point. Routes between:
//   - public demo (no account/code, local + ephemeral)
//   - auditor in a study (joined via code) -> audit App with the study's questionnaire
//   - investigator previewing their own study -> same audit App
//   - signed-in investigator -> study dashboard
//   - everyone else -> gate (login / join / demo)
//
// OPT-IN: the standalone app only mounts this when REACT_APP_FEATURE0 is enabled
// (see src/index.js); otherwise it renders the plain <App>, unchanged.

import React, { useEffect, useMemo } from 'react';
import { Box, Button } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import App from '../App';
import { Feature0Provider, useFeature0, DEFAULT_QUESTIONNAIRE } from './Feature0Context';
import Feature0Gate from './Feature0Gate';
import ConsentGate from './ConsentGate';
import StudyDashboard from './StudyDashboard';
import { getConversationStore } from '../tools/stores';
import { deriveRuntimeConfig } from '../tools/studyConfig';

// Small floating control to leave an audit session (demo / preview / auditor).
function ExitBar({ label, onExit }) {
  return (
    <Button
      onClick={onExit}
      variant="contained"
      color="inherit"
      size="small"
      startIcon={<LogoutIcon />}
      sx={{
        position: 'fixed', top: 12, right: 12, zIndex: 2000,
        bgcolor: 'rgba(0,0,0,0.7)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.85)' },
      }}
    >
      {label}
    </Button>
  );
}

function ShellInner({ appProps = {} }) {
  const {
    user, activeStudyId, activeStudy, demoMode, exitStudy,
    consentAgreed, recordConsent, attachConversation, completeConversation,
  } = useFeature0();

  // Derive the runtime config the audit app consumes (timers, control mode, model,
  // evaluation toggles, provenance) from the active study's StudyConfig. Falls back
  // to the base config if the study config is invalid/legacy (e.g. previewing an
  // incomplete draft). The relay (`llmRelay`) is kept from appProps — provider
  // routing from the model block lands in Phase D.
  const studyRuntimeConfig = useMemo(() => {
    if (!activeStudyId) return null;
    const base = { ...(appProps.config || {}), studyId: activeStudyId };
    try {
      return { ...base, ...deriveRuntimeConfig(activeStudy?.config) };
    } catch (_) {
      return base;
    }
  }, [activeStudyId, activeStudy, appProps.config]);

  // Tag the persistence store with the active study so conversations are scoped
  // to it (required by Supabase; ignored by local/demo storage).
  useEffect(() => {
    if (activeStudyId) {
      try { getConversationStore().studyId = activeStudyId; } catch (_) { /* noop */ }
    }
  }, [activeStudyId]);

  // 0) Public demo — ephemeral, no backend, built-in questionnaire.
  if (demoMode) {
    return (
      <>
        <ExitBar label="Exit demo" onExit={exitStudy} />
        <App {...appProps} userId="demo-guest" presetSurveyQuestions={DEFAULT_QUESTIONNAIRE} />
      </>
    );
  }

  // 1) In a study (auditor who joined, or investigator previewing).
  if (activeStudyId && user) {
    // Consent gate: when the study configures consent text, the auditor must agree
    // before reaching the chat. Recorded on the session as {version, agreed, timestamp}.
    const consent = studyRuntimeConfig?.consent;
    if (consent?.text && !consentAgreed) {
      return (
        <>
          <ExitBar label="Exit" onExit={exitStudy} />
          <ConsentGate
            text={consent.text}
            version={consent.version}
            onAgree={(v) => recordConsent(v)}
            onDecline={exitStudy}
          />
        </>
      );
    }

    // The investigator configured the questionnaire — the auditor must NEVER see the
    // legacy in-app survey builder. Pass a non-null preset so App skips the SURVEY
    // state and goes straight to chat. The new AuditFlow reads the SurveyJS schema
    // from config (via AppConfig); this legacy value is only used by the legacy
    // AuditForm fallback.
    const preset = activeStudy?.config?.surveyQuestions || { questions: [] };
    return (
      <>
        <ExitBar label="Exit" onExit={exitStudy} />
        <App
          {...appProps}
          userId={user.id}
          presetSurveyQuestions={preset}
          config={studyRuntimeConfig}
          onConversationStart={attachConversation}
          onConversationComplete={completeConversation}
        />
      </>
    );
  }

  // 2) Signed-in, permanent account -> investigator dashboard.
  if (user && !user.isAnonymous) {
    return <StudyDashboard />;
  }

  // 3) Otherwise -> gate.
  return <Feature0Gate />;
}

export default function Feature0Shell({ appProps }) {
  return (
    <Feature0Provider>
      <ShellInner appProps={appProps} />
    </Feature0Provider>
  );
}
