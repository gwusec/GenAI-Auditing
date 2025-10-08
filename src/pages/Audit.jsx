import AuditForm from "../components/AuditForm";
import React from "react";

function Audit(
    {
        activeConversation,
        handleAuditComplete,
        setIsLoading,
        handleTutorialComplete,
        surveyQuestions
    }
) {
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

export default Audit;