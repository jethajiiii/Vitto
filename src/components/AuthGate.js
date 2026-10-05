'use client';

const { useState, useEffect } = require('react');
const { onAuthStateChanged, signInWithEmailAndPassword, signOut } = require('firebase/auth');
const { getClientAuth } = require('../lib/firebaseClient.js');

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
          <h1 className="auth-title">Sign in to Vitto</h1>
          <p className="auth-subtitle">Loan Servicing Dashboard</p>

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
          <span className="brand-logo">Vitto</span>
          <span className="brand-tag">Loan Servicing</span>
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
