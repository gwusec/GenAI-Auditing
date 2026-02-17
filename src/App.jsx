import React, { useState, useEffect } from 'react';
// import { App as TrailsChatbot } from 'trails-ui-chatbot';
import TrailsChatbot from './trails-chatbot/App';
import LLMSelector from './components/LLMSelector';
import OllamaSetup from './components/OllamaSetup';
import WebLLMSetup from './components/WebLLMSetup';
import APIKeySetup from './components/APIKeySetup';
import SurveyMaker from './components/SurveyMaker';
import Debugger from './components/Debugger';

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
  const [configSyncedWithServer, setConfigSyncedWithServer] = useState(false);

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
  const [userId, setUserId] = useState('user-' + Math.random().toString(36).substring(2, 9));

  // Handle backend selection change
  const handleBackendChange = (newBackend) => {
    console.log(`BACKEND CHANGED: ${backend} -> ${newBackend}`);
    setBackend(newBackend);
    // Reset config sync status when backend changes
    setConfigSyncedWithServer(false);
  };

  // Handle Survey Save/Start Chat
  const handleSurveySave = (surveyData) => {
    console.log('Survey saved:', surveyData);
    setSurveyConfig(surveyData);
    localStorage.setItem('surveyConfig', JSON.stringify(surveyData));

    // Generate a new User ID to ensure a fresh session
    const newUserId = 'user-' + Math.random().toString(36).substring(2, 9);
    setUserId(newUserId);
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
      } catch (e) {
        console.error('Failed to parse saved survey config', e);
      }
    }
  }, []);

  // Sync configuration with server when applied
  useEffect(() => {
    if (configApplied && !configSyncedWithServer) {
      // Get the current configuration based on selected backend
      let currentConfig;

      switch (backend) {
        case 'ollama':
          currentConfig = ollamaConfig;
          break;
        case 'webllm':
          currentConfig = webLLMConfig;
          break;
        case 'api':
          currentConfig = apiConfig;
          break;
        default:
          console.error('Unknown backend:', backend);
          return;
      }

      console.log(`SYNCING CONFIGURATION WITH SERVER - Backend: ${backend}`);

      // Send the configuration to the server
      fetch('/api/set-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: userId,
          backend: backend,
          config: currentConfig
        })
      })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            console.log('CONFIGURATION SYNCED WITH SERVER SUCCESSFULLY');
            setConfigSyncedWithServer(true);
          } else {
            console.error('FAILED TO SYNC CONFIGURATION WITH SERVER', data.error);
          }
        })
        .catch(error => {
          console.error('ERROR SYNCING CONFIGURATION WITH SERVER', error);
        });
    }
  }, [configApplied, configSyncedWithServer, backend, ollamaConfig, webLLMConfig, apiConfig, userId]);

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
    // Reset config sync status to trigger a new sync
    setConfigSyncedWithServer(false);
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
  const getProxyUrl = () => {
    if (backend === 'ollama') {
      return ollamaConfig.proxyUrl;
    } else if (backend === 'api') {
      return 'http://localhost:3000';
    }
    return 'http://localhost:3000';
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
              window.location.reload();
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
                timerMinChatTimeRemainingToStartNewChatSeconds: 3 * 60
              }}
              initialSurvey={surveyConfig}
            />



            {configApplied && !configSyncedWithServer && (
              <div className="sync-status">
                Syncing configuration...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;