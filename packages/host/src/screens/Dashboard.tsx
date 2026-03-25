import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { io, Socket } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

interface Player {
  id: string;
  name: string;
  score: number;
  connected: boolean;
}

export const Dashboard = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState<any>(null);

  const [players, setPlayers] = useState<Player[]>([]);

  // Live Game State
  const [liveData, setLiveData] = useState<any>(null);
  const [answeredPlayers, setAnsweredPlayers] = useState<Map<string, 'correct' | 'incorrect' | 'answered'>>(new Map());
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  
  // Championship state
  const [championshipMode, setChampionshipMode] = useState(false);
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set(['quiz', 'trueFalse', 'countdown', 'pointless']));
  const availableGames = [
    { id: 'quiz', name: 'Quiz' },
    { id: 'trueFalse', name: 'True or False' },
    { id: 'countdown', name: 'Countdown' },
    { id: 'pointless', name: 'Pointless' }
  ];

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (timeRemaining > 0) {
      const startTime = Date.now();
      const initialTime = timeRemaining;
      timer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, initialTime - elapsed);
        setTimeRemaining(remaining);
        if (remaining === 0) clearInterval(timer);
      }, 100);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [timeRemaining > 0]); // Trigger when time is set

  useEffect(() => {
    const newSocket = io(SERVER_URL, {
      autoConnect: false,
      transports: ['websocket']
    });

    newSocket.on('connect', () => {
      console.log('[Host] Connected');
      setConnected(true);

      // Auto-reconnect with stored password if available
      const storedPassword = sessionStorage.getItem('hostPassword');
      if (storedPassword) {
        console.log('[Host] Auto-authenticating with stored credentials');
        newSocket.emit('host:join', { password: storedPassword });
      }
    });

    newSocket.on('disconnect', () => {
      console.log('[Host] Disconnected');
      setConnected(false);
      setAuthenticated(false);
    });

    // Heartbeat - respond to server pings
    newSocket.on('ping', () => {
      newSocket.emit('pong');
    });

    newSocket.on('host:joined', (data) => {
      console.log('[Host] Authenticated', data);
      setAuthenticated(true);
      setGameState(data.gameState);
      setPlayers(data.gameState?.players || []);
      setError('');
    });

    newSocket.on('host:rejected', (data) => {
      console.log('[Host] Rejected', data);
      setError(data.message);
      setAuthenticated(false);
      // Clear stored password if authentication fails
      sessionStorage.removeItem('hostPassword');
    });

    newSocket.on('players:update', (updatedPlayers) => {
      console.log('[Host] Players updated', updatedPlayers);
      setPlayers(updatedPlayers);
    });

    newSocket.on('phase:change', ({ phase }) => {
      console.log('[Host] Phase changed', phase);
      setGameState((prev: any) => ({ ...prev, phase }));
    });

    newSocket.on('game:start', ({ game }) => {
      console.log('[Host] Game started', game);
      setGameState((prev: any) => ({ ...prev, currentGame: game, phase: 'playing' }));
      setLiveData(null);
      setAnsweredPlayers(new Map());
    });

    // Listen for championship updates (need to handle player list update for championship state)
    // Since getGameState() returns championship state inside the main object, players:update might not carry it unless we add it
    // For now, let's assume we get it from initial host:joined or rely on inference
    // Ideally, we should listen to an event or poll, but let's stick to existing flow for now.
    // Actually, let's add a listener for gameEnd to update championship state if needed locally, 
    // though the server handles the logic. We just need to know if we can show "Continue".
    
    // Better: Update setGameState when we get players update if it includes meta, but it doesn't.
    // Let's just use the phase change.


    // Live Game Events
    newSocket.on('quiz:question:start', (data) => {
      setLiveData({ type: 'quiz', text: data.question, subtext: `Question ${data.questionNumber}/${data.totalQuestions} — ${data.category} (${data.difficulty})` });
      setAnsweredPlayers(new Map());
      setTotalTime(data.duration);
      setTimeRemaining(data.duration);
    });

    newSocket.on('truefalse:statement', (data) => {
      setLiveData({ type: 'trueFalse', text: data.statement, subtext: `Statement ${data.statementNumber}/${data.totalStatements}` });
      setAnsweredPlayers(new Map());
      setTotalTime(data.duration);
      setTimeRemaining(data.duration);
    });

    newSocket.on('countdown:round:start', (data) => {
      setLiveData({ type: 'countdown', text: data.letters.join(' '), subtext: `Round ${data.roundNumber}/${data.totalRounds}` });
      setAnsweredPlayers(new Map());
      setTotalTime(data.duration);
      setTimeRemaining(data.duration);
    });

    newSocket.on('pointless:round:start', (data) => {
      setLiveData({ type: 'pointless', text: data.question, subtext: `Category: ${data.category}` });
      setAnsweredPlayers(new Map());
      setTotalTime(data.duration);
      setTimeRemaining(data.duration);
    });

    newSocket.on('host:player_answered', ({ playerId, isCorrect }: { playerId: string; isCorrect?: boolean }) => {
      setAnsweredPlayers(prev => {
        const newMap = new Map(prev);
        const status = isCorrect === true ? 'correct' : isCorrect === false ? 'incorrect' : 'answered';
        newMap.set(playerId, status);
        return newMap;
      });
    });

    // Clear live data on round ends
    const clearLive = () => {
      setTimeRemaining(0);
      // Keep the text but maybe indicate "Ended"
    };
    newSocket.on('quiz:question:end', clearLive);
    newSocket.on('truefalse:answer', clearLive);
    newSocket.on('countdown:round:end', clearLive);
    newSocket.on('pointless:round:end', clearLive);

    setSocket(newSocket);
    newSocket.connect();

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (socket && password) {
      // Store password in sessionStorage for auto-reconnect
      sessionStorage.setItem('hostPassword', password);
      socket.emit('host:join', { password });
    }
  };

  const startChampionship = () => {
    if (socket && selectedGames.size > 0) {
      const sequence = Array.from(selectedGames);
      // Sort sequence based on availableGames order to maintain logical flow
      const sortedSequence = availableGames
        .filter(g => selectedGames.has(g.id))
        .map(g => g.id);
        
      socket.emit('host:control', { action: 'startChampionship', sequence: sortedSequence });
    }
  };

  const nextChampionshipGame = () => {
    if (socket) {
      socket.emit('host:control', { action: 'nextGame' });
    }
  };

  const toggleGameSelection = (gameId: string) => {
    setSelectedGames(prev => {
      const newSet = new Set(prev);
      if (newSet.has(gameId)) {
        newSet.delete(gameId);
      } else {
        newSet.add(gameId);
      }
      return newSet;
    });
  };

  const startGame = (game: string) => {
    if (socket) {
      socket.emit('host:control', { action: 'start', game });
    }
  };

  const revealResults = () => {
    if (socket) {
      socket.emit('host:control', { action: 'reveal' });
    }
  };

  const resetGame = () => {
    if (socket && confirm('Are you sure you want to reset the game?')) {
      socket.emit('host:control', { action: 'reset' });
    }
  };

  const returnToLobby = () => {
    if (socket) {
      socket.emit('host:control', { action: 'lobby' });
    }
  };

  const emergencySkip = () => {
    if (socket && confirm('Are you sure you want to skip the current phase? This cannot be undone.')) {
      socket.emit('host:control', { action: 'skip' });
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('hostPassword');
    setAuthenticated(false);
    if (socket) {
      socket.disconnect();
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card max-w-md w-full"
        >
          <h1 className="text-4xl font-bold text-center mb-2 text-white">
            Host Control
          </h1>
          <p className="text-ui-textMuted text-center mb-8">
            Peter's House of Games
          </p>

          <div className="mb-6 p-3 rounded-lg bg-ui-background border border-ui-border">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-game-correct' : 'bg-game-incorrect'}`} />
              <span className="text-sm">
                {connected ? 'Connected to server' : 'Connecting...'}
              </span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Host Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter host password"
                className="w-full px-4 py-3 bg-ui-card border border-ui-border rounded-lg text-ui-text focus:outline-none focus:ring-2 focus:ring-primary-blue"
                required
                disabled={!connected}
              />
            </div>

            {error && (
              <p className="text-game-incorrect text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={!connected || !password}
              className="btn w-full bg-primary-blue"
            >
              Login as Host
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold mb-2">Host Dashboard</h1>
            <p className="text-ui-textMuted">
              Phase: <span className="font-bold text-primary-teal">{gameState?.phase || 'lobby'}</span>
              {gameState?.currentGame && (
                <> | Game: <span className="font-bold text-primary-blue">{gameState.currentGame}</span></>
              )}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg bg-ui-background hover:bg-ui-border text-ui-textMuted hover:text-ui-text transition-colors"
          >
            Logout
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Live Game View */}
          {gameState?.phase === 'playing' && (
            <div className="card lg:col-span-3 border-2 border-primary-blue bg-ui-background">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">Live Game</h2>
                  {liveData && (
                    <>
                      <p className="text-xl mt-2 font-bold text-primary-teal">{liveData.text}</p>
                      <p className="text-sm text-ui-textMuted">{liveData.subtext}</p>
                    </>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-3xl font-mono font-bold text-white">
                    {Math.ceil(timeRemaining / 1000)}s
                  </div>
                </div>
              </div>

              {/* Timer Bar */}
              <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden mb-6">
                <motion.div
                  className="h-full bg-primary-blue"
                  initial={{ width: '100%' }}
                  animate={{ width: `${totalTime > 0 ? (timeRemaining / totalTime) * 100 : 0}%` }}
                  transition={{ duration: 0.1, ease: "linear" }}
                />
              </div>

              {/* Answer Tracker */}
              <div>
                <h3 className="text-sm font-bold text-ui-textMuted uppercase mb-2">Answer Tracker</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {players.filter(p => p.connected).map(player => {
                    const answerStatus = answeredPlayers.get(player.id);
                    const hasAnswered = !!answerStatus;
                    let bgClass = 'bg-ui-card border border-ui-border text-ui-textMuted'; // not answered
                    if (answerStatus === 'correct') {
                      bgClass = 'bg-emerald-800 text-white border border-emerald-600'; // darker green for correct
                    } else if (answerStatus === 'incorrect') {
                      bgClass = 'bg-red-800 text-white border border-red-600'; // red for incorrect
                    } else if (answerStatus === 'answered') {
                      bgClass = 'bg-game-correct text-white'; // generic answered (no correctness info)
                    }
                    return (
                      <div
                        key={player.id}
                        className={`p-2 rounded text-center text-sm font-medium transition-colors ${bgClass}`}
                      >
                        {player.name}
                        {answerStatus === 'correct' && ' ✓'}
                        {answerStatus === 'incorrect' && ' ✗'}
                        {answerStatus === 'answered' && ' ✓'}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Game Controls */}
          <div className="card lg:col-span-2">
            <h2 className="text-2xl font-bold mb-4">Game Controls</h2>

            {/* Championship Mode Toggle */}
            <div className="mb-6 p-4 bg-ui-background rounded-lg border border-ui-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Championship Mode</h3>
                <button 
                  onClick={() => setChampionshipMode(!championshipMode)}
                  disabled={gameState?.phase !== 'lobby'}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                    championshipMode ? 'bg-primary-blue text-white' : 'bg-ui-card text-ui-textMuted'
                  }`}
                >
                  {championshipMode ? 'Active' : 'Inactive'}
                </button>
              </div>

              {championshipMode && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    {availableGames.map(game => (
                      <label key={game.id} className="flex items-center space-x-2 p-2 rounded hover:bg-ui-card cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedGames.has(game.id)}
                          onChange={() => toggleGameSelection(game.id)}
                          disabled={gameState?.phase !== 'lobby'}
                          className="form-checkbox h-5 w-5 text-primary-blue rounded border-gray-600 bg-gray-700 focus:ring-offset-gray-800"
                        />
                        <span>{game.name}</span>
                      </label>
                    ))}
                  </div>
                  
                  <button
                    onClick={startChampionship}
                    disabled={gameState?.phase !== 'lobby' || selectedGames.size === 0}
                    className="btn w-full bg-primary-blue"
                  >
                    Start Championship ({selectedGames.size} Games)
                  </button>
                </div>
              )}
            </div>

            {!championshipMode && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                  onClick={() => startGame('quiz')}
                  disabled={gameState?.phase !== 'lobby'}
                  className="btn bg-primary-blue"
                >
                  Start Quiz
                </button>
                <button
                  onClick={() => startGame('trueFalse')}
                  disabled={gameState?.phase !== 'lobby'}
                  className="btn bg-primary-teal"
                >
                  Start True/False
                </button>
                <button
                  onClick={() => startGame('countdown')}
                  disabled={gameState?.phase !== 'lobby'}
                  className="btn bg-primary-purple"
                >
                  Start Countdown
                </button>
                <button
                  onClick={() => startGame('pointless')}
                  disabled={gameState?.phase !== 'lobby'}
                  className="btn bg-game-incorrect"
                >
                  Start Pointless
                </button>
              </div>
            )}

            {/* Championship Continue Button */}
            {gameState?.phase === 'leaderboard' && gameState?.championship?.active && (
               <div className="mb-6 p-4 border-2 border-game-leader rounded-lg bg-game-leader/10 animate-pulse">
                 <h3 className="font-bold text-center mb-2 text-game-leader">Championship in Progress</h3>
                 <button
                   onClick={nextChampionshipGame}
                   className="btn w-full bg-game-leader text-black font-bold hover:scale-105 transition-transform"
                 >
                   Continue to Next Round
                 </button>
               </div>
            )}

            {/* Pointless Controls */}
            {gameState?.currentGame === 'pointless' && (
              <div className="mb-6 p-4 border border-ui-border rounded-lg bg-ui-background/50">
                <h3 className="font-bold mb-2 text-sm text-ui-textMuted uppercase">Pointless Controls</h3>
                <button
                  onClick={revealResults}
                  className="btn w-full bg-primary-teal animate-pulse"
                >
                  Reveal Results
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 border-t border-ui-border pt-4">
              <button
                onClick={returnToLobby}
                disabled={gameState?.phase === 'lobby'}
                className="btn bg-game-warning"
              >
                Return to Lobby
              </button>
              <button
                onClick={emergencySkip}
                disabled={gameState?.phase === 'lobby' || gameState?.phase === 'leaderboard'}
                className="btn bg-orange-600 hover:bg-orange-700 text-white"
              >
                ⚠ Emergency Skip
              </button>
              <button
                onClick={resetGame}
                className="btn bg-game-incorrect col-span-2"
              >
                Reset Game
              </button>
            </div>
          </div>

          {/* Player Stats */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">
                Players ({players.filter(p => p.connected).length}/{players.length})
              </h2>
              {gameState?.phase === 'lobby' && players.length > 0 && (
                <span className="text-sm text-game-correct animate-pulse">
                  ● Waiting Room
                </span>
              )}
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {players.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-ui-textMuted text-lg mb-2">
                    No players yet
                  </p>
                  <p className="text-ui-textMuted text-sm">
                    Share http://localhost:5173 with players
                  </p>
                </div>
              ) : (
                players
                  .sort((a, b) => gameState?.currentGame === 'pointless' ? a.score - b.score : b.score - a.score)
                  .map((player, index) => (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-3 rounded-lg transition-all ${player.connected
                        ? 'bg-ui-background border-l-4 border-game-correct'
                        : 'bg-ui-background opacity-50 border-l-4 border-ui-textMuted'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-ui-textMuted font-mono text-sm w-8">
                            #{index + 1}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${player.connected ? 'bg-game-correct animate-pulse' : 'bg-ui-textMuted'
                              }`} />
                            <span className="font-medium text-lg">{player.name}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {gameState?.phase !== 'lobby' && (
                            <span className={`font-bold text-lg ${index === 0 && player.score > 0 ? 'text-game-leader' : 'text-primary-teal'
                              }`}>
                              {player.score} pts
                            </span>
                          )}
                          {gameState?.phase === 'lobby' && player.connected && (
                            <span className="text-sm text-game-correct">
                              Ready
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="card lg:col-span-3">
            <h2 className="text-2xl font-bold mb-4">Quick Guide</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-ui-background rounded-lg">
                <h3 className="font-bold mb-2 text-primary-blue">1. Setup</h3>
                <p className="text-sm text-ui-textMuted">
                  Wait for players to join via the player app. Share the URL with participants.
                </p>
              </div>
              <div className="p-4 bg-ui-background rounded-lg">
                <h3 className="font-bold mb-2 text-primary-teal">2. Start Game</h3>
                <p className="text-sm text-ui-textMuted">
                  Click one of the game buttons to start. Games will automatically progress through rounds.
                </p>
              </div>
              <div className="p-4 bg-ui-background rounded-lg">
                <h3 className="font-bold mb-2 text-primary-purple">3. Manage</h3>
                <p className="text-sm text-ui-textMuted">
                  Use the control buttons to return to lobby or reset the entire game if needed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

