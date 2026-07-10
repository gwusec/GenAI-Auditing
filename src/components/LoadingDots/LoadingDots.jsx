import React from 'react';
import styles from './LoadingDots.module.css';

// Three-dot "typing" indicator (matches the prototype): slim bouncing dots shown
// while the assistant's reply is pending, before the first streamed token.
const LoadingDots = () => (
  <div className={styles.typing} role="status" aria-label="Assistant is typing">
    <span></span><span></span><span></span>
  </div>
);

export default LoadingDots;
