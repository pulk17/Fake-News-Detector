import React, { useState } from 'react';
import { FaThumbsUp, FaThumbsDown, FaCheck, FaLock } from 'react-icons/fa';

function FeedbackForm({ onSubmit, submitted, classNames, currentPrediction, token, onShowLogin }) {
  const [isPredictionCorrect, setIsPredictionCorrect] = useState(null);
  const [correctLabel, setCorrectLabel] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const alternativeLabels = classNames.filter(label => label !== currentPrediction);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isPredictionCorrect === null || !token) return;
    setSubmitError(''); 
    setIsSubmitting(true); 

    try {
      await onSubmit(
        isPredictionCorrect,
        !isPredictionCorrect ? correctLabel : null
      );
    } catch (error) {
      console.error("Feedback submission error:", error);
      setSubmitError(error.toString() || "Failed to submit feedback. Please try again.");
      
      if (error.toString().includes("Token is invalid") || 
          error.toString().includes("Unauthorized") ||
          error.toString().includes("token")) {
        setSubmitError("Your session has expired. Please login again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="feedback-form disabled-feedback">
        <FaLock /> Please <button type="button" className='link-button' onClick={onShowLogin}>login</button> to submit feedback.
      </div>
    );
  }

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
      {submitError && <p className="error-message">{submitError}</p>}
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
          disabled={isPredictionCorrect === null || 
                   (isPredictionCorrect === false && !correctLabel) ||
                   isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </form>
    </div>
  );
}

export default FeedbackForm;