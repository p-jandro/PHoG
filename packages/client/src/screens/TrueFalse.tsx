import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';

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
  const [currentPlacement, setCurrentPlacement] = useState(0);

  const { playerId } = useGameStore();

  useEffect(() => {
    if (!socket) return;

    // Intro event
    socket.on('truefalse:intro', (data) => {
      console.log('[TrueFalse] Game intro', data);
      setPhase('intro');
      setIntroData(data);
      setTimeRemaining(data.duration);
      setCurrentScore(0);
      setCurrentStreak(0);
      setCurrentPlacement(0);
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
      // Just confirmation — streak/score revealed after round ends
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
          setCurrentScore(myResult.score);
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

  // Helper for ordinal suffix
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
            <h2 className="text-2xl font-bold text-game-accent mb-4">Streak Scoring</h2>
            <div className="space-y-2 text-lg">
              {introData.scoringRules?.map((rule: string, index: number) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="flex items-start"
                >
                  <span className="text-game-accent mr-2">•</span>
                  <span className="text-ui-textMuted">{rule}</span>
                </motion.div>
              ))}
            </div>
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

  // Playing Phase
  if (phase === 'playing' && currentStatement) {
    const timePercent = (timeRemaining / currentStatement.duration) * 100;
    const showingAnswer = correctAnswer !== null;

    return (
      <div className="min-h-screen flex flex-col p-4">
        {/* Persistent Stats Bar */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed top-0 left-0 right-0 z-10 bg-gray-900 border-b border-gray-800 px-4 py-3"
        >
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-1">
              <div className="text-ui-textMuted text-xs sm:text-sm">
                True/False • Round {currentStatement.statementNumber}/{currentStatement.totalStatements}
              </div>
              {currentPlacement > 0 && (
                <div className="text-ui-textMuted text-xs sm:text-sm">
                  <span className="font-bold text-white">{currentPlacement}{getOrdinalSuffix(currentPlacement)}</span> Place
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="text-game-accent font-bold text-xl sm:text-2xl">
                {currentScore} pts
              </div>
              {currentStreak > 0 && (
                <motion.div
                  key={currentStreak}
                  initial={{ scale: 1.5 }}
                  animate={{ scale: 1 }}
                  className="text-game-warning font-bold"
                >
                  {currentStreak}x Streak
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Main content with top padding for stats bar */}
        <div className="flex-1 flex items-center justify-center mt-16">
          <motion.div
            key={currentStatement.statementId}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            className="max-w-4xl w-full"
          >
            {/* Progress */}
            <div className="flex justify-between items-center mb-6">
              <span className="text-ui-textMuted">
                Statement {currentStatement.statementNumber} / {currentStatement.totalStatements}
              </span>
              {!showingAnswer && (
                <div className="text-2xl font-bold text-primary-teal">
                  {Math.ceil(timeRemaining / 1000)}s
                </div>
              )}
            </div>

            {/* Timer bar */}
            {!showingAnswer && (
              <div className="w-full h-2 bg-ui-border rounded-full overflow-hidden mb-8">
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
            )}

            {/* Statement */}
            <motion.div
              className="card mb-8"
              animate={showingAnswer ? {
                backgroundColor: correctAnswer === selectedAnswer ? '#00D4AA20' : '#FF475720'
              } : {}}
            >
              <h2 className="text-3xl font-bold text-center">
                {currentStatement.statement}
              </h2>

              {/* Show answer */}
              {showingAnswer && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 text-center"
                >
                  <p className={`text-2xl font-bold ${
                    correctAnswer === selectedAnswer ? 'text-game-correct' : 'text-game-incorrect'
                  }`}>
                    {correctAnswer === selectedAnswer ? '✓ Correct!' : '✗ Wrong!'}
                  </p>
                  <p className="text-ui-textMuted mt-2">
                    Answer: {correctAnswer ? 'TRUE' : 'FALSE'}
                  </p>

                  {/* Fun Fact Explanation */}
                  {explanation && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="mt-6 p-4 bg-ui-background rounded-lg text-left"
                    >
                      <h3 className="text-lg font-bold text-primary-teal mb-2">Did you know?</h3>
                      <p className="text-ui-textMuted">{explanation}</p>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </motion.div>

            {/* Answer buttons - optimized for mobile */}
            {!showingAnswer && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <motion.button
                  onClick={() => handleAnswer(false)}
                  disabled={selectedAnswer !== null}
                  whileTap={{ scale: selectedAnswer !== null ? 1 : 0.95 }}
                  className={`btn-answer min-h-[100px] text-3xl sm:text-2xl font-bold ${
                    selectedAnswer === false ? 'ring-4 ring-white' : ''
                  } ${selectedAnswer !== null && selectedAnswer !== false ? 'opacity-50' : ''} 
                  active:scale-95 transition-all touch-manipulation`}
                  style={{ backgroundColor: '#FF4757' }}
                >
                  FALSE
                </motion.button>

                <motion.button
                  onClick={() => handleAnswer(true)}
                  disabled={selectedAnswer !== null}
                  whileTap={{ scale: selectedAnswer !== null ? 1 : 0.95 }}
                  className={`btn-answer min-h-[100px] text-3xl sm:text-2xl font-bold ${
                    selectedAnswer === true ? 'ring-4 ring-white' : ''
                  } ${selectedAnswer !== null && selectedAnswer !== true ? 'opacity-50' : ''} 
                  active:scale-95 transition-all touch-manipulation`}
                  style={{ backgroundColor: '#00D4AA' }}
                >
                  TRUE
                </motion.button>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  // Results Phase
  if (phase === 'results' && results) {
    const myResult = results.results.find((r: any) => r.playerId === playerId);

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card max-w-2xl w-full"
        >
          <h2 className="text-4xl font-bold text-center mb-6">
            Game Over!
          </h2>

          {myResult && (
            <div className="text-center mb-8">
              <p className="text-6xl font-bold mb-2" style={{ color: '#00D4AA' }}>
                {myResult.accuracy}%
              </p>
              <p className="text-2xl text-ui-textMuted mb-4">
                {myResult.correct} / {myResult.total} correct
              </p>
              <p className="text-xl">
                You earned <span className="text-game-leader font-bold">{myResult.points}</span> points!
              </p>
              <p className="text-ui-textMuted mt-2">
                Total score: {myResult.newScore}
              </p>
            </div>
          )}

          <div className="border-t border-ui-border pt-6">
            <h3 className="font-bold mb-4 text-center">Top Performers</h3>
            <div className="space-y-2">
              {results.results.slice(0, 5).map((result: any, index: number) => (
                <motion.div
                  key={result.playerId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-3 rounded-lg ${
                    result.playerId === playerId ? 'bg-primary-blue bg-opacity-20 border-2 border-primary-blue' : 'bg-ui-background'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">
                      {index + 1}. {result.playerName}
                    </span>
                    <span className="text-game-correct font-bold">
                      {result.accuracy}%
                    </span>
                  </div>
                </motion.div>
              ))}
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
        <h2 className="text-2xl font-bold text-center">Loading...</h2>
      </div>
    </div>
  );
};

