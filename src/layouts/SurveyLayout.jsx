import Debugger from "../components/Debugger";
import SurveyMaker from "../components/SurveyMaker/SurveyMaker";
import { Alert, CssBaseline } from "@mui/material";
import ErrorDialog from "../components/ErrorDialog";

function SurveyLayout({
    isViewOnly = false,
    debugMode = false,
    setCurrentAppState,
    setSurveyQuestions,
    error,
    setError,
    showAPIErrorDialog,
    handleCloseErrorDialog,
    handleSurveySave
}) {
    return (
        <>
            {debugMode && <Debugger/>}
            {!isViewOnly && (
                <SurveyMaker onSurveySave={handleSurveySave} />
            )}
            <CssBaseline />
            {error && (
                <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            <ErrorDialog
                open={showAPIErrorDialog}
                onClose={handleCloseErrorDialog}
                title="Your chat is too long!"
                message="You cannot continue your chat with the AI chatbot, because your conversation is getting too long. Please end the current conversation by clicking 'End Conversation & Start Reporting'."
            />
        </>
    )
}

export default SurveyLayout;