import React from 'react';
import { FaInfoCircle, FaExclamationTriangle, FaBook } from 'react-icons/fa';

function InfoPanel({ isOpen, onClose }) {
  if (!isOpen) return null;
  
  return (
    <div className="info-panel-overlay">
      <div className="info-panel">
        <div className="info-panel-header">
          <h2><FaInfoCircle /> About This Tool</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="info-panel-content">
          <section className="info-section">
            <h3><FaBook /> How It Works</h3>
            <p>The Fake News Detector uses an AI model trained on thousands of verified and fake news articles. It analyzes the content, structure, and language patterns to identify potential misinformation.</p>
            <p>The system examines various linguistic features, including:</p>
            <ul>
              <li>Emotional language and sensationalism</li>
              <li>Source credibility markers</li>
              <li>Statistical comparisons with known fake news</li>
              <li>Structural elements common in misinformation</li>
            </ul>
          </section>
          
          <section className="info-section">
            <h3><FaExclamationTriangle /> Important Disclaimers</h3>
            <p>This tool should be used as one of many resources to evaluate content reliability:</p>
            <ul>
              <li>No AI system is 100% accurate</li>
              <li>Always cross-check information with trusted sources</li>
              <li>Context matters - consider the full picture</li>
              <li>Your feedback helps improve the system's accuracy</li>
            </ul>
          </section>
          
          <div className="info-footer">
            <p>For more information, check out our <a href="#resources">educational resources</a> on media literacy.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InfoPanel;