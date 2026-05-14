import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional override for the fallback UI. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render-time errors so a malformed socket payload doesn't whitescreen
 * the host TV. The fallback offers a single "reload" path — better than
 * staring at a blank screen mid-game. Host crashes are especially painful
 * since the host is the shared display for the whole room.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      return (
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="relative overflow-hidden rounded-[2rem] border border-ink/20 bg-bg-surface p-8 shadow-ink-lg max-w-2xl w-full text-center space-y-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-game-incorrect">
              Something broke on screen
            </p>
            <h1 className="text-3xl font-bold text-ink">The display hit an unexpected error.</h1>
            <p className="text-ink-muted">
              The game itself may still be running on the server. Reload this
              page to resync with the current state.
            </p>
            <pre className="overflow-auto rounded-[1.2rem] bg-black/40 p-4 text-left text-xs text-game-incorrect">
              {this.state.error.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="rounded-full bg-action px-6 py-3 text-sm font-semibold text-on-action shadow-ink-sm"
            >
              Reload the display
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
