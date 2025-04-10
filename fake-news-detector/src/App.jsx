import React, { useState, useEffect } from 'react';
import './App.css';
import { FaCheck, FaTimes, FaQuestionCircle, FaInfoCircle, FaPaperPlane, FaSpinner, FaHistory, FaExclamationTriangle } from 'react-icons/fa'; // Added FaExclamationTriangle
import ResultCard from './components/ResultCard'; 
import ExplanationModal from './components/ExplanationModal'; 
import FactCheckResults from './components/FactCheckResults'; 
import FeedbackForm from './components/FeedbackForm'; 
import Header from './components/Header';
import Footer from './components/Footer'; 
import InfoPanel from './components/InfoPanel'; 
import SearchHistory from './components/SearchHistory'; 
import LoadingIndicator from './components/LoadingIndicator'; 
import useLocalStorage from './hooks/useLocalStorage'; 
import { analyzeText, getServerConfig, submitFeedback } from './utils/api'; 

function App() {
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false); 
  const [serverConfig, setServerConfig] = useState(null);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [searchHistory, setSearchHistory] = useLocalStorage('search-history', []);
  const [darkMode, setDarkMode] = useLocalStorage('dark-mode', false);
  const [showLowConfidencePrompt, setShowLowConfidencePrompt] = useState(false);

  // Fetch server configuration on component mount (keep as is)
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await getServerConfig();
        setServerConfig(config);
      } catch (err) {
        console.error('Error fetching server config:', err);
      }
    };
    fetchConfig();
  }, []);

  // Apply dark mode if enabled (keep as is)
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setFeedbackSubmitted(false); // Reset feedback state for new analysis
    setShowLowConfidencePrompt(false); // Reset low confidence prompt

    try {
      // analyzeText from your api.js already includes explain: true
      const data = await analyzeText(inputText);
      setResult(data);

      // *** Check for low confidence ***
      if (data.prediction.confidence < 0.95) {
        setShowLowConfidencePrompt(true);
      }
      const newHistoryItem = {
        text: inputText,
        timestamp: new Date().toISOString(),
        result: data.prediction.label // Use the actual label from prediction
      };
      setSearchHistory(prevHistory =>
        [newHistoryItem, ...prevHistory].slice(0, 10)
      );

    } catch (err) {
      setError(err.message || 'An unexpected error occurred during analysis.');
      console.error("Analysis Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedbackSubmit = async (wasPredictionCorrect, correctLabel) => {
    if (!result) return;

    // Disable form immediately to prevent double submission
    setFeedbackSubmitted(true); // Set submitted state *before* API call

    try {
      await submitFeedback({
        text: inputText,
        prediction: result.prediction.label,
        confidence: result.prediction.confidence,
        was_correct: wasPredictionCorrect,
        correct_label: correctLabel // Pass correctLabel (will be null if wasPredictionCorrect is true)
      });
      // Feedback successful - message is handled inside FeedbackForm
    } catch (err) {
      console.error('Error submitting feedback:', err);
      // Optionally: Re-enable the form or show an error message
      // setError('Failed to submit feedback. Please try again.'); // Example error display
      setFeedbackSubmitted(false); // Re-enable form on error
    }
  }

  // handleHistoryItemClick (keep as is)
  const handleHistoryItemClick = (text) => {
    setInputText(text);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // clearSearchHistory (keep as is)
  const clearSearchHistory = () => {
    setSearchHistory([]);
  };

  // toggleDarkMode (keep as is)
  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };

  // handleExplainClick - checks data before showing modal
  const handleExplainClick = () => {
      // Check if result and the explanation object within it exist
      if (result?.explanation) {
          setShowExplanation(true);
      } else {
          console.warn("Attempted to show explanation but result.explanation data is missing.");
          // Optionally show a user message here if needed
      }
  }

  return (
    <div className={`app ${darkMode ? 'dark-mode' : ''}`}>
      <Header
        serverConfig={serverConfig}
        onInfoClick={() => setShowInfoPanel(true)}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
      />

      <main className="main-content">
        {/* Input Section (keep as is) */}
        <section className="input-section">
          <h2>Analyze Text for Misinformation</h2>
          <form onSubmit={handleSubmit}>
             <div className="text-input-container">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste news text, social media post, or any content you want to analyze..."
                  rows={6}
                  className="text-input"
                />
                <button
                  type="submit"
                  className="submit-button"
                  disabled={isLoading || !inputText.trim()}
                >
                  {isLoading ? <FaSpinner className="spinner" /> : <FaPaperPlane />}
                  {isLoading ? ' Analyzing...' : ' Analyze'}
                </button>
              </div>
          </form>
        </section>

        {/* Error Message Display (keep as is) */}
        {error && (
          <div className="error-message">
            <FaInfoCircle /> {error}
          </div>
        )}

        {/* Loading Indicator (keep as is) */}
        {isLoading && (
          <LoadingIndicator message="Analyzing content, generating explanation, and checking facts..." />
        )}

        {showLowConfidencePrompt && !isLoading && result && (
          <div className="info-message low-confidence-prompt">
            <FaExclamationTriangle />
            <span>
              The confidence score ({Math.round(result.prediction.confidence * 100)}%) is below 95%.
              For higher accuracy, consider providing the full article text or more context if possible.
            </span>
          </div>
        )}

        {/* --- Results Section --- */}
        {result && !isLoading && (
          <section className="results-section">
            {/* Pass isExplanationAvailable to your ResultCard */}
            <ResultCard
              prediction={result.prediction}
              processingTime={result.processing_time_seconds.toFixed(2)} // Use actual processing time
              onExplainClick={handleExplainClick}
              // Add this prop: check if explanation status is success
              isExplanationAvailable={result.explanation?.status === 'success'}
            />

            {/* Fact Check Results (keep as is) */}
            {result.fact_check.status === 'success' && result.fact_check.claims.length > 0 && (
              <FactCheckResults factCheckData={result.fact_check} />
            )}

            {/* Feedback Form - Pass submitted state */}
            {/* No need for separate confirmation message here */}
            <FeedbackForm
              onSubmit={handleFeedbackSubmit}
              submitted={feedbackSubmitted} // Pass the state here
              classNames={serverConfig?.class_names || ['FAKE', 'REAL']}
              currentPrediction={result.prediction.label}
            />
          </section>
        )}
        {/* --- End Results Section --- */}


        {/* Search History (keep as is) */}
        {searchHistory.length > 0 && (
          <section className="history-section">
            <SearchHistory
              history={searchHistory}
              onItemClick={handleHistoryItemClick}
              onClearHistory={clearSearchHistory}
            />
          </section>
        )}
      </main>

      {showExplanation && result?.explanation && (
        <ExplanationModal
          explanation={result.explanation} // Pass the explanation object directly
          onClose={() => setShowExplanation(false)}
        />
      )}

      {/* Info Panel (keep as is) */}
      <InfoPanel
        isOpen={showInfoPanel}
        onClose={() => setShowInfoPanel(false)}
      />

      <Footer />
    </div>
  );
}

export default App;