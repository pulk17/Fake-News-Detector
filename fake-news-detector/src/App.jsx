import React, { useState, useEffect } from 'react';
import './App.css';
import { FaCheck, FaTimes, FaQuestionCircle, FaInfoCircle, FaPaperPlane, FaSpinner, FaHistory } from 'react-icons/fa';
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

  // Fetch server configuration on component mount
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

  // Apply dark mode if enabled
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
    setFeedbackSubmitted(false);
    
    try {
      const data = await analyzeText(inputText);
      setResult(data);
      
      // Add to search history (keep last 10 items)
      const newHistoryItem = {
        text: inputText,
        timestamp: new Date().toISOString(),
        result: data.prediction.label
      };
      
      setSearchHistory(prevHistory => 
        [newHistoryItem, ...prevHistory].slice(0, 10)
      );
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedbackSubmit = async (wasPredictionCorrect, correctLabel) => {
    if (!result) return;
    
    try {
      await submitFeedback({
        text: inputText,
        prediction: result.prediction.label,
        confidence: result.prediction.confidence,
        was_correct: wasPredictionCorrect,
        correct_label: correctLabel
      });
      
      setFeedbackSubmitted(true);
    } catch (err) {
      console.error('Error submitting feedback:', err);
    }
  }

  const handleHistoryItemClick = (text) => {
    setInputText(text);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
  };

  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };

  return (
    <div className={`app ${darkMode ? 'dark-mode' : ''}`}>
      <Header 
        serverConfig={serverConfig} 
        onInfoClick={() => setShowInfoPanel(true)}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
      />
      
      <main className="main-content">
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

        {error && (
          <div className="error-message">
            <FaInfoCircle /> {error}
          </div>
        )}

        {isLoading && (
          <LoadingIndicator message="Analyzing content and checking facts..." />
        )}

        {result && (
          <section className="results-section">
            <ResultCard 
              prediction={result.prediction} 
              processingTime={result.processing_time_seconds}
              onExplainClick={() => setShowExplanation(true)}
            />
            
            {result.fact_check.status === 'success' && result.fact_check.claims.length > 0 && (
              <FactCheckResults factCheckData={result.fact_check} />
            )}
            
            <FeedbackForm 
              onSubmit={handleFeedbackSubmit} 
              submitted={feedbackSubmitted}
              classNames={serverConfig?.class_names || ['FAKE', 'REAL']}
              currentPrediction={result.prediction.label}
            />
          </section>
        )}

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
      
      {showExplanation && result && (
        <ExplanationModal 
          explanation={result.explanation} 
          onClose={() => setShowExplanation(false)} 
        />
      )}
      
      <InfoPanel 
        isOpen={showInfoPanel} 
        onClose={() => setShowInfoPanel(false)} 
      />
      
      <Footer />
    </div>
  );
}

export default App;