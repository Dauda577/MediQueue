import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, ArrowRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getCurrentStaff } from '../../lib/auth'
import '../login/Login.css'

export default function AcceptInvite() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }: { data: { session: unknown } }) => {
      setHasSession(!!data.session); setCheckingSession(false)
    })
  }, [])

  async function handleSetPassword() {
    setError(null)
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      const staff = await getCurrentStaff()
      navigate(staff?.role === 'admin' ? '/admin' : '/staff', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not set password.')
    } finally { setLoading(false) }
  }

  if (checkingSession) {
    return <div className="login"><div className="login__content"><div className="login__card" style={{ textAlign: 'center' }}><p className="login__sub">Checking your invite link…</p></div></div></div>
  }
  if (!hasSession) {
    return <div className="login"><div className="login__content"><div className="login__card" style={{ textAlign: 'center' }}><h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1A2E33' }}>Invite link expired</h2><p className="login__sub">Ask an admin to resend your invitation.</p></div></div></div>
  }
  return (
    <div className="login">
      <div className="login__content">
        <motion.div className="login__card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="login__header">
            <span className="login__logo">⚕️</span>
            <h1 className="login__title">Welcome to MediQueue</h1>
            <p className="login__sub">Set a password to activate your staff account.</p>
          </div>
          {error && <motion.div className="login__error" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>{error}</motion.div>}
          <div className="login__field">
            <label>New Password</label>
            <div className="login__input-wrap"><Lock size={16} className="login__input-icon" /><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="8+ characters" /></div>
          </div>
          <div className="login__field">
            <label>Confirm Password</label>
            <div className="login__input-wrap"><Lock size={16} className="login__input-icon" /><input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" onKeyDown={e => { if (e.key === 'Enter' && password && confirm && !loading) handleSetPassword() }} /></div>
          </div>
          <button className="login__btn" onClick={handleSetPassword} disabled={loading || !password || !confirm}>
            {loading ? <span className="login__btn-loading"><span className="login__spinner" />Setting password</span> : <span className="login__btn-text">Activate Account <ArrowRight size={18} /></span>}
          </button>
        </motion.div>
      </div>
    </div>
  )
}
