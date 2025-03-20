import React, { useState, useEffect } from 'react';
import { App as TrailsChatbot } from 'trails-ui-chatbot';
import LLMSelector from './components/LLMSelector';
import OllamaSetup from './components/OllamaSetup';
import WebLLMSetup from './components/WebLLMSetup';
import './App.css';

function App() {
  // LLM backend configuration
  const [backend, setBackend] = useState('ollama'); // 'ollama', 'webllm'
  const [showConfig, setShowConfig] = useState(true);
  const [configApplied, setConfigApplied] = useState(false);
  
  // Ollama config
  const [ollamaConfig, setOllamaConfig] = useState({
    url: 'http://localhost:11434',
    model: 'llama3',
    proxyUrl: 'http://localhost:3000'
  });
  
  // WebLLM config
  const [webLLMConfig, setWebLLMConfig] = useState({
    model: 'Llama-3-8B-Instruct',
    quantized: true
  });
  
  // User ID for the chatbot (normally would come from auth)
  const [userId] = useState('user-' + Math.random().toString(36).substring(2, 9));
  
  // Load saved configuration on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('llmConfig');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      if (config.backend) {
        setBackend(config.backend);
      }
      if (config.ollama) {
        setOllamaConfig(config.ollama);
      }
      if (config.webllm) {
        setWebLLMConfig(config.webllm);
      }
      
      // Auto-apply saved config if it exists
      setConfigApplied(true);
      setShowConfig(false);
    }
  }, []);
  
  // Handle configuration save
  const saveConfig = () => {
    const config = {
      backend,
      ollama: ollamaConfig,
      webllm: webLLMConfig
    };
    localStorage.setItem('llmConfig', JSON.stringify(config));
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
  
  // Get the proxy URL based on current backend
  const getProxyUrl = () => {
    if (backend === 'ollama') {
      return ollamaConfig.proxyUrl;
    }
    // For WebLLM, we'll use a relative path as it's client-side
    return '/api';
  };

  return (
    <div className="app-container">
      <header>
        <h1>TRAILS Chatbot</h1>
        <button 
          onClick={() => setShowConfig(!showConfig)} 
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
            setBackend={setBackend} 
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
          
          <button onClick={saveConfig} className="save-button">
            Save Configuration
          </button>
        </div>
      )}
      
      {configApplied && (
        <div className="chatbot-container">
          <TrailsChatbot
            userId={userId}
            llmProxyServerUrl={getProxyUrl()}
            debugMode={false}
            config={{
              timerMaxOverallChatTimeSeconds: 30 * 60, // 30 minutes total
              timerChatsMaxSeconds: [7 * 60, 7 * 60],  // 7 minutes per chat
              timerWarningChatTimeIsUpSeconds: 2 * 60,  // 2 min warning
              timerMinChatTimeRemainingToStartNewChatSeconds: 3 * 60 // 3 min minimum
            }}
          />
        </div>
      )}
      
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