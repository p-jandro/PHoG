import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { ColumnReveal } from './Pointless/ColumnReveal';
import { useGameStore } from '../stores/gameStore';
import { GamePromptHeader } from '../components/GamePromptHeader';

interface PointlessProps {
  socket: Socket | null;
}

interface RoundData {
  roundIndex: number;
  totalRounds: number;
  category: string;
  question: string;
  duration: number;
}

interface RevealData {
  score: number;
  triggerTime: number;
  isCorrect: boolean;
  correctAnswer: string;
  originalInput: string;
}

interface PointlessIntroData {
  title: string;
  description: string;
  scoringRules: string[];
  placementInfo: string;
  totalRounds: number;
  duration: number;
  endsAt?: number;
}

export const Pointless = ({ socket }: PointlessProps) => {
  const { playerId } = useGameStore();
  const [phase, setPhase] = useState<'waiting' | 'intro' | 'playing' | 'submitted' | 'reveal'>('waiting');
  const [introData, setIntroData] = useState<PointlessIntroData | null>(null);
  const [roundData, setRoundData] = useState<RoundData | null>(null);
  const [revealData, setRevealData] = useState<RevealData | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [myCurrentScore, setMyCurrentScore] = useState(0);
  const [myCurrentPlacement, setMyCurrentPlacement] = useState<number | null>(null);
  const [revealDetailsVisible, setRevealDetailsVisible] = useState(false);

  // Subscribe to players from store
  const players = useGameStore((state) => state.players);

  // Track current placement - recalculate whenever players update
  useEffect(() => {
    if (!playerId || players.length === 0) {
      setMyCurrentScore(0);
      setMyCurrentPlacement(null);
      return;
    }

    const myPlayer = players.find((player) => player.id === playerId);
    setMyCurrentScore(myPlayer?.score || 0);

    // During Pointless, lower score is better (ascending sort)
    const sortedPlayers = [...players]
      .filter(p => p.connected)
      .sort((a, b) => a.score - b.score);

    const placement = sortedPlayers.findIndex(p => p.id === playerId) + 1;
    setMyCurrentPlacement(placement > 0 ? placement : null);
  }, [playerId, players]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    let timer: NodeJS.Timeout;

    if ((phase === 'intro' || phase === 'playing') && timeRemaining > 0) {
      const startTime = Date.now();
      const initialTime = timeRemaining;

      timer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, initialTime - elapsed);
        setTimeRemaining(remaining);

        if (remaining === 0) {
          clearInterval(timer);
        }
      }, 100);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [phase, roundData, socket]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    socket.on('pointless:intro', (data: PointlessIntroData) => {
      setIntroData(data);
      setPhase('intro');
      const remaining = data.endsAt
        ? Math.max(0, data.endsAt - Date.now())
        : data.duration;
      setTimeRemaining(remaining);
      setRevealData(null);
      setRevealDetailsVisible(false);
    });

    socket.on('pointless:round:start', (data: RoundData) => {
      console.log('[Pointless] Round start:', data);
      setRoundData(data);
      setPhase('playing');
      setIntroData(null);
      setInput('');
      setError('');
      setRevealData(null);
      setRevealDetailsVisible(false);
      setTimeRemaining(data.duration || 20000);

      // Reset score at start of first round only
      if (data.roundIndex === 0) {
        setMyCurrentScore(0);
      }
    });

    socket.on('pointless:answer:received', () => {
      setPhase('submitted');
    });

    socket.on('game:pointless:reveal', (data: RevealData) => {
      console.log('[Pointless] Reveal received:', data);
      setRevealData(data);
      setRevealDetailsVisible(false);
      // Accumulate score instead of setting it
      setMyCurrentScore(prev => prev + data.score);
      setPhase('reveal');
    });

    // Handle late joiners or state sync
    socket.emit('request:state'); // Ensure server sends current state if needed

    return () => {
      socket.off('pointless:intro');
      socket.off('pointless:round:start');
      socket.off('pointless:answer:received');
      socket.off('game:pointless:reveal');
    };
  }, [socket]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket) {
      return;
    }
    if (!input.trim()) {
      setError('Please enter an answer');
      return;
    }

    socket.emit('pointless:submit', { text: input });
  };

  const getOrdinalSuffix = (num: number) => {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  };

  if (!roundData && phase === 'waiting') {
    return (
      <div className="screen-shell flex items-center justify-center">
        <div className="card max-w-2xl text-center">
          <p className="eyebrow mb-3">Pointless</p>
          <h1 className="text-3xl font-bold">Waiting for the round to open</h1>
        </div>
      </div>
    );
  }

  if (phase === 'intro' && introData) {
    const progress = introData.duration ? ((introData.duration - timeRemaining) / introData.duration) * 100 : 0;

    return (
      <div className="screen-shell flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="screen-frame max-w-4xl text-center space-y-6"
        >
          <p className="eyebrow">Pointless</p>
          <motion.h1
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            className="text-5xl sm:text-6xl font-bold text-primary-teal mb-4"
          >
            {introData.title}
          </motion.h1>

          <p className="text-xl text-ui-textMuted sm:text-2xl">Starting shortly</p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="w-full max-w-md mx-auto"
          >
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary-teal"
                style={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <p className="text-sm text-ui-textMuted mt-2">
              Starting in {Math.ceil(timeRemaining / 1000)}s...
            </p>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  const isAnsweringPhase = phase === 'playing' || phase === 'submitted';

  return (
      <div className="screen-shell py-8 text-white">
        <div className="screen-frame max-w-5xl">
          {isAnsweringPhase ? (
            <div className="sticky top-3 z-10 mb-4 rounded-[1.6rem] border border-ui-border/80 bg-[#0c0a09]/92 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.3)] backdrop-blur-md sm:mb-6 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="eyebrow mb-2">Pointless</p>
                  <p className="text-[0.72rem] uppercase tracking-[0.2em] text-ui-textMuted sm:text-sm sm:tracking-[0.24em]">
                    Round {roundData ? roundData.roundIndex + 1 : '-'} of {roundData ? roundData.totalRounds : '-'} • {roundData?.category || 'Category'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="status-pill">
                    <span className="text-xl font-bold text-primary-teal">{myCurrentScore}</span>
                    <span className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-ui-textMuted">pts</span>
                  </span>
                  {myCurrentPlacement ? (
                    <span className="status-pill">
                      {myCurrentPlacement}
                      {getOrdinalSuffix(myCurrentPlacement)} in Pointless
                    </span>
                  ) : null}
                  {phase === 'playing' ? (
                    <span className="status-pill text-primary-teal">
                      {Math.ceil(timeRemaining / 1000)}s
                    </span>
                  ) : null}
                </div>
              </div>
              {phase === 'playing' ? (
                <div className="mt-4">
                  <div className="h-2 overflow-hidden rounded-full bg-ui-border/90">
                    <motion.div
                      className="h-full bg-primary-teal"
                      animate={{ width: `${Math.max(0, Math.min(100, (timeRemaining / (roundData?.duration || 30000)) * 100))}%` }}
                      transition={{ duration: 0.1, ease: 'linear' }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <GamePromptHeader
              eyebrow="Pointless"
              meta={`Round ${roundData ? roundData.roundIndex + 1 : '-'} of ${roundData ? roundData.totalRounds : '-'} • ${roundData?.category || 'Category'}`}
              title={roundData?.question || 'Question loading...'}
              details={(
                <>
                  <span className="status-pill">
                    <span className="text-xl font-bold text-primary-teal">{myCurrentScore}</span>
                    <span className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-ui-textMuted">pts</span>
                  </span>
                  {myCurrentPlacement ? (
                    <span className="status-pill">
                      {myCurrentPlacement}
                      {getOrdinalSuffix(myCurrentPlacement)} in Pointless
                    </span>
                  ) : null}
                </>
              )}
              timerBarClassName="bg-primary-teal"
              timerTextClassName="text-primary-teal"
            />
          )}

          <div className={`${isAnsweringPhase ? 'mx-auto w-full max-w-2xl' : 'flex min-h-[420px] items-center justify-center'}`}>
            <AnimatePresence mode="wait">

            {/* Input Phase */}
            {phase === 'playing' && (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full"
              >
                <form onSubmit={handleSubmit} className="card space-y-5 p-5 sm:p-8">
                  <div className="space-y-2">
                    <label className="section-label block">Your Answer</label>
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Type your obscure answer..."
                      className="w-full rounded-[1.4rem] border border-ui-border/80 bg-black/30 px-4 py-4 text-lg focus:border-primary-teal focus:outline-none transition-colors"
                      autoFocus
                      autoComplete="off"
                      enterKeyHint="done"
                    />
                    {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-full bg-primary-teal py-4 text-xl font-bold shadow-[0_18px_30px_rgba(0,0,0,0.25)] transition-transform active:scale-95 hover:bg-primary-teal/85"
                  >
                    Submit Answer
                  </button>
                </form>
              </motion.div>
            )}

            {/* Submitted Phase */}
            {phase === 'submitted' && (
              <motion.div
                key="submitted"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className="card w-full py-12 text-center"
              >
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl font-bold text-green-400">OK</span>
                </div>
                <h3 className="text-2xl font-bold mb-2">Answer Locked!</h3>
                <p className="text-gray-400">Waiting for the reveal...</p>
              </motion.div>
            )}

            {/* Reveal Phase */}
            {phase === 'reveal' && revealData && (
              <motion.div
                key="reveal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mx-auto w-full max-w-3xl"
              >
                <div className="card p-6 sm:p-8">
                  <p className="eyebrow mb-4">Score Reveal</p>

                  <ColumnReveal
                    key={revealData.triggerTime}
                    score={revealData.score}
                    triggerTime={revealData.triggerTime}
                    isCorrect={revealData.isCorrect}
                    className="h-[320px] sm:h-[400px]"
                    onSequenceComplete={() => setRevealDetailsVisible(true)}
                  />

                  <AnimatePresence>
                    {revealDetailsVisible && (
                      <motion.div
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        className="mt-6 rounded-[1.5rem] border border-ui-border/80 bg-black/20 p-5"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="section-label mb-2">
                              {revealData.isCorrect ? 'Official Match' : 'Submitted Answer'}
                            </p>
                            <h3 className="text-2xl font-bold text-white sm:text-3xl">
                              {revealData.correctAnswer || revealData.originalInput}
                            </h3>
                            {revealData.originalInput.toLowerCase() !== revealData.correctAnswer?.toLowerCase() && revealData.isCorrect && (
                              <p className="mt-2 text-sm text-ui-textMuted">
                                Corrected from "{revealData.originalInput}"
                              </p>
                            )}
                            {!revealData.isCorrect && revealData.originalInput && (
                              <p className="mt-2 text-sm text-ui-textMuted">
                                Submitted as "{revealData.originalInput}"
                              </p>
                            )}
                          </div>

                          <span className={`rounded-full px-4 py-2 text-sm font-semibold ${
                            revealData.isCorrect ? 'bg-primary-teal text-white' : 'bg-game-incorrect text-white'
                          }`}>
                            {revealData.score} pts
                          </span>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-[1.3rem] border border-ui-border/80 bg-black/20 p-4">
                            <p className="section-label mb-2">Current Standing</p>
                            <p className="text-2xl font-semibold">
                              {myCurrentPlacement ? `#${myCurrentPlacement}` : '-'}
                            </p>
                          </div>
                          <div className="rounded-[1.3rem] border border-ui-border/80 bg-black/20 p-4">
                            <p className="section-label mb-2">Running Total</p>
                            <p className="text-2xl font-semibold">{myCurrentScore}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            </AnimatePresence>
          </div>
        </div>
      </div>
  );
};
