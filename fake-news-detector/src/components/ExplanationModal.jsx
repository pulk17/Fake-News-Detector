// In components/ExplanationModal.jsx
import React, { useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';

function ExplanationModal({ explanation, onClose }) {
  useEffect(() => {
    // Log what explanation data we're receiving
    console.log("Modal received explanation:", explanation);
  }, [explanation]);

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Explanation of Result</h3>
          <button onClick={onClose} className="close-button">
            <FaTimes />
          </button>
        </div>
        
        <div className="modal-body">
          {explanation.status === 'success' && explanation.html ? (
            <div 
              className="explanation-content"
              dangerouslySetInnerHTML={{ __html: explanation.html }}
            />
          ) : (
            <div className="explanation-error">
              <p>
                {explanation.status === 'not_requested' 
                  ? 'No explanation was requested.' 
                  : `Error generating explanation: ${explanation.status}`}
              </p>
              {explanation.status === 'success' && !explanation.html && (
                <p>The explanation was generated but no HTML content was provided.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ExplanationModal;