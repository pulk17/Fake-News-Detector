import React from 'react';
import { FaSpinner } from 'react-icons/fa';

function LoadingIndicator({ message = "Processing..." }) {
  return (
    <div className="loading-container">
      <FaSpinner className="loading-spinner" />
      <p className="loading-message">{message}</p>
    </div>
  );
}

export default LoadingIndicator;