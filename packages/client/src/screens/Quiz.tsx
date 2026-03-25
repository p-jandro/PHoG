import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';

interface QuizProps {
  socket: Socket | null;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface QuizQuestion {
  questionId: string;
  question: string;
  answers: Record<string, string>;
  category: string;
  questionNumber: number;
  totalQuestions: number;
  duration: number;
}

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

  const { playerId } = useGameStore();

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
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-ui-background to-gray-900">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-3xl w-full text-center space-y-6"
        >
          <motion.h1
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            className="text-5xl sm:text-6xl font-bold text-game-correct mb-4"
          >
            {introData.title}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-2xl sm:text-3xl text-ui-textMuted mb-8"
          >
            {introData.description}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-ui-card rounded-xl p-6 sm:p-8 text-left"
          >
            <h2 className="text-2xl font-bold text-game-accent mb-4">Scoring Rules</h2>
            <ul className="space-y-2 text-lg">
              {introData.scoringRules.map((rule: string, index: number) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="flex items-start"
                >
                  <span className="text-game-accent mr-2">•</span>
                  <span className="text-ui-textMuted">{rule}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-xl text-game-warning"
          >
            {introData.placementInfo}
          </motion.p>

          {/* Progress bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="w-full max-w-md mx-auto"
          >
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-game-accent"
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

  // Voting Phase
  if (phase === 'voting') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full"
        >
          <h1 className="text-4xl font-bold text-center mb-2">Vote for Category</h1>
          <p className="text-ui-textMuted text-center mb-8">
            The leader's vote counts 2x!
          </p>

          <div className="grid grid-cols-2 gap-4">
            {categories.map((category) => (
              <motion.button
                key={category.id}
                onClick={() => handleVote(category.id)}
                disabled={!!selectedCategory}
                whileHover={{ scale: selectedCategory ? 1 : 1.05 }}
                whileTap={{ scale: selectedCategory ? 1 : 0.95 }}
                className={`p-8 rounded-xl font-bold text-2xl transition-all ${
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
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-2xl w-full"
        >
          <h1 className="text-4xl font-bold text-center mb-2">Voting Results</h1>
          <p className="text-ui-textMuted text-center mb-8">
            The votes are in!
          </p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            {categories.map((category) => {
              const voteCount = votingResults.voteCounts[category.id] || 0;
              const isWinner = votingResults.winningCategory === category.id;
              
              return (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-6 rounded-xl transition-all ${
                    isWinner ? 'ring-4 ring-game-leader scale-105' : ''
                  }`}
                  style={{
                    backgroundColor: category.color,
                    color: 'white'
                  }}
                >
                  <div className="text-center">
                    <div className="text-2xl font-bold mb-2">{category.name}</div>
                    <div className="text-4xl font-bold">{voteCount}</div>
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

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl w-full"
        >
          {/* Question header */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-ui-textMuted">
                Question {currentQuestion.questionNumber} / {currentQuestion.totalQuestions}
              </span>
              <span
                className={`font-bold px-3 py-1 rounded-full text-sm`}
                style={{
                  backgroundColor: categories.find(c => c.id === currentQuestion.category)?.color || '#0066FF',
                  color: 'white'
                }}
              >
                {currentQuestion.category.toUpperCase()}
              </span>
            </div>

            {/* Timer bar */}
            <div className="w-full h-2 bg-ui-border rounded-full overflow-hidden mb-4">
              <motion.div
                className={`h-full ${
                  timePercent > 50 ? 'bg-game-correct' :
                  timePercent > 25 ? 'bg-game-warning' :
                  'bg-game-incorrect'
                }`}
                style={{ width: `${timePercent}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>

            {/* Question text - centered with padding */}
            <div className="card p-6 sm:p-8">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center leading-tight">
                {currentQuestion.question}
              </h2>
            </div>
          </div>

          {/* Answer buttons - optimized for mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                style={{
                  backgroundColor: {
                    A: '#0066FF',
                    B: '#00D4AA',
                    C: '#FFA502',
                    D: '#7B61FF'
                  }[key]
                }}
              >
                <div className="text-center w-full text-2xl sm:text-xl font-medium leading-tight px-4">
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
              ✓ Answer submitted!
            </motion.p>
          )}

          <div className="text-center mt-6 text-2xl font-bold">
            {timeSeconds}s
          </div>
        </motion.div>
      </div>
    );
  }

  // Results Phase
  if (phase === 'results' && results) {
    const myResult = results.results.find((r: any) => r.playerId === playerId);
    
    // Calculate current placement in quiz
    const myRank = results.leaderboard?.findIndex((p: any) => p.id === playerId) + 1 || 0;
    const totalPlayers = results.leaderboard?.length || 0;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card max-w-2xl w-full"
        >
          <h2 className="text-3xl font-bold text-center mb-6">
            {myResult?.isCorrect ? (
              <span className="text-game-correct">Correct!</span>
            ) : (
              <span className="text-game-incorrect">Wrong!</span>
            )}
          </h2>

          {myResult && (
            <div className="text-center mb-6">
              {/* Points earned this question */}
              <div className="mb-4">
                <p className="text-lg text-ui-textMuted mb-1">Points This Question</p>
                <p className="text-4xl font-bold text-game-leader">
                  +{myResult.points}
                </p>
              </div>

              {/* Total score for current game */}
              <div className="mb-4 p-4 bg-ui-background rounded-lg">
                <p className="text-sm text-ui-textMuted mb-1">Current Quiz Score</p>
                <p className="text-3xl font-bold text-primary-blue">
                  {myResult.newScore} pts
                </p>
              </div>

              {/* Current placement */}
              {myRank > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-ui-textMuted mb-2">Current Placement</p>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                    className={`inline-block px-6 py-3 rounded-full ${
                      myRank === 1 ? 'bg-game-leader' :
                      myRank === 2 ? 'bg-primary-blue' :
                      myRank === 3 ? 'bg-primary-teal' :
                      'bg-primary-purple'
                    }`}
                  >
                    <span className="text-3xl font-bold text-white">
                      {myRank}{getOrdinalSuffix(myRank)} of {totalPlayers}
                    </span>
                  </motion.div>
                </div>
              )}

              {myResult.isLeader && (
                <p className="text-game-leader mt-2 text-sm font-bold">Leader Bonus (2x) Applied!</p>
              )}
            </div>
          )}

          <div className="border-t border-ui-border pt-4">
            <h3 className="font-bold mb-2 text-lg">Correct Answer: {results.correctAnswer}</h3>
            <p className="text-ui-textMuted text-sm">
              {results.results.filter((r: any) => r.isCorrect).length} / {results.results.length} players got it right
            </p>
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

