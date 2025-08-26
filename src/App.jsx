import React, { useState, useEffect } from 'react';
import { App as TrailsChatbot } from 'trails-ui-chatbot';
import LLMSelector from './components/LLMSelector';
import OllamaSetup from './components/OllamaSetup';
import WebLLMSetup from './components/WebLLMSetup';
import APIKeySetup from './components/APIKeySetup';
import BackendStatus from './components/BackendStatus';
import './App.css';

function App() {
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
  const [userId] = useState('user-' + Math.random().toString(36).substring(2, 9));
  
  // Handle backend selection change
  const handleBackendChange = (newBackend) => {
    console.log(`BACKEND CHANGED: ${backend} -> ${newBackend}`);
    setBackend(newBackend);
    // Reset config sync status when backend changes
    setConfigSyncedWithServer(false);
  };
  
  // Load saved configuration on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('llmConfig');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      console.log('LOADING SAVED CONFIG:', config);
      
      if (config.backend) {
        console.log(`SETTING BACKEND FROM STORAGE: ${config.backend}`);
        setBackend(config.backend);
      }
      if (config.ollama) {
        setOllamaConfig(config.ollama);
      }
      if (config.webllm) {
        setWebLLMConfig(config.webllm);
      }
      if (config.api) {
        setApiConfig(config.api);
      }
      
      // Auto-apply saved config if it exists
      setConfigApplied(true);
      setShowConfig(false);
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
    
    if (backend === 'api') {
      console.log('API CONFIG:', apiConfig);
    } else if (backend === 'ollama') {
      console.log('OLLAMA CONFIG:', ollamaConfig);
    } else if (backend === 'webllm') {
      console.log('WEBLLM CONFIG:', webLLMConfig);
    }
    
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
      console.log("User consented to share data. This would send data to a server in a real implementation.");
      // Here you would implement the data sharing functionality
    } else {
      console.log("User declined to share data.");
    }
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
      // Return the full proxy URL - IMPORTANT: no /api prefix for Ollama
      return ollamaConfig.proxyUrl;
    } else if (backend === 'api') {
      // For API keys, return the absolute URL to our server
      return 'http://localhost:3000';
    }
    // For WebLLM, return the absolute URL to our server
    return 'http://localhost:3000';
  };

  // Get the current backend configuration
  const getCurrentConfig = () => {
    switch(backend) {
      case 'ollama': return ollamaConfig;
      case 'webllm': return webLLMConfig;
      case 'api': return apiConfig;
      default: return {};
    }
  };

return (
  <div className="app-container">
    <header>
      <h1>Chatbot</h1>
      <button 
        onClick={() => {
          console.log('Settings button clicked. Current showConfig:', showConfig);
          setShowConfig(!showConfig);
        }} 
        className="config-toggle"
      >
        {showConfig ? 'Hide' : 'Show'} Settings
      </button>
    </header>
    
    {showConfig && (
      <div className="config-panel">
        <h3>Chatbot Settings</h3>
        
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
    
    {/* Only show chatbot if config is applied AND settings panel is hidden */}
    {configApplied && !showConfig && (
      <div className="chatbot-container">
        <TrailsChatbot
          userId={userId}
          llmProxyServerUrl={getProxyUrl()}
          debugMode={false}
          config={{
            timerMaxOverallChatTimeSeconds: 30 * 60,
            timerChatsMaxSeconds: [7 * 60, 7 * 60],
            timerWarningChatTimeIsUpSeconds: 2 * 60,
            timerMinChatTimeRemainingToStartNewChatSeconds: 3 * 60
          }}
        />
        
        {/* <BackendStatus 
          backend={backend} 
          config={getCurrentConfig()} 
        /> */}
        
        {configApplied && !configSyncedWithServer && (
          <div style={{
            position: 'fixed',
            top: '70px',
            right: '10px',
            backgroundColor: '#fff3cd',
            color: '#856404',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '0.8rem',
            zIndex: 1000,
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            pointerEvents: 'none'
          }}>
            Syncing configuration...
          </div>
        )}
      </div>
    )}
    
    {/* Show prompt if no config and settings panel is hidden */}
    {!configApplied && !showConfig && (
      <div className="config-prompt">
        <p>Please configure your LLM settings to continue.</p>
        <button 
          onClick={() => setShowConfig(true)} 
          className="config-button"
        >
          Configure
        </button>
      </div>
    )}
  </div>
);
}

export default App;