import React from 'react';
import './LLMSelector.css';

function LLMSelector({ backend, setBackend }) {
  return (
    <div className="llm-selector">
      <h4>Choose LLM Provider</h4>
      
      <div className="backend-options">
        <div 
          className={`backend-option ${backend === 'ollama' ? 'selected' : ''}`}
          onClick={() => setBackend('ollama')}
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
          onClick={() => setBackend('webllm')}
        >
          <div className="backend-icon webllm-icon">
            <img src="/webllm-logo.png" alt="WebLLM" onError={(e) => e.target.src = "https://raw.githubusercontent.com/mlc-ai/web-llm/main/site/img/webllm-logo.png"} />
          </div>
          <div className="backend-details">
            <h5>WebLLM</h5>
            <p>Run LLMs directly in your browser</p>
          </div>
        </div>
      </div>
      
      <div className="coming-soon">
        <p>Coming soon: OpenAI, Claude, and Gemini API support</p>
      </div>
    </div>
  );
}

export default LLMSelector;