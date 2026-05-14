import { lazy, Suspense } from 'react';
import { useSocket } from './hooks/useSocket';
import { useGameStore } from './stores/gameStore';
import { Lobby } from './screens/Lobby';

const UiShowcase = lazy(() => import('./ui/UiShowcase').then(m => ({ default: m.UiShowcase })));
import { Quiz } from './screens/Quiz';
import { TrueFalse } from './screens/TrueFalse';
import { Countdown } from './screens/Countdown';
import { Pointless } from './screens/Pointless';
import { ThemedDle } from './screens/ThemedDle';
import { Numbers } from './screens/Numbers';
import { Wordle } from './screens/Wordle';
import { Travel } from './screens/Travel';
import { FinalLeaderboard } from './screens/FinalLeaderboard';
import { PausedOverlay } from './components/PausedOverlay';

function App() {
  const socket = useSocket();
  const { phase, currentGame } = useGameStore();

  if (typeof window !== 'undefined' && window.location.search.includes('showcase')) {
    return (
      <Suspense fallback={null}>
        <UiShowcase />
      </Suspense>
    );
  }

  // Determine which screen to show based on phase and current game
  const renderScreen = () => {
    switch (phase) {
      case 'lobby':
        return <Lobby socket={socket} />;
      
      case 'playing':
        // Show specific game screen based on current game
        switch (currentGame) {
          case 'quiz':
            return <Quiz socket={socket} />;
          case 'trueFalse':
            return <TrueFalse socket={socket} />;
          case 'countdown':
            return <Countdown socket={socket} />;
          case 'pointless':
            return <Pointless socket={socket} />;
          case 'pokedle':
          case 'hpdle':
            return <ThemedDle socket={socket} />;
          case 'numbers':
            return <Numbers socket={socket} />;
          case 'wordle':
            return <Wordle socket={socket} />;
          case 'travel':
            return <Travel socket={socket} />;
          default:
            return (
              <div className="min-h-screen flex items-center justify-center px-4">
                <div className="relative overflow-hidden rounded-[2rem] border border-ink/20 bg-bg-surface p-6 shadow-ink-lg">
                  <h1 className="text-3xl font-bold text-center text-ink">Loading game...</h1>
                </div>
              </div>
            );
        }
      
      case 'leaderboard':
      case 'finished':
        return <FinalLeaderboard />;
      
      default:
        return (
          <div className="min-h-screen flex items-center justify-center px-4">
            <div className="relative overflow-hidden rounded-[2rem] border border-ink/20 bg-bg-surface p-6 shadow-ink-lg">
              <h1 className="text-3xl font-bold text-center text-ink">Loading...</h1>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="App">
      {renderScreen()}
      <PausedOverlay />
    </div>
  );
}

export default App;
