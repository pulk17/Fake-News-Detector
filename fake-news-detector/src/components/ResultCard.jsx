import React from 'react';
// Make sure all used icons are imported
import { FaLightbulb, FaChartBar, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

// Accept isExplanationAvailable prop
function ResultCard({ prediction, processingTime, onExplainClick, isExplanationAvailable }) {
  const { label, confidence, probabilities } = prediction;
  const isReal = label === 'REAL'; // Assuming labels are 'REAL' and 'FAKE'

  // Determine icon based on label
  const LabelIcon = isReal ? FaCheckCircle : FaTimesCircle;

  return (
    // Use dynamic classes based on label for styling
    <div className={`result-card ${label.toLowerCase()}`}>
      <h3 className="result-header">
        Analysis Results
        <span className="processing-time">
          (processed in {processingTime}s)
        </span>
      </h3>

      <div className="result-content">
        <div className="prediction-section">
           {/* Consider using an icon + text for the badge */}
           <div className={`prediction-badge ${label.toLowerCase()}`}>
              <LabelIcon className="prediction-icon"/> {label}
           </div>
          <div className="confidence-meter">
            <div className="confidence-bar-container">
              <div
                className="confidence-bar"
                style={{ width: `${confidence * 100}%` }}
                // Add ARIA attributes for accessibility
                role="progressbar"
                aria-valuenow={confidence * 100}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-label={`Confidence score ${label}`}
              ></div>
            </div>
            <div className="confidence-text">
              {(confidence * 100).toFixed(1)}% confidence
            </div>
          </div>
        </div>

        {probabilities && Object.keys(probabilities).length > 0 && ( // Check if probabilities exist
          <div className="probability-distribution">
            <h4><FaChartBar /> Probability Distribution</h4>
            {/* Ensure probabilities is an object before mapping */}
            {Object.entries(probabilities).map(([category, prob]) => (
              <div key={category} className={`probability-item ${category.toLowerCase()}`}>
                <span className="category">{category}:</span>
                <div className="probability-bar-container">
                  <div
                    className="probability-bar"
                    style={{ width: `${prob * 100}%` }}
                    role="progressbar"
                    aria-valuenow={prob * 100}
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-label={`Probability for ${category}`}
                  ></div>
                  <span className="probability-value">{(prob * 100).toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- Modified Explain Button --- */}
        <button
          onClick={onExplainClick}
          className="explain-button"
          // Disable button if explanation is not available
          disabled={!isExplanationAvailable}
          // Add title to explain why it might be disabled
          title={isExplanationAvailable ? "See explanation" : "Explanation could not be generated or is not available"}
        >
          <FaLightbulb /> Explain This Result
        </button>

      </div>
    </div>
  );
}

export default ResultCard;