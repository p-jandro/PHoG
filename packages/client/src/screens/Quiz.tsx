import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import { GamePromptHeader } from '../components/GamePromptHeader';
import { Chip } from '../ui/Chip';
import { AnswerFeedback } from '../ui/AnswerFeedback';

interface QuizProps {
  socket: Socket | null;
}

interface Category {
  id: string;
  name?: string;
  label?: string;
  color: string;
}

interface QuizQuestion {
  questionId: string;
  question: string;
  answers: Record<string, string>;
  category: string;
  difficulty: string;
  color: string;
  questionNumber: number;
  totalQuestions: number;
  duration: number;
}

const ANSWER_BG_CLASS: Record<string, string> = {
  A: 'bg-answer-a',
  B: 'bg-answer-b',
  C: 'bg-answer-c',
  D: 'bg-answer-d',
};

export const Quiz = ({ socket }: QuizProps) => {
  const [phase, setPhase] = useState<'intro' | 'voting' | 'votingResults' | 'question' | 'results'>('intro');
  const [introData, setIntroData] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [questionTimer, setQuestionTimer] = useState<NodeJS.Timeout | null>(null);
  const [results, setResults] = useState<any>(null);
  const [votingResults, setVotingResults] = useState<any>(null);
  const [currentScore, setCurrentScore] = useState(0);
  const [currentPlacement, setCurrentPlacement] = useState<number | null>(null);
  const [submittedTimeSeconds, setSubmittedTimeSeconds] = useState<number | null>(null);

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
    socket.on('quiz:intro', (data) => {
      console.log('[Quiz] Intro received', data);
      setPhase('intro');
      setIntroData(data);
      
      const remaining = data.endsAt 
        ? Math.max(0, data.endsAt - Date.now())
        : data.duration;
      setTimeRemaining(remaining);
    });

    // Voting events
    socket.on('quiz:voting:start', (data) => {
      console.log('[Quiz] Voting started', data);
      setPhase('voting');
      setCategories(data.options || data.categories); // Support both old and new format
      setSelectedCategory(null);
      
      const remaining = data.endsAt 
        ? Math.max(0, data.endsAt - Date.now())
        : data.duration;
      setTimeRemaining(remaining);
    });

    socket.on('quiz:vote:received', () => {
      console.log('[Quiz] Vote received');
    });

    socket.on('quiz:voting:end', (data) => {
      console.log('[Quiz] Voting ended', data);
      setPhase('votingResults');
      setVotingResults(data);
    });

    // Question events
    socket.on('quiz:question:start', (data) => {
      console.log('[Quiz] Question started', data);
      setPhase('question');
      setCurrentQuestion(data);
      setSelectedAnswer(null);
      setSubmittedTimeSeconds(null);
      
      const initialRemaining = data.endsAt 
        ? Math.max(0, data.endsAt - Date.now())
        : data.duration;
      setTimeRemaining(initialRemaining);

      // Start countdown timer
      const startTime = Date.now();
      const interval = setInterval(() => {
        let remaining;
        
        if (data.endsAt) {
          // Use server synchronized end time
          remaining = Math.max(0, data.endsAt - Date.now());
        } else {
          // Fallback to local duration
          const elapsed = Date.now() - startTime;
          remaining = Math.max(0, data.duration - elapsed);
        }
        
        setTimeRemaining(remaining);

        if (remaining === 0) {
          clearInterval(interval);
        }
      }, 100);

      setQuestionTimer(interval);
    });

    socket.on('quiz:answer:received', () => {
      console.log('[Quiz] Answer received');
    });

    socket.on('quiz:question:end', (data) => {
      console.log('[Quiz] Question ended', data);
      setPhase('results');
      setResults(data);

      // Clear timer
      if (questionTimer) {
        clearInterval(questionTimer);
        setQuestionTimer(null);
      }
    });

    socket.on('quiz:end', (data) => {
      console.log('[Quiz] Quiz ended', data);
      // B1 fix (2026-05-14): clear out the last question/results so this screen
      // can't briefly re-paint the previous round between the round-leaderboard
      // overlay dismissing and the App switching to the final leaderboard.
      setResults(null);
      setCurrentQuestion(null);
      setSelectedAnswer(null);
      setVotingResults(null);
      setIntroData(null);
      if (questionTimer) {
        clearInterval(questionTimer);
        setQuestionTimer(null);
      }
    });

    return () => {
      socket.off('quiz:intro');
      socket.off('quiz:voting:start');
      socket.off('quiz:vote:received');
      socket.off('quiz:voting:end');
      socket.off('quiz:question:start');
      socket.off('quiz:answer:received');
      socket.off('quiz:question:end');
      socket.off('quiz:end');

      if (questionTimer) {
        clearInterval(questionTimer);
      }
    };
  }, [socket, questionTimer]);

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

  const handleVote = (optionId: string) => {
    if (!socket || selectedCategory) return;
    
    setSelectedCategory(optionId);
    socket.emit('quiz:vote', { optionId });
  };

  const handleAnswer = (answer: string) => {
    console.log('[Quiz Client] handleAnswer called', { answer, hasSocket: !!socket, selectedAnswer, hasQuestion: !!currentQuestion });
    
    if (!socket) {
      console.error('[Quiz Client] ❌ No socket');
      return;
    }
    if (selectedAnswer) {
      console.error('[Quiz Client] ❌ Already answered');
      return;
    }
    if (!currentQuestion) {
      console.error('[Quiz Client] ❌ No current question');
      return;
    }
    
    setSelectedAnswer(answer);
    setSubmittedTimeSeconds(Math.ceil(timeRemaining / 1000));
    
    const payload = {
      questionId: currentQuestion.questionId,
      answer,
      timeRemaining
    };
    
    console.log('[Quiz Client] ✓ Emitting quiz:answer', payload);
    socket.emit('quiz:answer', payload);

    // Keep timer running - don't stop it
    // Timer will continue to count down visually until question ends
  };

  // Helper function for ordinal suffix
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
    const progress = ((introData.duration - timeRemaining) / introData.duration) * 100;

    return (
      <div className="min-h-screen bg-bg-base px-4 py-8 text-ink">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-6 text-center"
        >
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak sm:text-sm">
            Quiz Briefing
          </p>
          <h1 className="font-serif text-5xl font-extrabold leading-tight tracking-tight text-ink sm:text-6xl">
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

  // Voting Phase
  if (phase === 'voting') {
    return (
      <div className="min-h-screen bg-bg-base px-4 py-8 text-ink">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="mx-auto max-w-4xl"
        >
          <p className="mb-3 text-center text-xs font-extrabold uppercase tracking-[0.2em] text-streak sm:text-sm">
            Round Vote
          </p>
          <h1 className="text-center text-4xl font-extrabold tracking-tight text-ink">
            Vote for Category
          </h1>
          <p className="mt-2 text-center text-base font-semibold text-ink-muted">
            The leader's vote counts 2×.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {categories.map((category) => {
              const isPicked = selectedCategory === category.id;
              const dimmed = selectedCategory && !isPicked;
              return (
                <motion.button
                  key={category.id}
                  onClick={() => handleVote(category.id)}
                  disabled={!!selectedCategory}
                  whileHover={!selectedCategory ? { x: -1, y: -1 } : undefined}
                  whileTap={!selectedCategory ? { x: 4, y: 4 } : undefined}
                  transition={{ duration: 0.08, ease: [0, 0, 0.2, 1] }}
                  className={[
                    'rounded-2xl border-2 border-ink p-6 text-xl font-extrabold text-white shadow-ink sm:p-8 sm:text-2xl',
                    isPicked ? 'ring-4 ring-now' : '',
                    dimmed ? 'opacity-40' : '',
                  ].join(' ')}
                  style={{ backgroundColor: category.color }}
                >
                  {(category as any).label || category.name}
                </motion.button>
              );
            })}
          </div>

          {selectedCategory && (
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="mt-6 text-center text-base font-extrabold text-action"
            >
              ✓ Vote submitted!
            </motion.p>
          )}
        </motion.div>
      </div>
    );
  }

  // Voting Results Phase
  if (phase === 'votingResults' && votingResults) {
    return (
      <div className="min-h-screen bg-bg-base px-4 py-8 text-ink">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="mx-auto max-w-4xl"
        >
          <p className="mb-3 text-center text-xs font-extrabold uppercase tracking-[0.2em] text-streak sm:text-sm">
            Vote Locked
          </p>
          <h1 className="text-center text-4xl font-extrabold tracking-tight text-ink">
            Voting Results
          </h1>
          <p className="mt-2 text-center text-base font-semibold text-ink-muted">
            The votes are in!
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {categories.map((category) => {
              const voteCount = votingResults.voteCounts[category.id] || 0;
              const isWinner = votingResults.winningOptionId === category.id;
              return (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className={[
                    'rounded-2xl border-2 border-ink p-5 text-center text-white shadow-ink sm:p-6',
                    isWinner ? 'ring-4 ring-now scale-[1.03]' : '',
                  ].join(' ')}
                  style={{ backgroundColor: category.color }}
                >
                  <div className="text-xl font-extrabold sm:text-2xl">{(category as any).label || category.name}</div>
                  <div className="mt-2 font-display text-3xl font-black leading-none sm:text-4xl">{voteCount}</div>
                  <div className="mt-1 text-xs font-bold uppercase tracking-[0.18em] opacity-80">
                    vote{voteCount !== 1 ? 's' : ''}
                  </div>
                  {isWinner && (
                    <div className="mt-2 text-base font-extrabold uppercase tracking-[0.18em]">Winner!</div>
                  )}
                </motion.div>
              );
            })}
          </div>

          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="mt-6 text-center text-base font-bold text-ink-muted"
          >
            Next question coming up…
          </motion.p>
        </motion.div>
      </div>
    );
  }

  // Question Phase
  if (phase === 'question' && currentQuestion) {
    const timeSeconds = Math.ceil(timeRemaining / 1000);

    return (
      <div className="min-h-screen bg-bg-base px-4 py-8 text-ink">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="mx-auto max-w-5xl"
        >
          <GamePromptHeader
            eyebrow="Quiz"
            meta={`${currentQuestion.category} • ${currentQuestion.difficulty}`}
            title={currentQuestion.question}
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
                    <span className="text-[0.65rem] tracking-[0.18em] uppercase">in Quiz</span>
                  </Chip>
                ) : null}
              </>
            )}
            timerMs={timeRemaining}
            totalMs={currentQuestion.duration}
          />

          <div className="mx-auto max-w-4xl">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {Object.entries(currentQuestion.answers).map(([key, value]) => {
                const isPicked = selectedAnswer === key;
                const dimmed = !!selectedAnswer && !isPicked;
                return (
                  <motion.button
                    key={key}
                    onClick={() => handleAnswer(key)}
                    disabled={!!selectedAnswer}
                    whileHover={!selectedAnswer ? { x: -1, y: -1 } : undefined}
                    whileTap={!selectedAnswer ? { x: 4, y: 4 } : undefined}
                    transition={{ duration: 0.08, ease: [0, 0, 0.2, 1] }}
                    className={[
                      'flex min-h-[100px] w-full items-center gap-4 rounded-2xl border-2 border-ink p-4 text-left text-white shadow-ink touch-manipulation sm:min-h-[88px] sm:p-5',
                      ANSWER_BG_CLASS[key] || 'bg-bg-surface',
                      isPicked ? 'ring-4 ring-now' : '',
                      dimmed ? 'opacity-40' : '',
                    ].join(' ')}
                  >
                    <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-bg-surface font-display text-2xl font-black text-ink shadow-ink-sm">
                      {key}
                    </span>
                    <span className="flex-1 text-xl font-extrabold leading-tight sm:text-2xl">
                      {value}
                    </span>
                  </motion.button>
                );
              })}
            </div>

            {selectedAnswer && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="mt-6 text-center text-base font-extrabold text-action"
              >
                Answer submitted. Locked in with {submittedTimeSeconds ?? timeSeconds}s remaining.
              </motion.p>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  // Results Phase
  if (phase === 'results' && results && currentQuestion) {
    const myResult = results.results.find((r: any) => r.playerId === playerId);
    const myRank = results.leaderboard?.findIndex((p: any) => p.id === playerId) + 1 || 0;
    const correctAnswerKey = results.correctAnswer;
    const wasCorrect = !!myResult?.isCorrect;
    const hadAnswer = !!selectedAnswer;

    return (
      <div className="min-h-screen bg-bg-base px-4 py-8 text-ink">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="mx-auto max-w-5xl"
        >
          {/* Banner: Correct! / Wrong / No answer */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="mx-auto mb-6 max-w-2xl"
          >
            <div
              className={[
                'rounded-2xl border-2 border-ink px-6 py-4 text-center font-display text-3xl font-black shadow-ink',
                wasCorrect ? 'bg-action text-on-action' : hadAnswer ? 'bg-danger text-on-danger' : 'bg-bg-sunken text-ink',
              ].join(' ')}
            >
              {wasCorrect ? 'Correct!' : hadAnswer ? 'Wrong' : 'No answer'}
              <div className="mt-1 font-sans text-sm font-bold uppercase tracking-[0.18em] opacity-90">
                {myResult ? `+${myResult.points} points` : '0 points'}
              </div>
            </div>
          </motion.div>

          <GamePromptHeader
            eyebrow="Quiz"
            meta={`${currentQuestion.category} • ${currentQuestion.difficulty}`}
            title={currentQuestion.question}
            details={(
              <>
                <Chip variant="info">
                  <span className="font-display text-base font-black">{myResult?.newScore ?? currentScore}</span>
                  <span className="text-[0.65rem] tracking-[0.18em] uppercase">pts</span>
                </Chip>
                {myRank > 0 ? (
                  <Chip>
                    <span className="font-display text-base font-black">
                      {myRank}{getOrdinalSuffix(myRank)}
                    </span>
                    <span className="text-[0.65rem] tracking-[0.18em] uppercase">in Quiz</span>
                  </Chip>
                ) : null}
              </>
            )}
          />

          <div className="mx-auto max-w-4xl">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {Object.entries(currentQuestion.answers).map(([key, value]) => {
                const isCorrectAnswer = key === correctAnswerKey;
                const isPlayerPick = selectedAnswer === key;
                const playerPickedThis = isPlayerPick;
                // Feedback animation: only on the player's pick.
                const feedbackState: 'idle' | 'correct' | 'wrong' =
                  playerPickedThis ? (wasCorrect ? 'correct' : 'wrong') : 'idle';

                return (
                  <AnswerFeedback key={key} state={feedbackState}>
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 * ['A', 'B', 'C', 'D'].indexOf(key), duration: 0.22, ease: 'easeOut' }}
                      className={[
                        'flex min-h-[100px] w-full items-center gap-4 rounded-2xl border-2 border-ink p-4 text-left text-white shadow-ink sm:p-5',
                        ANSWER_BG_CLASS[key] || 'bg-bg-surface',
                        isCorrectAnswer ? 'ring-4 ring-action' : '',
                        !isCorrectAnswer && !isPlayerPick ? 'opacity-40' : '',
                        isPlayerPick && !wasCorrect ? 'ring-4 ring-danger' : '',
                      ].join(' ')}
                    >
                      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-bg-surface font-display text-2xl font-black text-ink shadow-ink-sm">
                        {key}
                      </span>
                      <div className="flex-1">
                        <div className="text-xl font-extrabold leading-tight sm:text-2xl">{value}</div>
                        {isPlayerPick && (
                          <div className="mt-1 text-xs font-extrabold uppercase tracking-[0.18em] opacity-90">
                            Your pick
                          </div>
                        )}
                      </div>
                      {isCorrectAnswer && (
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 border-ink bg-action text-on-action font-black shadow-ink-sm">
                          ✓
                        </span>
                      )}
                    </motion.div>
                  </AnswerFeedback>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center px-4">
      <div className="rounded-2xl border-2 border-ink bg-bg-surface p-8 shadow-ink-lg">
        <h2 className="text-center text-2xl font-extrabold text-ink">Loading Quiz…</h2>
      </div>
    </div>
  );
};
