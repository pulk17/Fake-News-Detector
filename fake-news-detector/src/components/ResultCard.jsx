import React from 'react';
import { FaLightbulb, FaChartBar } from 'react-icons/fa';

function ResultCard({ prediction, processingTime, onExplainClick }) {
  const { label, confidence, probabilities } = prediction;
  const isReal = label === 'REAL';
  
  return (
    <div className={`result-card ${isReal ? 'real' : 'fake'}`}>
      <h3 className="result-header">
        Analysis Results 
        <span className="processing-time">
          (processed in {processingTime}s)
        </span>
      </h3>
      
      <div className="result-content">
        <div className="prediction-section">
          <div className={`prediction-badge ${isReal ? 'real' : 'fake'}`}>
            {isReal ? 'REAL' : 'FAKE'}
          </div>
          <div className="confidence-meter">
            <div className="confidence-bar-container">
              <div 
                className="confidence-bar" 
                style={{ width: `${confidence * 100}%` }}
              ></div>
            </div>
            <div className="confidence-text">
              {(confidence * 100).toFixed(1)}% confidence
            </div>
          </div>
        </div>
        
        <div className="probability-distribution">
          <h4><FaChartBar /> Probability Distribution</h4>
          {Object.entries(probabilities).map(([category, prob]) => (
            <div key={category} className={`probability-item ${category.toLowerCase()}`}>
              <span className="category">{category}:</span>
              <div className="probability-bar-container">
                <div 
                  className="probability-bar" 
                  style={{ width: `${prob * 100}%` }}
                ></div>
                <span className="probability-value">{(prob * 100).toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
        
        <button onClick={onExplainClick} className="explain-button">
          <FaLightbulb /> Explain This Result
        </button>
      </div>
    </div>
  );
}

export default ResultCard;