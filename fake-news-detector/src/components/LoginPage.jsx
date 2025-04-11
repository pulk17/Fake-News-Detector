import React, { useState } from 'react';
import { loginUser } from '../utils/api';
import { FaEnvelope, FaLock, FaSignInAlt, FaSpinner } from 'react-icons/fa';

function LoginPage({ onLoginSuccess, onSwitchToSignup, onError }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    onError(''); // Clear global error

    try {
      const data = await loginUser({ email, password });
      if (data.access_token) {
        onLoginSuccess(data.access_token, email); // Pass token and email up
      } else {
        throw new Error("Login response did not contain access token.");
      }
    } catch (err) {
      console.error("Login Page Error:", err);
      const errorMessage = err.message || 'Login failed. Please check your credentials.';
      setError(errorMessage);
      onError(errorMessage); // Set global error as well
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page login-page">
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        {error && <p className="error-message auth-error">{error}</p>}
        <div className="input-group">
          <FaEnvelope />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <div className="input-group">
          <FaLock />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <button type="submit" className="auth-button" disabled={isLoading}>
          {isLoading ? <FaSpinner className="spinner" /> : <FaSignInAlt />}
          {isLoading ? ' Logging In...' : ' Login'}
        </button>
      </form>
      <p className="switch-auth">
        Don't have an account?{' '}
        <button type="button" onClick={onSwitchToSignup} className="link-button">
          Sign Up
        </button>
      </p>
    </div>
  );
}

export default LoginPage;