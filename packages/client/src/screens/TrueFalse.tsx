import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import { GamePromptHeader } from '../components/GamePromptHeader';
import { Chip } from '../ui/Chip';
import { AnswerFeedback } from '../ui/AnswerFeedback';
import { streakChipPop } from '../lib/motion';

interface TrueFalseProps {
  socket: Socket | null;
}

interface Statement {
  statementId: string;
  statement: string;
  statementNumber: number;
  totalStatements: number;
  duration: number;
}

export const TrueFalse = ({ socket }: TrueFalseProps) => {
  const [phase, setPhase] = useState<'intro' | 'playing' | 'results'>('intro');
  const [introData, setIntroData] = useState<any>(null);
  const [currentStatement, setCurrentStatement] = useState<Statement | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<boolean | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<boolean | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);
  const [results, setResults] = useState<any>(null);
  const [explanation, setExplanation] = useState<string>('');

  // Stats display
  const [currentScore, setCurrentScore] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [currentPlacement, setCurrentPlacement] = useState<number | null>(null);

  const { playerId } = useGameStore();
  const players = useGameStore((state) => state.players);

  useEffect(() => {
    if (!playerId || players.length === 0) {
      setCurrentScore(0);
      setCurrentPlacement(null);
      return;
    }

    const myPlayer = players.find((player) => player.id === playerId);
    setCurrentScore(myPlayer?.score || 0);

    const sortedPlayers = [...players]
      .filter((player) => player.connected)
      .sort((a, b) => b.score - a.score);

    const placement = sortedPlayers.findIndex((player) => player.id === playerId) + 1;
    setCurrentPlacement(placement > 0 ? placement : null);
  }, [playerId, players]);

  useEffect(() => {
    if (!socket) return;

    // Intro event
    socket.on('truefalse:intro', (data) => {
      console.log('[TrueFalse] Game intro', data);
      setPhase('intro');
      setIntroData(data);
      const remaining = data.endsAt
        ? Math.max(0, data.endsAt - Date.now())
        : data.duration;
      setTimeRemaining(remaining);
      setCurrentScore(0);
      setCurrentStreak(0);
      setCurrentPlacement(null);
    });

    // Statement events
    socket.on('truefalse:statement', (data) => {
      console.log('[TrueFalse] New statement', data);
      setPhase('playing');
      setCurrentStatement(data);
      setSelectedAnswer(null);
      setCorrectAnswer(null);
      setTimeRemaining(data.duration);

      // Start countdown
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, data.duration - elapsed);
        setTimeRemaining(remaining);

        if (remaining === 0) {
          clearInterval(interval);
        }
      }, 100);

      setTimer(interval);
    });

    socket.on('truefalse:answer:received', (data) => {
      console.log('[TrueFalse] Answer confirmed', data);
      if (typeof data.streak === 'number') {
        setCurrentStreak(data.streak);
      }
    });

    socket.on('truefalse:answer', (data) => {
      console.log('[TrueFalse] Showing answer', data);
      setCorrectAnswer(data.correctAnswer);
      setExplanation(data.explanation || '');

      // Update streak and score from round-end data
      if (data.playerResults && playerId) {
        const myResult = data.playerResults[playerId];
        if (myResult) {
          setCurrentStreak(myResult.streak);
        }
      }

      // Clear timer
      if (timer) {
        clearInterval(timer);
        setTimer(null);
      }
    });

    socket.on('truefalse:end', (data) => {
      console.log('[TrueFalse] Game ended', data);
      setPhase('results');
      setResults(data);
    });

    return () => {
      socket.off('truefalse:intro');
      socket.off('truefalse:statement');
      socket.off('truefalse:answer:received');
      socket.off('truefalse:answer');
      socket.off('truefalse:end');

      if (timer) {
        clearInterval(timer);
      }
    };
  }, [socket, timer]);

  useEffect(() => {
    if (phase !== 'intro' || !introData) {
      return;
    }

    const endsAt = introData.endsAt || Date.now() + (introData.duration || 0);
    const interval = setInterval(() => {
      const remaining = Math.max(0, endsAt - Date.now());
      setTimeRemaining(remaining);

      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [phase, introData]);

  const handleAnswer = (answer: boolean) => {
    if (!socket || selectedAnswer !== null || !currentStatement) return;
    
    setSelectedAnswer(answer);
    socket.emit('truefalse:answer', {
      statementId: currentStatement.statementId,
      answer
    });

    // Stop timer
    if (timer) {
      clearInterval(timer);
      setTimer(null);
    }
  };

  const getOrdinalSuffix = (num: number) => {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  };

  // Intro Phase
  if (phase === 'intro' && introData) {
    const progress = introData.duration ? ((introData.duration - timeRemaining) / introData.duration) * 100 : 0;

    return (
      <div className="min-h-screen bg-bg-base px-4 py-8 text-ink">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-6 text-center"
        >
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak sm:text-sm">
            True or False
          </p>
          <h1 className="font-serif text-5xl font-extrabold leading-tight tracking-tight text-action sm:text-6xl">
            {introData.title}
          </h1>
          <p className="text-xl font-semibold text-ink-muted sm:text-2xl">Starting shortly</p>

          <div className="w-full max-w-md">
            <div className="h-3 overflow-hidden rounded-full border-2 border-ink bg-bg-sunken shadow-ink-sm">
              <motion.div
                className="h-full bg-action"
                style={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <p className="mt-2 text-sm font-bold text-ink-muted">
              Starting in {Math.ceil(timeRemaining / 1000)}s…
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Playing Phase
  if (phase === 'playing' && currentStatement) {
    const showingAnswer = correctAnswer !== null;
    const wasCorrect = correctAnswer === selectedAnswer;
    const hadAnswer = selectedAnswer !== null;

    return (
      <div className="min-h-screen bg-bg-base px-4 py-8 text-ink">
        <motion.div
          key={currentStatement.statementId}
          initial={{ opacity: 0, x: 80 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="mx-auto max-w-5xl"
        >
          <GamePromptHeader
            eyebrow="True or False"
            meta={`Statement ${currentStatement.statementNumber} of ${currentStatement.totalStatements}`}
            title={currentStatement.statement}
            details={(
              <>
                <Chip variant="info">
                  <span className="font-display text-base font-black">{currentScore}</span>
                  <span className="text-[0.65rem] tracking-[0.18em] uppercase">pts</span>
                </Chip>
                {currentPlacement ? (
                  <Chip>
                    <span className="font-display text-base font-black">
                      {currentPlacement}{getOrdinalSuffix(currentPlacement)}
                    </span>
                    <span className="text-[0.65rem] tracking-[0.18em] uppercase">in True/False</span>
                  </Chip>
                ) : null}
                {currentStreak >= 2 ? (
                  <motion.div
                    key={currentStreak}
                    variants={streakChipPop}
                    initial="hidden"
                    animate="visible"
                  >
                    <Chip variant="streak">
                      <span className="font-display text-base font-black">{currentStreak}×</span>
                      <span className="text-[0.65rem] tracking-[0.18em] uppercase">streak</span>
                    </Chip>
                  </motion.div>
                ) : null}
              </>
            )}
            timerMs={!showingAnswer ? timeRemaining : undefined}
            totalMs={!showingAnswer ? currentStatement.duration : undefined}
          />

          <div className="mx-auto max-w-4xl">
            {showingAnswer ? (
              <AnswerFeedback state={wasCorrect ? 'correct' : hadAnswer ? 'wrong' : 'idle'}>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className={[
                    'mb-6 rounded-2xl border-2 border-ink p-6 text-center shadow-ink',
                    wasCorrect ? 'bg-action text-on-action' : hadAnswer ? 'bg-danger text-on-danger' : 'bg-bg-sunken text-ink',
                  ].join(' ')}
                >
                  <p className="font-display text-3xl font-black">
                    {wasCorrect ? 'Correct!' : hadAnswer ? 'Wrong' : 'No answer'}
                  </p>
                  <p className="mt-2 text-base font-bold uppercase tracking-[0.18em] opacity-90">
                    Answer: {correctAnswer ? 'TRUE' : 'FALSE'}
                  </p>

                  {explanation && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25, duration: 0.22, ease: 'easeOut' }}
                      className="mt-6 rounded-xl border-2 border-ink bg-bg-surface p-5 text-left text-ink shadow-ink-sm"
                    >
                      <h3 className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-streak">
                        Did you know?
                      </h3>
                      <p className="text-base font-semibold text-ink-muted">{explanation}</p>
                    </motion.div>
                  )}
                </motion.div>
              </AnswerFeedback>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                <motion.button
                  onClick={() => handleAnswer(false)}
                  disabled={selectedAnswer !== null}
                  whileHover={selectedAnswer === null ? { x: -1, y: -1 } : undefined}
                  whileTap={selectedAnswer === null ? { x: 4, y: 4 } : undefined}
                  transition={{ duration: 0.08, ease: [0, 0, 0.2, 1] }}
                  className={[
                    'min-h-[120px] rounded-2xl border-2 border-ink bg-danger text-on-danger font-display text-4xl font-black tracking-tight shadow-ink touch-manipulation sm:text-5xl',
                    selectedAnswer === false ? 'ring-4 ring-now' : '',
                    selectedAnswer === true ? 'opacity-40' : '',
                  ].join(' ')}
                >
                  FALSE
                </motion.button>

                <motion.button
                  onClick={() => handleAnswer(true)}
                  disabled={selectedAnswer !== null}
                  whileHover={selectedAnswer === null ? { x: -1, y: -1 } : undefined}
                  whileTap={selectedAnswer === null ? { x: 4, y: 4 } : undefined}
                  transition={{ duration: 0.08, ease: [0, 0, 0.2, 1] }}
                  className={[
                    'min-h-[120px] rounded-2xl border-2 border-ink bg-action text-on-action font-display text-4xl font-black tracking-tight shadow-ink touch-manipulation sm:text-5xl',
                    selectedAnswer === true ? 'ring-4 ring-now' : '',
                    selectedAnswer === false ? 'opacity-40' : '',
                  ].join(' ')}
                >
                  TRUE
                </motion.button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  // Results Phase
  if (phase === 'results' && results) {
    const myResult = results.results.find((r: any) => r.playerId === playerId);

    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center px-4 py-8 text-ink">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="w-full max-w-3xl rounded-3xl border-2 border-ink bg-bg-surface p-8 shadow-ink-lg sm:p-10"
        >
          <p className="mb-2 text-center text-xs font-extrabold uppercase tracking-[0.2em] text-streak sm:text-sm">
            True or False
          </p>
          <h2 className="mb-6 text-center font-serif text-3xl font-extrabold tracking-tight sm:text-4xl">
            Game Over
          </h2>

          {myResult && (
            <div className="text-center">
              <p className="font-display text-6xl font-black leading-none text-action sm:text-7xl">
                {myResult.accuracy}%
              </p>
              <p className="mt-3 text-xl font-bold text-ink-muted sm:text-2xl">
                {myResult.correct} / {myResult.total} correct
              </p>
              <p className="mt-6 text-lg font-semibold text-ink">
                You earned <span className="font-display text-2xl font-black text-streak">{myResult.points}</span> points
              </p>
              <p className="mt-2 text-sm font-bold text-ink-muted">
                Total score: <span className="font-display text-base text-ink">{myResult.newScore}</span>
              </p>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center px-4">
      <div className="rounded-2xl border-2 border-ink bg-bg-surface p-8 shadow-ink-lg">
        <h2 className="text-center text-2xl font-extrabold text-ink">Loading…</h2>
      </div>
    </div>
  );
};
