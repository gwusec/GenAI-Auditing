import React, { useState, useEffect } from 'react';
// import { App as TrailsChatbot } from 'trails-ui-chatbot';
import TrailsChatbot from './trails-chatbot/App';
import LLMSelector from './components/LLMSelector';
import OllamaSetup from './components/OllamaSetup';
import WebLLMSetup from './components/WebLLMSetup';
import APIKeySetup from './components/APIKeySetup';
import SurveyMaker from './components/SurveyMaker';
import Debugger from './components/Debugger';
import db from './trails-chatbot/tools/db';

import './App.css';

// AppState Enum to manage flow
const AppState = {
  SURVEY_DESIGN: 'SURVEY_DESIGN',
  CHAT: 'CHAT',
  SURVEY_COMPLETE: 'SURVEY_COMPLETE'
};

function App() {
  // App Flow State
  const [appState, setAppState] = useState(AppState.SURVEY_DESIGN);
  const [surveyConfig, setSurveyConfig] = useState(null);

  // LLM backend configuration
  const [backend, setBackend] = useState('ollama'); // 'ollama', or 'api'
  const [showConfig, setShowConfig] = useState(true);
  const [configApplied, setConfigApplied] = useState(false);

  // Ollama config
  const [ollamaConfig, setOllamaConfig] = useState({
    url: 'http://localhost:11434',
    model: 'llama3.1',
    proxyUrl: 'http://localhost:3000'
  });

  // WebLLM config
  const [webLLMConfig, setWebLLMConfig] = useState({
    model: 'Llama-3-8B-Instruct',
    quantized: true
  });

  // API config
  const [apiConfig, setApiConfig] = useState({
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1'
  });

  // User ID for the chatbot (normally would come from auth)
  const [userId, setUserId] = useState(() => {
    const savedUserId = localStorage.getItem('chatbotUserId');
    return savedUserId || ('user-' + Math.random().toString(36).substring(2, 9));
  });

  // Handle backend selection change
  const handleBackendChange = (newBackend) => {
    console.log(`BACKEND CHANGED: ${backend} -> ${newBackend}`);
    setBackend(newBackend);
  };

  // Handle Survey Save/Start Chat
  const handleSurveySave = (surveyData) => {
    console.log('Survey saved:', surveyData);
    setSurveyConfig(surveyData);
    localStorage.setItem('surveyConfig', JSON.stringify(surveyData));

    // Generate a new User ID to ensure a fresh session
    const newUserId = 'user-' + Math.random().toString(36).substring(2, 9);
    setUserId(newUserId);
    localStorage.setItem('chatbotUserId', newUserId);
    console.log('Starting new session with UserID:', newUserId);

    // Ensure configuration is applied (using defaults if not set)
    if (!configApplied) {
      // Save default config to storage so it persists on reload
      const config = {
        backend,
        ollama: ollamaConfig,
        webllm: webLLMConfig,
        api: apiConfig
      };
      localStorage.setItem('llmConfig', JSON.stringify(config));
      setConfigApplied(true);
    }

    // Transition to Chat
    setAppState(AppState.CHAT);
  };

  // Load saved configuration on mount
  useEffect(() => {
    // Load LLM Config
    const savedConfig = localStorage.getItem('llmConfig');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      console.log('LOADING SAVED CONFIG:', config);

      if (config.backend) {
        console.log(`SETTING BACKEND FROM STORAGE: ${config.backend}`);
        setBackend(config.backend);
      }
      if (config.ollama) setOllamaConfig(config.ollama);
      if (config.webllm) setWebLLMConfig(config.webllm);
      if (config.api) setApiConfig(config.api);

      // Auto-apply saved config if it exists
      setConfigApplied(true);
    }

    // Load Survey Config
    const savedSurvey = localStorage.getItem('surveyConfig');
    if (savedSurvey) {
      try {
        setSurveyConfig(JSON.parse(savedSurvey));

        // If we have both configs, and a user ID from a previous run, assume they are resuming an active chat
        if (savedConfig && localStorage.getItem('chatbotUserId')) {
          console.log("Found existing configs and userId, resuming chat phase directly.");
          setAppState(AppState.CHAT);
        }
      } catch (e) {
        console.error('Failed to parse saved survey config', e);
      }
    }
  }, []);

  // Handle configuration save
  const saveConfig = () => {
    console.log(`SAVING CONFIGURATION - Selected Backend: ${backend}`);

    // ... log configs ...

    const config = {
      backend,
      ollama: ollamaConfig,
      webllm: webLLMConfig,
      api: apiConfig
    };
    localStorage.setItem('llmConfig', JSON.stringify(config));
    setConfigApplied(true);
    setShowConfig(false);
  };



  // Handle audit completion event
  const handleAuditFinished = (event) => {
    console.log('Audit finished:', event.detail);

    // Display consent dialog for data collection (implementation placeholder)
    const consentToShare = window.confirm(
      "Would you be willing to share your audit data with the developers to improve the system? " +
      "No personal information will be shared, only the conversation and audit responses."
    );

    if (consentToShare) {
      console.log("User consented to share data.");
    } else {
      console.log("User declined to share data.");
    }

    setAppState(AppState.SURVEY_COMPLETE);
  };

  // Set up event listener for audit completion
  useEffect(() => {
    document.addEventListener('trails-chatbot:audit-finished', handleAuditFinished);
    return () => {
      document.removeEventListener('trails-chatbot:audit-finished', handleAuditFinished);
    };
  }, []);

  // Get the proxy URL based on current backend
  // In production the React app is served by the same Express server,
  // so we use a relative base URL (empty string = same origin).
  // In development, proxy to the local Express server.
  const getProxyUrl = () => {
    if (process.env.NODE_ENV === 'production') {
      return '';
    }
    if (backend === 'ollama') {
      return ollamaConfig.proxyUrl || 'http://localhost:3000';
    }
    return 'http://localhost:3000';
  };

  const getRelayConfig = () => {
    if (backend === 'api') {
      return {
        backend: 'api',
        provider: apiConfig.provider,
        apiKey: apiConfig.apiKey,
        model: apiConfig.model,
        baseUrl: apiConfig.baseUrl
      };
    }

    return {
      backend: 'ollama',
      ollamaUrl: ollamaConfig.url,
      ollamaModel: ollamaConfig.model
    };
  };

  return (
    <div className="app-container">
      <header>
        <h1>Chatbot</h1>
        {appState === AppState.SURVEY_DESIGN && (
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="config-toggle"
          >
            {showConfig ? 'Hide' : 'Show'} Backend Settings
          </button>
        )}
        {appState === AppState.CHAT && (
          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to completely restart? This will erase the current chat history.")) {
                window.__isRestarting = true;
                localStorage.removeItem('chatbotUserId');
                localStorage.removeItem('chatTimerState');
                db.resetDatabase().then(() => {
                  window.location.reload();
                });
              }
            }}
            className="config-toggle"
            style={{ marginLeft: '10px' }}
          >
            Restart
          </button>
        )}
      </header>

      {/* Configuration Panel - Only visible in Survey Design mode if toggled */}
      {appState === AppState.SURVEY_DESIGN && showConfig && (
        <div className="config-panel">
          <h3>Backend Settings</h3>

          <LLMSelector
            backend={backend}
            setBackend={handleBackendChange}
          />

          {backend === 'ollama' && (
            <OllamaSetup
              config={ollamaConfig}
              setConfig={setOllamaConfig}
            />
          )}

          {backend === 'webllm' && (
            <WebLLMSetup
              config={webLLMConfig}
              setConfig={setWebLLMConfig}
            />
          )}

          {backend === 'api' && (
            <APIKeySetup
              config={apiConfig}
              setConfig={setApiConfig}
            />
          )}

          <button onClick={saveConfig} className="save-button">
            Save Configuration
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="main-content">
        {appState === AppState.SURVEY_DESIGN && (
          <>
            <SurveyMaker
              onSurveySave={handleSurveySave}
              initialSurvey={surveyConfig}
            />
            <Debugger />
          </>
        )}

        {appState === AppState.CHAT && configApplied && (
          <div className="chatbot-container">
            <TrailsChatbot
              key={userId}
              userId={userId}
              llmProxyServerUrl={getProxyUrl()}
              debugMode={false}
              config={{
                timerMaxOverallChatTimeSeconds: 30 * 60,
                timerChatsMaxSeconds: [7 * 60, 7 * 60],
                timerWarningChatTimeIsUpSeconds: 2 * 60,
                timerMinChatTimeRemainingToStartNewChatSeconds: 3 * 60,
                llmRelay: getRelayConfig()
              }}
              initialSurvey={surveyConfig}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;