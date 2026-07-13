import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { getCurrentStaff } from '../../lib/auth';
import './AcceptInvite.css';

// Supabase's invite link lands here with tokens in the URL hash/query.
// The client SDK picks those up automatically (detectSessionInUrl is on
// by default), which briefly authenticates the user just enough for them
// to set a real password via auth.updateUser().
export default function AcceptInvite() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setCheckingSession(false);
    });
  }, []);

  async function handleSetPassword() {
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      const staff = await getCurrentStaff();
      navigate(staff?.role === 'admin' ? '/admin' : '/staff', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Could not set password. Try the invite link again.');
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <div className="ai-page">
        <div className="ai-card">
          <p className="ai-subtitle">Checking your invite link…</p>
        </div>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="ai-page">
        <div className="ai-card">
          <h1 className="ai-title">Invite link expired</h1>
          <p className="ai-subtitle">
            This invite link is invalid or has expired. Ask an admin to resend your invitation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-page">
      <div className="ai-card">
        <h1 className="ai-title">Welcome to MediQueue</h1>
        <p className="ai-subtitle">Set a password to activate your staff account.</p>

        {error && <div className="ai-error">{error}</div>}

        <div className="ai-field">
          <label className="ai-label">New Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="ai-input"
          />
        </div>

        <div className="ai-field">
          <label className="ai-label">Confirm Password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && password && confirm && !loading) handleSetPassword();
            }}
            placeholder="••••••••"
            className="ai-input"
          />
        </div>

        <button
          onClick={handleSetPassword}
          disabled={loading || !password || !confirm}
          className="ai-button"
        >
          {loading ? 'Setting password…' : 'Activate Account'}
        </button>
      </div>
    </div>
  );
}