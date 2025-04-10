import React, { useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';

function ExplanationModal({ explanation, onClose }) {
  useEffect(() => {
    // Log what explanation data we're receiving - useful for debugging
    console.log("Modal received explanation:", explanation);
  }, [explanation]);

  // --- Basic Safeguard ---
  // If explanation object itself is missing, display an error or nothing.
  if (!explanation) {
    console.error("ExplanationModal rendered without explanation prop.");
    // Optionally return a minimal modal showing an error
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
    // Clicking the overlay will close the modal
    <div className="modal-overlay" onClick={onClose}>
       {/* Clicking inside the content stops the event from bubbling to the overlay */}
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Explanation of Result</h3>
          <button onClick={onClose} className="close-button">
            <FaTimes />
          </button>
        </div>

        <div className="modal-body">
           {/* Check for success status AND the presence of the html string */}
          {explanation.status === 'success' && explanation.html ? (
            // *** REPLACE DIV WITH IFRAME ***
            // Use an iframe to render the self-contained HTML from LIME.
            // The srcDoc attribute takes the full HTML string.
            // The browser will render this HTML in a sandboxed context, allowing its scripts (like D3.js used by LIME) to run.
            <iframe
              className="explanation-iframe" // Add a class for easier styling
              srcDoc={explanation.html}
              width="100%"                // Fill container width
              height="500px"               // Set a fixed height (adjust as needed)
              frameBorder="0"              // Remove default border
              title="Explanation Visualization" // Accessibility title
            />
            // *** END IFRAME REPLACEMENT ***
          ) : (
             // Keep your existing error/status display logic
            <div className="explanation-error">
              <p>
                {explanation.status === 'not_requested'
                  ? 'No explanation was requested.'
                   // Add handling for other potential statuses if your backend sends them
                  : explanation.status === 'generating'
                  ? 'Explanation is generating...'
                  // Generic fallback for error or unexpected statuses
                  : `Could not display explanation.`
                }
              </p>
              {/* Specific message if status is success but HTML is missing */}
              {explanation.status === 'success' && !explanation.html && (
                <p>The explanation status is 'success' but no HTML content was provided by the backend.</p>
              )}
               {/* Optionally display the raw error status if it's not 'success' */}
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