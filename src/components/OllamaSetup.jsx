import React, { useState, useEffect } from 'react';
import './OllamaSetup.css';

function OllamaSetup({ config, setConfig }) {
  const [connectionStatus, setConnectionStatus] = useState('unknown');
  const [modelStatus, setModelStatus] = useState('unknown'); // Track model availability separately
  
  // Use the correct Ollama model name
  const FIXED_MODEL = 'llama3.1';  // Changed from 'llama3.1:8b-instruct'
  
  // Ensure the model is always set to the fixed value
  useEffect(() => {
    if (config.model !== FIXED_MODEL) {
      console.log(`Updating model from ${config.model} to ${FIXED_MODEL}`);
      setConfig({
        ...config,
        model: FIXED_MODEL
      });
    }
  }, []);

  // Update the config when user changes input fields
  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfig({
      ...config,
      [name]: value
    });
  };
  
  // Check connection to Ollama on mount and when URL changes
  useEffect(() => {
    checkOllamaConnection();
  }, [config.url]);
  
  const checkOllamaConnection = async () => {
    setConnectionStatus('checking');
    setModelStatus('checking');
    
    try {
      // First try a direct connection to check if Ollama is running
      let response = await fetch(`${config.url}/api/tags`, { 
        signal: AbortSignal.timeout(3000) 
      });
      
      // If direct connection fails, try via proxy
      if (!response.ok) {
        console.log('Direct connection failed, trying proxy...');
        response = await fetch(`${config.proxyUrl}/api/ollama/api/tags`, {
          headers: { 'x-ollama-url': config.url },
          signal: AbortSignal.timeout(3000)
        });
      }
      
      if (!response.ok) {
        throw new Error('Failed to connect to Ollama');
      }
      
      const data = await response.json();
      setConnectionStatus('connected');
      console.log('Connected to Ollama. Available models:', data.models?.map(m => m.name));

      // Check if the required model is available
      if (data.models) {
        const modelNames = data.models.map(model => model.name);
        const hasRequiredModel = modelNames.some(name => 
          name === FIXED_MODEL || 
          name === `${FIXED_MODEL}:latest` ||
          name === `${FIXED_MODEL}:8b` ||
          name.startsWith(`${FIXED_MODEL}:`)
        );
        
        if (hasRequiredModel) {
          setModelStatus('available');
          console.log(`Model ${FIXED_MODEL} is available`);
        } else {
          setModelStatus('not_pulled');
          console.warn(`Model ${FIXED_MODEL} not found. Available models:`, modelNames);
        }
      } else {
        setModelStatus('unknown');
      }
    } catch (error) {
      console.error('Error connecting to Ollama:', error);
      setConnectionStatus('disconnected');
      setModelStatus('unknown');
    }
  };
  
  // Function to copy pull command to clipboard
  const copyPullCommand = () => {
    navigator.clipboard.writeText(`ollama pull ${FIXED_MODEL}`);
    alert('Command copied to clipboard!');
  };
  
  return (
    <div className="ollama-setup">
      <h4>Ollama Configuration</h4>
      
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="url">Ollama URL:</label>
          <input
            type="text"
            id="url"
            name="url"
            value={config.url}
            onChange={handleChange}
            placeholder="http://localhost:11434"
          />
          <p className="field-hint">Local Ollama server URL</p>
        </div>
        
        <div className="form-group">
          <label htmlFor="proxyUrl">Proxy URL:</label>
          <input
            type="text"
            id="proxyUrl"
            name="proxyUrl"
            value={config.proxyUrl}
            onChange={handleChange}
            placeholder="http://localhost:3000"
          />
          <p className="field-hint">Proxy server for API calls</p>
        </div>
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label>Model:</label>
          <div className="fixed-model-display">
            <strong>{FIXED_MODEL}</strong>
          </div>
          <p className="field-hint">Using Llama 3.1 model</p>
        </div>
        
        <div className="form-group connection-status-container">
          <div className="connection-status">
            <span>Ollama Status:</span> 
            <span className={`status-indicator ${connectionStatus}`}>
              {connectionStatus === 'connected' ? 'Connected' : 
               connectionStatus === 'disconnected' ? 'Not Connected' : 
               connectionStatus === 'checking' ? 'Checking...' : 'Unknown'}
            </span>
          </div>
          
          {connectionStatus === 'connected' && (
            <div className="connection-status">
              <span>Model Status:</span> 
              <span className={`status-indicator ${
                modelStatus === 'available' ? 'connected' : 
                modelStatus === 'not_pulled' ? 'disconnected' : 
                modelStatus === 'checking' ? 'checking' : 'unknown'
              }`}>
                {modelStatus === 'available' ? 'Ready' : 
                 modelStatus === 'not_pulled' ? 'Not Installed' : 
                 modelStatus === 'checking' ? 'Checking...' : 'Unknown'}
              </span>
            </div>
          )}
          
          <button onClick={checkOllamaConnection} className="check-button">
            Check Connection
          </button>
        </div>
      </div>
      
      {modelStatus === 'not_pulled' && (
        <div className="ollama-help" style={{ backgroundColor: '#fff3cd', borderColor: '#ffc107' }}>
          <h5 style={{ color: '#856404' }}>⚠️ Model Not Found</h5>
          <p style={{ color: '#856404' }}>
            The model <strong>{FIXED_MODEL}</strong> is not installed. Please run the following command:
          </p>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px',
            marginTop: '10px'
          }}>
            <code style={{ 
              flex: 1,
              backgroundColor: '#fff',
              padding: '8px',
              border: '1px solid #856404'
            }}>
              ollama pull {FIXED_MODEL}
            </code>
            <button 
              onClick={copyPullCommand}
              style={{
                padding: '6px 12px',
                backgroundColor: '#ffc107',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                color: '#212529'
              }}
            >
              Copy
            </button>
          </div>
        </div>
      )}
      
      {modelStatus === 'available' && (
        <div className="ollama-help" style={{ backgroundColor: '#d4edda', borderColor: '#28a745' }}>
          <h5 style={{ color: '#155724' }}>✓ Ready to Use</h5>
          <p style={{ color: '#155724' }}>
            Ollama is connected and the {FIXED_MODEL} model is installed. You're ready to start chatting!
          </p>
        </div>
      )}
      
      {(modelStatus === 'unknown' || connectionStatus === 'disconnected') && (
        <div className="ollama-help">
          <h5>Setup Instructions</h5>
          <p>
            1. <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer">Download Ollama</a><br/>
            2. Run: <code>ollama pull {FIXED_MODEL}</code><br/>
            3. Start Ollama: <code>ollama serve</code>
          </p>
        </div>
      )}
    </div>
  );
}

export default OllamaSetup;