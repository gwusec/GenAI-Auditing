import React, { useState, useEffect } from 'react';
import { App as TrailsChatbot } from 'trails-ui-chatbot';

// Configuration panel for Ollama settings
function ConfigPanel({ 
    ollamaUrl, 
    setOllamaUrl, 
    ollamaModel, 
    setOllamaModel, 
    proxyUrl, 
    setProxyUrl, 
    onSaveConfig 
  }) {
    const [availableModels, setAvailableModels] = useState([]);
    const [connectionStatus, setConnectionStatus] = useState('unknown');
    
    useEffect(() => {
      checkOllamaConnection();
    }, []);
    
    const checkOllamaConnection = async () => {
      setConnectionStatus('checking');
      try {
        // Check if Ollama is available
        const response = await fetch(`${ollamaUrl}/api/tags`);
        if (!response.ok) {
          throw new Error('Failed to connect to Ollama');
        }
        
        const data = await response.json();
        setConnectionStatus('connected');
        
        // Update model list
        if (data.models && data.models.length > 0) {
          setAvailableModels(data.models.map(model => ({
            name: model.name,
            value: model.name
          })));
        }
      } catch (error) {
        console.error('Error connecting to Ollama:', error);
        setConnectionStatus('disconnected');
      }
    };
    
    return (
      <div className="config-panel">
        <h3>Local LLM Configuration</h3>
        <div className="settings-form">
          <div className="form-group">
            <label htmlFor="ollamaUrl">Ollama URL:</label>
            <input
              type="text"
              id="ollamaUrl"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="proxyUrl">Proxy URL:</label>
            <input
              type="text"
              id="proxyUrl"
              value={proxyUrl}
              onChange={(e) => setProxyUrl(e.target.value)}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="ollamaModel">Model:</label>
            <select
              id="ollamaModel"
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
            >
              {availableModels.length > 0 ? (
                availableModels.map(model => (
                  <option key={model.value} value={model.value}>
                    {model.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="llama3">llama3</option>
                  <option value="llama2">llama2</option>
                  <option value="mistral">mistral</option>
                  <option value="gemma:2b">gemma:2b</option>
                </>
              )}
            </select>
          </div>
          
          <div className="connection-status">
            Status: 
            <span className={`status-indicator ${connectionStatus}`}>
              {connectionStatus === 'connected' ? 'Connected' : 
               connectionStatus === 'disconnected' ? 'Not Connected' : 'Checking...'}
            </span>
            <button onClick={checkOllamaConnection} className="check-button">
              Check Connection
            </button>
          </div>
          
          <button onClick={onSaveConfig} className="save-button">
            Save Configuration
          </button>
        </div>
      </div>
    );
  }
  
  // Main application component
  function App() {
    // Configuration state
    const [showConfig, setShowConfig] = useState(false);
    const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
    const [ollamaModel, setOllamaModel] = useState('llama3');
    const [proxyUrl, setProxyUrl] = useState('http://localhost:3000');
    
    // Configuration has been applied and we're ready to show the chatbot
    const [configApplied, setConfigApplied] = useState(false);
    
    // User ID for the chatbot (normally would come from auth)
    const [userId] = useState('local-user-' + Math.random().toString(36).substring(2, 9));
    
    // Load saved configuration on mount
    useEffect(() => {
      const savedConfig = localStorage.getItem('localLlmConfig');
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        setOllamaUrl(config.ollamaUrl || ollamaUrl);
        setOllamaModel(config.ollamaModel || ollamaModel);
        setProxyUrl(config.proxyUrl || proxyUrl);
        
        // Auto-apply saved config
        setConfigApplied(true);
      }
    }, []);
    
    // Handle configuration save
    const saveConfig = () => {
      const config = {
        ollamaUrl,
        ollamaModel,
        proxyUrl
      };
      localStorage.setItem('localLlmConfig', JSON.stringify(config));
      setConfigApplied(true);
      setShowConfig(false);
    };
    
    // Handle audit completion event
    const handleAuditFinished = (event) => {
      console.log('Audit finished:', event.detail);
      // You can implement additional logic here if needed
    };
    
    // Set up event listener for audit completion
    useEffect(() => {
      document.addEventListener('trails-chatbot:audit-finished', handleAuditFinished);
      return () => {
        document.removeEventListener('trails-chatbot:audit-finished', handleAuditFinished);
      };
    }, []);
    
    return (
      <div className="app-container">
        <header>
          <h1>TRAILS Chatbot with Local LLM</h1>
          <button 
            onClick={() => setShowConfig(!showConfig)} 
            className="config-toggle"
          >
            {showConfig ? 'Hide' : 'Show'} Configuration
          </button>
        </header>
        
        {showConfig && (
          <ConfigPanel
            ollamaUrl={ollamaUrl}
            setOllamaUrl={setOllamaUrl}
            ollamaModel={ollamaModel}
            setOllamaModel={setOllamaModel}
            proxyUrl={proxyUrl}
            setProxyUrl={setProxyUrl}
            onSaveConfig={saveConfig}
          />
        )}
        
        {configApplied && (
          <div className="chatbot-container">
            <TrailsChatbot
              userId={userId}
              llmProxyServerUrl={proxyUrl}
              debugMode={false}
              config={{
                timerMaxOverallChatTimeSeconds: 30 * 60, // 30 minutes
                timerChatsMaxSeconds: [7 * 60, 7 * 60],  // 7 minutes each
                timerWarningChatTimeIsUpSeconds: 2 * 60,  // 2 min warning
                timerMinChatTimeRemainingToStartNewChatSeconds: 3 * 60 // 3 min min
              }}
            />
          </div>
        )}
        
        {!configApplied && !showConfig && (
          <div className="config-prompt">
            <p>Please configure your local LLM settings to continue.</p>
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