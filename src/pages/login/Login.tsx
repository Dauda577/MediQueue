import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn, getCurrentStaff } from '../../lib/auth';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { staff } = useAuth();

  // If already logged in (e.g. session restored on mount), skip the form
  useEffect(() => {
    if (staff) {
      navigate(staff.role === 'admin' ? '/admin' : '/staff', { replace: true });
    }
  }, [staff, navigate]);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      const staffMember = await getCurrentStaff();
      if (!staffMember) {
        throw new Error('No staff record found for this account.');
      }
      navigate(staffMember.role === 'admin' ? '/admin' : '/staff', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 3H5C3.9 3 3 3.9 3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14h-2v-4H8v-2h2V9h2v2h2v2h-2v4z"/>
            </svg>
          </div>
          <h1 className="login-title">MediQueue</h1>
          <p className="login-subtitle">Staff Portal — Sign in to continue</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <div className="login-field">
          <label className="login-label">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@hospital.com"
            className="login-input"
          />
        </div>

        <div className="login-field">
          <label className="login-label">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && email && password && !loading) handleLogin();
            }}
            placeholder="••••••••"
            className="login-input"
          />
        </div>

        <button
          onClick={handleLogin}
          disabled={loading || !email || !password}
          className="login-button"
        >
          {loading ? <span className="login-spinner">Signing in</span> : 'Sign In'}
        </button>

        <p className="login-footer">MediQueue &copy; {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}