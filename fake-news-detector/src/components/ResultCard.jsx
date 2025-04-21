import React from 'react';
import { FaLightbulb, FaChartBar, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

function ResultCard({ prediction, processingTime, onExplainClick, isExplanationAvailable }) {
  const { label, confidence, probabilities } = prediction;
  const isReal = label === 'REAL'; 

  const LabelIcon = isReal ? FaCheckCircle : FaTimesCircle;

  return (
    <div className={`result-card ${label.toLowerCase()}`}>
      <h3 className="result-header">
        Analysis Results
        <span className="processing-time">
          (processed in {processingTime}s)
        </span>
      </h3>

      <div className="result-content">
        <div className="prediction-section">
           <div className={`prediction-badge ${label.toLowerCase()}`}>
              <LabelIcon className="prediction-icon"/> {label}
           </div>
          <div className="confidence-meter">
            <div className="confidence-bar-container">
              <div
                className="confidence-bar"
                style={{ width: `${confidence * 100}%` }}
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

        {probabilities && Object.keys(probabilities).length > 0 && ( 
          <div className="probability-distribution">
            <h4><FaChartBar /> Probability Distribution</h4>
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

        <button
          onClick={onExplainClick}
          className="explain-button"
          disabled={!isExplanationAvailable}
          title={isExplanationAvailable ? "See explanation" : "Explanation could not be generated or is not available"}
        >
          <FaLightbulb /> Explain This Result
        </button>

      </div>
    </div>
  );
}

export default ResultCard;