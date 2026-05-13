import { useState, useEffect, lazy, Suspense } from 'react';
import { Dashboard } from './screens/Dashboard';
import { Display } from './screens/Display';

const UiShowcase = lazy(() => import('./ui/UiShowcase').then(m => ({ default: m.UiShowcase })));

function App() {
  const [view, setView] = useState<'dashboard' | 'display'>('dashboard');

  // Allow switching views with keyboard shortcut (Ctrl+D)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'd' && e.ctrlKey) {
        e.preventDefault();
        setView(v => v === 'dashboard' ? 'display' : 'dashboard');
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  if (typeof window !== 'undefined' && window.location.search.includes('showcase')) {
    return (
      <Suspense fallback={null}>
        <UiShowcase />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-30 px-4 pt-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl justify-end">
          <div className="inline-flex w-full max-w-[20rem] rounded-full border border-ink/20 bg-bg-surface p-1 shadow-ink-lg">
            <button
              onClick={() => setView('dashboard')}
              className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-all sm:text-base ${
                view === 'dashboard'
                  ? 'bg-action text-on-action shadow-ink-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setView('display')}
              className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-all sm:text-base ${
                view === 'display'
                  ? 'bg-info text-on-info shadow-ink-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Display
            </button>
          </div>
        </div>
      </div>

      {view === 'dashboard' ? <Dashboard /> : <Display />}
    </div>
  );
}

export default App;
