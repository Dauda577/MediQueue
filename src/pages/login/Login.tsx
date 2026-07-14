import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentStaff, signIn } from '../../lib/auth';
import './Login.css';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      const staffMember = await getCurrentStaff();
      navigate(staffMember?.role === 'admin' ? '/admin' : '/staff');
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
          <div className="login-logo-icon" aria-label="Medical icon">
            <span aria-hidden="true">⚕️</span>
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
