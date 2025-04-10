import React from 'react';
import { FaNewspaper, FaQuestionCircle, FaMoon, FaSun } from 'react-icons/fa';

function Header({ serverConfig, onInfoClick, darkMode, onToggleDarkMode }) {
  return (
    <header className="header">
      <div className="logo">
        <FaNewspaper className="logo-icon" />
        <h1>Fake News Detector</h1>
      </div>
      <div className="header-actions">
        <div className="server-status">
          {serverConfig ? (
            <div className="status online">
              <span className="status-dot"></span>
              API Connected
            </div>
          ) : (
            <div className="status offline">
              <span className="status-dot"></span>
              API Disconnected
            </div>
          )}
        </div>
        
        <button 
          className="header-button toggle-theme-button" 
          onClick={onToggleDarkMode}
          title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {darkMode ? <FaSun /> : <FaMoon />}
        </button>
        
        <button 
          className="header-button info-button" 
          onClick={onInfoClick}
          title="About this tool"
        >
          <FaQuestionCircle />
        </button>
      </div>
    </header>
  );
}

export default Header;