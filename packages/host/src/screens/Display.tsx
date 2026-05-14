import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import { Button, Card, Chip, ThemeToggle } from '../ui';
import { ThemedDleDisplay } from './ThemedDleDisplay';
import { NumbersDisplay } from './NumbersDisplay';
import { WordleDisplay } from './WordleDisplay';
import { TravelDisplay } from './TravelDisplay';
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
const CHAMPIONSHIP_PREVIEW_DELAY = 5000;
type GameKey = 'quiz' | 'trueFalse' | 'countdown' | 'pointless' | 'pokedle' | 'hpdle' | 'numbers' | 'wordle' | 'travel';

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

interface PointlessRevealAnswer {
  answer: string;
  score: number;
  isPointless: boolean;
}

interface PointlessRevealState {
  triggerTime: number;
  roundIndex: number;
  totalRounds: number;
  category: string;
  question: string;
  obscureAnswers: PointlessRevealAnswer[];
  frequentAnswers: PointlessRevealAnswer[];
}

interface IntroState {
  title: string;
  description: string;
  scoringRules?: string[];
  placementInfo?: string;
  duration?: number;
  endsAt?: number;
}

interface TrueFalseRevealState {
  statementId: string;
  statement: string;
  statementNumber: number;
  totalStatements: number;
  correctAnswer: boolean;
  explanation: string;
}

export const Display = () => {
  const [connected, setConnected] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [pointlessReadyToReveal, setPointlessReadyToReveal] = useState(false);
  const [phase, setPhase] = useState<string>('lobby');
  const [currentGame, setCurrentGame] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [leaderboardStage, setLeaderboardStage] = useState<'game' | 'championship'>('game');
  const [now, setNow] = useState(Date.now());
  const [socket, setSocket] = useState<Socket | null>(null);
  const playerJoinLabel = PLAYER_URL.replace(/^https?:\/\//, '');

  // Quiz state
  const [quizIntro, setQuizIntro] = useState<IntroState | null>(null);
  const [quizVoting, setQuizVoting] = useState<any>(null);
  const [quizVotingResults, setQuizVotingResults] = useState<any>(null);
  const [quizQuestion, setQuizQuestion] = useState<any>(null);
  const [quizResults, setQuizResults] = useState<any>(null);
  const [quizInterRound, setQuizInterRound] = useState<any>(null);

  // True/False state
  const [trueFalseIntro, setTrueFalseIntro] = useState<IntroState | null>(null);
  const [tfStatement, setTfStatement] = useState<any>(null);
  const [tfReveal, setTfReveal] = useState<TrueFalseRevealState | null>(null);
  const [tfInterRound, setTfInterRound] = useState<any>(null);
  // Per QA 2026-05-14 §16: capture host-private per-player correctness so the
  // T/F display can color each player's chip after the statement ends.
  const [tfPerPlayer, setTfPerPlayer] = useState<Record<string, { isCorrect: boolean }>>({});

  // Countdown state
  const [countdownRound, setCountdownRound] = useState<any>(null);
  const [pointlessIntro, setPointlessIntro] = useState<IntroState | null>(null);
  const [pointlessRound, setPointlessRound] = useState<any>(null);
  const [pointlessReveal, setPointlessReveal] = useState<PointlessRevealState | null>(null);
  // Per QA 2026-05-14 §17: Pointless host no longer shows per-player reveals.
  // The state and setter remain unused below but kept declared so any older
  // shared types/refs continue to compile without churn.
  // Per bug-report 2026-05-14 §D1/§D2: live submission status per player so the
  // host display can render a Locked-in / Still-thinking tracker without
  // requiring a Dashboard ↔ Display toggle to refresh.
  const [pointlessProgress, setPointlessProgress] = useState<Record<string, { status: 'submitted' | 'none' }>>({});

  useEffect(() => {
    if (phase !== 'leaderboard') {
      setLeaderboardStage('game');
      return;
    }

    setLeaderboardStage('game');
    const timeoutId = setTimeout(() => {
      setLeaderboardStage('championship');
    }, CHAMPIONSHIP_PREVIEW_DELAY);

    return () => clearTimeout(timeoutId);
  }, [phase, currentGame]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const newSocket = io(SERVER_URL, {
      autoConnect: true,
      transports: ['websocket']
    });

    newSocket.on('connect', () => {
      console.log('[Display] Connected');
      setConnected(true);
      const storedPassword = sessionStorage.getItem('hostPassword');
      if (storedPassword) {
        newSocket.emit('host:join', { password: storedPassword });
      }
      newSocket.emit('request:state');
    });

    newSocket.on('disconnect', () => {
      console.log('[Display] Disconnected');
      setConnected(false);
      setAuthenticated(false);
      setPointlessReadyToReveal(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('[Display] Connection error:', error.message);
    });

    newSocket.on('host:joined', (data) => {
      setAuthenticated(true);
      setPointlessReadyToReveal(
        Boolean(
          data.gameState?.currentGame === 'pointless' &&
          data.gameState?.pointless?.phase === 'reveal'
        )
      );
    });

    newSocket.on('host:rejected', () => {
      setAuthenticated(false);
      setPointlessReadyToReveal(false);
    });

    newSocket.on('host:control:success', ({ action }) => {
      if (action === 'reveal') {
        setPointlessReadyToReveal(false);
      }
    });

    // Heartbeat
    newSocket.on('ping', () => {
      newSocket.emit('pong');
    });

    // Game state events
    newSocket.on('players:update', (updatedPlayers) => {
      setPlayers(updatedPlayers);
    });

    newSocket.on('phase:change', ({ phase }) => {
      setPhase(phase);
    });

    newSocket.on('game:start', ({ game }) => {
      setCurrentGame(game);
      setPhase('playing');
      setQuizIntro(null);
      setQuizVoting(null);
      setQuizVotingResults(null);
      setQuizQuestion(null);
      setQuizResults(null);
      setTrueFalseIntro(null);
      setTfStatement(null);
      setTfReveal(null);
      setCountdownRound(null);
      setPointlessIntro(null);
      setPointlessRound(null);
      setPointlessReveal(null);
      setPointlessReadyToReveal(false);
    });

    // Quiz events
    newSocket.on('quiz:intro', (data) => {
      setQuizIntro(data);
      setQuizVoting(null);
      setQuizVotingResults(null);
      setQuizQuestion(null);
      setQuizResults(null);
    });

    newSocket.on('quiz:voting:start', (data) => {
      setQuizIntro(null);
      setQuizVoting(data);
      setQuizVotingResults(null);
      setQuizQuestion(null);
      setQuizResults(null);
    });

    newSocket.on('quiz:voting:end', (data) => {
      setQuizVotingResults(data);
    });

    newSocket.on('quiz:question:start', (data) => {
      setQuizIntro(null);
      setQuizVoting(null);
      setQuizVotingResults(null);
      setQuizQuestion(data);
      setQuizResults(null);
    });

    newSocket.on('quiz:question:end', (data) => {
      setQuizResults(data);
      setQuizInterRound(null);
    });

    newSocket.on('quiz:leaderboard:show', (data) => {
      setQuizInterRound(data);
      setQuizResults(null);
    });

    // True/False events
    newSocket.on('truefalse:intro', (data) => {
      setTrueFalseIntro(data);
      setTfStatement(null);
      setTfReveal(null);
    });

    newSocket.on('truefalse:statement', (data) => {
      setTrueFalseIntro(null);
      setTfStatement(data);
      setTfReveal(null);
      setTfPerPlayer({});
    });

    newSocket.on('host:player_answered', (data: { playerId: string; game: string; isCorrect?: boolean }) => {
      if (data.game === 'trueFalse' && typeof data.isCorrect === 'boolean') {
        setTfPerPlayer((prev) => ({ ...prev, [data.playerId]: { isCorrect: !!data.isCorrect } }));
      }
    });

    newSocket.on('truefalse:answer', (data) => {
      setTfReveal(data);
      setTfInterRound(null);
    });

    newSocket.on('truefalse:leaderboard:show', (data) => {
      setTfInterRound(data);
      setTfReveal(null);
    });

    // Countdown events
    newSocket.on('countdown:round:start', (data) => {
      setCountdownRound(data);
    });

    newSocket.on('countdown:round:end', () => {
      setCountdownRound(null);
    });

    newSocket.on('pointless:intro', (data) => {
      setPointlessIntro(data);
      setPointlessRound(null);
      setPointlessReveal(null);
      setPointlessReadyToReveal(false);
    });

    newSocket.on('pointless:round:start', (data) => {
      setPointlessIntro(null);
      setPointlessRound(data);
      setPointlessReveal(null);
      setPointlessReadyToReveal(false);
      // New round — clear stale progress so all players show as "Still thinking".
      setPointlessProgress({});
    });

    newSocket.on('pointless:round:end', () => {
      setPointlessRound(null);
      setPointlessReadyToReveal(true);
    });

    // Per bug-report 2026-05-14 §D1/§D2: live per-player submission status.
    newSocket.on('pointless:progress', (data: { playerProgress?: Record<string, { status: 'submitted' | 'none' }> }) => {
      setPointlessProgress(data?.playerProgress || {});
    });

    newSocket.on('pointless:reveal:display', (data) => {
      setPointlessReveal(data);
      setPointlessRound(null);
      setPointlessReadyToReveal(false);
    });

    // Per QA 2026-05-14 §17: host no longer renders per-player Pointless answer
    // reveals — the server must not broadcast this event to the host, and even
    // if it leaks, the host display ignores it. Player phones still receive
    // game:pointless:reveal individually for their own score-drop animation.

    setSocket(newSocket);

    return () => {
      setSocket(null);
      newSocket.disconnect();
    };
  }, []);

  const revealResults = () => {
    const storedPassword = sessionStorage.getItem('hostPassword');
    if (!authenticated || !connected || !storedPassword) {
      return;
    }
    const socket = io(SERVER_URL, {
      autoConnect: true,
      transports: ['websocket']
    });

    socket.on('connect', () => {
      socket.emit('host:join', { password: storedPassword });
    });

    socket.on('host:joined', () => {
      socket.emit('host:control', { action: 'reveal' });
    });

    socket.on('host:control:success', ({ action }) => {
      if (action === 'reveal') {
        setPointlessReadyToReveal(false);
      }
      socket.disconnect();
    });

    socket.on('error', () => {
      socket.disconnect();
    });

    socket.on('host:rejected', () => {
      setAuthenticated(false);
      socket.disconnect();
    });
  };

  const displayControl = (
    <>
      {/* Per bug-report 2026-05-14 §A1: the theme toggle is always visible on
          every host screen, not just the lobby/dashboard. */}
      <div className="fixed top-4 right-4 z-40 sm:top-6 sm:right-6">
        <ThemeToggle />
      </div>
      {authenticated && pointlessReadyToReveal ? (
        <div className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
          <Button variant="action" size="lg" onClick={revealResults}>
            Reveal Pointless Results (Skip Timer)
          </Button>
        </div>
      ) : null}
    </>
  );

  const getCountdownSeconds = (endsAt?: number) => {
    if (!endsAt) {
      return null;
    }

    return Math.max(0, Math.ceil((endsAt - now) / 1000));
  };

  const renderIntroView = (eyebrow: string, accentClassName: string, intro: IntroState | null) => {
    if (!intro) {
      return null;
    }

    const countdown = getCountdownSeconds(intro.endsAt);

    return (
      <>
        <div className="min-h-screen px-6 py-8 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mx-auto w-full max-w-6xl"
          >
            <div className="relative overflow-hidden rounded-[2rem] border border-ink/20 bg-bg-surface p-8 shadow-ink-lg sm:p-10">
              <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-4xl">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-ink-muted mb-3">{eyebrow}</p>
                  <h1 className={`text-4xl font-bold sm:text-6xl ${accentClassName}`}>{intro.title}</h1>
                  <p className="mt-4 text-xl leading-relaxed text-ink-muted sm:text-2xl">
                    {intro.description}
                  </p>
                </div>
                <Chip variant="default">
                  {countdown !== null ? `Starting in ${countdown}s` : 'Starting shortly'}
                </Chip>
              </div>

              <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border-2 border-ink bg-bg-sunken p-6 shadow-ink-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink-muted mb-4">How This Game Works</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(intro.scoringRules || []).slice(0, 6).map((rule) => (
                      <div
                        key={rule}
                        className="rounded-xl border-2 border-ink bg-bg-surface px-4 py-3 text-base font-semibold text-ink shadow-ink-sm"
                      >
                        {rule}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-ink bg-bg-sunken p-6 shadow-ink-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink-muted mb-3">Placement</p>
                  <p className="text-xl font-bold leading-relaxed text-ink">
                    {intro.placementInfo || 'Results on the house display determine the standings.'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
        {displayControl}
      </>
    );
  };

  const renderRedesignedIntroView = (eyebrow: string, intro: IntroState | null) => {
    if (!intro) return null;
    const countdown = getCountdownSeconds(intro.endsAt);

    return (
      <>
        <div className="min-h-screen bg-bg-base text-ink overflow-y-auto py-8 px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="mx-auto max-w-6xl"
          >
            {/* Skeleton header */}
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak sm:text-sm">
                  {eyebrow}
                </p>
                <p className="mt-1 text-base font-bold text-ink-muted">Get ready</p>
              </div>
              <div className="rounded-xl border-2 border-ink bg-bg-surface px-4 py-2 font-display text-2xl font-black text-ink shadow-ink-sm">
                {countdown !== null ? `${countdown}s` : '—:—'}
              </div>
            </div>

            <div className="rounded-3xl border-2 border-ink bg-bg-surface p-8 shadow-ink-lg sm:p-10">
              <h1 className="font-serif text-5xl font-extrabold leading-tight tracking-tight text-ink sm:text-6xl">
                {intro.title}
              </h1>
              <p className="mt-4 text-xl font-semibold leading-relaxed text-ink-muted sm:text-2xl">
                {intro.description}
              </p>

              <div className="mt-8 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border-2 border-ink bg-bg-sunken p-6 shadow-ink-sm">
                  <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.18em] text-streak">
                    How this game works
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(intro.scoringRules || []).slice(0, 6).map((rule) => (
                      <div
                        key={rule}
                        className="rounded-xl border-2 border-ink bg-bg-surface px-4 py-3 text-base font-semibold text-ink shadow-ink-sm"
                      >
                        {rule}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-ink bg-bg-sunken p-6 shadow-ink-sm">
                  <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-streak">
                    Placement
                  </p>
                  <p className="text-xl font-bold leading-relaxed text-ink">
                    {intro.placementInfo || 'Results on the house display determine the standings.'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
        {displayControl}
      </>
    );
  };

  if ((currentGame === 'pokedle' || currentGame === 'hpdle') && phase === 'playing') {
    return (
      <>
        <ThemedDleDisplay
          socket={socket}
          currentGame={currentGame as 'pokedle' | 'hpdle'}
          players={players}
        />
        {displayControl}
      </>
    );
  }

  if (currentGame === 'numbers' && phase === 'playing') {
    return (
      <>
        <NumbersDisplay socket={socket} players={players} />
        {displayControl}
      </>
    );
  }

  if (currentGame === 'wordle' && phase === 'playing') {
    return (
      <>
        <WordleDisplay socket={socket} players={players} />
        {displayControl}
      </>
    );
  }

  if (currentGame === 'travel' && phase === 'playing') {
    return (
      <>
        <TravelDisplay socket={socket} players={players} />
        {displayControl}
      </>
    );
  }

  if (currentGame === 'quiz' && quizIntro) {
    return renderRedesignedIntroView('Quiz Briefing', quizIntro);
  }

  if (currentGame === 'trueFalse' && trueFalseIntro) {
    return renderRedesignedIntroView('True or False', trueFalseIntro);
  }

  if (currentGame === 'pointless' && pointlessIntro) {
    return renderIntroView('Pointless Briefing', 'text-action', pointlessIntro);
  }

  if ((phase === 'leaderboard' || phase === 'finished') && currentGame) {
    const activeGame = currentGame as GameKey;
    const showChampionship = phase === 'finished' || leaderboardStage === 'championship';
    const sortedPlayers = [...players].sort((a, b) => {
      if (showChampionship) {
        if (!a.totalPlacementScore) return 1;
        if (!b.totalPlacementScore) return -1;
        return a.totalPlacementScore - b.totalPlacementScore;
      }

      const aPlacement = a.gamePlacements?.[activeGame] ?? null;
      const bPlacement = b.gamePlacements?.[activeGame] ?? null;

      if (aPlacement === null && bPlacement === null) {
        return activeGame === 'pointless'
          ? (a.currentGameScore || 0) - (b.currentGameScore || 0)
          : (b.currentGameScore || 0) - (a.currentGameScore || 0);
      }

      if (aPlacement === null) return 1;
      if (bPlacement === null) return -1;
      if (aPlacement !== bPlacement) return aPlacement - bPlacement;

      return activeGame === 'pointless'
        ? (a.currentGameScore || 0) - (b.currentGameScore || 0)
        : (b.currentGameScore || 0) - (a.currentGameScore || 0);
    });

    return (
      <>
        <div className="min-h-screen px-6 py-6 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mx-auto w-full max-w-7xl"
          >
            <div className="relative overflow-hidden rounded-[2rem] border border-ink/20 bg-bg-surface p-8 shadow-ink-lg sm:p-10">
            {phase === 'finished' && sortedPlayers.length > 0 && (
              <div className="mb-6 rounded-3xl border-4 border-ink bg-bg-sunken p-6 text-center shadow-ink-lg">
                <motion.h2
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="font-serif text-5xl font-extrabold text-ink sm:text-6xl"
                >
                  🏆 Congratulations, {sortedPlayers[0].name}!
                </motion.h2>
                <div className="mx-auto mt-6 grid max-w-3xl grid-cols-3 items-end gap-4">
                  <div className={[
                    'rounded-2xl border-2 border-ink p-4 text-center shadow-ink-sm',
                    sortedPlayers[1] ? 'bg-bg-surface text-ink' : 'bg-bg-sunken text-ink-muted opacity-60'
                  ].join(' ')}>
                    <p className="text-xs font-extrabold uppercase tracking-[0.18em]">2nd</p>
                    <p className="mt-2 truncate font-display text-2xl font-extrabold">{sortedPlayers[1]?.name ?? '—'}</p>
                  </div>
                  <div className="rounded-2xl border-4 border-ink bg-streak p-5 text-center text-on-streak shadow-ink">
                    <p className="text-xs font-extrabold uppercase tracking-[0.18em] opacity-90">1st</p>
                    <p className="mt-2 truncate font-display text-3xl font-black sm:text-4xl">{sortedPlayers[0].name}</p>
                  </div>
                  <div className={[
                    'rounded-2xl border-2 border-ink p-3 text-center shadow-ink-sm',
                    sortedPlayers[2] ? 'bg-bg-surface text-ink' : 'bg-bg-sunken text-ink-muted opacity-60'
                  ].join(' ')}>
                    <p className="text-xs font-extrabold uppercase tracking-[0.18em]">3rd</p>
                    <p className="mt-2 truncate font-display text-xl font-extrabold">{sortedPlayers[2]?.name ?? '—'}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="mb-8 flex items-end justify-between gap-6">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-ink-muted mb-3">
                  {phase === 'finished' ? 'Session Complete' : showChampionship ? 'Championship Snapshot' : 'Game Complete'}
                </p>
                <h1 className="text-5xl font-bold text-ink sm:text-6xl">
                  {showChampionship ? 'Championship Table' : `${{
                    quiz: 'Quiz',
                    trueFalse: 'True/False',
                    countdown: 'Countdown',
                    pointless: 'Pointless',
                    pokedle: 'Pokédle',
                    hpdle: 'HP-dle',
                    numbers: 'Numbers',
                    wordle: 'Wordle',
                    travel: 'Travel'
                  }[activeGame]} Placements`}
                </h1>
                <p className="mt-3 text-2xl text-ink-muted">
                  {showChampionship
                    ? 'Lowest combined placement leads the session.'
                    : 'Final standings for the game that just ended.'}
                </p>
              </div>
              <Chip variant="default">
                {showChampionship ? 'Championship view' : 'Per-game results'}
              </Chip>
            </div>

            <div className="overflow-hidden rounded-2xl border-2 border-ink">
              {showChampionship ? (
                <>
                  <div className="grid grid-cols-[4rem_minmax(0,1.8fr)_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-3 border-b-2 border-ink bg-bg-sunken px-5 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-ink-muted">
                    <span>Rank</span>
                    <span>Player</span>
                    <span className="text-right">Quiz</span>
                    <span className="text-right">T/F</span>
                    <span className="text-right">PTL</span>
                    <span className="text-right">PKD</span>
                    <span className="text-right">HP</span>
                    <span className="text-right">NUM</span>
                    <span className="text-right">WRD</span>
                    <span className="text-right">TRV</span>
                    <span className="text-right">Total</span>
                  </div>
                  <div className="max-h-[62vh] divide-y divide-ink/20 overflow-y-auto">
                    {sortedPlayers.map((player, index) => (
                      <div
                        key={player.id}
                        className={`grid grid-cols-[4rem_minmax(0,1.8fr)_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] items-center gap-3 px-5 py-3 ${
                          index < 3 ? 'bg-now/10' : 'bg-bg-surface'
                        }`}
                      >
                        <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-bg-sunken font-bold text-ink shadow-ink-sm">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <span className={`h-2.5 w-2.5 rounded-full ${player.connected ? 'bg-action' : 'bg-ink-muted'}`} />
                            <p className="truncate text-xl font-semibold text-ink">{player.name}</p>
                          </div>
                        </div>
                        <p className="text-right text-lg text-ink">{player.gamePlacements?.quiz || '-'}</p>
                        <p className="text-right text-lg text-ink">{player.gamePlacements?.trueFalse || '-'}</p>
                        <p className="text-right text-lg text-ink">{player.gamePlacements?.pointless || '-'}</p>
                        <p className="text-right text-lg text-ink">{player.gamePlacements?.pokedle || '-'}</p>
                        <p className="text-right text-lg text-ink">{player.gamePlacements?.hpdle || '-'}</p>
                        <p className="text-right text-lg text-ink">{player.gamePlacements?.numbers || '-'}</p>
                        <p className="text-right text-lg text-ink">{player.gamePlacements?.wordle || '-'}</p>
                        <p className="text-right text-lg text-ink">{player.gamePlacements?.travel || '-'}</p>
                        <p className="text-right text-2xl font-bold text-ink">{player.totalPlacementScore || '-'}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-[4rem_minmax(0,1.8fr)_1fr_1fr_1fr] gap-3 border-b-2 border-ink bg-bg-sunken px-5 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-ink-muted">
                    <span>Rank</span>
                    <span>Player</span>
                    <span className="text-right">Place</span>
                    <span className="text-right">Score</span>
                    <span className="text-right">Total</span>
                  </div>
                  <div className="max-h-[62vh] divide-y divide-ink/20 overflow-y-auto">
                    {sortedPlayers.map((player, index) => (
                      <div
                        key={player.id}
                        className={`grid grid-cols-[4rem_minmax(0,1.8fr)_1fr_1fr_1fr] items-center gap-3 px-5 py-3 ${
                          index < 3 ? 'bg-now/10' : 'bg-bg-surface'
                        }`}
                      >
                        <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-bg-sunken font-bold text-ink shadow-ink-sm">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <span className={`h-2.5 w-2.5 rounded-full ${player.connected ? 'bg-action' : 'bg-ink-muted'}`} />
                            <p className="truncate text-xl font-semibold text-ink">{player.name}</p>
                          </div>
                        </div>
                        <p className="text-right text-xl font-semibold text-ink">{player.gamePlacements?.[activeGame] ?? '-'}</p>
                        <p className="text-right text-2xl font-bold text-action">{player.currentGameScore}</p>
                        <p className="text-right text-lg text-ink">{player.totalPlacementScore || '-'}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            </div>
          </motion.div>
        </div>
        {displayControl}
      </>
    );
  }

  // Lobby View
  if (phase === 'lobby') {
    return (
      <>
        <div className="min-h-screen px-6 flex items-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-auto w-full max-w-7xl text-center"
          >
            <div className="relative overflow-hidden rounded-[2rem] border border-ink/20 bg-bg-surface p-8 shadow-ink-lg sm:p-10">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-ink-muted mb-4">House Display</p>
            <h1 className="text-6xl font-bold text-ink sm:text-8xl">PHoG</h1>
            <p className="mx-auto mt-4 max-w-3xl text-2xl leading-relaxed text-ink-muted sm:text-3xl">
              Join the room, keep your device open, and wait for the host to send everyone into the first round.
            </p>

            <div className="mt-8 flex flex-col items-center gap-6 lg:flex-row lg:items-stretch lg:justify-between">
              <div className="rounded-[2rem] bg-white p-4 shadow-[0_18px_40px_rgba(0,0,0,0.3)]">
                <QRCodeSVG
                  value={PLAYER_URL}
                  size={240}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <div className="grid flex-1 gap-4 text-left sm:grid-cols-2">
                <div className="rounded-2xl border-2 border-ink bg-bg-sunken p-6 shadow-ink-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink-muted mb-2">Join Link</p>
                  <p className="break-all text-xl font-semibold text-ink sm:text-2xl">{playerJoinLabel}</p>
                  <p className="mt-2 text-sm text-ink-muted">Players can scan the code or type the address directly.</p>
                </div>
                <div className="rounded-2xl border-2 border-ink bg-bg-sunken p-6 shadow-ink-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink-muted mb-2">Players Ready</p>
                  <p className="text-2xl font-semibold text-ink">{players.filter(p => p.connected).length}</p>
                  <p className="mt-2 text-sm text-ink-muted">The board updates live as people join the room.</p>
                </div>
              </div>
            </div>
            </div>

            <div className="relative overflow-hidden rounded-[2rem] border border-ink/20 bg-bg-surface mt-6 p-8 shadow-ink-lg">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-ink-muted mb-2">Room List</p>
                <h2 className="text-3xl font-bold text-ink">Players Checked In</h2>
              </div>
              <Chip variant="default">Waiting for host to start</Chip>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {players.map((player) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border-2 border-ink bg-bg-sunken p-4 text-left shadow-ink-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-xl font-medium text-ink">{player.name}</p>
                    <span className={`h-2.5 w-2.5 rounded-full ${player.connected ? 'bg-action' : 'bg-ink-muted'}`} />
                  </div>
                </motion.div>
              ))}
            </div>
            </div>
          </motion.div>
        </div>
        {displayControl}
      </>
    );
  }

  // Quiz Voting View
  if (currentGame === 'quiz' && quizVoting && !quizVotingResults) {
    return (
      <>
        <div className="min-h-screen bg-bg-base text-ink overflow-y-auto py-8 px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="mx-auto max-w-6xl"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak sm:text-sm">
                  Quiz Round · Question {quizVoting.questionNumber} of {quizVoting.totalQuestions}
                </p>
                <p className="mt-1 text-base font-bold text-ink-muted">Players are voting</p>
              </div>
              <div className="rounded-xl border-2 border-ink bg-bg-surface px-4 py-2 font-display text-2xl font-black text-ink shadow-ink-sm">
                —:—
              </div>
            </div>

            <div className="rounded-3xl border-2 border-ink bg-bg-surface p-8 text-center shadow-ink-lg sm:p-10">
              <h1 className="font-serif text-5xl font-extrabold tracking-tight text-ink sm:text-6xl">
                Choose the next category
              </h1>
              <p className="mt-3 text-lg font-bold text-ink-muted sm:text-2xl">
                The leader's vote counts 2×
              </p>

              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
                {quizVoting.options.map((category: any) => (
                  <motion.div
                    key={category.id}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="rounded-2xl border-2 border-ink p-6 text-center text-white shadow-ink sm:p-8"
                    style={{ backgroundColor: category.color }}
                  >
                    <p className="text-2xl font-extrabold sm:text-3xl">{category.label}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
        {displayControl}
      </>
    );
  }

  if (currentGame === 'quiz' && quizVoting && quizVotingResults) {
    return (
      <>
        <div className="min-h-screen bg-bg-base text-ink overflow-y-auto py-8 px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="mx-auto max-w-6xl"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak sm:text-sm">
                  Quiz Round · Question {quizVoting.questionNumber} of {quizVoting.totalQuestions}
                </p>
                <p className="mt-1 text-base font-bold text-ink-muted">Votes are in</p>
              </div>
              <div className="rounded-xl border-2 border-ink bg-bg-surface px-4 py-2 font-display text-2xl font-black text-ink shadow-ink-sm">
                —:—
              </div>
            </div>

            <div className="rounded-3xl border-2 border-ink bg-bg-surface p-8 text-center shadow-ink-lg sm:p-10">
              <h1 className="font-serif text-5xl font-extrabold tracking-tight text-ink sm:text-6xl">
                Voting Results
              </h1>

              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
                {quizVoting.options.map((category: any) => {
                  const voteCount = quizVotingResults.voteCounts?.[category.id] || 0;
                  const isWinner = quizVotingResults.winningOptionId === category.id;
                  return (
                    <motion.div
                      key={category.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                      className={[
                        'rounded-2xl border-2 border-ink p-6 text-center text-white shadow-ink sm:p-8',
                        isWinner ? 'ring-4 ring-now' : '',
                      ].join(' ')}
                      style={{ backgroundColor: category.color }}
                    >
                      <p className="text-2xl font-extrabold sm:text-3xl">{category.label}</p>
                      <p className="mt-4 font-display text-4xl font-black sm:text-5xl">{voteCount}</p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] opacity-90">
                        vote{voteCount === 1 ? '' : 's'}
                      </p>
                      {isWinner && (
                        <p className="mt-4 text-base font-extrabold uppercase tracking-[0.18em]">
                          Selected
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
        {displayControl}
      </>
    );
  }

  // Inter-round leaderboard overlay (Quiz / T-F). Per QA 2026-05-14 §16.
  if ((currentGame === 'quiz' && quizInterRound) || (currentGame === 'trueFalse' && tfInterRound)) {
    const data = currentGame === 'quiz' ? quizInterRound : tfInterRound;
    const board: Array<{ id: string; name: string; score: number; rank: number; connected?: boolean }> = data?.leaderboard || [];
    const top = board.slice(0, 8);
    return (
      <div className="flex h-screen w-screen flex-col bg-bg-base px-10 py-8 text-ink">
        <header className="flex items-start justify-between">
          <div className="font-display text-2xl font-extrabold tracking-tight">
            {currentGame === 'quiz' ? 'Quiz · Leaderboard' : 'True or False · Leaderboard'}
          </div>
        </header>
        <section className="flex flex-1 items-center justify-center">
          <ol className="w-full max-w-3xl space-y-2">
            {top.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-2xl border-2 border-ink bg-bg-surface px-6 py-4 shadow-ink-sm"
              >
                <span className="flex items-center gap-4">
                  <span className="font-display text-3xl font-extrabold tabular-nums">{p.rank}.</span>
                  <span className="font-display text-2xl font-extrabold">{p.name}</span>
                </span>
                <span className="font-display text-3xl font-extrabold tabular-nums">{p.score}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    );
  }

  // Quiz Question View
  if (currentGame === 'quiz' && quizQuestion) {
    const ANSWER_BG_CLASS: Record<string, string> = {
      A: 'bg-answer-a',
      B: 'bg-answer-b',
      C: 'bg-answer-c',
      D: 'bg-answer-d',
    };
    const submittedCount = players.filter((p) => p.connected).length; // best-effort; server tally not available here
    const totalConnected = players.filter((p) => p.connected).length;

    return (
      <>
        <div className="min-h-screen bg-bg-base text-ink overflow-y-auto py-8 px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="mx-auto max-w-6xl"
          >
            {/* Skeleton header: location top-left, time-left top-right */}
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak sm:text-sm">
                  Quiz Round · Question {quizQuestion.questionNumber} of {quizQuestion.totalQuestions}
                </p>
                <p className="mt-1 text-base font-bold text-ink-muted">
                  {quizQuestion.category} · {quizQuestion.difficulty}
                </p>
              </div>
              <div className="rounded-xl border-2 border-ink bg-bg-surface px-4 py-2 font-display text-2xl font-black text-ink shadow-ink-sm">
                {quizResults ? '—:—' : `${Math.ceil(((quizQuestion.endsAt ?? 0) - now) / 1000)}s`}
              </div>
            </div>

            {/* Centre: question and answers */}
            <div className="rounded-3xl border-2 border-ink bg-bg-surface p-8 shadow-ink-lg sm:p-10">
              <h2 className="text-center font-serif text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
                {quizQuestion.question}
              </h2>

              {quizResults ? (
                <div className="mx-auto mt-6 max-w-3xl rounded-2xl border-2 border-ink bg-action px-6 py-5 text-center text-on-action shadow-ink">
                  <p className="text-xs font-extrabold uppercase tracking-[0.2em] opacity-90">Correct answer</p>
                  <p className="mt-2 font-display text-3xl font-black sm:text-4xl">
                    {quizResults.correctAnswer} · {quizResults.correctAnswerText}
                  </p>
                </div>
              ) : null}

              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                {Object.entries(quizQuestion.answers).map(([key, value]: [string, any]) => {
                  const isCorrect = quizResults && key === quizResults.correctAnswer;
                  const dimmed = quizResults && key !== quizResults.correctAnswer;
                  return (
                    <motion.div
                      key={key}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 * ['A', 'B', 'C', 'D'].indexOf(key), duration: 0.22, ease: 'easeOut' }}
                      className={[
                        'flex items-center gap-4 rounded-2xl border-2 border-ink p-5 text-left text-white shadow-ink sm:p-6',
                        ANSWER_BG_CLASS[key] || 'bg-bg-surface',
                        isCorrect ? 'ring-4 ring-now' : '',
                        dimmed ? 'opacity-40' : '',
                      ].join(' ')}
                    >
                      <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-bg-surface font-display text-3xl font-black text-ink shadow-ink-sm">
                        {key}
                      </span>
                      <span className="flex-1 text-2xl font-extrabold leading-tight sm:text-3xl">{value}</span>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Bottom: player tracker */}
            <div className="mt-6 rounded-2xl border-2 border-ink bg-bg-surface p-5 shadow-ink">
              <div className="mb-3 flex items-end justify-between">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak">Players</p>
                <p className="font-display text-base font-black text-ink-muted">
                  {submittedCount} of {totalConnected}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {players.filter((p) => p.connected).map((p) => {
                  // Per QA 2026-05-14 §16: after question end, color by
                  // correctness; during the question, neutral chip.
                  const resForP = quizResults?.results?.find((r: any) => r.playerId === p.id);
                  let chipCls = 'bg-bg-sunken text-ink';
                  let dot = 'bg-action';
                  if (quizResults && resForP) {
                    if (resForP.isCorrect) { chipCls = 'bg-action text-on-action'; dot = 'bg-bg-surface'; }
                    else { chipCls = 'bg-danger text-on-danger'; dot = 'bg-bg-surface'; }
                  } else if (quizResults && !resForP) {
                    chipCls = 'bg-bg-sunken text-ink-muted opacity-70'; dot = 'bg-ink-muted';
                  }
                  return (
                    <span
                      key={p.id}
                      className={`inline-flex items-center gap-2 rounded-lg border-2 border-ink px-2.5 py-1 text-xs font-extrabold shadow-ink-sm ${chipCls}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
                      {p.name}
                    </span>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
        {displayControl}
      </>
    );
  }

  // True/False View
  if (currentGame === 'trueFalse' && tfReveal) {
    const totalConnected = players.filter((p) => p.connected).length;

    return (
      <>
        <div className="min-h-screen bg-bg-base text-ink overflow-y-auto py-8 px-6">
          <motion.div
            key={tfReveal.statementId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="mx-auto max-w-6xl"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak sm:text-sm">
                  True or False · Statement {tfReveal.statementNumber} of {tfReveal.totalStatements}
                </p>
                <p className="mt-1 text-base font-bold text-ink-muted">Reveal</p>
              </div>
              <div className="rounded-xl border-2 border-ink bg-bg-surface px-4 py-2 font-display text-2xl font-black text-ink shadow-ink-sm">
                —:—
              </div>
            </div>

            <div className="rounded-3xl border-2 border-ink bg-bg-surface p-8 shadow-ink-lg sm:p-10">
              <h2 className="text-center font-serif text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
                {tfReveal.statement}
              </h2>

              <div className="mt-8 grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
                <div
                  className={[
                    'rounded-2xl border-2 border-ink p-8 shadow-ink sm:p-10',
                    tfReveal.correctAnswer ? 'bg-action text-on-action' : 'bg-danger text-on-danger',
                  ].join(' ')}
                >
                  <p className="text-base font-extrabold uppercase tracking-[0.22em] opacity-90">Answer</p>
                  <p className="mt-3 font-display text-5xl font-black sm:text-6xl">
                    {tfReveal.correctAnswer ? 'TRUE' : 'FALSE'}
                  </p>
                </div>

                <div className="rounded-2xl border-2 border-ink bg-bg-sunken p-8 text-ink shadow-ink sm:p-10">
                  <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-streak">
                    Did You Know?
                  </p>
                  <p className="text-xl font-semibold leading-relaxed sm:text-2xl">
                    {tfReveal.explanation || 'No extra note for this statement.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Player tracker */}
            <div className="mt-6 rounded-2xl border-2 border-ink bg-bg-surface p-5 shadow-ink">
              <div className="mb-3 flex items-end justify-between">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak">Players</p>
                <p className="font-display text-base font-black text-ink-muted">
                  {totalConnected} of {totalConnected}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {players.filter((p) => p.connected).map((p) => {
                  const r = tfPerPlayer[p.id];
                  let chipCls = 'bg-bg-sunken text-ink';
                  let dot = 'bg-action';
                  if (r) {
                    chipCls = r.isCorrect ? 'bg-action text-on-action' : 'bg-danger text-on-danger';
                    dot = 'bg-bg-surface';
                  }
                  return (
                    <span
                      key={p.id}
                      className={`inline-flex items-center gap-2 rounded-lg border-2 border-ink px-2.5 py-1 text-xs font-extrabold shadow-ink-sm ${chipCls}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
                      {p.name}
                    </span>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
        {displayControl}
      </>
    );
  }

  if (currentGame === 'trueFalse' && tfStatement) {
    const totalConnected = players.filter((p) => p.connected).length;

    return (
      <>
        <div className="min-h-screen bg-bg-base text-ink overflow-y-auto py-8 px-6">
          <motion.div
            key={tfStatement.statementId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="mx-auto max-w-6xl"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak sm:text-sm">
                  True or False · Statement {tfStatement.statementNumber} of {tfStatement.totalStatements}
                </p>
                <p className="mt-1 text-base font-bold text-ink-muted">Players are answering</p>
              </div>
              <div className="rounded-xl border-2 border-ink bg-bg-surface px-4 py-2 font-display text-2xl font-black text-ink shadow-ink-sm">
                {tfStatement.endsAt ? `${Math.max(0, Math.ceil((tfStatement.endsAt - now) / 1000))}s` : '—:—'}
              </div>
            </div>

            <div className="rounded-3xl border-2 border-ink bg-bg-surface p-8 shadow-ink-lg sm:p-10">
              <h2 className="text-center font-serif text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
                {tfStatement.statement}
              </h2>

              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                <div className="rounded-2xl border-2 border-ink bg-danger p-8 text-on-danger shadow-ink sm:p-10">
                  <p className="font-display text-5xl font-black sm:text-6xl">FALSE</p>
                </div>
                <div className="rounded-2xl border-2 border-ink bg-action p-8 text-on-action shadow-ink sm:p-10">
                  <p className="font-display text-5xl font-black sm:text-6xl">TRUE</p>
                </div>
              </div>
            </div>

            {/* Player tracker */}
            <div className="mt-6 rounded-2xl border-2 border-ink bg-bg-surface p-5 shadow-ink">
              <div className="mb-3 flex items-end justify-between">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak">Players</p>
                <p className="font-display text-base font-black text-ink-muted">
                  {totalConnected} of {totalConnected}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {players.filter((p) => p.connected).map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-2 rounded-lg border-2 border-ink bg-bg-sunken px-2.5 py-1 text-xs font-extrabold text-ink shadow-ink-sm"
                  >
                    <span className="h-2 w-2 rounded-full bg-action" aria-hidden="true" />
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
        {displayControl}
      </>
    );
  }

  // Countdown View
  if (currentGame === 'countdown' && countdownRound) {
    return (
      <>
        <div className="min-h-screen px-6 py-8 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-auto w-full max-w-7xl"
          >
          <div className="mb-8">
            <span className="text-xl text-ink-muted sm:text-3xl">
              Round {countdownRound.roundNumber} of {countdownRound.totalRounds}
            </span>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] border border-ink/20 bg-bg-surface mb-8 p-6 shadow-ink-lg sm:p-12">
            <h2 className="mb-8 text-3xl font-bold text-ink sm:text-5xl">Make the longest word!</h2>
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
              {countdownRound.letters.map((letter: string, index: number) => (
                <motion.div
                  key={index}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-ink bg-premium text-4xl font-bold text-on-premium shadow-ink sm:h-20 sm:w-20 sm:text-5xl"
                >
                  {letter}
                </motion.div>
              ))}
            </div>
          </div>

          <p className="text-lg text-ink-muted sm:text-2xl">
            Players have 30 seconds to form a word
          </p>
          </motion.div>
        </div>
        {displayControl}
      </>
    );
  }

  if (currentGame === 'pointless' && pointlessRound) {
    const connected = players.filter((p) => p.connected);
    const submittedCount = connected.filter((p) => pointlessProgress[p.id]?.status === 'submitted').length;
    return (
      <>
        <div className="min-h-screen overflow-y-auto bg-bg-base py-8 text-ink">
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="mx-auto w-full max-w-6xl px-4 text-center sm:px-6"
          >
            <div className="mb-6 flex flex-wrap justify-center gap-2">
              <Chip variant="info">
                Round {pointlessRound.roundIndex + 1} of {pointlessRound.totalRounds}
              </Chip>
              <Chip variant="default">{pointlessRound.category}</Chip>
            </div>

            <Card eyebrow="Pointless" className="text-center">
              <h2 className="font-display text-3xl font-extrabold text-ink sm:text-5xl">
                {pointlessRound.question}
              </h2>
            </Card>

            <p className="mt-6 text-lg font-semibold uppercase tracking-[0.18em] text-ink-muted sm:text-xl">
              Players have {Math.ceil((pointlessRound.duration || 30000) / 1000)} seconds · Lowest valid answer wins
            </p>

            {/* Per bug-report 2026-05-14 §D1/§D2: live per-player tracker chips. */}
            <div className="mt-8 rounded-2xl border-2 border-ink bg-bg-surface p-5 text-left shadow-ink">
              <div className="mb-3 flex items-end justify-between">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak">Players</p>
                <p className="font-display text-base font-black text-ink-muted">
                  {submittedCount} of {connected.length} locked in
                </p>
              </div>
              {connected.length === 0 ? (
                <p className="text-center text-ink-muted">No players connected.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {connected.map((p) => {
                    const submitted = pointlessProgress[p.id]?.status === 'submitted';
                    const tone = submitted
                      ? 'border-ink bg-action text-on-action'
                      : 'border-ink bg-bg-sunken text-ink';
                    const label = submitted ? 'Locked in' : 'Still thinking';
                    return (
                      <span
                        key={p.id}
                        className={`inline-flex items-center gap-2 rounded-lg border-2 px-2.5 py-1 text-xs font-extrabold shadow-ink-sm ${tone}`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${submitted ? 'bg-on-action' : 'bg-ink-muted'}`}
                          aria-hidden="true"
                        />
                        {p.name}
                        <span className="text-[0.6rem] font-extrabold uppercase tracking-[0.18em] opacity-80">
                          · {label}
                        </span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
        {displayControl}
      </>
    );
  }

  if (currentGame === 'pointless' && pointlessReveal) {
    // Per QA 2026-05-14 §17: host shows ONLY the library top/bottom 3 at reveal.
    // No per-player names, no per-player answer text, no per-player ScoreDrop.
    return (
      <>
        <div className="min-h-screen bg-bg-base py-8 text-ink overflow-y-auto">
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="mx-auto w-full max-w-6xl px-4 sm:px-6"
          >
            {/* Header */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-streak">Pointless Reveal</p>
                <h1 className="mt-1 font-display text-3xl font-extrabold text-ink sm:text-5xl">
                  {pointlessReveal.category}
                </h1>
                <p className="mt-2 max-w-4xl text-lg text-ink-muted sm:text-xl">
                  {pointlessReveal.question}
                </p>
              </div>
              <Chip variant="info">
                Round {pointlessReveal.roundIndex + 1} of {pointlessReveal.totalRounds}
              </Chip>
            </div>

            {/* Aggregate top-3 (always shown as reference / fallback when no player reveals) */}
            <div className="grid gap-5 xl:grid-cols-2">
              <div className="rounded-2xl border-2 border-ink bg-bg-sunken p-6 shadow-ink">
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-ink-muted">
                      Most Obscure
                    </p>
                    <h2 className="mt-2 font-display text-2xl font-extrabold text-ink sm:text-3xl">
                      Top 3 Lowest Answers
                    </h2>
                  </div>
                  <Chip variant="default">Lower is better</Chip>
                </div>
                <div className="space-y-3">
                  {pointlessReveal.obscureAnswers.map((answer, index) => (
                    <div
                      key={`${answer.answer}-${answer.score}-obscure`}
                      className="grid grid-cols-[3rem_minmax(0,1fr)_5rem] items-center gap-4 rounded-xl border-2 border-ink bg-bg-surface px-4 py-3 shadow-ink-sm"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink bg-action font-display text-lg font-extrabold text-white shadow-ink-sm">
                        {index + 1}
                      </div>
                      <p className="truncate font-display text-xl font-extrabold text-ink">
                        {answer.answer}
                      </p>
                      <p className="text-right font-display text-2xl font-extrabold text-action">
                        {answer.score}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border-2 border-ink bg-bg-sunken p-6 shadow-ink">
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-ink-muted">
                      Most Frequent
                    </p>
                    <h2 className="mt-2 font-display text-2xl font-extrabold text-ink sm:text-3xl">
                      Top 3 Highest Answers
                    </h2>
                  </div>
                  <Chip variant="streak">Higher is common</Chip>
                </div>
                <div className="space-y-3">
                  {pointlessReveal.frequentAnswers.map((answer, index) => (
                    <div
                      key={`${answer.answer}-${answer.score}-frequent`}
                      className="grid grid-cols-[3rem_minmax(0,1fr)_5rem] items-center gap-4 rounded-xl border-2 border-ink bg-bg-surface px-4 py-3 shadow-ink-sm"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink bg-streak font-display text-lg font-extrabold text-white shadow-ink-sm">
                        {index + 1}
                      </div>
                      <p className="truncate font-display text-xl font-extrabold text-ink">
                        {answer.answer}
                      </p>
                      <p className="text-right font-display text-2xl font-extrabold text-streak">
                        {answer.score}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
        {displayControl}
      </>
    );
  }

  // Default/Generic View
  return (
    <>
      <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center p-8">
        <div className="text-center">
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <h1 className="text-6xl font-bold text-ink mb-4">PHoG Display</h1>
            <p className="text-2xl text-ink-muted">
              {connected ? 'Connected to server' : 'Connecting...'}
            </p>
            <p className="text-xl text-ink-muted mt-4">
              Phase: {phase} | Game: {currentGame || 'None'}
            </p>
          </motion.div>
        </div>
      </div>
      {displayControl}
    </>
  );
};
