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
    <div>
      {/* View Switcher */}
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => setView('dashboard')}
          className={`px-4 py-2 rounded-lg font-bold transition-all ${
            view === 'dashboard'
              ? 'bg-primary-blue text-white'
              : 'bg-ui-card text-ui-textMuted hover:bg-ui-border'
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setView('display')}
          className={`px-4 py-2 rounded-lg font-bold transition-all ${
            view === 'display'
              ? 'bg-primary-teal text-white'
              : 'bg-ui-card text-ui-textMuted hover:bg-ui-border'
          }`}
        >
          Display
        </button>
      </div>

      {/* Render selected view */}
      {view === 'dashboard' ? <Dashboard /> : <Display />}
    </div>
  );
}

export default App;

