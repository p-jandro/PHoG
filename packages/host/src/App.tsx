import { useState, useEffect } from 'react';
import { Dashboard } from './screens/Dashboard';
import { Display } from './screens/Display';

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

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-30 px-4 pt-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl justify-end">
          <div className="inline-flex w-full max-w-[20rem] rounded-full border border-ui-border/80 bg-black/30 p-1 shadow-[0_16px_30px_rgba(0,0,0,0.25)] backdrop-blur-md">
            <button
              onClick={() => setView('dashboard')}
              className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-all sm:text-base ${
                view === 'dashboard'
                  ? 'bg-primary-blue text-white shadow-[0_12px_20px_rgba(0,0,0,0.22)]'
                  : 'text-ui-textMuted hover:text-ui-text'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setView('display')}
              className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-all sm:text-base ${
                view === 'display'
                  ? 'bg-primary-teal text-white shadow-[0_12px_20px_rgba(0,0,0,0.22)]'
                  : 'text-ui-textMuted hover:text-ui-text'
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
