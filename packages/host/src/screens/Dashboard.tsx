import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { io, Socket } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || (
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : 'http://localhost:3000'
);
const PLAYER_URL = import.meta.env.VITE_PLAYER_URL || (
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:5173`
    : 'http://localhost:5173'
);

interface Player {
  id: string;
  name: string;
  score: number;
  currentGameScore: number;
  totalPlacementScore: number;
  gamePlacements?: {
    quiz: number | null;
    trueFalse: number | null;
    countdown: number | null;
    pointless: number | null;
    pokedle: number | null;
    hpdle: number | null;
    numbers: number | null;
    wordle: number | null;
    travel: number | null;
  };
  connected: boolean;
}

type GameKey = 'quiz' | 'trueFalse' | 'countdown' | 'pointless' | 'pokedle' | 'hpdle' | 'numbers' | 'wordle' | 'travel';
const GAME_LABELS: Record<GameKey, string> = {
  quiz: 'Quiz',
  trueFalse: 'True/False',
  countdown: 'Countdown',
  pointless: 'Pointless',
  pokedle: 'Pokédle',
  hpdle: 'HP-dle',
  numbers: 'Numbers',
  wordle: 'Wordle',
  travel: 'Travel'
};

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
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [pointlessReadyToReveal, setPointlessReadyToReveal] = useState(false);
  const [championshipActive, setChampionshipActive] = useState(false);
  
  // Championship state
  const [championshipMode, setChampionshipMode] = useState(false);
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set(['quiz', 'trueFalse', 'pointless']));
  const availableGames = [
    { id: 'quiz', name: 'Quiz' },
    { id: 'trueFalse', name: 'True or False' },
    { id: 'pointless', name: 'Pointless' },
    { id: 'pokedle', name: 'Pokédle' },
    { id: 'hpdle', name: 'HP-dle' },
    { id: 'numbers', name: 'Numbers Round' },
    { id: 'wordle', name: 'Wordle' },
    { id: 'travel', name: 'Travel' }
  ];

  const activeGame = (gameState?.currentGame || null) as GameKey | null;
  const playerJoinLabel = PLAYER_URL.replace(/^https?:\/\//, '');
  const championshipPlayers = [...players].sort((a, b) => {
    const aPlacement = a.totalPlacementScore || 0;
    const bPlacement = b.totalPlacementScore || 0;

    if (aPlacement === 0 && bPlacement === 0) {
      return activeGame === 'pointless'
        ? (a.currentGameScore || a.score || 0) - (b.currentGameScore || b.score || 0)
        : (b.currentGameScore || b.score || 0) - (a.currentGameScore || a.score || 0);
    }

    if (aPlacement === 0) return 1;
    if (bPlacement === 0) return -1;
    if (aPlacement !== bPlacement) return aPlacement - bPlacement;

    return a.name.localeCompare(b.name);
  });

  useEffect(() => {
    if (!timerEndsAt) {
      return;
    }

    const updateRemaining = () => {
      const remaining = Math.max(0, timerEndsAt - Date.now());
      setTimeRemaining(remaining);
      return remaining;
    };

    updateRemaining();

    const timer = setInterval(() => {
      if (updateRemaining() === 0) {
        clearInterval(timer);
      }
    }, 100);

    return () => {
      clearInterval(timer);
    };
  }, [timerEndsAt]);

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
      setPointlessReadyToReveal(false);
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
      setChampionshipActive(Boolean(data.gameState?.championship?.active));
      setPointlessReadyToReveal(
        Boolean(
          data.gameState?.currentGame === 'pointless' &&
          data.gameState?.pointless?.phase === 'reveal'
        )
      );
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
      setPointlessReadyToReveal(false);
    });

    newSocket.on('host:control:success', ({ action }) => {
      if (action === 'startChampionship') {
        setChampionshipActive(true);
      }

      if (action === 'reset' || action === 'lobby' || action === 'end') {
        setChampionshipActive(false);
        setPointlessReadyToReveal(false);
      }

      if (action === 'reveal') {
        setPointlessReadyToReveal(false);
      }
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
      setTimerEndsAt(Date.now() + data.duration);
    });

    newSocket.on('truefalse:statement', (data) => {
      setLiveData({ type: 'trueFalse', text: data.statement, subtext: `Statement ${data.statementNumber}/${data.totalStatements}` });
      setAnsweredPlayers(new Map());
      setTotalTime(data.duration);
      setTimeRemaining(data.duration);
      setTimerEndsAt(Date.now() + data.duration);
    });

    newSocket.on('countdown:round:start', (data) => {
      setLiveData({ type: 'countdown', text: data.letters.join(' '), subtext: `Round ${data.roundNumber}/${data.totalRounds}` });
      setAnsweredPlayers(new Map());
      setTotalTime(data.duration);
      setTimeRemaining(data.duration);
      setTimerEndsAt(Date.now() + data.duration);
    });

    newSocket.on('pointless:round:start', (data) => {
      setLiveData({ type: 'pointless', text: data.question, subtext: `Category: ${data.category}` });
      setAnsweredPlayers(new Map());
      setTotalTime(data.duration);
      setTimeRemaining(data.duration);
      setTimerEndsAt(Date.now() + data.duration);
      setPointlessReadyToReveal(false);
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
      setTimerEndsAt(null);
      // Keep the text but maybe indicate "Ended"
    };
    newSocket.on('quiz:question:end', clearLive);
    newSocket.on('truefalse:answer', clearLive);
    newSocket.on('countdown:round:end', clearLive);
    newSocket.on('pointless:round:end', clearLive);
    newSocket.on('pointless:round:end', () => {
      setPointlessReadyToReveal(true);
    });
    newSocket.on('session:end', () => {
      setChampionshipActive(false);
      setPointlessReadyToReveal(false);
    });

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
      setPointlessReadyToReveal(false);
    }
  };

  const resetGame = () => {
    if (socket && confirm('Are you sure you want to reset the game?')) {
      socket.emit('host:control', { action: 'reset' });
      setChampionshipActive(false);
      setPointlessReadyToReveal(false);
    }
  };

  const returnToLobby = () => {
    if (socket) {
      socket.emit('host:control', { action: 'lobby' });
      setChampionshipActive(false);
      setPointlessReadyToReveal(false);
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
    setChampionshipActive(false);
    setPointlessReadyToReveal(false);
    if (socket) {
      socket.disconnect();
    }
  };

  if (!authenticated) {
    return (
      <div className="screen-shell flex items-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="screen-frame grid max-w-5xl gap-6 lg:grid-cols-[1fr_0.92fr]"
        >
          <div className="card flex flex-col justify-between gap-8 p-8 sm:p-10">
            <div className="space-y-5">
              <p className="eyebrow">Host Station</p>
              <div className="space-y-3">
                <h1 className="text-5xl font-bold sm:text-6xl">Run the Room</h1>
                <p className="max-w-2xl text-lg leading-relaxed text-ui-textMuted">
                  Start rounds, monitor responses, and keep the room moving without hunting through controls.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.5rem] border border-ui-border/80 bg-black/20 p-5">
                <p className="section-label mb-2">Connection</p>
                <p className="text-2xl font-semibold">{connected ? 'Live' : 'Waiting'}</p>
              </div>
              <div className="rounded-[1.5rem] border border-ui-border/80 bg-black/20 p-5">
                <p className="section-label mb-2">Views</p>
                <p className="text-2xl font-semibold">Dashboard and Display</p>
              </div>
              <div className="rounded-[1.5rem] border border-ui-border/80 bg-black/20 p-5">
                <p className="section-label mb-2">Format</p>
                <p className="text-2xl font-semibold">Single Rounds or Championship</p>
              </div>
            </div>
          </div>

          <div className="card p-8 sm:p-9">
            <p className="eyebrow mb-3">Secure Entry</p>
            <h2 className="text-3xl font-bold">Host Login</h2>
            <p className="mt-2 text-ui-textMuted">
              Use the host password to unlock controls for the current session.
            </p>

            <div className="my-6 rounded-[1.35rem] border border-ui-border/80 bg-black/20 p-4">
              <div className="flex items-center gap-3">
                <div className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-game-correct' : 'bg-game-incorrect'}`} />
                <span className="font-medium">
                  {connected ? 'Connected to server' : 'Connecting to server'}
                </span>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="password" className="section-label mb-2 block">
                  Host Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter host password"
                  className="input-field"
                  required
                  disabled={!connected}
                />
              </div>

              {error && (
                <p className="text-sm text-game-incorrect">{error}</p>
              )}

              <button
                type="submit"
                disabled={!connected || !password}
                className="btn w-full bg-primary-blue"
              >
                Unlock Host Controls
              </button>
            </form>

            <div className="mt-5 rounded-[1.35rem] border border-ui-border/80 bg-white/[0.03] p-4 text-sm text-ui-textMuted">
              The display view stays in this same app, so you can switch between control mode and the public screen without opening another tool.
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="screen-shell">
      <div className="screen-frame">
        <div className="card mb-6 p-7 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow mb-3">Control Room</p>
              <h1 className="text-4xl font-bold sm:text-5xl">Host Dashboard</h1>
              <p className="mt-2 text-ui-textMuted">
                Session phase <span className="font-semibold text-primary-teal">{gameState?.phase || 'lobby'}</span>
                {gameState?.currentGame && (
                  <> • current game <span className="font-semibold text-primary-blue">{gameState.currentGame}</span></>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <span className="status-pill">{players.filter(p => p.connected).length} players connected</span>
              <button
                onClick={handleLogout}
                className="btn bg-white/10 text-ui-text"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

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
            <p className="eyebrow mb-3">Session Controls</p>
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  onClick={() => startGame('pointless')}
                  disabled={gameState?.phase !== 'lobby'}
                  className="btn bg-game-incorrect"
                >
                  Start Pointless
                </button>
                <button
                  onClick={() => startGame('pokedle')}
                  disabled={gameState?.phase !== 'lobby'}
                  className="btn bg-yellow-500 text-black"
                >
                  Start Pokédle
                </button>
                <button
                  onClick={() => startGame('hpdle')}
                  disabled={gameState?.phase !== 'lobby'}
                  className="btn bg-purple-600"
                >
                  Start HP-dle
                </button>
                <button
                  onClick={() => startGame('numbers')}
                  disabled={gameState?.phase !== 'lobby'}
                  className="btn bg-emerald-600"
                >
                  Start Numbers Round
                </button>
                <button
                  onClick={() => startGame('wordle')}
                  disabled={gameState?.phase !== 'lobby'}
                  className="btn bg-slate-600"
                >
                  Start Wordle
                </button>
              </div>
            )}

            {/* Championship Continue Button */}
            {gameState?.phase === 'leaderboard' && championshipActive && (
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
            {gameState?.currentGame === 'pointless' && pointlessReadyToReveal && (
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

            <div className="grid grid-cols-1 gap-4 border-t border-ui-border pt-4 sm:grid-cols-2">
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
                className="btn bg-game-incorrect sm:col-span-2"
              >
                Reset Game
              </button>
            </div>
          </div>

          {/* Player Stats */}
          <div className="card">
            <div className="mb-4 flex justify-between items-center">
              <div>
                <p className="eyebrow mb-2">Room Overview</p>
                <h2 className="text-2xl font-bold">
                Players ({players.filter(p => p.connected).length}/{players.length})
                </h2>
              </div>
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
                    Share {playerJoinLabel} with players
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

          <div className="card lg:col-span-3">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow mb-2">Championship Table</p>
                <h2 className="text-2xl font-bold">Current Standings</h2>
              </div>
              <span className="status-pill">
                {activeGame ? `${GAME_LABELS[activeGame]} just ended` : 'Live placements'}
              </span>
            </div>

            {championshipPlayers.length === 0 ? (
              <div className="rounded-[1.5rem] border border-ui-border/80 bg-black/20 p-6 text-ui-textMuted">
                Championship standings will appear once players join the room.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {championshipPlayers.slice(0, 9).map((player, index) => (
                  <div
                    key={player.id}
                    className={`rounded-[1.6rem] border px-5 py-5 ${
                      index < 3 ? 'border-white/10 bg-white/[0.07]' : 'border-ui-border/80 bg-black/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-xl font-semibold">
                          {index + 1}. {player.name}
                        </p>
                        <p className="mt-2 text-sm text-ui-textMuted">
                          Championship total: {player.totalPlacementScore || '-'}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(['quiz', 'trueFalse', 'pointless', 'pokedle', 'hpdle', 'numbers', 'wordle', 'travel'] as GameKey[]).map((game) => (
                            <span
                              key={game}
                              className="rounded-full border border-ui-border/70 bg-black/20 px-3 py-1 text-xs font-semibold text-ui-textMuted"
                            >
                              {GAME_LABELS[game]}: {player.gamePlacements?.[game] ?? '-'}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-3xl font-bold ${index === 0 ? 'text-game-leader' : 'text-primary-teal'}`}>
                          {player.totalPlacementScore || '-'}
                        </p>
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ui-textMuted">
                          Total place
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
