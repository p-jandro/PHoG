import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import { GamePromptHeader } from '../components/GamePromptHeader';

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
      <div className="screen-shell flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="screen-frame max-w-4xl text-center space-y-6"
        >
          <p className="eyebrow">True or False</p>
          <motion.h1
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            className="text-5xl sm:text-6xl font-bold text-game-correct mb-4"
          >
            {introData.title}
          </motion.h1>

          <p className="text-xl text-ui-textMuted sm:text-2xl">Starting shortly</p>

          {/* Progress bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
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
          key={currentStatement.statementId}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          className="screen-frame max-w-5xl"
        >
          <GamePromptHeader
            eyebrow="True or False"
            meta={`Statement ${currentStatement.statementNumber} of ${currentStatement.totalStatements}`}
            title={currentStatement.statement}
            details={(
              <>
                <span className="status-pill">
                  <span className="text-xl font-bold text-game-correct">{currentScore}</span>
                  <span className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-ui-textMuted">pts</span>
                </span>
                {currentPlacement ? (
                  <span className="status-pill">
                    {currentPlacement}
                    {getOrdinalSuffix(currentPlacement)} in T/F
                  </span>
                ) : null}
                {currentStreak > 0 ? (
                  <span className="status-pill text-game-warning">
                    {currentStreak}x streak
                  </span>
                ) : null}
              </>
            )}
            timerMs={!showingAnswer ? timeRemaining : undefined}
            totalMs={!showingAnswer ? currentStatement.duration : undefined}
            timerBarClassName={timerToneClass}
            timerTextClassName={timerTextClass}
          />

          <div className="mx-auto max-w-4xl">
            {showingAnswer && (
              <motion.div
                className="card mb-8"
                animate={{
                  backgroundColor: correctAnswer === selectedAnswer ? '#00D4AA20' : '#FF475720'
                }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center"
                >
                  <p className={`text-2xl font-bold ${
                    correctAnswer === selectedAnswer ? 'text-game-correct' : 'text-game-incorrect'
                  }`}>
                    {correctAnswer === selectedAnswer ? 'Correct' : 'Wrong'}
                  </p>
                  <p className="mt-2 text-ui-textMuted">
                    Answer: {correctAnswer ? 'TRUE' : 'FALSE'}
                  </p>

                  {explanation && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                      className="mt-6 rounded-[1.5rem] bg-ui-background p-5 text-left"
                    >
                      <h3 className="text-lg font-bold text-primary-teal mb-2">Did you know?</h3>
                      <p className="text-ui-textMuted">{explanation}</p>
                    </motion.div>
                  )}
                </motion.div>
              </motion.div>
            )}

            {!showingAnswer && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                <motion.button
                  onClick={() => handleAnswer(false)}
                  disabled={selectedAnswer !== null}
                  whileTap={{ scale: selectedAnswer !== null ? 1 : 0.95 }}
                  className={`btn-answer min-h-[100px] text-3xl font-bold sm:text-2xl ${
                    selectedAnswer === false ? 'ring-4 ring-white' : ''
                  } ${selectedAnswer !== null && selectedAnswer !== false ? 'opacity-50' : ''} 
                  active:scale-95 transition-all touch-manipulation`}
                  style={{ backgroundColor: '#bf5c43' }}
                >
                  FALSE
                </motion.button>

                <motion.button
                  onClick={() => handleAnswer(true)}
                  disabled={selectedAnswer !== null}
                  whileTap={{ scale: selectedAnswer !== null ? 1 : 0.95 }}
                  className={`btn-answer min-h-[100px] text-3xl font-bold sm:text-2xl ${
                    selectedAnswer === true ? 'ring-4 ring-white' : ''
                  } ${selectedAnswer !== null && selectedAnswer !== true ? 'opacity-50' : ''} 
                  active:scale-95 transition-all touch-manipulation`}
                  style={{ backgroundColor: '#6f9a79' }}
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
      <div className="screen-shell flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card w-full max-w-3xl p-6 sm:p-8"
        >
          <h2 className="mb-6 text-center text-3xl font-bold sm:text-4xl">
            Game Over!
          </h2>

          {myResult && (
            <div className="text-center mb-8">
              <p className="mb-2 text-5xl font-bold sm:text-6xl" style={{ color: '#00D4AA' }}>
                {myResult.accuracy}%
              </p>
              <p className="mb-4 text-xl text-ui-textMuted sm:text-2xl">
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
