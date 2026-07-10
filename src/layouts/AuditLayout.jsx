import AuditForm from "../components/AuditForm/AuditForm";
import AuditFlow from "../components/AuditFlow/AuditFlow";
import AppConfig from "../tools/AppConfig";

function AuditLayout({
    activeConversation,
    handleAuditComplete,
    setIsLoading,
    handleTutorialComplete,
    surveyQuestions
}) {
    // For a configured study (has `evaluation`), use the new config-driven AuditFlow
    // (span highlighting → questionnaire per the audit plan); otherwise fall back to
    // the legacy AuditForm.
    const cfg = (AppConfig.getAll().config) || {};
    const useNewFlow = Boolean(cfg.evaluation);

    return (
        <>
            {activeConversation && (
                useNewFlow ? (
                    <AuditFlow
                        conversationId={activeConversation.id}
                        onAuditComplete={handleAuditComplete}
                        setLoading={setIsLoading}
                    />
                ) : (
                    <AuditForm
                        conversationId={activeConversation.id}
                        onAuditComplete={handleAuditComplete}
                        setLoading={setIsLoading}
                        onTutorialComplete={handleTutorialComplete}
                        surveyQuestions={surveyQuestions}
                    />
                )
            )}
        </>
    )
}

export default AuditLayout;
