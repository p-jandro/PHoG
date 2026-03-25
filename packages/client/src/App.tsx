import { useSocket } from './hooks/useSocket';
import { useGameStore } from './stores/gameStore';
import { Lobby } from './screens/Lobby';
import { Quiz } from './screens/Quiz';
import { TrueFalse } from './screens/TrueFalse';
import { Countdown } from './screens/Countdown';
import { Pointless } from './screens/Pointless';
import { FinalLeaderboard } from './screens/FinalLeaderboard';
import { PausedOverlay } from './components/PausedOverlay';
import { RoundLeaderboardOverlay } from './components/RoundLeaderboardOverlay';

function App() {
  const socket = useSocket();
  const { phase, currentGame } = useGameStore();

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
          default:
            return (
              <div className="min-h-screen flex items-center justify-center">
                <div className="card">
                  <h1 className="text-3xl font-bold text-center">Loading game...</h1>
                </div>
              </div>
            );
        }
      
      case 'leaderboard':
      case 'finished':
        return <FinalLeaderboard />;
      
      default:
        return (
          <div className="min-h-screen flex items-center justify-center">
            <div className="card">
              <h1 className="text-3xl font-bold text-center">Loading...</h1>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="App">
      {renderScreen()}
      <RoundLeaderboardOverlay />
      <PausedOverlay />
    </div>
  );
}

export default App;
