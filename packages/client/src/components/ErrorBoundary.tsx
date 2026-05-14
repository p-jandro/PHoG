import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render-time errors in any game screen so a malformed payload
 * doesn't leave the player staring at a blank phone. Logs to console and
 * shows a recovery UI with a Reload button.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="relative overflow-hidden rounded-[2rem] border border-ink/20 bg-bg-surface p-6 shadow-ink-lg max-w-md w-full text-center space-y-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-game-incorrect">Hold up</p>
            <h2 className="text-2xl font-bold text-ink">Your phone hit an unexpected error.</h2>
            <p className="text-sm text-ink-muted">
              The host display may still be on the right round. Try reloading
              to rejoin with your saved name.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full rounded-full bg-action px-6 py-3 text-sm font-semibold text-on-action shadow-ink-sm"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
