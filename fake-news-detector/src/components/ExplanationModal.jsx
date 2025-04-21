import React, { useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';

function ExplanationModal({ explanation, onClose }) {
  useEffect(() => {
    console.log("Modal received explanation:", explanation);
  }, [explanation]);

  // --- Basic Safeguard ---
  if (!explanation) {
    console.error("ExplanationModal rendered without explanation prop.");
     return (
       <div className="modal-overlay" onClick={onClose}>
         <div className="modal-content" onClick={(e) => e.stopPropagation()}>
           <div className="modal-header">
             <h3>Explanation Error</h3>
             <button onClick={onClose} className="close-button">
               <FaTimes />
             </button>
           </div>
           <div className="modal-body">
             <p>Error: Explanation data was not provided to the modal.</p>
           </div>
         </div>
       </div>
     );
  }
  // --- End Safeguard ---


  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Explanation of Result</h3>
          <button onClick={onClose} className="close-button">
            <FaTimes />
          </button>
        </div>

        <div className="modal-body">
          {explanation.status === 'success' && explanation.html ? (
            <iframe
              className="explanation-iframe" 
              srcDoc={explanation.html}
              width="100%"                
              height="500px"               
              frameBorder="0"              
              title="Explanation Visualization" 
            />
          ) : (
            <div className="explanation-error">
              <p>
                {explanation.status === 'not_requested'
                  ? 'No explanation was requested.'
                  : explanation.status === 'generating'
                  ? 'Explanation is generating...'
                  : `Could not display explanation.`
                }
              </p>
              {explanation.status === 'success' && !explanation.html && (
                <p>The explanation status is 'success' but no HTML content was provided by the backend.</p>
              )}
               {explanation.status !== 'success' && explanation.status !== 'not_requested' && (
                 <p><small>Status code: {explanation.status}</small></p>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ExplanationModal;