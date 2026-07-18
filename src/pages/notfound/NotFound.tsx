import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-6)',
      textAlign: 'center',
      background: 'linear-gradient(135deg, var(--color-background) 0%, #EBF0F5 100%)',
    }}>
      <span style={{
        fontSize: '80px',
        lineHeight: 1,
        marginBottom: 'var(--space-4)',
        opacity: 0.6,
      }}>
        404
      </span>
      <h1 style={{
        font: 'var(--font-headline-md)',
        color: 'var(--color-on-surface)',
        marginBottom: 'var(--space-3)',
      }}>
        Page not found
      </h1>
      <p style={{
        font: 'var(--font-body-md)',
        color: 'var(--color-on-surface-variant)',
        maxWidth: 400,
        marginBottom: 'var(--space-8)',
      }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: '12px 24px',
            border: '1px solid var(--color-outline-variant)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-surface)',
            color: 'var(--color-on-surface)',
            font: 'var(--font-label-md)',
            cursor: 'pointer',
          }}
        >
          Go Back
        </button>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '12px 24px',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-primary)',
            color: 'var(--color-on-primary)',
            font: 'var(--font-label-md)',
            cursor: 'pointer',
          }}
        >
          Go Home
        </button>
      </div>
    </div>
  )
}
