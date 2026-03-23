import React from 'react';

/**
 * Component to display the current backend status
 * Modified to ensure it doesn't block interactions with the chatbot
 */
const BackendStatus = ({ backend, config }) => {
  let statusText = '';
  let statusDetails = '';
  
  switch (backend) {
    case 'ollama':
      statusText = 'Using Ollama';
      statusDetails = `${config.model} @ ${config.url}`;
      break;
    case 'webllm':
      statusText = 'Using WebLLM';
      statusDetails = `${config.model} (${config.quantized ? 'Quantized' : 'Full precision'})`;
      break;
    case 'api':
      statusText = `Using ${config.provider}`;
      statusDetails = `${config.model}`;
      break;
    default:
      statusText = 'No backend selected';
  }
  
  const statusStyles = {
    container: {
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      color: 'white',
      padding: '8px 12px',
      borderRadius: '4px',
      fontSize: '0.8rem',
      zIndex: 1000,
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
      pointerEvents: 'none', // This makes the component ignore mouse events
      userSelect: 'none',    // Prevents text selection
      maxWidth: '200px',     // Limit width to ensure it stays compact
      textAlign: 'right'     // Right-align text
    },
    title: {
      fontWeight: 'bold',
      marginBottom: '4px'
    },
    details: {
      opacity: 0.8,
      fontSize: '0.7rem'
    }
  };
  
  return (
    <div style={statusStyles.container} aria-hidden="true">
      <div style={statusStyles.title}>{statusText}</div>
      <div style={statusStyles.details}>{statusDetails}</div>
    </div>
  );
};

export default BackendStatus;