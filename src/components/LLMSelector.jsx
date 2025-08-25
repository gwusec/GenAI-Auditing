import React, { useEffect } from 'react';
import './LLMSelector.css';

function LLMSelector({ backend, setBackend }) {
  // Log when the component receives a new backend prop
  useEffect(() => {
    console.log(`LLM_SELECTOR: Current backend is "${backend}"`);
    if (backend === 'webllm') {
      console.log('LLM_SELECTOR: WebLLM no longer available, switching to Ollama');
      setBackend('ollama');
    }
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
            <p>Use locally hosted Llama 3.1 model</p>
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
            <p>Use cloud-based GPT models via API</p>
          </div>
        </div>
      </div>
      
      <div className="feature-banner">
        <div className="feature-item">
          <span className="feature-icon">🔒</span>
          <span className="feature-text">Secure local processing with Ollama</span>
        </div>
        <div className="feature-item">
          <span className="feature-icon">⚡</span>
          <span className="feature-text">Fast cloud-based inference with API</span>
        </div>
      </div>
    </div>
  );
}

export default LLMSelector;