import React from 'react';
import { FaNewspaper, FaQuestionCircle, FaMoon, FaSun, FaSignInAlt, FaUserPlus, FaSignOutAlt } from 'react-icons/fa';

function Header({
  serverConfig,
  onInfoClick,
  darkMode,
  onToggleDarkMode,
  token,
  userEmail,
  onShowLogin,
  onShowSignup,
  onLogout
}) {
  return (
    <header className="header">
      <div className="logo">
        <FaNewspaper className="logo-icon" />
        <h1>BuzzBuster</h1> 
        <p>A Fake News Dector AI Tool</p>
      </div>

      <div className="header-actions">
         {/* Server Status (keep as is) */}
         <div className="server-status">
             {serverConfig ? (
                 <div className="status online">
                     <span className="status-dot"></span> API Connected
                 </div>
             ) : (
                 <div className="status offline">
                     <span className="status-dot"></span> API Disconnected
                 </div>
             )}
         </div>

        {/* Dark Mode Toggle (keep as is) */}
        <button
          className="header-button toggle-theme-button"
          onClick={onToggleDarkMode}
          title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {darkMode ? <FaSun /> : <FaMoon />}
        </button>

        {/* Info Button (keep as is) */}
        <button
          className="header-button info-button"
          onClick={onInfoClick}
          title="About this tool"
        >
          <FaQuestionCircle />
        </button>

        {token ? (
          <>
            <span className="user-email" title={userEmail}>{userEmail}</span>
            <button
              className="header-button auth-action-button"
              onClick={onLogout}
              title="Logout"
            >
              <FaSignOutAlt /> Logout
            </button>
          </>
        ) : (
          <>
            <button
              className="header-button auth-action-button"
              onClick={onShowLogin}
              title="Login"
            >
              <FaSignInAlt /> Login
            </button>
            <button
              className="header-button auth-action-button"
              onClick={onShowSignup}
              title="Sign Up"
            >
              <FaUserPlus /> Sign Up
            </button>
          </>
        )}

      </div>
    </header>
  );
}

export default Header;