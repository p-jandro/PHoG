import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import { ThemedDleDisplay } from './ThemedDleDisplay';
import { NumbersDisplay } from './NumbersDisplay';
import { WordleDisplay } from './WordleDisplay';
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

interface RoundLeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  score: number;
  connected: boolean;
  streak?: number;
  rankDelta?: number | null;
}

interface RoundLeaderboardState {
  game: 'quiz' | 'trueFalse' | 'countdown' | 'pointless' | 'pokedle' | 'hpdle' | 'numbers' | 'wordle' | 'travel';
  duration: number;
  leaderboard: RoundLeaderboardEntry[];
  roundNumber?: number | null;
  totalRounds?: number | null;
  unitLabel?: string;
  timestamp: number;
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

const getRankDeltaMeta = (rankDelta: number | null | undefined) => {
  if (rankDelta === null || rankDelta === undefined) {
    return null;
  }

  if (rankDelta > 0) {
    return {
      label: `↑${rankDelta} since last round`,
      className: 'bg-game-correct/20 text-game-correct'
    };
  }

  if (rankDelta < 0) {
    return {
      label: `↓${Math.abs(rankDelta)} since last round`,
      className: 'bg-game-incorrect/20 text-game-incorrect'
    };
  }

  return {
    label: 'No change',
    className: 'bg-white/10 text-ui-textMuted'
  };
};

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

  // True/False state
  const [trueFalseIntro, setTrueFalseIntro] = useState<IntroState | null>(null);
  const [tfStatement, setTfStatement] = useState<any>(null);
  const [tfReveal, setTfReveal] = useState<TrueFalseRevealState | null>(null);

  // Countdown state
  const [countdownRound, setCountdownRound] = useState<any>(null);
  const [pointlessIntro, setPointlessIntro] = useState<IntroState | null>(null);
  const [pointlessRound, setPointlessRound] = useState<any>(null);
  const [pointlessReveal, setPointlessReveal] = useState<PointlessRevealState | null>(null);
  const [roundLeaderboard, setRoundLeaderboard] = useState<RoundLeaderboardState | null>(null);

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
    let roundLeaderboardTimeout: ReturnType<typeof setTimeout> | null = null;

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
      setRoundLeaderboard(null);
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

    newSocket.on('round:leaderboard:show', (data) => {
      setRoundLeaderboard(data);
      setQuizResults(null);
      setTfReveal(null);
      setPointlessReveal(null);

      if (roundLeaderboardTimeout) {
        clearTimeout(roundLeaderboardTimeout);
      }

      roundLeaderboardTimeout = setTimeout(() => {
        setRoundLeaderboard(null);
        roundLeaderboardTimeout = null;
      }, data.duration || 5000);
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
    });

    newSocket.on('truefalse:answer', (data) => {
      setTfReveal(data);
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
    });

    newSocket.on('pointless:round:end', () => {
      setPointlessRound(null);
      setPointlessReadyToReveal(true);
    });

    newSocket.on('pointless:reveal:display', (data) => {
      setPointlessReveal(data);
      setPointlessRound(null);
      setPointlessReadyToReveal(false);
    });

    setSocket(newSocket);

    return () => {
      setSocket(null);
      if (roundLeaderboardTimeout) {
        clearTimeout(roundLeaderboardTimeout);
      }
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

  const displayControl = authenticated && pointlessReadyToReveal ? (
    <div className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
      <button
        onClick={revealResults}
        className="rounded-full bg-primary-teal px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_30px_rgba(0,0,0,0.28)] transition-transform hover:bg-primary-teal/90 active:scale-95 sm:text-base"
      >
        Reveal Pointless Results
      </button>
    </div>
  ) : null;

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
        <div className="screen-shell overflow-y-auto py-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="screen-frame max-w-6xl"
          >
            <div className="card p-8 sm:p-10">
              <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-4xl">
                  <p className="eyebrow mb-3">{eyebrow}</p>
                  <h1 className={`text-4xl font-bold sm:text-6xl ${accentClassName}`}>{intro.title}</h1>
                  <p className="mt-4 text-xl leading-relaxed text-ui-textMuted sm:text-2xl">
                    {intro.description}
                  </p>
                </div>
                <span className="status-pill">
                  {countdown !== null ? `Starting in ${countdown}s` : 'Starting shortly'}
                </span>
              </div>

              <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-[1.7rem] border border-ui-border/80 bg-black/20 p-6">
                  <p className="section-label mb-4">How This Game Works</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(intro.scoringRules || []).slice(0, 6).map((rule) => (
                      <div
                        key={rule}
                        className="rounded-[1.2rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-lg font-medium text-white"
                      >
                        {rule}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.7rem] border border-ui-border/80 bg-black/20 p-6">
                  <p className="section-label mb-3">Placement</p>
                  <p className="text-2xl font-semibold leading-relaxed text-white">
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

  if (roundLeaderboard) {
    const gameLabel = {
      quiz: 'Quiz',
      trueFalse: 'True/False',
      countdown: 'Countdown',
      pointless: 'Pointless',
      pokedle: 'Pokédle',
      hpdle: 'HP-dle',
      numbers: 'Numbers',
      wordle: 'Wordle',
      travel: 'Travel'
    }[roundLeaderboard.game];

    return (
      <>
        <div className="screen-shell overflow-y-auto py-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="screen-frame"
          >
            <div className="card p-8 sm:p-10">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow mb-3">Round Standings</p>
                <h1 className="text-4xl font-bold sm:text-6xl">{gameLabel} Leaderboard</h1>
                {roundLeaderboard.roundNumber && roundLeaderboard.totalRounds ? (
                  <p className="mt-3 text-lg text-ui-textMuted sm:text-2xl">
                    {roundLeaderboard.unitLabel || 'Round'} {roundLeaderboard.roundNumber} of {roundLeaderboard.totalRounds}
                  </p>
                ) : null}
              </div>
              <span className="status-pill">
                {roundLeaderboard.game === 'pointless' ? 'Lower score leads' : 'Higher score leads'}
              </span>
            </div>

            <div className="overflow-hidden rounded-[1.6rem] border border-ui-border/80">
              <div className="grid grid-cols-[4rem_minmax(0,1.7fr)_1fr_1.2fr_1fr] gap-3 border-b border-ui-border/80 bg-white/[0.06] px-5 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-ui-textMuted">
                <span>Rank</span>
                <span>Player</span>
                <span className="text-right">Score</span>
                <span>Change</span>
                <span>Streak</span>
              </div>

              <div className="max-h-[62vh] divide-y divide-ui-border/70 overflow-y-auto">
              {roundLeaderboard.leaderboard.map((entry, index) => {
                const rankDeltaMeta = getRankDeltaMeta(entry.rankDelta);

                return (
                  <div
                    key={entry.id}
                    className={`grid grid-cols-[4rem_minmax(0,1.7fr)_1fr_1.2fr_1fr] items-center gap-3 px-5 py-3 ${
                      index < 3 ? 'bg-white/[0.05]' : 'bg-black/15'
                    }`}
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 font-bold text-white">
                      {entry.rank}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className={`h-2.5 w-2.5 rounded-full ${entry.connected ? 'bg-game-correct' : 'bg-ui-textMuted'}`} />
                        <p className="truncate text-xl font-semibold">{entry.name}</p>
                      </div>
                    </div>
                    <p className="text-right text-2xl font-bold text-white">
                      {entry.score}
                    </p>
                    <div>
                      {rankDeltaMeta ? (
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${rankDeltaMeta.className}`}>
                          {rankDeltaMeta.label}
                        </span>
                      ) : (
                        <span className="text-sm text-ui-textMuted">Opening round</span>
                      )}
                    </div>
                    <div>
                      {roundLeaderboard.game === 'trueFalse' && (entry.streak || 0) > 3 ? (
                        <span className="inline-flex items-center rounded-full border border-game-warning/60 bg-game-warning/30 px-3.5 py-1.5 text-sm font-bold uppercase tracking-[0.18em] text-white shadow-[0_12px_24px_rgba(0,0,0,0.22)]">
                          {entry.streak}x streak
                        </span>
                      ) : (
                        <span className="text-sm text-ui-textMuted">-</span>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
            </div>
          </motion.div>
        </div>
        {displayControl}
      </>
    );
  }

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

  if (currentGame === 'quiz' && quizIntro) {
    return renderIntroView('Quiz Briefing', 'text-primary-blue', quizIntro);
  }

  if (currentGame === 'trueFalse' && trueFalseIntro) {
    return renderIntroView('True or False', 'text-game-correct', trueFalseIntro);
  }

  if (currentGame === 'pointless' && pointlessIntro) {
    return renderIntroView('Pointless Briefing', 'text-primary-teal', pointlessIntro);
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
        <div className="screen-shell overflow-y-auto py-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="screen-frame"
          >
            <div className="card p-8 sm:p-10">
            <div className="mb-8 flex items-end justify-between gap-6">
              <div>
                <p className="eyebrow mb-3">
                  {phase === 'finished' ? 'Session Complete' : showChampionship ? 'Championship Snapshot' : 'Game Complete'}
                </p>
                <h1 className="text-5xl font-bold sm:text-6xl">
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
                <p className="mt-3 text-2xl text-ui-textMuted">
                  {showChampionship
                    ? 'Lowest combined placement leads the session.'
                    : 'Final standings for the game that just ended.'}
                </p>
              </div>
              <span className="status-pill">
                {showChampionship ? 'Championship view' : 'Per-game results'}
              </span>
            </div>

            <div className="overflow-hidden rounded-[1.6rem] border border-ui-border/80">
              {showChampionship ? (
                <>
                  <div className="grid grid-cols-[4rem_minmax(0,1.8fr)_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-3 border-b border-ui-border/80 bg-white/[0.06] px-5 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-ui-textMuted">
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
                  <div className="max-h-[62vh] divide-y divide-ui-border/70 overflow-y-auto">
                    {sortedPlayers.map((player, index) => (
                      <div
                        key={player.id}
                        className={`grid grid-cols-[4rem_minmax(0,1.8fr)_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] items-center gap-3 px-5 py-3 ${
                          index < 3 ? 'bg-white/[0.05]' : 'bg-black/15'
                        }`}
                      >
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 font-bold text-white">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <span className={`h-2.5 w-2.5 rounded-full ${player.connected ? 'bg-game-correct' : 'bg-ui-textMuted'}`} />
                            <p className="truncate text-xl font-semibold">{player.name}</p>
                          </div>
                        </div>
                        <p className="text-right text-lg">{player.gamePlacements?.quiz || '-'}</p>
                        <p className="text-right text-lg">{player.gamePlacements?.trueFalse || '-'}</p>
                        <p className="text-right text-lg">{player.gamePlacements?.pointless || '-'}</p>
                        <p className="text-right text-lg">{player.gamePlacements?.pokedle || '-'}</p>
                        <p className="text-right text-lg">{player.gamePlacements?.hpdle || '-'}</p>
                        <p className="text-right text-lg">{player.gamePlacements?.numbers || '-'}</p>
                        <p className="text-right text-lg">{player.gamePlacements?.wordle || '-'}</p>
                        <p className="text-right text-lg">{player.gamePlacements?.travel || '-'}</p>
                        <p className="text-right text-2xl font-bold text-white">{player.totalPlacementScore || '-'}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-[4rem_minmax(0,1.8fr)_1fr_1fr_1fr] gap-3 border-b border-ui-border/80 bg-white/[0.06] px-5 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-ui-textMuted">
                    <span>Rank</span>
                    <span>Player</span>
                    <span className="text-right">Place</span>
                    <span className="text-right">Score</span>
                    <span className="text-right">Total</span>
                  </div>
                  <div className="max-h-[62vh] divide-y divide-ui-border/70 overflow-y-auto">
                    {sortedPlayers.map((player, index) => (
                      <div
                        key={player.id}
                        className={`grid grid-cols-[4rem_minmax(0,1.8fr)_1fr_1fr_1fr] items-center gap-3 px-5 py-3 ${
                          index < 3 ? 'bg-white/[0.05]' : 'bg-black/15'
                        }`}
                      >
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 font-bold text-white">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <span className={`h-2.5 w-2.5 rounded-full ${player.connected ? 'bg-game-correct' : 'bg-ui-textMuted'}`} />
                            <p className="truncate text-xl font-semibold">{player.name}</p>
                          </div>
                        </div>
                        <p className="text-right text-xl font-semibold">{player.gamePlacements?.[activeGame] ?? '-'}</p>
                        <p className="text-right text-2xl font-bold text-primary-teal">{player.currentGameScore}</p>
                        <p className="text-right text-lg">{player.totalPlacementScore || '-'}</p>
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
        <div className="screen-shell flex items-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="screen-frame text-center"
          >
            <div className="card p-8 sm:p-10">
            <p className="eyebrow mb-4">House Display</p>
            <h1 className="text-6xl font-bold sm:text-8xl">PHoG</h1>
            <p className="mx-auto mt-4 max-w-3xl text-2xl leading-relaxed text-ui-textMuted sm:text-3xl">
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
                <div className="rounded-[1.6rem] border border-ui-border/80 bg-black/20 p-6">
                  <p className="section-label mb-2">Join Link</p>
                  <p className="break-all text-xl font-semibold sm:text-2xl">{playerJoinLabel}</p>
                  <p className="mt-2 text-sm text-ui-textMuted">Players can scan the code or type the address directly.</p>
                </div>
                <div className="rounded-[1.6rem] border border-ui-border/80 bg-black/20 p-6">
                  <p className="section-label mb-2">Players Ready</p>
                  <p className="text-2xl font-semibold">{players.filter(p => p.connected).length}</p>
                  <p className="mt-2 text-sm text-ui-textMuted">The board updates live as people join the room.</p>
                </div>
              </div>
            </div>
            </div>

            <div className="card mt-6 p-8">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow mb-2">Room List</p>
                <h2 className="text-3xl font-bold">Players Checked In</h2>
              </div>
              <span className="status-pill">Waiting for host to start</span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {players.map((player) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[1.4rem] border border-ui-border/80 bg-black/20 p-4 text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-xl font-medium">{player.name}</p>
                    <span className={`h-2.5 w-2.5 rounded-full ${player.connected ? 'bg-game-correct' : 'bg-ui-textMuted'}`} />
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
        <div className="screen-shell overflow-y-auto py-8">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="screen-frame card p-8 text-center sm:p-10"
          >
          <p className="eyebrow mb-3">Round Vote</p>
          <h1 className="text-4xl font-bold sm:text-6xl">Choose the next question</h1>
          <p className="mb-8 mt-4 text-lg text-ui-textMuted sm:mb-12 sm:text-2xl">
            Question {quizVoting.questionNumber} of {quizVoting.totalQuestions}
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
            {quizVoting.options.map((category: any) => (
              <motion.div
                key={category.id}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="rounded-[1.8rem] border border-white/10 p-6 text-center shadow-[0_18px_30px_rgba(0,0,0,0.22)] sm:p-10"
                style={{ backgroundColor: category.color }}
              >
                <p className="text-2xl font-bold text-white sm:text-3xl">{category.label}</p>
              </motion.div>
            ))}
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
        <div className="screen-shell overflow-y-auto py-8">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="screen-frame"
          >
            <div className="card p-8 text-center sm:p-10">
              <p className="eyebrow mb-3">Vote Locked</p>
              <h1 className="text-4xl font-bold sm:text-6xl">Voting Results</h1>
              <p className="mb-8 mt-4 text-lg text-ui-textMuted sm:mb-12 sm:text-2xl">
                Question {quizVoting.questionNumber} of {quizVoting.totalQuestions}
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
                {quizVoting.options.map((category: any) => {
                  const voteCount = quizVotingResults.voteCounts?.[category.id] || 0;
                  const isWinner = quizVotingResults.winningOptionId === category.id;

                  return (
                    <motion.div
                      key={category.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`rounded-[1.8rem] border p-6 text-center shadow-[0_18px_30px_rgba(0,0,0,0.22)] sm:p-10 ${
                        isWinner ? 'border-white ring-4 ring-white/60' : 'border-white/10'
                      }`}
                      style={{ backgroundColor: category.color }}
                    >
                      <p className="text-2xl font-bold text-white sm:text-3xl">{category.label}</p>
                      <p className="mt-4 text-4xl font-bold text-white sm:text-5xl">{voteCount}</p>
                      <p className="mt-2 text-sm uppercase tracking-[0.24em] text-white/75">
                        Vote{voteCount === 1 ? '' : 's'}
                      </p>
                      {isWinner ? (
                        <p className="mt-5 text-lg font-semibold uppercase tracking-[0.22em] text-white">
                          Selected
                        </p>
                      ) : null}
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

  // Quiz Question View
  if (currentGame === 'quiz' && quizQuestion) {
    const quizAnswerPalette: Record<string, string> = {
      A: '#7186be',
      B: '#6f9a79',
      C: '#d7a348',
      D: '#8b5f6b'
    };

    return (
      <>
        <div className="screen-shell overflow-y-auto py-8">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="screen-frame"
          >
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-lg text-ui-textMuted sm:text-2xl">
              Question {quizQuestion.questionNumber} of {quizQuestion.totalQuestions}
            </span>
            <span
              className="text-sm font-bold px-4 py-2 rounded-full sm:ml-4 sm:text-2xl"
              style={{ backgroundColor: quizQuestion.color || '#0066FF', color: 'white' }}
            >
              {quizQuestion.category.toUpperCase()} • {quizQuestion.difficulty.toUpperCase()}
            </span>
          </div>

          <div className="card mb-8 p-6 sm:p-12">
            <h2 className="text-3xl font-bold sm:text-5xl">{quizQuestion.question}</h2>
          </div>

          {quizResults ? (
            <div className="mb-6 rounded-[1.6rem] border border-ui-border/80 bg-black/20 px-6 py-5 text-center">
              <p className="section-label mb-2">Correct Answer</p>
              <p className="text-2xl font-bold text-white sm:text-3xl">
                {quizResults.correctAnswer} • {quizResults.correctAnswerText}
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
            {Object.entries(quizQuestion.answers).map(([key, value]: [string, any]) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * ['A', 'B', 'C', 'D'].indexOf(key) }}
                className={`rounded-[1.8rem] border p-6 text-left shadow-[0_18px_30px_rgba(0,0,0,0.22)] transition-all sm:p-8 ${
                  quizResults
                    ? key === quizResults.correctAnswer
                      ? 'border-white ring-4 ring-game-correct/70 brightness-110'
                      : 'border-white/10 opacity-35 brightness-50'
                    : 'border-white/10'
                }`}
                style={{ backgroundColor: quizAnswerPalette[key] }}
              >
                <div className="mb-2 text-2xl font-bold text-white opacity-75 sm:text-3xl">{key}</div>
                <div className="text-2xl text-white sm:text-3xl">{value}</div>
              </motion.div>
            ))}
          </div>
          </motion.div>
        </div>
        {displayControl}
      </>
    );
  }

  // True/False View
  if (currentGame === 'trueFalse' && tfReveal) {
    return (
      <>
        <div className="screen-shell overflow-y-auto py-8">
          <motion.div
            key={tfReveal.statementId}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="screen-frame"
          >
            <div className="mb-8">
              <span className="text-xl text-ui-textMuted sm:text-3xl">
                Statement {tfReveal.statementNumber} of {tfReveal.totalStatements}
              </span>
            </div>

            <div className="card p-8 sm:p-16">
              <h2 className="text-4xl font-bold sm:text-6xl">{tfReveal.statement}</h2>
            </div>

            <div className="mt-8 grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
              <div className={`rounded-[1.8rem] border border-white/10 p-8 shadow-[0_18px_30px_rgba(0,0,0,0.22)] sm:p-12 ${
                tfReveal.correctAnswer ? 'bg-game-correct' : 'bg-game-incorrect'
              }`}>
                <p className="text-lg font-semibold uppercase tracking-[0.24em] text-white/75">Answer</p>
                <p className="mt-4 text-5xl font-bold text-white sm:text-6xl">
                  {tfReveal.correctAnswer ? 'TRUE' : 'FALSE'}
                </p>
              </div>

              <div className="rounded-[1.8rem] border border-ui-border/80 bg-black/20 p-8 sm:p-12">
                <p className="section-label mb-3">Did You Know?</p>
                <p className="text-2xl leading-relaxed text-white sm:text-3xl">
                  {tfReveal.explanation || 'No extra note for this statement.'}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
        {displayControl}
      </>
    );
  }

  if (currentGame === 'trueFalse' && tfStatement) {
    return (
      <>
        <div className="screen-shell overflow-y-auto py-8">
          <motion.div
            key={tfStatement.statementId}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="screen-frame"
          >
          <div className="mb-8">
            <span className="text-xl text-ui-textMuted sm:text-3xl">
              Statement {tfStatement.statementNumber} of {tfStatement.totalStatements}
            </span>
          </div>

          <div className="card p-8 sm:p-16">
            <h2 className="text-4xl font-bold sm:text-6xl">{tfStatement.statement}</h2>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-8">
            <div className="rounded-[1.8rem] border border-white/10 bg-game-incorrect p-8 shadow-[0_18px_30px_rgba(0,0,0,0.22)] sm:p-12">
              <p className="text-4xl font-bold text-white sm:text-5xl">FALSE</p>
            </div>
            <div className="rounded-[1.8rem] border border-white/10 bg-game-correct p-8 shadow-[0_18px_30px_rgba(0,0,0,0.22)] sm:p-12">
              <p className="text-4xl font-bold text-white sm:text-5xl">TRUE</p>
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
        <div className="screen-shell overflow-y-auto py-8">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="screen-frame"
          >
          <div className="mb-8">
            <span className="text-xl text-ui-textMuted sm:text-3xl">
              Round {countdownRound.roundNumber} of {countdownRound.totalRounds}
            </span>
          </div>

          <div className="card mb-8 p-6 sm:p-12">
            <h2 className="mb-8 text-3xl font-bold sm:text-5xl">Make the longest word!</h2>
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
              {countdownRound.letters.map((letter: string, index: number) => (
                <motion.div
                  key={index}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex h-16 w-16 items-center justify-center rounded-[1.1rem] bg-primary-purple text-4xl font-bold text-white shadow-[0_14px_24px_rgba(0,0,0,0.22)] sm:h-20 sm:w-20 sm:rounded-[1.35rem] sm:text-5xl"
                >
                  {letter}
                </motion.div>
              ))}
            </div>
          </div>

          <p className="text-lg text-ui-textMuted sm:text-2xl">
            Players have 30 seconds to form a word
          </p>
          </motion.div>
        </div>
        {displayControl}
      </>
    );
  }

  if (currentGame === 'pointless' && pointlessRound) {
    return (
      <>
        <div className="screen-shell overflow-y-auto py-8">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="screen-frame text-center"
          >
          <div className="mb-8">
            <span className="text-xl text-ui-textMuted sm:text-3xl">
              Round {pointlessRound.roundIndex + 1} of {pointlessRound.totalRounds}
            </span>
          </div>

          <div className="card mb-8 p-6 sm:p-12">
            <p className="mb-4 text-sm uppercase tracking-[0.3em] text-ui-textMuted sm:text-2xl">
              {pointlessRound.category}
            </p>
            <h2 className="text-3xl font-bold sm:text-5xl">{pointlessRound.question}</h2>
          </div>

          <p className="text-lg text-ui-textMuted sm:text-2xl">
            Players have {Math.ceil((pointlessRound.duration || 30000) / 1000)} seconds. Lowest valid answer wins.
          </p>
          </motion.div>
        </div>
        {displayControl}
      </>
    );
  }

  if (currentGame === 'pointless' && pointlessReveal) {
    return (
      <>
        <div className="screen-shell flex items-center">
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="screen-frame"
          >
          <div className="card p-8 sm:p-10">
            <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow mb-3">Pointless Reveal</p>
                <h1 className="text-4xl font-bold sm:text-6xl">{pointlessReveal.category}</h1>
                <p className="mt-3 max-w-4xl text-xl text-ui-textMuted sm:text-2xl">
                  {pointlessReveal.question}
                </p>
              </div>
              <span className="status-pill">
                Round {pointlessReveal.roundIndex + 1} / {pointlessReveal.totalRounds}
              </span>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <div className="rounded-[1.7rem] border border-primary-teal/35 bg-primary-teal/10 p-6">
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="section-label mb-2">Most Obscure</p>
                    <h2 className="text-3xl font-bold">Top 3 Lowest Answers</h2>
                  </div>
                  <span className="status-pill">Lower is better</span>
                </div>
                <div className="space-y-3">
                  {pointlessReveal.obscureAnswers.map((answer, index) => (
                    <div
                      key={`${answer.answer}-${answer.score}-obscure`}
                      className="grid grid-cols-[3rem_minmax(0,1fr)_5rem] items-center gap-4 rounded-[1.25rem] border border-white/10 bg-black/20 px-4 py-3"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 font-bold text-white">
                        {index + 1}
                      </div>
                      <p className="truncate text-xl font-semibold">{answer.answer}</p>
                      <p className="text-right text-xl font-bold text-primary-teal">{answer.score}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.7rem] border border-white/10 bg-black/20 p-6">
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="section-label mb-2">Most Frequent</p>
                    <h2 className="text-3xl font-bold">Top 3 Highest Answers</h2>
                  </div>
                  <span className="status-pill">Higher is common</span>
                </div>
                <div className="space-y-3">
                  {pointlessReveal.frequentAnswers.map((answer, index) => (
                    <div
                      key={`${answer.answer}-${answer.score}-frequent`}
                      className="grid grid-cols-[3rem_minmax(0,1fr)_5rem] items-center gap-4 rounded-[1.25rem] border border-white/10 bg-white/[0.04] px-4 py-3"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 font-bold text-white">
                        {index + 1}
                      </div>
                      <p className="truncate text-xl font-semibold">{answer.answer}</p>
                      <p className="text-right text-xl font-bold text-game-warning">{answer.score}</p>
                    </div>
                  ))}
                </div>
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
      <div className="min-h-screen bg-gradient-to-br from-primary-navy to-ui-background flex flex-col items-center justify-center p-8">
        <div className="text-center">
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <h1 className="text-6xl font-bold mb-4">PHoG Display</h1>
            <p className="text-2xl text-ui-textMuted">
              {connected ? 'Connected to server' : 'Connecting...'}
            </p>
            <p className="text-xl text-ui-textMuted mt-4">
              Phase: {phase} | Game: {currentGame || 'None'}
            </p>
          </motion.div>
        </div>
      </div>
      {displayControl}
    </>
  );
};
