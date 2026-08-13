import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Something went wrong.',
    };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('[MediQueue] Unhandled render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 12,
            fontFamily: 'Geist Sans, system-ui, sans-serif',
            color: '#05668D',
            background: '#f0faf7',
            padding: 24,
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>MediQueue hit an error</h1>
          <p style={{ margin: 0, maxWidth: 480, color: '#0b3a52' }}>{this.state.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
              padding: '10px 20px',
              borderRadius: 10,
              border: 'none',
              background: '#00A896',
              color: '#fff',
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload app
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}