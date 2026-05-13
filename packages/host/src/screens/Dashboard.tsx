import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import { Button, Card, Chip, HostScreenShell, Input, Pill, PlayerTracker } from '../ui';
import type { ButtonVariant, TrackedPlayer } from '../ui';
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

const LAUNCH_GAMES: Array<{ id: GameKey; label: string; variant: ButtonVariant }> = [
  { id: 'quiz',      label: 'Quiz',           variant: 'info'    },
  { id: 'trueFalse', label: 'True or False',  variant: 'action'  },
  { id: 'pointless', label: 'Pointless',      variant: 'streak'  },
  { id: 'pokedle',   label: 'Pokédle',        variant: 'now'     },
  { id: 'hpdle',     label: 'HP-dle',         variant: 'premium' },
  { id: 'numbers',   label: 'Numbers Round',  variant: 'action'  },
  { id: 'wordle',    label: 'Wordle',         variant: 'info'    },
  { id: 'travel',    label: 'Travel',         variant: 'streak'  },
];

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

          {/* MIDDLE: launcher area */}
          <Card eyebrow="Session Controls" title={championshipMode ? 'Pick games for the Championship Sequence' : 'Start a game'}>
            <div className="flex flex-col gap-5">

              {/* Championship mode toggle */}
              <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-ink bg-bg-sunken px-4 py-3">
                <div className="min-w-0">
                  <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">Mode</div>
                  <div className="font-display text-lg font-black tracking-tight text-ink">
                    {championshipMode ? 'Championship Sequence' : 'Single Round'}
                  </div>
                </div>
                <Button
                  variant={championshipMode ? 'premium' : 'ghost'}
                  size="sm"
                  onClick={() => setChampionshipMode((m) => !m)}
                  disabled={gameState?.phase !== 'lobby'}
                >
                  {championshipMode ? 'Switch to Single Round' : 'Switch to Championship'}
                </Button>
              </div>

              {/* Championship view: checkbox grid + start button */}
              {championshipMode ? (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {availableGames.map((game) => {
                      const selected = selectedGames.has(game.id);
                      return (
                        <Button
                          key={game.id}
                          variant={selected ? 'info' : 'ghost'}
                          size="sm"
                          onClick={() => toggleGameSelection(game.id)}
                          disabled={gameState?.phase !== 'lobby'}
                          aria-pressed={selected}
                          className="!justify-start text-left"
                        >
                          <span aria-hidden="true" className="mr-2">{selected ? '✓' : '○'}</span>
                          {game.name}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="premium"
                    size="lg"
                    onClick={startChampionship}
                    disabled={gameState?.phase !== 'lobby' || selectedGames.size === 0}
                    className="w-full"
                  >
                    Start Championship · {selectedGames.size} {selectedGames.size === 1 ? 'game' : 'games'}
                  </Button>
                </>
              ) : (
                /* Single-round view: 4×2 grid of game launches */
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {LAUNCH_GAMES.map((g) => (
                    <Button
                      key={g.id}
                      variant={g.variant}
                      size="md"
                      onClick={() => startGame(g.id)}
                      disabled={gameState?.phase !== 'lobby'}
                      className="!justify-start text-left"
                    >
                      {g.label}
                    </Button>
                  ))}
                </div>
              )}

              {/* Championship continue */}
              {gameState?.phase === 'leaderboard' && championshipActive && (
                <div className="rounded-2xl border-2 border-ink bg-now/40 px-4 py-3">
                  <div className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-ink">
                    Championship in progress
                  </div>
                  <Button variant="now" size="lg" onClick={nextChampionshipGame} className="w-full">
                    Continue to next round
                  </Button>
                </div>
              )}

              {/* Pointless reveal */}
              {gameState?.currentGame === 'pointless' && pointlessReadyToReveal && (
                <Button variant="streak" size="lg" onClick={revealResults} className="w-full">
                  Reveal Pointless results
                </Button>
              )}

              {/* Secondary row: Lobby / Emergency Skip / Reset */}
              <div className="grid grid-cols-1 gap-2 border-t-2 border-ink/10 pt-4 sm:grid-cols-3">
                <Button
                  variant="info"
                  size="sm"
                  onClick={returnToLobby}
                  disabled={gameState?.phase === 'lobby'}
                >
                  Return to Lobby
                </Button>
                <Button
                  variant="now"
                  size="sm"
                  onClick={emergencySkip}
                  disabled={gameState?.phase === 'lobby' || gameState?.phase === 'leaderboard'}
                >
                  Emergency Skip
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={resetGame}
                >
                  Reset Game
                </Button>
              </div>
            </div>
          </Card>

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
