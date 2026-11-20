import React from 'react';

/**
 * If a page crashes while drawing, React clears the whole screen and leaves it
 * white. This catches that, shows what happened, and offers a reload that also
 * clears the app files saved for offline use (a stale copy is the usual cause
 * after an update).
 */

interface State {
  error: Error | null;
}

const clearSavedAppFiles = async () => {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k.startsWith('si-app-')).map(k => caches.delete(k)));
    }
  } catch {
    /* nothing saved, or storage blocked */
  }
};

export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Screen crashed:', error, info.componentStack);
  }

  private reload = async () => {
    await clearSavedAppFiles();
    window.location.reload();
  };

  private goHome = async () => {
    await clearSavedAppFiles();
    window.location.assign('/');
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas p-6">
        <div className="max-w-md w-full bg-white border border-line rounded-2xl shadow-card p-6 text-center space-y-3">
          <img src="/logo-mark.png" alt="" className="w-12 h-12 mx-auto" />
          <h1 className="text-lg font-bold text-navy">Something went wrong on this screen</h1>
          <p className="text-sm text-muted">
            Reloading usually fixes it, especially right after the app has been updated.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={this.reload}
              className="flex-1 h-11 rounded-xl bg-navy text-white text-sm font-semibold cursor-pointer"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={this.goHome}
              className="flex-1 h-11 rounded-xl border border-line text-navy text-sm font-semibold cursor-pointer bg-white"
            >
              Go to dashboard
            </button>
          </div>
          <details className="text-left pt-2">
            <summary className="text-xs text-subtle cursor-pointer">Details for support</summary>
            <pre className="mt-2 text-[11px] text-ink-soft whitespace-pre-wrap break-words bg-canvas rounded-lg p-2 max-h-40 overflow-auto">
              {error.name}: {error.message}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
