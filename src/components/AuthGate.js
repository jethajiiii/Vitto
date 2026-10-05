'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getClientAuth } from '../lib/firebaseClient.js';

/**
 * Maps Firebase Auth error codes to friendly, safe user-facing error messages.
 * Never exposes raw Firebase error codes or stack traces.
 */
function getFriendlyAuthError(error) {
  const code = error?.code || '';
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/user-not-found' ||
    code === 'auth/wrong-password' ||
    code === 'auth/invalid-email'
  ) {
    return 'Invalid email or password. Please check your credentials.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many failed sign-in attempts. Please wait a moment and try again.';
  }
  if (code === 'auth/network-request-failed') {
    return "Couldn't reach the authentication server. Please check your network connection.";
  }
  return 'Sign in failed. Please check your credentials and try again.';
}

export default function AuthGate({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const auth = getClientAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setAuthError('');
    setSubmitting(true);

    try {
      const auth = getClientAuth();
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setAuthError(getFriendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const auth = getClientAuth();
      await signOut(auth);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  if (loading) {
    return <div className="loading-state">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-logo-wrapper">
            <div className="logo-badge">
              <svg className="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h1 className="auth-title">Vitto</h1>
              <p className="auth-subtitle">Loan Servicing Platform</p>
            </div>
          </div>

          {authError && <div className="error-banner">{authError}</div>}

          <form onSubmit={handleSignIn} className="auth-form">
            <div className="form-group">
              <label htmlFor="auth-email">Email Address</label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@vitto.app"
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={submitting}
              />
            </div>

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-brand">
          <div className="logo-badge logo-badge-sm">
            <svg className="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="brand-text">
            <span className="brand-logo">Vitto</span>
            <span className="brand-tag">Loan Servicing</span>
          </div>
        </div>
        <div className="header-user">
          <span className="user-email">{user.email || 'Operator'}</span>
          <button type="button" onClick={handleSignOut} className="btn-secondary btn-sm">
            Sign out
          </button>
        </div>
      </header>

      <main className="app-main">{children}</main>
    </div>
  );
}
