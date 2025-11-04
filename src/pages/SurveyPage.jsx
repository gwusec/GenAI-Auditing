
import React from "react";
import {AppState} from "../App";
import SurveyLayout from "../layouts/SurveyLayout";

function SurveyPage(
    {
        isViewOnly = false,
        debugMode = false,
        setCurrentAppState,
        setSurveyQuestions,
        error,
        setError,
        showAPIErrorDialog,
        handleCloseErrorDialog
    }
) {
    const handleSurveySave = (survey) => {
        setSurveyQuestions(survey);
        setCurrentAppState(AppState.CHAT);
    };

    return (
        <SurveyLayout {...{
            isViewOnly,
            debugMode,
            setCurrentAppState,
            setSurveyQuestions,
            error,
            setError,
            showAPIErrorDialog,
            handleCloseErrorDialog,
            handleSurveySave
        }} />
    )
}

export default SurveyPage;