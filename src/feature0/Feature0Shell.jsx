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
import { Button } from '../components/ui/button';
import { Logout as LogoutIcon } from '../components/ui/icons';
import App from '../App';
import { Feature0Provider, useFeature0, DEFAULT_QUESTIONNAIRE } from './Feature0Context';
import Feature0Gate from './Feature0Gate';
import ConsentGate from './ConsentGate';
import StudyDashboard from './StudyDashboard';
import { getConversationStore } from '../tools/stores';
import { deriveRuntimeConfig } from '../tools/studyConfig';

export function resolveStudyRuntimeConfig({ base, studyConfig, previewMode }) {
  try {
    return { ...base, ...deriveRuntimeConfig(studyConfig) };
  } catch (err) {
    if (!previewMode) {
      console.error('Feature0Shell: refusing to start an auditor with an invalid study config.', err);
      return { ...base, __configError: true };
    }
    console.warn('Feature0Shell: preview config failed strict validation; deriving leniently for investigator preview.', err);
    try {
      return { ...base, ...deriveRuntimeConfig(studyConfig, { strict: false }) };
    } catch (err2) {
      console.error('Feature0Shell: lenient preview config derivation failed.', err2);
      return { ...base, __configError: true };
    }
  }
}

// Small floating control to leave an audit session (demo / preview / auditor).
function ExitBar({ label, onExit }) {
  return (
    <Button
      onClick={onExit}
      size="sm"
      className="fixed right-3 top-3 z-[2000] bg-black/70 text-white hover:bg-black/85"
    >
      <LogoutIcon />
      {label}
    </Button>
  );
}

function ShellInner({ appProps = {} }) {
  const {
    user, activeStudyId, activeStudy, demoMode, previewMode, exitStudy,
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
    return resolveStudyRuntimeConfig({
      base,
      studyConfig: activeStudy?.config,
      previewMode,
    });
  }, [activeStudyId, activeStudy, appProps.config, previewMode]);

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
    if (studyRuntimeConfig?.__configError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
          <section className="w-full max-w-lg rounded-xl border bg-card p-6 text-center shadow-sm">
            <h1 className="text-xl font-semibold">Study temporarily unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This study configuration is invalid. Please contact the investigator before continuing.
            </p>
            <Button className="mt-5" onClick={exitStudy}>Exit study</Button>
          </section>
        </main>
      );
    }
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
