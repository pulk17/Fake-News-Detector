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


// Helper to decode JWT (basic, only gets payload, doesn't verify signature)
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
  const [token, setToken] = useState(() => localStorage.getItem('authToken')); // Store token
  const [userEmail, setUserEmail] = useLocalStorage('userEmail', null); // Store user email
  const [currentView, setCurrentView] = useState('main'); // 'main', 'login', 'signup'

  // --- Effects ---

  // Fetch server config (no change needed)
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await getServerConfig();
        setServerConfig(config);
      } catch (err) {
        console.error('Error fetching server config:', err);
         setError('Could not connect to the API. Please try again later.'); // Inform user
      }
    };
    fetchConfig();
  }, []);

   // Check token validity on load 
   useEffect(() => {
    if (token) {
      const decoded = decodeJwt(token);
      if (!decoded || decoded.exp * 1000 < Date.now()) {
        console.log("Token expired or invalid on load, logging out.");
        handleLogout(); // Use handleLogout which now clears localStorage
      } else {
        if (!userEmail && decoded?.email) {
          setUserEmail(decoded.email);
        }
        console.log("User appears logged in with token:", token ? token.substring(0, 10) + '...' : 'None');
      }
    }
    // Add handleLogout to dependency array if it's defined with useCallback, otherwise be careful
  }, [token, userEmail, setUserEmail]);


  // Apply dark mode (no change needed)
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
    setError(null); // Clear previous errors
    setResult(null);
    setFeedbackSubmitted(false);
    setShowLowConfidencePrompt(false);

    try {
      const data = await analyzeText(inputText); // Uses api.js
      setResult(data);

      if (data.prediction.confidence < 0.95) { // Confidence check remains
        setShowLowConfidencePrompt(true);
      }
      // Update history (remains)
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
     // No result or no token? Don't proceed. The form UI should prevent this, but double-check.
     if (!result || !token) {
        setError("Cannot submit feedback: No result available or not logged in.");
        return Promise.reject("Not logged in or no result"); // Return a rejected promise
     }

     // NOTE: We no longer set feedbackSubmitted=true *before* the API call
     // because the form now handles its own loading/submitted state internally
     // if an error occurs during submission.

     try {
       const feedbackPayload = {
          text: inputText, // Make sure inputText corresponds to the 'result'
          prediction: result.prediction.label,
          confidence: result.prediction.confidence,
          was_correct: wasPredictionCorrect,
          // Send correctLabel only if prediction was incorrect
          correct_label: !wasPredictionCorrect ? correctLabel : null
        };

       console.log("Submitting feedback with payload:", feedbackPayload);
       console.log("Using token:", token ? token.substring(0,10) + '...' : 'None');

       await submitFeedback(feedbackPayload); // Uses api.js which now includes token

       setFeedbackSubmitted(true); // Set submitted state ONLY on successful API call
       setError(null); // Clear any previous errors on success
       return Promise.resolve(); // Indicate success

     } catch (err) {
       console.error('Error submitting feedback in App.jsx:', err);
       setError(`Feedback submission failed: ${err.message}`); // Show error globally
       setFeedbackSubmitted(false); // Ensure form is not stuck in submitted state on error
       return Promise.reject(err.message); // Propagate error message
     }
  }, [result, token, inputText, setError, setFeedbackSubmitted]); 


  // --- Auth Handlers ---
  const handleLoginSuccess = (newToken, email) => {
    localStorage.setItem('authToken', newToken);
    setToken(newToken);
    setUserEmail(email);
    setCurrentView('main'); // Switch back to main view after login
    setError(null); // Clear any previous login/signup errors
    console.log("Login successful, email:", email);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setToken(null);
    setUserEmail(null);
    setCurrentView('main'); // Go back to main view
    setError(null);
    console.log("User logged out.");
  };

  const handleSignupSuccess = () => {
      // Decide what to do after successful signup
      // Option 1: Switch to login view automatically
      setCurrentView('login');
      // Option 2: Keep them on signup page with a success message (handled in SignupPage)
      setError(null); 
      console.log("Signup reported success, switching to login view.");
  };

   // --- Navigation Handlers ---
  const showLogin = () => setCurrentView('login');
  const showSignup = () => setCurrentView('signup');
  const showMain = () => setCurrentView('main');


  // --- Other Handlers (Keep existing ones) ---
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

             {/* Global Error Display */}
             {error && !isLoading && ( // Don't show analysis errors while loading new analysis
                 <div className="error-message global-error"> 
                     <FaExclamationTriangle /> {error}
                 </div>
             )}


            {/* Loading Indicator */}
            {isLoading && (
              <LoadingIndicator message="Analyzing content, generating explanation, and checking facts..." />
            )}

             {/* Low Confidence Prompt */}
             {showLowConfidencePrompt && !isLoading && result && (
                 <div className="info-message low-confidence-prompt">
                      <FaExclamationTriangle />
                      <span>
                          The confidence score ({Math.round(result.prediction.confidence * 100)}%) is below 95%. For higher accuracy, consider providing the full article text or more context if possible.
                      </span>
                  </div>
             )}


            {/* Results Section */}
            {result && !isLoading && (
              <section className="results-section">
                <ResultCard
                  prediction={result.prediction}
                  processingTime={result.processing_time_seconds != null ? result.processing_time_seconds.toFixed(2) : 'N/A'}
                  onExplainClick={handleExplainClick}
                  isExplanationAvailable={result.explanation?.status === 'success' && !!result.explanation?.html} // Check HTML exists too
                />

                {result.fact_check?.status === 'success' && result.fact_check.claims?.length > 0 && (
                  <FactCheckResults factCheckData={result.fact_check} />
                )}

                {/* Pass token to FeedbackForm */}
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

            {/* Search History */}
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
        // Pass auth state and handlers to Header
        token={token}
        userEmail={userEmail}
        onShowLogin={showLogin}
        onShowSignup={showSignup}
        onLogout={handleLogout}
      />

      <main className="main-content">
        {renderView()}
      </main>

      {/* Modals and Panels (keep existing ones) */}
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