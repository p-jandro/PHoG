import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { ScoreDrop, Card, Chip, Input, Button } from '../ui';
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
      setTimeRemaining(data.duration || 120000);

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

  // Task 3: Waiting screen
  if (!roundData && phase === 'waiting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base p-6">
        <Card eyebrow="Pointless" className="max-w-xl text-center">
          <h1 className="font-display text-3xl font-extrabold text-ink sm:text-4xl">
            Waiting for the round to open
          </h1>
          <p className="mt-3 text-base text-ink-muted">
            Sit tight — the host will start the round any moment.
          </p>
        </Card>
      </div>
    );
  }

  // Task 4: Intro screen
  if (phase === 'intro' && introData) {
    const progress = introData.duration ? ((introData.duration - timeRemaining) / introData.duration) * 100 : 0;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg-base p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full max-w-3xl"
        >
          <Card eyebrow="Pointless" className="text-center">
            <motion.h1
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
              className="font-serif text-5xl font-extrabold text-streak sm:text-6xl"
            >
              {introData.title}
            </motion.h1>

            <p className="mt-4 text-xl text-ink-muted sm:text-2xl">Starting shortly</p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mx-auto mt-8 w-full max-w-md"
            >
              <div className="h-2 overflow-hidden rounded-full border-2 border-ink bg-bg-sunken">
                <motion.div
                  className="h-full bg-action"
                  style={{ width: `${progress}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
              <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-ink-muted">
                Starting in {Math.ceil(timeRemaining / 1000)}s
              </p>
            </motion.div>
          </Card>
        </motion.div>
      </div>
    );
  }

  const isAnsweringPhase = phase === 'playing' || phase === 'submitted';

  return (
    <div className="min-h-screen bg-bg-base py-8 text-ink">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        {/* Task 5: Sticky status bar / GamePromptHeader */}
        {isAnsweringPhase ? (
          <div className="sticky top-3 z-10 mb-4 rounded-2xl border-2 border-ink bg-bg-surface p-4 shadow-ink sm:mb-6 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-streak">
                  Pointless
                </p>
                <p className="mt-1 text-sm font-semibold uppercase tracking-[0.16em] text-ink-muted">
                  Round {roundData ? roundData.roundIndex + 1 : '-'} of {roundData ? roundData.totalRounds : '-'} · {roundData?.category || 'Category'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Chip variant="default">
                  <span className="font-display text-lg font-extrabold text-ink">{myCurrentScore}</span>
                  <span className="ml-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-muted">pts</span>
                </Chip>
                {myCurrentPlacement ? (
                  <Chip variant="info">
                    {myCurrentPlacement}{getOrdinalSuffix(myCurrentPlacement)} in Pointless
                  </Chip>
                ) : null}
                {phase === 'playing' ? (
                  <Chip variant="now">
                    {Math.ceil(timeRemaining / 1000)}s
                  </Chip>
                ) : null}
              </div>
            </div>
            {phase === 'playing' ? (
              <div className="mt-4">
                <div className="h-2 overflow-hidden rounded-full border-2 border-ink bg-bg-sunken">
                  <motion.div
                    className="h-full bg-action"
                    animate={{ width: `${Math.max(0, Math.min(100, (timeRemaining / (roundData?.duration || 120000)) * 100))}%` }}
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
                <Chip variant="default">
                  <span className="font-display text-lg font-extrabold text-ink">{myCurrentScore}</span>
                  <span className="ml-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-muted">pts</span>
                </Chip>
                {myCurrentPlacement ? (
                  <Chip variant="info">
                    {myCurrentPlacement}{getOrdinalSuffix(myCurrentPlacement)} in Pointless
                  </Chip>
                ) : null}
              </>
            )}
          />
        )}

        <div className={`${isAnsweringPhase ? 'mx-auto w-full max-w-2xl' : 'flex min-h-[420px] items-center justify-center'}`}>
          <AnimatePresence mode="wait">

          {/* Task 5: Input Phase */}
          {phase === 'playing' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full"
            >
              <Card className="space-y-5">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <Input
                    label="Your Answer"
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your obscure answer..."
                    autoFocus
                    autoComplete="off"
                    enterKeyHint="done"
                    error={error || undefined}
                  />
                  <Button type="submit" variant="action" size="lg" className="w-full">
                    Submit Answer
                  </Button>
                </form>
              </Card>
            </motion.div>
          )}

          {/* Task 5: Submitted Phase */}
          {phase === 'submitted' && (
            <motion.div
              key="submitted"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="w-full"
            >
              <Card className="py-12 text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-ink bg-action shadow-ink">
                  <span className="font-display text-3xl font-black text-white">OK</span>
                </div>
                <h3 className="font-display text-2xl font-extrabold text-ink">Answer Locked!</h3>
                <p className="mt-2 text-base text-ink-muted">Waiting for the reveal...</p>
              </Card>
            </motion.div>
          )}

          {/* Task 6: Reveal Phase */}
          {phase === 'reveal' && revealData && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mx-auto w-full max-w-3xl"
            >
              <Card eyebrow="Score Reveal">
                <div className="flex justify-center py-2 sm:py-4">
                  <ScoreDrop
                    key={revealData.triggerTime}
                    targetScore={revealData.score}
                    autoStart
                    onLanded={() => setRevealDetailsVisible(true)}
                  />
                </div>

                <AnimatePresence>
                  {revealDetailsVisible && (
                    <motion.div
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 12 }}
                      transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
                      className="mt-6 rounded-2xl border-2 border-ink bg-bg-sunken p-5 shadow-ink"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-ink-muted">
                            {revealData.isCorrect ? 'Official Match' : 'Submitted Answer'}
                          </p>
                          <h3 className="mt-2 font-display text-2xl font-extrabold text-ink sm:text-3xl">
                            {revealData.correctAnswer || revealData.originalInput}
                          </h3>
                          {revealData.originalInput.toLowerCase() !== revealData.correctAnswer?.toLowerCase() && revealData.isCorrect && (
                            <p className="mt-2 text-sm text-ink-muted">
                              Corrected from "{revealData.originalInput}"
                            </p>
                          )}
                          {!revealData.isCorrect && revealData.originalInput && (
                            <p className="mt-2 text-sm text-ink-muted">
                              Submitted as "{revealData.originalInput}"
                            </p>
                          )}
                        </div>

                        <Chip variant={revealData.isCorrect ? 'default' : 'streak'}>
                          <span className="font-display text-lg font-extrabold">
                            {revealData.score}
                          </span>
                          <span className="ml-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em]">
                            pts
                          </span>
                        </Chip>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border-2 border-ink bg-bg-surface p-4 shadow-ink-sm">
                          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-ink-muted">
                            Current Standing
                          </p>
                          <p className="mt-2 font-display text-2xl font-extrabold text-ink">
                            {myCurrentPlacement ? `#${myCurrentPlacement}` : '-'}
                          </p>
                        </div>
                        <div className="rounded-xl border-2 border-ink bg-bg-surface p-4 shadow-ink-sm">
                          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-ink-muted">
                            Running Total
                          </p>
                          <p className="mt-2 font-display text-2xl font-extrabold text-ink">
                            {myCurrentScore}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
