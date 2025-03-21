import React, { useEffect } from 'react';
import './LLMSelector.css';

function LLMSelector({ backend, setBackend }) {
  // Log when the component receives a new backend prop
  useEffect(() => {
    console.log(`LLM_SELECTOR: Current backend is "${backend}"`);
  }, [backend]);
  
  // Enhanced handler with logging
  const handleBackendSelect = (newBackend) => {
    console.log(`LLM_SELECTOR: User clicked "${newBackend}" (previous: "${backend}")`);
    
    if (newBackend === backend) {
      console.log('LLM_SELECTOR: No change in backend selection');
      return;
    }
    
    console.log(`LLM_SELECTOR: Setting backend to "${newBackend}"`);
    setBackend(newBackend);
  };

  return (
    <div className="llm-selector">
      <h4>Choose LLM Provider</h4>
      
      <div className="backend-options">
        <div 
          className={`backend-option ${backend === 'ollama' ? 'selected' : ''}`}
          onClick={() => handleBackendSelect('ollama')}
          data-testid="ollama-option"
        >
          <div className="backend-icon ollama-icon">
            <img src="/ollama-logo.png" alt="Ollama" onError={(e) => e.target.src = "https://ollama.com/public/ollama.png"} />
          </div>
          <div className="backend-details">
            <h5>Ollama</h5>
            <p>Use locally hosted models via Ollama</p>
          </div>
        </div>
        
        <div 
          className={`backend-option ${backend === 'webllm' ? 'selected' : ''}`}
          onClick={() => handleBackendSelect('webllm')}
          data-testid="webllm-option"
        >
          <div className="backend-icon webllm-icon">
            <img src="/webllm-logo.png" alt="WebLLM" onError={(e) => e.target.src = "https://raw.githubusercontent.com/mlc-ai/web-llm/main/site/img/webllm-logo.png"} />
          </div>
          <div className="backend-details">
            <h5>WebLLM</h5>
            <p>Run LLMs directly in your browser</p>
          </div>
        </div>
        
        <div 
          className={`backend-option ${backend === 'api' ? 'selected' : ''}`}
          onClick={() => handleBackendSelect('api')}
          data-testid="api-option"
        >
          <div className="backend-icon api-icon">
            <img src="/api-logo.png" alt="API" onError={(e) => e.target.src = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIvPjxwYXRoIGQ9Ik05LjA5IDlhMyAzIDAgMCAxIDUuODMgMWMwIDItMyAzLTMgM00xMiAxN2guMDEiLz48L3N2Zz4="} />
          </div>
          <div className="backend-details">
            <h5>API Key</h5>
            <p>Use commercial LLM APIs (OpenAI, Claude, etc.)</p>
          </div>
        </div>
      </div>
      
      <div className="feature-banner">
        <div className="feature-item">
          <span className="feature-icon">🔒</span>
          <span className="feature-text">API keys are stored locally in your browser</span>
        </div>
        <div className="feature-item">
          <span className="feature-icon">🌐</span>
          <span className="feature-text">Support for multiple API providers</span>
        </div>
        <div className="feature-item">
          <span className="feature-icon">⚙️</span>
          <span className="feature-text">Compatible with API proxies</span>
        </div>
      </div>
    </div>
  );
}

export default LLMSelector;