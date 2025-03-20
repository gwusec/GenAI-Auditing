import React, { useState, useEffect } from 'react';
import './OllamaSetup.css';

function OllamaSetup({ config, setConfig }) {
  const [availableModels, setAvailableModels] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('unknown');
  
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
    try {
      // First try a direct connection
      let response = await fetch(`${config.url}/api/tags`, { signal: AbortSignal.timeout(2000) });
      
      // If direct connection fails, try via proxy
      if (!response.ok) {
        response = await fetch(`${config.proxyUrl}/api/ollama/api/tags`, {
          headers: { 'x-ollama-url': config.url },
          signal: AbortSignal.timeout(2000)
        });
      }
      
      if (!response.ok) {
        throw new Error('Failed to connect to Ollama');
      }
      
      const data = await response.json();
      setConnectionStatus('connected');
      
      // Extract models from the response
      if (data.models) {
        setAvailableModels(data.models.map(model => ({
          name: model.name,
          value: model.name
        })));
      }
    } catch (error) {
      console.error('Error connecting to Ollama:', error);
      setConnectionStatus('disconnected');
      
      // Set some default models when disconnected
      setAvailableModels([
        { name: 'llama3', value: 'llama3' },
        { name: 'llama2', value: 'llama2' },
        { name: 'gemma:2b', value: 'gemma:2b' },
        { name: 'mistral', value: 'mistral' }
      ]);
    }
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
          <label htmlFor="model">Ollama Model:</label>
          <select
            id="model"
            name="model"
            value={config.model}
            onChange={handleChange}
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
          <p className="field-hint">Select an available model</p>
        </div>
        
        <div className="form-group connection-status-container">
          <div className="connection-status">
            <span>Ollama Status:</span> 
            <span className={`status-indicator ${connectionStatus}`}>
              {connectionStatus === 'connected' ? 'Connected' : 
               connectionStatus === 'disconnected' ? 'Not Connected' : 'Checking...'}
            </span>
          </div>
          <button onClick={checkOllamaConnection} className="check-button">
            Check Connection
          </button>
        </div>
      </div>
      
      <div className="ollama-help">
        <h5>Don't have Ollama installed?</h5>
        <p>
          Ollama lets you run LLMs locally. 
          <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer">Download Ollama</a> 
          and run <code>ollama pull llama3</code> to get started.
        </p>
      </div>
    </div>
  );
}

export default OllamaSetup;