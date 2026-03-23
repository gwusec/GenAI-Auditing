import React, { useState } from 'react';
import './WebLLMSetup.css';

// Available models for WebLLM
const AVAILABLE_MODELS = [
  { name: 'Llama-3-8B-Instruct', value: 'Llama-3-8B-Instruct' },
  { name: 'Gemma-2B-Instruct', value: 'Gemma-2B-Instruct' },
  { name: 'Mistral-7B-Instruct', value: 'Mistral-7B-Instruct' },
  { name: 'Phi-3-Mini-4K', value: 'Phi-3-Mini-4K' }
];

function WebLLMSetup({ config, setConfig }) {
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [modelLoaded, setModelLoaded] = useState(false);
  
  // Update the config when user changes input
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'quantized') {
      setConfig({
        ...config,
        [name]: e.target.checked
      });
    } else {
      setConfig({
        ...config,
        [name]: value
      });
    }
  };
  
  // Simulate downloading the model
  const preloadModel = () => {
    setDownloading(true);
    setDownloadProgress(0);
    
    // Simulate download progress
    const interval = setInterval(() => {
      setDownloadProgress(prev => {
        const newProgress = prev + Math.random() * 10;
        if (newProgress >= 100) {
          clearInterval(interval);
          setModelLoaded(true);
          setDownloading(false);
          return 100;
        }
        return newProgress;
      });
    }, 500);
  };
  
  return (
    <div className="webllm-setup">
      <h4>WebLLM Configuration</h4>
      
      <div className="info-box">
        <p>
          WebLLM runs AI models directly in your browser. 
          Models will be downloaded the first time you use them (~1-2GB).
        </p>
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="model">Choose Model:</label>
          <select
            id="model"
            name="model"
            value={config.model}
            onChange={handleChange}
          >
            {AVAILABLE_MODELS.map(model => (
              <option key={model.value} value={model.value}>
                {model.name}
              </option>
            ))}
          </select>
          <p className="field-hint">Select the model to run in browser</p>
        </div>
        
        <div className="form-group">
          <div className="checkbox-container">
            <input
              type="checkbox"
              id="quantized"
              name="quantized"
              checked={config.quantized}
              onChange={handleChange}
            />
            <label htmlFor="quantized">Use quantized model (smaller download)</label>
          </div>
          <p className="field-hint">Quantized models are smaller but slightly less accurate</p>
        </div>
      </div>
      
      <div className="model-preload">
        <button 
          onClick={preloadModel} 
          disabled={downloading || modelLoaded}
          className={`preload-button ${modelLoaded ? 'loaded' : ''}`}
        >
          {modelLoaded ? 'Model Ready!' : downloading ? 'Downloading...' : 'Pre-download Model'}
        </button>
        
        {downloading && (
          <div className="progress-container">
            <div 
              className="progress-bar" 
              style={{ width: `${downloadProgress}%` }}
            ></div>
            <span className="progress-text">{Math.round(downloadProgress)}%</span>
          </div>
        )}
      </div>
      
      <div className="browser-compatibility">
        <h5>Browser Compatibility</h5>
        <p>
          WebLLM works best in Chrome and Edge. Firefox has limited WebGPU support.
          Safari support is experimental.
        </p>
      </div>
    </div>
  );
}

export default WebLLMSetup;