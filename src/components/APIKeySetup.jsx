import React, { useState, useEffect } from 'react';
import './APIKeySetup.css';

// List of available API providers
const API_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', logo: '/openai-logo.png', fallbackLogo: 'https://openai.com/content/images/2022/05/openai-logo-1.svg' },
  { id: 'anthropic', name: 'Anthropic', logo: '/anthropic-logo.png', fallbackLogo: 'https://assets-global.website-files.com/62a295c7120a7e4c6220712a/62a2b61930dc1b42a9ee1ad2_Logo%20Icon%20for%20Favicon.svg' },
  { id: 'cohere', name: 'Cohere', logo: '/cohere-logo.png', fallbackLogo: 'https://cohere.com/favicon/favicon.ico' },
  { id: 'gemini', name: 'Google Gemini', logo: '/gemini-logo.png', fallbackLogo: 'https://gemini.google.com/favicon.ico' }
];

// List of available models per provider
const PROVIDER_MODELS = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'gpt-4', name: 'GPT-4' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
  ],
  anthropic: [
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
    { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
    { id: 'claude-2.1', name: 'Claude 2.1' }
  ],
  cohere: [
    { id: 'command-r-plus', name: 'Command R+' },
    { id: 'command-r', name: 'Command R' },
    { id: 'command', name: 'Command' }
  ],
  gemini: [
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro' }
  ]
};

// API base URLs
const API_BASE_URLS = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  cohere: 'https://api.cohere.ai/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta'
};

function APIKeySetup({ config, setConfig }) {
  const [testStatus, setTestStatus] = useState(null);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  
  // Log when the component receives updated config props
  useEffect(() => {
    console.log('API_SETUP: Current config:', {
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey ? `***${config.apiKey.slice(-4)}` : 'undefined'
    });
  }, [config]);
  
  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    console.log(`API_SETUP: Field "${name}" changed to "${name === 'apiKey' ? '***' : value}"`);
    
    if (name === 'provider') {
      // When provider changes, update the model to the first available model
      const newProvider = value;
      const firstModel = PROVIDER_MODELS[newProvider]?.[0]?.id || '';
      const baseUrl = API_BASE_URLS[newProvider] || '';
      
      console.log(`API_SETUP: Provider changed to "${newProvider}"`);
      console.log(`API_SETUP: Setting default model to "${firstModel}"`);
      console.log(`API_SETUP: Setting default baseUrl to "${baseUrl}"`);
      
      setConfig({
        ...config,
        provider: newProvider,
        model: firstModel,
        baseUrl: baseUrl
      });
    } else {
      setConfig({
        ...config,
        [name]: value
      });
    }
  };
  
  // Handle API key display toggle
  const toggleKeyVisibility = () => {
    setShowKey(!showKey);
  };
  
  // Test the API key by making a simple request
  const testApiKey = async () => {
    setIsTestingKey(true);
    setTestStatus(null);
    
    console.log(`API_SETUP: Testing API key for ${config.provider}`);
    console.log(`API_SETUP: Using model "${config.model}" and baseUrl "${config.baseUrl}"`);
    
    try {
      const response = await fetch('/api/test-api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider: config.provider,
          apiKey: config.apiKey,
          model: config.model,
          baseUrl: config.baseUrl
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log('API_SETUP: API key test succeeded');
        setTestStatus({ success: true, message: 'API key is valid!' });
      } else {
        console.error('API_SETUP: API key test failed', data.error);
        setTestStatus({ success: false, message: `Error: ${data.error || 'Unknown error'}` });
      }
    } catch (error) {
      console.error('API_SETUP: API key test exception', error);
      setTestStatus({ success: false, message: `Error: ${error.message}` });
    } finally {
      setIsTestingKey(false);
    }
  };
  
  return (
    <div className="api-key-setup">
      <h4>API Configuration</h4>
      
      <div className="provider-selection">
        <label htmlFor="provider">Select API Provider:</label>
        <div className="provider-options">
          {API_PROVIDERS.map(provider => (
            <div 
              key={provider.id} 
              className={`provider-option ${config.provider === provider.id ? 'selected' : ''}`}
              onClick={() => handleChange({ target: { name: 'provider', value: provider.id } })}
              data-testid={`provider-${provider.id}`}
            >
              <div className="provider-logo">
                <img 
                  src={provider.logo} 
                  alt={provider.name} 
                  onError={(e) => {e.target.src = provider.fallbackLogo}}
                />
              </div>
              <div className="provider-name">{provider.name}</div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="apiKey">API Key:</label>
          <div className="api-key-input">
            <input
              type={showKey ? "text" : "password"}
              id="apiKey"
              name="apiKey"
              value={config.apiKey}
              onChange={handleChange}
              placeholder="Enter your API key"
              data-testid="api-key-input"
            />
            <button 
              type="button" 
              className="toggle-visibility" 
              onClick={toggleKeyVisibility}
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
          <p className="field-hint">Your API key is stored locally in your browser</p>
        </div>
        
        <div className="form-group">
          <label htmlFor="model">Model:</label>
          <select
            id="model"
            name="model"
            value={config.model}
            onChange={handleChange}
            data-testid="model-select"
          >
            {PROVIDER_MODELS[config.provider]?.map(model => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
          <p className="field-hint">Select the model to use</p>
        </div>
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="baseUrl">API Base URL:</label>
          <input
            type="text"
            id="baseUrl"
            name="baseUrl"
            value={config.baseUrl}
            onChange={handleChange}
            placeholder="https://api.example.com/v1"
            data-testid="base-url-input"
          />
          <p className="field-hint">For API proxy or compatible services</p>
        </div>
        
        <div className="form-group api-test-container">
          <button 
            onClick={testApiKey} 
            disabled={isTestingKey || !config.apiKey} 
            className="test-button"
            data-testid="test-api-button"
          >
            {isTestingKey ? "Testing..." : "Test API Key"}
          </button>
          
          {testStatus && (
            <div className={`test-result ${testStatus.success ? 'success' : 'error'}`}>
              {testStatus.message}
            </div>
          )}
        </div>
      </div>
      
      <div className="api-help">
        <h5>How to get an API key</h5>
        <ul>
          <li><strong>OpenAI:</strong> <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">Get API key from OpenAI</a></li>
          <li><strong>Anthropic:</strong> <a href="https://console.anthropic.com/account/keys" target="_blank" rel="noopener noreferrer">Get API key from Anthropic</a></li>
          <li><strong>Cohere:</strong> <a href="https://dashboard.cohere.com/api-keys" target="_blank" rel="noopener noreferrer">Get API key from Cohere</a></li>
          <li><strong>Google Gemini:</strong> <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Get API key from Google AI Studio</a></li>
        </ul>
      </div>
    </div>
  );
}

export default APIKeySetup;