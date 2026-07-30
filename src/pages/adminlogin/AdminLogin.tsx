import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signIn, getCurrentStaff } from '../../lib/auth';
import { useAuth } from '../../context/AuthContext';
import '../login/Login.css';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { staff } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (staff && staff.role === 'admin') {
      navigate('/admin', { replace: true });
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

      if (staffMember.role !== 'admin') {
        throw new Error('Access denied. This portal is for administrators only.');
      }

      window.location.assign('/admin');
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
          <div className="login-logo-icon" aria-label="Admin icon">
            <span aria-hidden="true">⚕️</span>
          </div>
          <h1 className="login-title">MediQueue Admin</h1>
          <p className="login-subtitle">Admin Portal — Sign in to continue</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <div className="login-field">
          <label className="login-label">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@hospital.com"
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

        <p className="login-demo-help" style={{ marginTop: '1rem' }}>
          <Link to="/staff/login" style={{ color: '#2563eb', textDecoration: 'none' }}>
            Are you a staff member? Sign in here →
          </Link>
        </p>
      </div>
    </div>
  );
}
