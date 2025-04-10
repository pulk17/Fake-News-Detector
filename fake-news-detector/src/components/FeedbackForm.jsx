import React, { useState } from 'react';
import { FaThumbsUp, FaThumbsDown, FaCheck } from 'react-icons/fa';

function FeedbackForm({ onSubmit, submitted, classNames, currentPrediction }) {
  const [isPredictionCorrect, setIsPredictionCorrect] = useState(null);
  const [correctLabel, setCorrectLabel] = useState(null);
  
  // Get alternative labels (all labels except current prediction)
  const alternativeLabels = classNames.filter(label => label !== currentPrediction);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (isPredictionCorrect === null) return;
    
    onSubmit(
      isPredictionCorrect, 
      !isPredictionCorrect ? correctLabel : null
    );
  };
  
  if (submitted) {
    return (
      <div className="feedback-submitted">
        <FaCheck className="feedback-icon" />
        <p>Thank you for your feedback!</p>
      </div>
    );
  }
  
  return (
    <div className="feedback-form">
      <h3>Provide Feedback</h3>
      <form onSubmit={handleSubmit}>
        <div className="feedback-question">
          <p>Was this prediction correct?</p>
          <div className="feedback-buttons">
            <button
              type="button"
              className={`feedback-button ${isPredictionCorrect === true ? 'selected' : ''}`}
              onClick={() => setIsPredictionCorrect(true)}
            >
              <FaThumbsUp /> Yes
            </button>
            <button
              type="button"
              className={`feedback-button ${isPredictionCorrect === false ? 'selected' : ''}`}
              onClick={() => setIsPredictionCorrect(false)}
            >
              <FaThumbsDown /> No
            </button>
          </div>
        </div>
        
        {isPredictionCorrect === false && (
          <div className="correct-label-selection">
            <p>What is the correct label?</p>
            <div className="label-options">
              {alternativeLabels.map(label => (
                <button
                  key={label}
                  type="button"
                  className={`label-option ${correctLabel === label ? 'selected' : ''}`}
                  onClick={() => setCorrectLabel(label)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <button 
          type="submit" 
          className="submit-feedback" 
          disabled={isPredictionCorrect === null || (isPredictionCorrect === false && !correctLabel)}
        >
          Submit Feedback
        </button>
      </form>
    </div>
  );
}

export default FeedbackForm;