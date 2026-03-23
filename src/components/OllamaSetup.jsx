import React, { useState, useEffect } from 'react';
import './OllamaSetup.css';

function OllamaSetup({ config, setConfig }) {
  const [connectionStatus, setConnectionStatus] = useState('unknown');
  const [modelStatus, setModelStatus] = useState('unknown');
  const [triedUrls, setTriedUrls] = useState([]); // Track which URLs we've tried
  const [autoConfiguredUrl, setAutoConfiguredUrl] = useState(null); // Track if URL was auto-configured
  
  // Use the correct Ollama model name
  const FIXED_MODEL = 'llama3.1';
  
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
    setTriedUrls([]);
    setAutoConfiguredUrl(null); // Reset auto-config status
    
    // Store original URL to check if we auto-configured later
    const originalUrl = config.url;
    
    // URLs to try in order of preference
    const urlsToTry = [
      config.url, // User's current setting
      'http://localhost:11434', // Standard local
      'http://host.docker.internal:11434', // Docker Desktop (Mac/Windows)
      'http://172.17.0.1:11434', // Docker default bridge (Linux)
      'http://192.168.65.2:11434', // Docker Desktop alternative
    ].filter((url, index, self) => 
      // Remove duplicates and empty URLs
      url && url.trim() && self.indexOf(url) === index
    );
    
    console.log('Trying Ollama URLs in order:', urlsToTry);
    
    for (const url of urlsToTry) {
      console.log(`Attempting connection to: ${url}`);
      setTriedUrls(prev => [...prev, { url, status: 'trying' }]);
      
      try {
        // First try direct connection
        let response = await fetch(`${url}/api/tags`, { 
          signal: AbortSignal.timeout(3000) 
        });
        
        // If direct connection fails, try via proxy
        if (!response.ok) {
          console.log(`Direct connection to ${url} failed, trying proxy...`);
          response = await fetch(`${config.proxyUrl}/api/ollama/api/tags`, {
            headers: { 'x-ollama-url': url },
            signal: AbortSignal.timeout(3000)
          });
        }
        
        if (response.ok) {
          const data = await response.json();
          
          console.log(`✅ Successfully connected to Ollama at: ${url}`);
          console.log('Available models:', data.models?.map(m => m.name));
          
          // Update the config with the working URL if it's different
          if (originalUrl !== url) {
            console.log(`Auto-updating Ollama URL from ${originalUrl} to ${url}`);
            setAutoConfiguredUrl(url); // Track that we auto-configured
            setConfig(prevConfig => ({
              ...prevConfig,
              url: url
            }));
          }
          
          setConnectionStatus('connected');
          setTriedUrls(prev => prev.map(item => 
            item.url === url ? { ...item, status: 'success' } : item
          ));

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
              console.log(`✅ Model ${FIXED_MODEL} is available`);
            } else {
              setModelStatus('not_pulled');
              console.warn(`⚠️  Model ${FIXED_MODEL} not found. Available models:`, modelNames);
            }
          } else {
            setModelStatus('unknown');
          }
          
          return; // Success! Exit the loop
        }
        
      } catch (error) {
        console.log(`❌ Failed to connect to ${url}:`, error.message);
        setTriedUrls(prev => prev.map(item => 
          item.url === url ? { ...item, status: 'failed', error: error.message } : item
        ));
      }
    }
    
    // If we get here, all URLs failed
    console.error('❌ Failed to connect to Ollama on any URL');
    setConnectionStatus('disconnected');
    setModelStatus('unknown');
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
          <p className="field-hint">
            Local Ollama server URL (will auto-detect best URL)
          </p>
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
      
      {/* Show connection attempts for debugging */}
      {triedUrls.length > 0 && connectionStatus === 'checking' && (
        <div className="ollama-help" style={{ backgroundColor: '#f0f4f8', borderColor: '#3498db' }}>
          <h5>🔍 Connection Attempts</h5>
          {triedUrls.map((item, index) => (
            <p key={index} style={{ margin: '5px 0', fontSize: '0.8rem' }}>
              <strong>{item.url}:</strong> {
                item.status === 'trying' ? '🔄 Trying...' :
                item.status === 'success' ? '✅ Connected!' :
                item.status === 'failed' ? `❌ Failed (${item.error})` : '⏳ Pending'
              }
            </p>
          ))}
        </div>
      )}
      
      {connectionStatus === 'connected' && autoConfiguredUrl && (
        <div className="ollama-help" style={{ backgroundColor: '#d1ecf1', borderColor: '#17a2b8' }}>
          <h5>🔄 Auto-Configuration</h5>
          <p style={{ color: '#0c5460' }}>
            Automatically found Ollama at <strong>{autoConfiguredUrl}</strong>
          </p>
        </div>
      )}
      
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
          <h5 style={{ color: '#155724' }}>✅ Ready to Use</h5>
          <p style={{ color: '#155724' }}>
            Ollama is connected and the {FIXED_MODEL} model is installed. You're ready to start chatting!
          </p>
        </div>
      )}
      
      {connectionStatus === 'disconnected' && (
        <div className="ollama-help">
          <h5>Setup Instructions</h5>
          <p>
            The app tried multiple connection methods but couldn't find Ollama. Please ensure:
          </p>
          <ol style={{ margin: '10px 0', paddingLeft: '20px' }}>
            <li><a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer">Download Ollama</a></li>
            <li>Start Ollama: <code>ollama serve</code></li>
            <li>Install the model: <code>ollama pull {FIXED_MODEL}</code></li>
            <li>Click "Check Connection" again</li>
          </ol>
        </div>
      )}
    </div>
  );
}

export default OllamaSetup;