import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, ArrowRight, Shield } from 'lucide-react'
import { signIn, getCurrentStaff } from '../../lib/auth'
import { useAuth } from '../../context/AuthContext'
import '../login/Login.css'

export default function AdminLogin() {
  const navigate = useNavigate()
  const { staff } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (staff && staff.role === 'admin') navigate('/admin', { replace: true }) }, [staff, navigate])

  async function handleLogin() {
    setError(null); setLoading(true)
    try {
      await signIn(email, password)
      const staffMember = await getCurrentStaff()
      if (!staffMember) throw new Error('No staff record found.')
      if (staffMember.role !== 'admin') throw new Error('Access denied. Admin only.')
      window.location.assign('/admin')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid credentials')
    } finally { setLoading(false) }
  }

  return (
    <div className="login">
      <div className="login__content">
        <motion.div className="login__card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="login__header">
            <span className="login__logo"><Shield size={40} /></span>
            <h1 className="login__title">Admin Portal</h1>
            <p className="login__sub">MediQueue Administration</p>
          </div>
          {error && <motion.div className="login__error" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>{error}</motion.div>}
          <div className="login__field">
            <label>Email</label>
            <div className="login__input-wrap"><Mail size={16} className="login__input-icon" /><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@hospital.com" /></div>
          </div>
          <div className="login__field">
            <label>Password</label>
            <div className="login__input-wrap"><Lock size={16} className="login__input-icon" /><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => { if (e.key === 'Enter' && email && password && !loading) handleLogin() }} /></div>
          </div>
          <button className="login__btn" onClick={handleLogin} disabled={loading || !email || !password}>
            {loading ? <span className="login__btn-loading"><span className="login__spinner" />Signing in</span> : <span className="login__btn-text">Sign In <ArrowRight size={18} /></span>}
          </button>
          <p className="login__footer-link"><Link to="/staff/login">Staff member? Sign in here →</Link></p>
        </motion.div>
      </div>
    </div>
  )
}
