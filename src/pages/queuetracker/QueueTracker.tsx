import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import './QueueTracker.css';

// ─── Mock data (swap these fetches/subscriptions for Supabase later) ──────────

const MOCK_QUEUE = {
  tokenId: 'MQ-88241',
  fullName: 'Kwame Mensah',
  department: 'OPD',
  isPriority: false,
  position: 4,
  total: 12,
  stage: 'waiting',     
  stationRoom: 'Room 3',
  stationWing: 'Ground Floor, West Wing',
  avgMinsPerPatient: 4,    // used to derive waitMins
};

const MOCK_QUEUE_STATS = {
  served: 8,
  avgWait: 16,
  doctorsOnline: 3,
  systemStatus: 'Normal',
}/////;



const STAGES = [
  { key: 'checkin',      label: 'Check-in' },
  { key: 'waiting',      label: 'Waiting' },
  { key: 'consultation', label: 'Consult' },
  { key: 'lab',          label: 'Lab' },
  { key: 'pharmacy',     label: 'Pharmacy' },
  { key: 'done',         label: 'Done' },
];

function stageIndex(key) {
  return STAGES.findIndex(s => s.key === key);
}

// ─── Audio alert (Web Audio API) ──────────────────────────────────────────────

function playAlert(type = 'notify') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = type === 'urgent'
      ? [880, 1100, 880]
      : [660, 880];

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.22 + 0.3);
      osc.start(ctx.currentTime + i * 0.22);
      osc.stop(ctx.currentTime + i * 0.22 + 0.35);
    });
  } catch (_) {
    // Safari/blocked — fail silently
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveWaitMins(position, avgMins) {
  return Math.max(1, (position - 1) * avgMins);
}

function formatTime(date) {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QueueTracker() {
  const { tokenId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

 
  const [queueData, setQueueData] = useState(() => ({
    ...MOCK_QUEUE,
    // Override with router state if coming from check-in
    tokenId:    state?.tokenId    || tokenId    || MOCK_QUEUE.tokenId,
    fullName:   state?.fullName   || MOCK_QUEUE.fullName,
    department: state?.department || MOCK_QUEUE.department,
  }));
  const [stats]         = useState(MOCK_QUEUE_STATS);
  const [loading, setLoading]     = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [notification, setNotification] = useState(null); 
  const [helpOpen, setHelpOpen]   = useState(false);

  const alertFiredRef = useRef(false); // prevent repeat audio for same trigger

 
  const currentStageIdx = stageIndex(queueData.stage);
  const waitMins = deriveWaitMins(queueData.position, queueData.avgMinsPerPatient);
  const ringOffset = 201 - (201 * (queueData.total - queueData.position) / queueData.total);

  
  useEffect(() => {
    if (queueData.position <= 2 && !alertFiredRef.current) {
      alertFiredRef.current = true;
      playAlert(queueData.isPriority ? 'urgent' : 'notify');
      showNotification("You're almost up! Please make your way to the station.", 'warning');
    }
    if (queueData.position > 2) {
      alertFiredRef.current = false; // reset if position moves back (re-queue)
    }
  }, [queueData.position, queueData.isPriority]);

 
  const showNotification = useCallback((text, type = 'info') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 6000);
  }, []);

  // ── Simulate real-time mock updates (replace with Supabase realtime sub) ──
  useEffect(() => {
    // TODO: replace this entire block with:
    //   const channel = supabase
    //     .channel(`queue:${queueData.tokenId}`)
    //     .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'queue_entries',
    //         filter: `token_id=eq.${queueData.tokenId}` },
    //       payload => applyUpdate(payload.new))
    //     .subscribe();
    //   return () => supabase.removeChannel(channel);

    let steps = 0;
    const interval = setInterval(() => {
      steps++;
      setQueueData(prev => {
        // Simulate position moving down every ~12s
        if (steps % 3 === 0 && prev.position > 1) {
          const newPos = prev.position - 1;
          setLastUpdated(new Date());
          return { ...prev, position: newPos };
        }

        if (prev.position === 1 && prev.stage === 'waiting') {
          setLastUpdated(new Date());
          showNotification("It's your turn! Please proceed to " + prev.stationRoom, 'success');
          playAlert('notify');
          return { ...prev, stage: 'consultation', position: 1 };
        }
        return prev;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [showNotification]);

  // ── Manual refresh (replace with actual re-fetch) ──
  const handleRefresh = useCallback(() => {
    setLoading(true);
    // TODO: replace with Supabase fetch:
    //   const { data } = await supabase
    //     .from('queue_entries')
    //     .select('*')
    //     .eq('token_id', queueData.tokenId)
    //     .single();
    //   applyUpdate(data);
    setTimeout(() => {
      setLastUpdated(new Date());
      setLoading(false);
      showNotification('Status refreshed.', 'info');
    }, 800);
  }, [showNotification]);

  return (
    <div className="qt-page">

      
      <nav className="qt-nav">
        <div className="qt-nav-inner">
          <button className="qt-back" onClick={() => navigate('/checkin')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div className="qt-brand">
            <span className="qt-brand-icon">⚕</span>
            <span className="qt-brand-name">MediQueue</span>
          </div>
          <button className="qt-bell" aria-label="Notifications" onClick={() => showNotification('No new notifications.', 'info')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {notification && <span className="qt-bell-dot" />}
          </button>
        </div>
      </nav>

    
      {notification && (
        <div className={`qt-toast qt-toast--${notification.type}`}>
          <span>{notification.text}</span>
          <button className="qt-toast-close" onClick={() => setNotification(null)}>✕</button>
        </div>
      )}

      <div className="qt-body">

        {/* ── Identity row (spans both columns on desktop) ── */}
        <div className="qt-identity" style={{ animationDelay: '0s' }}>
          <div className="qt-avatar">{queueData.fullName.charAt(0).toUpperCase()}</div>
          <div className="qt-identity-text">
            <p className="qt-identity-name">{queueData.fullName}</p>
            <p className="qt-identity-meta">{queueData.department} Department</p>
          </div>
          {queueData.isPriority && (
            <span className="qt-priority-badge">⚡ Priority</span>
          )}
          <div className="qt-token-pill">
            <span className="qt-token-label">TOKEN</span>
            <span className="qt-token-val">{queueData.tokenId}</span>
          </div>
        </div>

        {/* ── Main column ── */}
        <div className="qt-main">

          {/* Hero */}
          <div className="qt-hero" style={{ animationDelay: '0.06s' }}>
            <div className="qt-hero-left">
              <div className="qt-status-row">
                <span className="qt-live-ring"><span className="qt-live-ring-inner" /></span>
                <span className="qt-status-label">
                  {STAGES[currentStageIdx]?.label ?? 'In Queue'}
                </span>
              </div>
              <div className="qt-position-row">
                <span className="qt-pos-num">{queueData.position}</span>
                <span className="qt-pos-divider">/</span>
                <span className="qt-pos-total">{queueData.total} in queue</span>
              </div>
              <p className="qt-pos-sub">You are #{queueData.position} in line</p>
              <p className="qt-pos-updated">Updated {formatTime(lastUpdated)}</p>
            </div>
            <div className="qt-hero-right">
              <div className="qt-wait-ring">
                <svg className="qt-ring-svg" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="32" className="qt-ring-track" />
                  <circle cx="40" cy="40" r="32" className="qt-ring-fill"
                    style={{ strokeDashoffset: ringOffset }} />
                </svg>
                <div className="qt-ring-center">
                  <span className="qt-ring-num">{waitMins}</span>
                  <span className="qt-ring-unit">min</span>
                </div>
              </div>
              <p className="qt-wait-label">Est. wait</p>
            </div>
          </div>

          {/* Stepper */}
          <div className="qt-card" style={{ animationDelay: '0.12s' }}>
            <div className="qt-card-head">
              <h3 className="qt-card-title">Queue Journey</h3>
              <span className="qt-card-badge">Live</span>
            </div>
            <div className="qt-stepper">
              {STAGES.map((stage, i) => {
                const done   = i < currentStageIdx;
                const active = i === currentStageIdx;
                return (
                  <div key={stage.key} className="qt-step-wrap">
                    <div className={`qt-step ${done ? 'qt-step--done' : active ? 'qt-step--active' : 'qt-step--pending'}`}>
                      <div className="qt-step-circle">
                        {done ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        ) : active ? (
                          <span className="qt-step-pulse" />
                        ) : (
                          <span className="qt-step-dot" />
                        )}
                      </div>
                      <span className="qt-step-label">{stage.label}</span>
                    </div>
                    {i < STAGES.length - 1 && (
                      <div className={`qt-connector ${done ? 'qt-connector--done' : ''}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Info tiles */}
          <div className="qt-info-row" style={{ animationDelay: '0.18s' }}>
            <div className="qt-info-tile">
              <div className="qt-info-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
              <p className="qt-info-label">STATION</p>
              <p className="qt-info-val">OPD — {queueData.stationRoom}</p>
              <p className="qt-info-sub">{queueData.stationWing}</p>
            </div>
            <div className="qt-info-tile">
              <div className="qt-info-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
              </div>
              <p className="qt-info-label">DEPARTMENT</p>
              <p className="qt-info-val">{queueData.department}</p>
              <p className="qt-info-sub">Gen. Consultation</p>
            </div>
            <div className="qt-info-tile">
              <div className="qt-info-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <p className="qt-info-label">TOKEN ID</p>
              <p className="qt-info-val qt-info-val--mono">{queueData.tokenId}</p>
              <p className="qt-info-sub">Updated {formatTime(lastUpdated)}</p>
            </div>
          </div>

          {/* Notification banner */}
          <div className="qt-notify-banner" style={{ animationDelay: '0.24s' }}>
            <div className="qt-notify-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <p className="qt-notify-text">
              {queueData.position <= 2
                ? "⚡ You're almost up — please make your way to the station now."
                : "You'll be notified when it's almost your turn. Stay nearby."}
            </p>
          </div>

          {/* Actions */}
          <div className="qt-actions" style={{ animationDelay: '0.3s' }}>
            <button
              className={`qt-btn-primary ${loading ? 'qt-btn--loading' : ''}`}
              onClick={handleRefresh}
              disabled={loading}
            >
              {loading ? (
                <span className="qt-spinner" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
              )}
              {loading ? 'Refreshing…' : 'Refresh Status'}
            </button>
            <button className="qt-btn-ghost" onClick={() => setHelpOpen(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              Need Help?
            </button>
          </div>
        </div>

        {/* ── Sidebar (desktop only) ── */}
        <div className="qt-sidebar">
          <div className="qt-sidebar-panel">
            <p className="qt-sidebar-panel-title">Queue Overview</p>

            <div className="qt-sidebar-live">
              <span className="qt-sidebar-live-dot" />
              <span className="qt-sidebar-live-text">Live</span>
            </div>

            <div className="qt-sidebar-stat">
              <span className="qt-sidebar-stat-label">Patients Served Today</span>
              <span className="qt-sidebar-stat-val">{stats.served}</span>
              <span className="qt-sidebar-stat-sub">Since 8:00 AM</span>
            </div>

            <div className="qt-sidebar-divider" />

            <div className="qt-sidebar-row">
              <span className="qt-sidebar-row-label">Avg. Wait Time</span>
              <span className="qt-sidebar-row-val">{stats.avgWait} min</span>
            </div>
            <div className="qt-sidebar-row">
              <span className="qt-sidebar-row-label">Doctors Online</span>
              <span className="qt-sidebar-row-val qt-sidebar-row-val--success">{stats.doctorsOnline} active</span>
            </div>
            <div className="qt-sidebar-row">
              <span className="qt-sidebar-row-label">Your Position</span>
              <span className="qt-sidebar-row-val">#{queueData.position} of {queueData.total}</span>
            </div>
            <div className="qt-sidebar-row">
              <span className="qt-sidebar-row-label">System Status</span>
              <span className="qt-sidebar-row-val qt-sidebar-row-val--success">{stats.systemStatus}</span>
            </div>
            <div className="qt-sidebar-row">
              <span className="qt-sidebar-row-label">Est. Your Wait</span>
              <span className="qt-sidebar-row-val">{waitMins} min</span>
            </div>
          </div>
        </div>

      </div>

      
      {helpOpen && (
        <div className="qt-modal-overlay" onClick={() => setHelpOpen(false)}>
          <div className="qt-modal" onClick={e => e.stopPropagation()}>
            <div className="qt-modal-head">
              <h3 className="qt-modal-title">Need Help?</h3>
              <button className="qt-modal-close" onClick={() => setHelpOpen(false)}>✕</button>
            </div>
            <div className="qt-modal-body">
              <p>If you have any issues with your queue position, please visit the <strong>Reception Desk</strong> at the main entrance.</p>
              <p style={{ marginTop: '12px' }}>For emergencies, inform any staff member immediately and they will escalate your case to <strong>Priority Queue</strong>.</p>
              <p style={{ marginTop: '12px' }}>Your token: <strong className="qt-info-val--mono">{queueData.tokenId}</strong></p>
            </div>
            <button className="qt-btn-primary" style={{ margin: '16px' }} onClick={() => setHelpOpen(false)}>Got it</button>
          </div>
        </div>
      )}

    </div>
  );
}