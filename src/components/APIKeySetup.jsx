import React, { useState, useEffect } from 'react';
import './APIKeySetup.css';

// List of available API providers - ONLY OPENAI
const API_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', logo: '/openai-logo.png', fallbackLogo: 'https://openai.com/content/images/2022/05/openai-logo-1.svg' }
];

// List of available models per provider
const PROVIDER_MODELS = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' }
    // { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    // { id: 'gpt-4', name: 'GPT-4' },
    // { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
  ]
};

// API base URLs
const API_BASE_URLS = {
  openai: 'https://api.openai.com/v1'
};

function APIKeySetup({ config, setConfig }) {
  const [testStatus, setTestStatus] = useState(null);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  
  // Normalize config so persisted stale values do not break API testing.
  useEffect(() => {
    const normalizedConfig = {
      ...config,
      provider: 'openai',
      model: config.model || PROVIDER_MODELS.openai[0].id,
      baseUrl: (config.baseUrl || API_BASE_URLS.openai).trim()
    };

    if (
      normalizedConfig.provider !== config.provider ||
      normalizedConfig.model !== config.model ||
      normalizedConfig.baseUrl !== config.baseUrl
    ) {
      setConfig(normalizedConfig);
    }
  }, [config, setConfig]);
  
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
    
    setConfig({
      ...config,
      [name]: value
    });
  };
  
  // Handle API key display toggle
  const toggleKeyVisibility = () => {
    setShowKey(!showKey);
  };
  
  // Test the API key by making a simple request
  const testApiKey = async () => {
    setIsTestingKey(true);
    setTestStatus(null);

    const normalizedBaseUrl = (config.baseUrl || API_BASE_URLS.openai).trim();

    try {
      // Validate early to show a friendly client-side message.
      new URL(normalizedBaseUrl);
    } catch (error) {
      setTestStatus({ success: false, message: 'Error: API Base URL is invalid. Use https://api.openai.com/v1' });
      setIsTestingKey(false);
      return;
    }
    
    console.log(`API_SETUP: Testing API key for ${config.provider}`);
    console.log(`API_SETUP: Using model "${config.model}" and baseUrl "${normalizedBaseUrl}"`);
    
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
          baseUrl: normalizedBaseUrl
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
      <h4>OpenAI API Configuration</h4>
      
      {/* Since we only have OpenAI, we can show it as a simple header instead of selection */}
      <div className="provider-selection">
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '15px',
          marginBottom: '20px',
          padding: '15px',
          backgroundColor: '#f0f4f8',
          borderRadius: '8px',
          border: '2px solid #3498db'
        }}>
          <img 
            src={API_PROVIDERS[0].logo} 
            alt={API_PROVIDERS[0].name} 
            onError={(e) => {e.target.src = API_PROVIDERS[0].fallbackLogo}}
            style={{ width: '40px', height: '40px', objectFit: 'contain' }}
          />
          <div>
            <h5 style={{ margin: 0, color: '#333' }}>OpenAI</h5>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
              Using OpenAI's GPT models
            </p>
          </div>
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
              placeholder="Enter your OpenAI API key"
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
            {PROVIDER_MODELS.openai.map(model => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
          <p className="field-hint">Select the OpenAI model to use</p>
        </div>
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="baseUrl">API Base URL (Optional):</label>
          <input
            type="text"
            id="baseUrl"
            name="baseUrl"
            value={config.baseUrl}
            onChange={handleChange}
            placeholder="https://api.openai.com/v1"
            data-testid="base-url-input"
          />
          <p className="field-hint">For API proxy or compatible services (leave default for OpenAI)</p>
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
        <h5>How to get an OpenAI API key</h5>
        <ul>
          <li>
            1. Go to <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">OpenAI Platform</a>
          </li>
          <li>2. Sign in or create an account</li>
          <li>3. Click "Create new secret key"</li>
          <li>4. Copy the key and paste it above</li>
          <li>5. Keep your API key secure and never share it</li>
        </ul>
      </div>
    </div>
  );
}

export default APIKeySetup;