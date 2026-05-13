import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import { Button, Card, Chip, HostScreenShell, Input, Pill, PlayerTracker } from '../ui';
import type { TrackedPlayer } from '../ui';
import { screenEnter } from '../lib/motion';
import { QRCodeSVG } from 'qrcode.react';

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

  // Live Game State — kept temporarily; cleaned up in Task 8
  const [_liveData, setLiveData] = useState<any>(null);
  const [_answeredPlayers, setAnsweredPlayers] = useState<Map<string, 'correct' | 'incorrect' | 'answered'>>(new Map());
  const [_timeRemaining, setTimeRemaining] = useState(0);
  const [_totalTime, setTotalTime] = useState(0);
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

  const playerJoinLabel = PLAYER_URL.replace(/^https?:\/\//, '');

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
    const status: 'connected' | 'connecting' | 'offline' = connected
      ? 'connected'
      : 'connecting';
    return (
      <HostScreenShell
        location="Host Login"
        topRight={{ kind: 'theme-toggle' }}
      >
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
          <motion.div variants={screenEnter} initial="hidden" animate="visible">
            <Card eyebrow="Host Station" title="Run the Room">
              <p className="mb-5 text-base leading-relaxed text-ink-muted">
                Use the host password to unlock controls for the current session.
              </p>

              <div className="mb-5">
                <Pill status={status}>
                  {connected ? 'Connected to server' : 'Connecting to server'}
                </Pill>
              </div>

              <form onSubmit={handleLogin} className="flex flex-col gap-5">
                <Input
                  label="Host Password"
                  type="password"
                  placeholder="Enter host password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={!connected}
                  error={error || undefined}
                />
                <Button
                  type="submit"
                  variant="action"
                  size="lg"
                  disabled={!connected || !password}
                  className="w-full"
                >
                  Unlock Host Controls
                </Button>
              </form>
            </Card>
          </motion.div>
        </div>
      </HostScreenShell>
    );
  }

  const status: 'connected' | 'connecting' | 'offline' = connected ? 'connected' : 'offline';
  const connectedCount = players.filter((p) => p.connected).length;
  const totalCount = players.length;

  // Build the player tracker rows. Sort: highest score first, except Pointless which sorts low-first.
  const sortedPlayers = [...players].sort((a, b) =>
    gameState?.currentGame === 'pointless'
      ? a.score - b.score
      : b.score - a.score,
  );
  const trackerPlayers: TrackedPlayer[] = sortedPlayers.map((p) => ({
    id: p.id,
    name: p.name,
    connected: p.connected,
    score: gameState?.phase === 'lobby' ? undefined : p.score,
    status:
      gameState?.phase === 'lobby' && p.connected
        ? 'Ready'
        : undefined,
  }));

  return (
    <HostScreenShell
      location={`Host Dashboard · ${gameState?.phase === 'lobby' ? 'Lobby' : gameState?.phase === 'leaderboard' ? 'Leaderboard' : 'Playing'}`}
      topRight={{ kind: 'theme-toggle' }}
    >
      <motion.div variants={screenEnter} initial="hidden" animate="visible" className="flex flex-col gap-4">
        {/* Header strip — session state + logout */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Pill status={status}>
              {connected ? 'Live' : 'Reconnecting'}
            </Pill>
            <Chip variant="info">{`${connectedCount} of ${totalCount} players connected`}</Chip>
            {gameState?.currentGame && (
              <Chip variant="muted">{`Current game · ${GAME_LABELS[gameState.currentGame as GameKey] ?? gameState.currentGame}`}</Chip>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>

        {/* 3-column body: QR · launcher · player tracker */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)_22rem]">

          {/* LEFT: QR + URL card */}
          <Card eyebrow="Join the Room" title="Scan to play">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-2xl border-2 border-ink bg-white p-3 shadow-ink">
                <QRCodeSVG value={PLAYER_URL} size={200} bgColor="#ffffff" fgColor="#181614" />
              </div>
              <div className="w-full break-words rounded-xl border-2 border-ink bg-bg-sunken px-3 py-2 text-center font-display text-base font-black tracking-tight text-ink">
                {playerJoinLabel}
              </div>
              <p className="text-xs text-ink-muted">
                Players join from any device on the same network.
              </p>
            </div>
          </Card>

          {/* MIDDLE: launcher area — REBUILT IN TASK 7. For now, keep the existing legacy JSX so the build keeps working. */}
          <div className="card lg:col-span-1" data-phase3-legacy-launcher>
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
                <button onClick={() => startGame('quiz')} disabled={gameState?.phase !== 'lobby'} className="btn bg-primary-blue">Start Quiz</button>
                <button onClick={() => startGame('trueFalse')} disabled={gameState?.phase !== 'lobby'} className="btn bg-primary-teal">Start True/False</button>
                <button onClick={() => startGame('pointless')} disabled={gameState?.phase !== 'lobby'} className="btn bg-game-incorrect">Start Pointless</button>
                <button onClick={() => startGame('pokedle')} disabled={gameState?.phase !== 'lobby'} className="btn bg-yellow-500 text-black">Start Pokédle</button>
                <button onClick={() => startGame('hpdle')} disabled={gameState?.phase !== 'lobby'} className="btn bg-purple-600">Start HP-dle</button>
                <button onClick={() => startGame('numbers')} disabled={gameState?.phase !== 'lobby'} className="btn bg-emerald-600">Start Numbers Round</button>
                <button onClick={() => startGame('wordle')} disabled={gameState?.phase !== 'lobby'} className="btn bg-slate-600">Start Wordle</button>
                <button onClick={() => startGame('travel')} disabled={gameState?.phase !== 'lobby'} className="btn bg-sky-600">Start Travel</button>
              </div>
            )}

            {/* Championship Continue Button */}
            {gameState?.phase === 'leaderboard' && championshipActive && (
              <div className="mb-6 p-4 border-2 border-game-leader rounded-lg bg-game-leader/10 animate-pulse">
                <h3 className="font-bold text-center mb-2 text-game-leader">Championship in Progress</h3>
                <button onClick={nextChampionshipGame} className="btn w-full bg-game-leader text-black font-bold hover:scale-105 transition-transform">
                  Continue to Next Round
                </button>
              </div>
            )}

            {/* Pointless Controls */}
            {gameState?.currentGame === 'pointless' && pointlessReadyToReveal && (
              <div className="mb-6 p-4 border border-ui-border rounded-lg bg-ui-background/50">
                <h3 className="font-bold mb-2 text-sm text-ui-textMuted uppercase">Pointless Controls</h3>
                <button onClick={revealResults} className="btn w-full bg-primary-teal animate-pulse">Reveal Results</button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 border-t border-ui-border pt-4 sm:grid-cols-2">
              <button onClick={returnToLobby} disabled={gameState?.phase === 'lobby'} className="btn bg-game-warning">Return to Lobby</button>
              <button onClick={emergencySkip} disabled={gameState?.phase === 'lobby' || gameState?.phase === 'leaderboard'} className="btn bg-orange-600 hover:bg-orange-700 text-white">⚠ Emergency Skip</button>
              <button onClick={resetGame} className="btn bg-game-incorrect sm:col-span-2">Reset Game</button>
            </div>
          </div>

          {/* RIGHT: player tracker */}
          <PlayerTracker
            title={`Players · ${connectedCount} of ${totalCount} connected`}
            players={trackerPlayers}
            emptyState={(
              <>
                No players yet.
                <br />
                Share <span className="font-bold text-ink">{playerJoinLabel}</span> with players.
              </>
            )}
          />
        </div>
      </motion.div>
    </HostScreenShell>
  );
};
