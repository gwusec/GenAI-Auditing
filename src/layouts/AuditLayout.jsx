import AuditForm from "../components/AuditForm";

function AuditLayout({
    activeConversation,
    handleAuditComplete,
    setIsLoading,
    handleTutorialComplete,
    surveyQuestions
}) {
    return (
        <>
            {activeConversation && (
                <AuditForm
                    conversationId={activeConversation.id}
                    onAuditComplete={handleAuditComplete}
                    setLoading={setIsLoading}
                    onTutorialComplete={handleTutorialComplete}
                    surveyQuestions={surveyQuestions}
                />
            )}
        </>
    )
}

export default AuditLayout;