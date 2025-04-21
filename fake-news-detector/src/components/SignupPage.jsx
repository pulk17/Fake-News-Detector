import React, { useState } from 'react';
import { registerUser } from '../utils/api';
import { FaUserPlus, FaEnvelope, FaLock, FaSpinner } from 'react-icons/fa';

function SignupPage({ onSignupSuccess, onSwitchToLogin, onError }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      onError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
        setError('Password must be at least 8 characters long.');
        onError('Password must be at least 8 characters long.');
        return;
    }

    setIsLoading(true);
    setError('');
    setSuccessMessage('');
    onError(''); 

    try {
      const data = await registerUser({ email, password });
      setSuccessMessage(data.message || 'Registration successful! Please log in.');
      onSignupSuccess();
      setEmail('');
      setPassword('');
      setConfirmPassword('');

    } catch (err) {
       console.error("Signup Page Error:", err);
       const errorMessage = err.message || 'Registration failed. Please try again.';
       setError(errorMessage);
       onError(errorMessage); 
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page signup-page">
      <h2>Sign Up</h2>
      <form onSubmit={handleSubmit}>
        {error && <p className="error-message auth-error">{error}</p>}
        {successMessage && <p className="success-message">{successMessage}</p>}
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
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            disabled={isLoading}
          />
        </div>
         <div className="input-group">
          <FaLock />
          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            disabled={isLoading}
          />
        </div>
        <button type="submit" className="auth-button" disabled={isLoading}>
          {isLoading ? <FaSpinner className="spinner" /> : <FaUserPlus />}
          {isLoading ? ' Signing Up...' : ' Sign Up'}
        </button>
      </form>
      <p className="switch-auth">
        Already have an account?{' '}
        <button type="button" onClick={onSwitchToLogin} className="link-button">
          Login
        </button>
      </p>
    </div>
  );
}

export default SignupPage;