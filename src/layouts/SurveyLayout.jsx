import Debugger from "../components/Debugger";
import SurveyMaker from "../components/SurveyMaker/SurveyMaker";
import { Alert } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Close } from "../components/ui/icons";
import ErrorDialog from "../components/ErrorDialog";

function SurveyLayout({
    isViewOnly = false,
    debugMode = false,
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
            {error && (
                <Alert variant="destructive" className="mb-4 pr-10">
                    {error}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1 h-7 w-7"
                        onClick={() => setError(null)}
                        aria-label="Close"
                    >
                        <Close />
                    </Button>
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
