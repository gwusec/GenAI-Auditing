import AuditLayout from "../layouts/AuditLayout";
import React from "react";

function AuditPage(
    { // take these from App.jsx
        activeConversation,
        handleAuditComplete,
        setIsLoading,
        handleTutorialComplete,
        surveyQuestions
    }
) {
    return (
        <AuditLayout {...{
            activeConversation,
            handleAuditComplete,
            setIsLoading,
            handleTutorialComplete,
            surveyQuestions
        }} />
    )
}

export default AuditPage;