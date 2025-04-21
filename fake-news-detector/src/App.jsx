// src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import './App.css'; 
import './Auth.css'; 
import { FaCheck, FaTimes, FaQuestionCircle, FaInfoCircle, FaPaperPlane, FaSpinner, FaHistory, FaExclamationTriangle } from 'react-icons/fa';
import ResultCard from './components/ResultCard';
import ExplanationModal from './components/ExplanationModal';
import FactCheckResults from './components/FactCheckResults';
import FeedbackForm from './components/FeedbackForm';
import Header from './components/Header';
import Footer from './components/Footer';
import InfoPanel from './components/InfoPanel';
import SearchHistory from './components/SearchHistory';
import LoadingIndicator from './components/LoadingIndicator';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage'; 
import useLocalStorage from './hooks/useLocalStorage';
import { analyzeText, getServerConfig, submitFeedback } from './utils/api'; 


const decodeJwt = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    console.error("Failed to decode JWT:", e);
    return null;
  }
};


function App() {
  // --- State ---
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

  // --- Authentication State ---
  const [token, setToken] = useState(() => localStorage.getItem('authToken')); 
  const [userEmail, setUserEmail] = useLocalStorage('userEmail', null); 
  const [currentView, setCurrentView] = useState('main'); 

  // --- Effects ---

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await getServerConfig();
        setServerConfig(config);
      } catch (err) {
        console.error('Error fetching server config:', err);
         setError('Could not connect to the API. Please try again later.'); 
      }
    };
    fetchConfig();
  }, []);

   useEffect(() => {
    if (token) {
      const decoded = decodeJwt(token);
      if (!decoded || decoded.exp * 1000 < Date.now()) {
        console.log("Token expired or invalid on load, logging out.");
        handleLogout(); 
      } else {
        if (!userEmail && decoded?.email) {
          setUserEmail(decoded.email);
        }
        console.log("User appears logged in with token:", token ? token.substring(0, 10) + '...' : 'None');
      }
    }
  }, [token, userEmail, setUserEmail]);


  // Apply dark mode 
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  // --- Handlers ---

  const handleAnalyzeSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setIsLoading(true);
    setError(null); 
    setResult(null);
    setFeedbackSubmitted(false);
    setShowLowConfidencePrompt(false);

    try {
      const data = await analyzeText(inputText); // Uses api.js
      setResult(data);

      if (data.prediction.confidence < 0.95) { 
        setShowLowConfidencePrompt(true);
      }
      const newHistoryItem = {
        text: inputText,
        timestamp: new Date().toISOString(),
        result: data.prediction.label
      };
      setSearchHistory(prevHistory =>
        [newHistoryItem, ...prevHistory].slice(0, 10)
      );

    } catch (err) {
      console.error("Analysis Error in App.jsx:", err);
      setError(err.message || 'An unexpected error occurred during analysis.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedbackSubmit = useCallback(async (wasPredictionCorrect, correctLabel) => {
     if (!result || !token) {
        setError("Cannot submit feedback: No result available or not logged in.");
        return Promise.reject("Not logged in or no result"); 
     }


     try {
       const feedbackPayload = {
          text: inputText, 
          prediction: result.prediction.label,
          confidence: result.prediction.confidence,
          was_correct: wasPredictionCorrect,
          correct_label: !wasPredictionCorrect ? correctLabel : null
        };

       console.log("Submitting feedback with payload:", feedbackPayload);
       console.log("Using token:", token ? token.substring(0,10) + '...' : 'None');

       await submitFeedback(feedbackPayload); 

       setFeedbackSubmitted(true); 
       setError(null); 
       return Promise.resolve(); 

     } catch (err) {
       console.error('Error submitting feedback in App.jsx:', err);
       setError(`Feedback submission failed: ${err.message}`); 
       setFeedbackSubmitted(false); 
       return Promise.reject(err.message); 
     }
  }, [result, token, inputText, setError, setFeedbackSubmitted]); 


  // --- Auth Handlers ---
  const handleLoginSuccess = (newToken, email) => {
    localStorage.setItem('authToken', newToken);
    setToken(newToken);
    setUserEmail(email);
    setCurrentView('main'); 
    setError(null); 
    console.log("Login successful, email:", email);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setToken(null);
    setUserEmail(null);
    setCurrentView('main');
    setError(null);
    console.log("User logged out.");
  };

  const handleSignupSuccess = () => {
      setCurrentView('login');
      setError(null); 
      console.log("Signup reported success, switching to login view.");
  };

   // --- Navigation Handlers ---
  const showLogin = () => setCurrentView('login');
  const showSignup = () => setCurrentView('signup');
  const showMain = () => setCurrentView('main');

  // --- Other Handlers 0---
  const handleHistoryItemClick = (text) => {
    setInputText(text);
    setCurrentView('main'); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
  };

  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };

  const handleExplainClick = () => {
    if (result?.explanation) {
      setShowExplanation(true);
    } else {
      console.warn("Attempted to show explanation but result.explanation data is missing.");
       setError("Explanation data is not available for this result.");
    }
  };

 // --- Render Logic ---
  const renderView = () => {
    switch (currentView) {
      case 'login':
        return <LoginPage
                    onLoginSuccess={handleLoginSuccess}
                    onSwitchToSignup={() => setCurrentView('signup')}
                    onError={setError} 
                />;
      case 'signup':
        return <SignupPage
                    onSignupSuccess={handleSignupSuccess}
                    onSwitchToLogin={() => setCurrentView('login')}
                    onError={setError} 
                />;
      case 'main':
      default:
        return (
          <>
            <section className="input-section">
              <h2>Analyze Text for Misinformation</h2>
              <form onSubmit={handleAnalyzeSubmit}>
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

             {error && !isLoading && ( 
                 <div className="error-message global-error"> 
                     <FaExclamationTriangle /> {error}
                 </div>
             )}

            {isLoading && (
              <LoadingIndicator message="Analyzing content, generating explanation, and checking facts..." />
            )}

             {showLowConfidencePrompt && !isLoading && result && (
                 <div className="info-message low-confidence-prompt">
                      <FaExclamationTriangle />
                      <span>
                          The confidence score ({Math.round(result.prediction.confidence * 100)}%) is below 95%. For higher accuracy, consider providing the full article text or more context if possible.
                      </span>
                  </div>
             )}


            {result && !isLoading && (
              <section className="results-section">
                <ResultCard
                  prediction={result.prediction}
                  processingTime={result.processing_time_seconds != null ? result.processing_time_seconds.toFixed(2) : 'N/A'}
                  onExplainClick={handleExplainClick}
                  isExplanationAvailable={result.explanation?.status === 'success' && !!result.explanation?.html} 
                />

                {result.fact_check?.status === 'success' && result.fact_check.claims?.length > 0 && (
                  <FactCheckResults factCheckData={result.fact_check} />
                )}

                <FeedbackForm
                  onSubmit={handleFeedbackSubmit}
                  submitted={feedbackSubmitted}
                  classNames={serverConfig?.class_names || ['FAKE', 'REAL']}
                  currentPrediction={result.prediction.label}
                  token={token}
                  onShowLogin={showLogin}
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
          </>
        );
    }
  };


  return (
    <div className={`app ${darkMode ? 'dark-mode' : ''}`}>
      <Header
        serverConfig={serverConfig}
        onInfoClick={() => setShowInfoPanel(true)}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        token={token}
        userEmail={userEmail}
        onShowLogin={showLogin}
        onShowSignup={showSignup}
        onLogout={handleLogout}
      />

      <main className="main-content">
        {renderView()}
      </main>

      {showExplanation && result?.explanation && (
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