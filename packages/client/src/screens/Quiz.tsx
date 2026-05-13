import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import { GamePromptHeader } from '../components/GamePromptHeader';

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

const QUIZ_ANSWER_COLORS: Record<string, string> = {
  A: '#7186be',
  B: '#6f9a79',
  C: '#d7a348',
  D: '#8b5f6b'
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
      <div className="screen-shell flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="screen-frame max-w-4xl"
        >
          <p className="eyebrow mb-3 text-center">Round Vote</p>
          <h1 className="text-4xl font-bold text-center mb-2">Vote for Category</h1>
          <p className="text-ui-textMuted text-center mb-8">
            The leader's vote counts 2x!
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {categories.map((category) => (
              <motion.button
                key={category.id}
                onClick={() => handleVote(category.id)}
                disabled={!!selectedCategory}
                whileHover={{ scale: selectedCategory ? 1 : 1.05 }}
                whileTap={{ scale: selectedCategory ? 1 : 0.95 }}
                className={`rounded-[1.8rem] border border-white/10 p-6 text-xl font-bold transition-all shadow-[0_18px_30px_rgba(0,0,0,0.22)] sm:p-8 sm:text-2xl ${
                  selectedCategory === category.id
                    ? 'ring-4 ring-white'
                    : selectedCategory
                    ? 'opacity-50'
                    : ''
                }`}
                style={{
                  backgroundColor: category.color,
                  color: 'white'
                }}
              >
                {(category as any).label || category.name}
              </motion.button>
            ))}
          </div>

          {selectedCategory && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center mt-6 text-game-correct font-medium"
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
      <div className="screen-shell flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="screen-frame max-w-4xl"
        >
          <p className="eyebrow mb-3 text-center">Vote Locked</p>
          <h1 className="text-4xl font-bold text-center mb-2">Voting Results</h1>
          <p className="text-ui-textMuted text-center mb-8">
            The votes are in!
          </p>

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {categories.map((category) => {
              const voteCount = votingResults.voteCounts[category.id] || 0;
              const isWinner = votingResults.winningOptionId === category.id;
              
              return (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-xl p-5 transition-all sm:p-6 ${
                    isWinner ? 'ring-4 ring-game-leader scale-105' : ''
                  }`}
                  style={{
                    backgroundColor: category.color,
                    color: 'white'
                  }}
                >
                  <div className="text-center">
                      <div className="mb-2 text-xl font-bold sm:text-2xl">{category.label || category.name}</div>
                    <div className="text-3xl font-bold sm:text-4xl">{voteCount}</div>
                    <div className="text-sm opacity-75">vote{voteCount !== 1 ? 's' : ''}</div>
                    {isWinner && (
                      <div className="mt-2 text-xl font-bold uppercase tracking-wide">Winner!</div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="text-center text-ui-textMuted"
          >
            Next question coming up...
          </motion.p>
        </motion.div>
      </div>
    );
  }

  // Question Phase
  if (phase === 'question' && currentQuestion) {
    const timeSeconds = Math.ceil(timeRemaining / 1000);
    const timePercent = (timeRemaining / currentQuestion.duration) * 100;
    const timerToneClass =
      timePercent > 50 ? 'bg-game-correct' :
      timePercent > 25 ? 'bg-game-warning' :
      'bg-game-incorrect';
    const timerTextClass =
      timePercent > 50 ? 'text-game-correct' :
      timePercent > 25 ? 'text-game-warning' :
      'text-game-incorrect';

    return (
      <div className="screen-shell py-8 text-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="screen-frame max-w-5xl"
        >
          <GamePromptHeader
            eyebrow="Quiz"
            meta={`${currentQuestion.category} • ${currentQuestion.difficulty}`}
            title={currentQuestion.question}
            details={(
              <>
                <span className="status-pill">
                  <span className="text-xl font-bold text-primary-blue">{currentScore}</span>
                  <span className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-ui-textMuted">pts</span>
                </span>
                {currentPlacement ? (
                  <span className="status-pill">
                    {currentPlacement}
                    {getOrdinalSuffix(currentPlacement)} in Quiz
                  </span>
                ) : null}
              </>
            )}
            timerMs={timeRemaining}
            totalMs={currentQuestion.duration}
            timerBarClassName={timerToneClass}
            timerTextClassName={timerTextClass}
          />

          <div className="mx-auto max-w-4xl">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {Object.entries(currentQuestion.answers).map(([key, value]) => (
              <motion.button
                key={key}
                onClick={() => handleAnswer(key)}
                disabled={!!selectedAnswer}
                  whileTap={{ scale: selectedAnswer ? 1 : 0.95 }}
                  className={`btn-answer min-h-[100px] sm:min-h-[88px] ${
                    selectedAnswer === key ? 'ring-4 ring-white' : ''
                  } ${selectedAnswer && selectedAnswer !== key ? 'opacity-50' : ''} 
                  active:scale-95 transition-all touch-manipulation`}
                  style={{ backgroundColor: QUIZ_ANSWER_COLORS[key] }}
                >
                  <div className="text-center w-full text-2xl font-medium leading-tight px-4 sm:text-xl">
                    {value}
                  </div>
                </motion.button>
              ))}
            </div>

            {selectedAnswer && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center mt-6 text-game-correct font-medium"
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
    const correctAnswerText = currentQuestion.answers[correctAnswerKey];

    return (
      <div className="screen-shell py-8 text-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="screen-frame max-w-5xl"
        >
          <GamePromptHeader
            eyebrow="Quiz"
            meta={`${currentQuestion.category} • ${currentQuestion.difficulty}`}
            title={currentQuestion.question}
            details={(
              <>
                <span className="status-pill">
                  <span className="text-xl font-bold text-primary-blue">{myResult?.newScore ?? currentScore}</span>
                  <span className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-ui-textMuted">pts</span>
                </span>
                {myRank > 0 ? (
                  <span className="status-pill">
                    {myRank}
                    {getOrdinalSuffix(myRank)} in Quiz
                  </span>
                ) : null}
              </>
            )}
          />

          <div className="mx-auto max-w-4xl">
            <div className="mb-6 rounded-[1.5rem] border border-ui-border/80 bg-black/20 p-5 text-center">
              <p className={`text-2xl font-bold ${myResult?.isCorrect ? 'text-game-correct' : 'text-game-incorrect'}`}>
                {myResult?.isCorrect ? 'Correct' : selectedAnswer ? 'Wrong' : 'No answer'}
              </p>
              <p className="mt-2 text-lg text-ui-textMuted">
                {myResult ? `+${myResult.points} points this question` : '0 points this question'}
              </p>
              <p className="mt-3 text-base font-semibold text-white">
                Correct answer: {correctAnswerKey} • {correctAnswerText}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {Object.entries(currentQuestion.answers).map(([key, value]) => {
                const isCorrectAnswer = key === correctAnswerKey;
                const isSelectedAnswer = selectedAnswer === key;
                const resultClass = isCorrectAnswer
                  ? 'border-white ring-4 ring-game-correct/70 brightness-110'
                  : isSelectedAnswer
                    ? 'border-white ring-4 ring-white/80 opacity-80'
                    : 'border-white/10 opacity-35 brightness-50';

                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 * ['A', 'B', 'C', 'D'].indexOf(key) }}
                    className={`rounded-[1.8rem] border p-6 text-left shadow-[0_18px_30px_rgba(0,0,0,0.22)] transition-all sm:p-8 ${resultClass}`}
                    style={{ backgroundColor: QUIZ_ANSWER_COLORS[key] }}
                  >
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <div className="text-2xl font-bold text-white/80 sm:text-3xl">{key}</div>
                      {isSelectedAnswer ? (
                        <div className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                          Your pick
                        </div>
                      ) : null}
                    </div>
                    <div className="text-2xl text-white sm:text-3xl">{value}</div>
                  </motion.div>
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
    <div className="min-h-screen flex items-center justify-center">
      <div className="card">
        <h2 className="text-2xl font-bold text-center">Loading Quiz...</h2>
      </div>
    </div>
  );
};
