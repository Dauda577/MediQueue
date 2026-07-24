import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useRealtimeQueue } from '../../hooks/useRealtimeQueue'
import { queueService } from '../../services/queueService'
import './CheckIn.css';




export type DepartmentId = 'OPD' | 'Lab' | 'Pharmacy' | 'Maternity';

export interface DepartmentConfig {
  id: DepartmentId;
  label: string;
  sub: string;
  icon: string;
  avgMinsPerPatient: number; // used to derive wait time consistently with QueueTracker
}

export interface QueueStats {
  waiting: number;
  avgWaitMins: number;
}

export type DepartmentStats = Record<DepartmentId, QueueStats>;

const DEPARTMENTS: DepartmentConfig[] = [
  { id: 'OPD',      label: 'OPD',      sub: 'Gen. Consultation', icon: '🩺', avgMinsPerPatient: 4 },
  { id: 'Lab',      label: 'Lab',      sub: 'Blood & Scans',     icon: '🔬', avgMinsPerPatient: 2 },
  { id: 'Pharmacy', label: 'Pharmacy', sub: 'Prescriptions',     icon: '💊', avgMinsPerPatient: 1 },
  { id: 'Maternity', label: 'Maternity', sub: 'Maternal Care',   icon: '🤱', avgMinsPerPatient: 6 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validatePhone(phone: string): string | null {
  if (!phone.trim()) return null; // optional field — empty is fine
  // Accepts +233XXXXXXXXX or 0XXXXXXXXX (Ghana), 10–13 digits
  const cleaned = phone.replace(/[\s\-().]/g, '');
  if (!/^(\+233|0)\d{9}$/.test(cleaned)) {
    return 'Enter a valid Ghanaian number, e.g. 024 XXX XXXX';
  }
  return null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const LiveDot: React.FC = () => (
  <motion.span
    className="ci-live-dot"
    animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
  />
);

// ─── Main component ───────────────────────────────────────────────────────────

export default function CheckIn() {
  const navigate = useNavigate();

  // ── Form state ──
  const [fullName, setFullName]       = useState('');
  const [phone, setPhone]             = useState('');
  const [department, setDepartment]   = useState<DepartmentId | null>(null);
  const [isPriority, setIsPriority]   = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string }>({});

  const [deptStats, setDeptStats] = useState<DepartmentStats>({
    OPD:      { waiting: 0, avgWaitMins: 0 },
    Lab:      { waiting: 0, avgWaitMins: 0 },
    Pharmacy: { waiting: 0, avgWaitMins: 0 },
    Maternity: { waiting: 0, avgWaitMins: 0 },
  });

  const fetchDeptStats = useCallback(async () => {
    const entries = await Promise.all(
      DEPARTMENTS.map(async (dept) => {
        const queue = await queueService.getQueueByDepartment(dept.id)
        return { id: dept.id, waiting: queue.length }
      })
    )
    setDeptStats(prev => {
      const updated = { ...prev }
      for (const { id, waiting } of entries) {
        const avgMins = DEPARTMENTS.find(d => d.id === id)?.avgMinsPerPatient ?? 4
        updated[id] = { waiting, avgWaitMins: waiting * avgMins }
      }
      return updated
    })
  }, [])

  useRealtimeQueue({ onUpdate: fetchDeptStats })

  useEffect(() => { fetchDeptStats() }, [fetchDeptStats])

  // ── Validation ──
  const validate = useCallback((): boolean => {
    const errors: { name?: string; phone?: string } = {};
    if (!fullName.trim()) errors.name = 'Full name is required.';
    const phoneErr = validatePhone(phone);
    if (phoneErr) errors.phone = phoneErr;
    if (!department) {
      setError('Please select a department.');
      setFieldErrors(errors);
      return false;
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Please fix the errors above.');
      return false;
    }
    return true;
  }, [fullName, phone, department]);

  // ── Submit ──
  const handleSubmit = async () => {
    setError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const patient = await queueService.checkInPatient(
        fullName.trim(),
        department!,
        {
          phone: phone.trim() || undefined,
          priority: isPriority ? 'priority' : 'normal',
        }
      );

      navigate(`/queue/${patient.token_id}`, {
        state: {
          fullName:   patient.full_name,
          phone:      patient.phone,
          department: patient.initial_department,
          isPriority: patient.priority !== 'normal',
          tokenId:    patient.token_id,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  // ── Derived: wait time for selected department ──
  const selectedDeptWait = department ? deptStats[department].avgWaitMins : null;

  return (
    <motion.div
      className="ci-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* ── Status bar color fill (mobile) ── */}
      <div className="ci-status-bar-fill" />

      {/* ── Nav ── */}
      <nav className="ci-nav">
        <div className="ci-nav-inner">
          <div className="ci-brand">
            <span className="ci-brand-icon">⚕</span>
            <span className="ci-brand-name">MediQueue</span>
          </div>
          <button className="ci-nav-bell" aria-label="Notifications">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span className="ci-notification-dot" />
          </button>
        </div>
      </nav>

      <div className="ci-body">
        {/* ── Left column ── */}
        <div className="ci-left">

          {/* Hero */}
          <motion.div
            className="ci-hero"
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h1 className="ci-title">
              Welcome to<br />
              <span className="ci-title-highlight">Central Medical</span>
            </h1>
            <p className="ci-subtitle">
              Please provide your details to join the queue.
            </p>
          </motion.div>

          {/* Patient info card */}
          <motion.div
            className="ci-card"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="ci-card-head">
              <svg className="ci-card-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <span className="ci-card-title">Patient Information</span>
            </div>

            {/* Full name */}
            <div className="ci-field">
              <label className="ci-label">
                Full Name <span className="ci-req">*</span>
              </label>
              <input
                className={`ci-input${fieldErrors.name ? ' ci-input--error' : ''}`}
                type="text"
                placeholder="Enter your full legal name"
                value={fullName}
                onChange={e => { setFullName(e.target.value); setFieldErrors(p => ({ ...p, name: undefined })); }}
              />
              <AnimatePresence>
                {fieldErrors.name && (
                  <motion.p className="ci-field-error"
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    {fieldErrors.name}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Phone */}
            <div className="ci-field">
              <label className="ci-label">
                Phone Number <span className="ci-opt">(Optional)</span>
              </label>
              <div className="ci-input-wrap">
                <svg className="ci-input-pre-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                <input
                  className={`ci-input ci-input--pre${fieldErrors.phone ? ' ci-input--error' : ''}`}
                  type="tel"
                  placeholder="+233 XX XXX XXXX"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setFieldErrors(p => ({ ...p, phone: undefined })); }}
                />
              </div>
              <AnimatePresence>
                {fieldErrors.phone ? (
                  <motion.p className="ci-field-error"
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    {fieldErrors.phone}
                  </motion.p>
                ) : (
                  <p className="ci-hint">We'll notify you when your turn is approaching.</p>
                )}
              </AnimatePresence>
            </div>

            {/* Priority flag */}
            <div className="ci-field">
              <button
                type="button"
                className={`ci-priority-toggle${isPriority ? ' ci-priority-toggle--active' : ''}`}
                onClick={() => setIsPriority(p => !p)}
              >
                <span className="ci-priority-toggle-icon">⚡</span>
                <div className="ci-priority-toggle-text">
                  <span className="ci-priority-toggle-label">Emergency / Priority</span>
                  <span className="ci-priority-toggle-sub">Select if you need urgent attention</span>
                </div>
                <span className={`ci-priority-check${isPriority ? ' ci-priority-check--on' : ''}`}>
                  {isPriority && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </span>
              </button>
            </div>
          </motion.div>

          {/* Department selection */}
          <motion.div
            className="ci-card"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className="ci-card-head">
              <svg className="ci-card-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
              <span className="ci-card-title">Select Department</span>
            </div>

            <div className="ci-dept-grid">
              {DEPARTMENTS.map((dept, index) => {
                const stats = deptStats[dept.id];
                const waitMins = stats.waiting === 0 ? 0 : stats.avgWaitMins;
                const isActive = department === dept.id;

                return (
                  <motion.button
                    key={dept.id}
                    className={`ci-dept-card${isActive ? ' ci-dept-card--active' : ''}`}
                    onClick={() => { setDepartment(dept.id); setError(''); }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    whileHover={{ y: -4, scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <div className="ci-dept-icon-wrap">
                      <span className="ci-dept-emoji">{dept.icon}</span>
                    </div>
                    <span className="ci-dept-name">{dept.label}</span>
                    <span className="ci-dept-sub">{dept.sub}</span>
                    <span className={`ci-dept-wait${stats.waiting === 0 ? ' ci-dept-wait--clear' : ''}`}>
                      {stats.waiting === 0 ? 'No wait' : `~${waitMins} min`}
                    </span>

                    <AnimatePresence>
                      {isActive && (
                        <motion.span
                          className="ci-dept-check"
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0, rotate: 180 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>

            {/* Selected dept wait callout */}
            <AnimatePresence>
              {selectedDeptWait !== null && (
                <motion.div
                  className="ci-dept-callout"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  {selectedDeptWait === 0
                    ? `${department} queue is clear — you'll be seen almost immediately.`
                    : `Current wait for ${department}: ~${selectedDeptWait} min with ${deptStats[department!].waiting} patient${deptStats[department!].waiting !== 1 ? 's' : ''} ahead.`}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Form-level error */}
          <AnimatePresence>
            {error && (
              <motion.p
                className="ci-error"
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Submit */}
          <motion.button
            className="ci-submit"
            onClick={handleSubmit}
            disabled={loading}
            whileHover={!loading ? { scale: 1.02, boxShadow: '0 10px 25px rgba(0,33,71,0.3)' } : {}}
            whileTap={!loading ? { scale: 0.98 } : {}}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            {loading ? (
              <span className="ci-submit-loading">
                Processing
                <motion.span
                  className="ci-dots"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  ...
                </motion.span>
              </span>
            ) : (
              <span className="ci-submit-content">
                Get Queue Number <span className="ci-arrow">→</span>
              </span>
            )}
          </motion.button>
        </div>

        {/* ── Right column ── */}
        <motion.div
          className="ci-right"
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <div className="ci-status-card">
            <div className="ci-status-top">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <div>
                <p className="ci-status-label">
                  {department ? `${department} Queue` : 'Select a Department'}
                </p>
                <p className="ci-status-time">
                  {department
                    ? `${deptStats[department].waiting} patient${deptStats[department].waiting !== 1 ? 's' : ''} ahead`
                    : '—'}
                </p>
              </div>
            </div>

            <div className="ci-status-divider" />

            <div className="ci-status-live-row">
              <span className="ci-live-badge">
                <LiveDot />
                LIVE
              </span>
              <span className="ci-status-subtitle">
                {department ? `${deptStats[department].waiting === 0 ? 'No wait' : `~${deptStats[department].avgWaitMins} min wait`}` : 'Queue Status'}
              </span>
            </div>

            <div className="ci-status-items">
              {DEPARTMENTS.filter(d => !department || d.id === department).map((dept, index) => {
                const stats = deptStats[dept.id];
                return (
                  <motion.div
                    key={dept.id}
                    className="ci-status-item"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                  >
                    <span className="ci-status-dept">{dept.label} Queue</span>
                    <span className={`ci-status-count${stats.waiting === 0 ? ' ci-status-count--clear' : ''}`}>
                      {stats.waiting === 0 ? 'Clear' : `${stats.waiting} waiting`}
                    </span>
                  </motion.div>
                );
              })}
            </div>

            <div className="ci-status-divider" />

            <p className="ci-status-quote">
              "We prioritize efficiency to ensure you receive the care you need as quickly as possible."
            </p>
          </div>

          <p className="ci-copyright">
            © 2025 MediQueue Health Systems. All Patient Data is Encrypted.
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}