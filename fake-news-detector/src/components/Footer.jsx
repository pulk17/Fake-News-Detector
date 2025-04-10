import React from 'react';

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <p>© {new Date().getFullYear()} Fake News Detector</p>
        <div className="footer-links">
          <a href="#about">About</a>
          <a href="#privacy">Privacy Policy</a>
          <a href="#terms">Terms of Service</a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;