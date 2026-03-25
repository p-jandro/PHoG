import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import { useAudio } from '../hooks/useAudio';

interface CountdownProps {
  socket: Socket | null;
}

interface Round {
  roundNumber: number;
  totalRounds: number;
  letters: string[];
  duration: number;
}

export const Countdown = ({ socket }: CountdownProps) => {
  const [phase, setPhase] = useState<'intro' | 'playing' | 'roundEnd' | 'gameEnd'>('intro');
  const [introData, setIntroData] = useState<any>(null);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [shuffledLetters, setShuffledLetters] = useState<string[]>([]);
  const [word, setWord] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);
  const [roundResults, setRoundResults] = useState<any>(null);
  const [gameResults, setGameResults] = useState<any>(null);

  const { playerId } = useGameStore();

  // Audio player for countdown theme
  // To use: Place audio file at packages/client/public/audio/countdown-theme.mp3
  const audio = useAudio('/audio/countdown-theme.mp3', {
    volume: 0.4,
    loop: true,
    autoPlay: false
  });

  useEffect(() => {
    if (!socket) return;

    // Intro event
    socket.on('countdown:intro', (data) => {
      console.log('[Countdown] Game intro', data);
      setPhase('intro');
      setIntroData(data);
      setTimeRemaining(data.duration || 0);
    });

    // Round events
    socket.on('countdown:round:start', (data) => {
      console.log('[Countdown] Round started', data);
      setPhase('playing');
      setCurrentRound(data);
      setShuffledLetters(data.letters); // Initialize shuffled letters
      setWord('');
      setSubmitted(false);
      setTimeRemaining(data.duration);

      // Play countdown music
      audio.play();

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

    socket.on('countdown:submit:received', (data) => {
      console.log('[Countdown] Word received', data);
      setSubmitted(true);
    });

    socket.on('countdown:round:end', (data) => {
      console.log('[Countdown] Round ended', data);
      setPhase('roundEnd');
      setRoundResults(data);

      // Fade out music
      audio.fadeOut(2000);

      // Clear timer
      if (timer) {
        clearInterval(timer);
        setTimer(null);
      }
    });

    socket.on('countdown:end', (data) => {
      console.log('[Countdown] Game ended', data);
      setPhase('gameEnd');
      setGameResults(data);
      
      // Stop music
      audio.stop();
    });

    return () => {
      socket.off('countdown:intro');
      socket.off('countdown:round:start');
      socket.off('countdown:submit:received');
      socket.off('countdown:round:end');
      socket.off('countdown:end');

      if (timer) {
        clearInterval(timer);
      }
    };
  }, [socket, timer]);

  const handleWordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (submitted) return;
    const value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
    setWord(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || submitted || !word || !currentRound) return;
    
    socket.emit('countdown:submit', { word });
    setSubmitted(true);

    // Stop timer
    if (timer) {
      clearInterval(timer);
      setTimer(null);
    }
  };

  const isLetterUsed = (letter: string, index: number) => {
    if (!word || !shuffledLetters) return false;
    
    // Count total occurrences of this letter in the word
    const letterUsageInWord = word.split('').filter(l => l === letter).length;
    
    // If the word doesn't use this letter at all, it's not used
    if (letterUsageInWord === 0) return false;

    // Find all indices of this letter in the shuffled array
    const letterIndices = shuffledLetters
      .map((l, i) => l === letter ? i : -1)
      .filter(i => i !== -1);
    
    // This specific instance's position among duplicates
    const instanceRank = letterIndices.indexOf(index);
    
    // If this instance is one of the first N occurrences (where N is usage count), mark it used
    return instanceRank < letterUsageInWord;
  };

  const handleShuffle = () => {
    const shuffled = [...shuffledLetters];
    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setShuffledLetters(shuffled);
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
            className="text-5xl sm:text-6xl font-bold text-white mb-4"
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
              {introData.scoringRules?.map((rule: string, index: number) => (
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

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="space-y-2"
          >
            <p className="text-xl text-game-warning">
              {introData.placementInfo}
            </p>
            <p className="text-lg text-ui-textMuted">
              {introData.shuffleInfo}
            </p>
          </motion.div>

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
  if (phase === 'playing' && currentRound) {
    const timePercent = (timeRemaining / currentRound.duration) * 100;
    const timeSeconds = Math.ceil(timeRemaining / 1000);

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl w-full"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <span className="text-ui-textMuted">
              Round {currentRound.roundNumber} / {currentRound.totalRounds}
            </span>
            <div className="flex items-center gap-4">
              {/* Volume control */}
              <button
                onClick={() => audio.isPlaying ? audio.pause() : audio.play()}
                className="text-sm font-medium px-3 py-1 rounded-lg bg-ui-card border border-ui-border opacity-75 hover:opacity-100 transition-opacity"
                aria-label={audio.isPlaying ? "Mute music" : "Play music"}
              >
                {audio.isPlaying ? 'Sound On' : 'Sound Off'}
              </button>
              <div className="text-3xl font-bold text-primary-purple">
                {timeSeconds}s
              </div>
            </div>
          </div>

          {/* Timer bar */}
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

          {/* Letters - optimized for mobile */}
          <div className="card mb-6 sm:mb-8">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold">Available Letters</h2>
              <button
                onClick={handleShuffle}
                className="btn-secondary bg-primary-teal hover:bg-primary-teal/80 px-4 py-2 rounded-lg font-bold transition-all active:scale-95 touch-manipulation"
              >
                Shuffle
              </button>
            </div>
            <div className="flex justify-center gap-2 sm:gap-3 flex-wrap">
              {shuffledLetters.map((letter, index) => (
                <motion.div
                  key={`${letter}-${index}`}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center text-2xl sm:text-3xl font-bold rounded-lg ${
                    isLetterUsed(letter, index)
                      ? 'bg-primary-purple text-white'
                      : 'bg-ui-border text-ui-text'
                  } transition-all`}
                >
                  {letter}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Word input - optimized for mobile */}
          <form onSubmit={handleSubmit} className="card">
            <h3 className="text-lg sm:text-xl font-bold mb-4">Your Word</h3>
            <div className="space-y-4">
              <input
                type="text"
                value={word}
                onChange={handleWordChange}
                placeholder="Enter your word..."
                className="input-field text-xl sm:text-2xl text-center font-bold min-h-[60px] touch-manipulation"
                maxLength={15}
                disabled={submitted}
                autoFocus
              />
              <button
                type="submit"
                disabled={!word || submitted}
                className="btn-primary w-full bg-primary-purple hover:bg-primary-purple/85 min-h-[64px] text-lg sm:text-base touch-manipulation active:scale-95 transition-transform"
              >
                {submitted ? '✓ Submitted!' : 'Submit Word'}
              </button>
            </div>

            {word && (
              <p className="text-center mt-4 text-ui-textMuted text-base sm:text-sm">
                {word.length} letter{word.length !== 1 ? 's' : ''}
              </p>
            )}
          </form>
        </motion.div>
      </div>
    );
  }

  // Round End Phase
  if (phase === 'roundEnd' && roundResults) {
    const mySubmission = roundResults.submissions.find((s: any) => s.playerId === playerId);

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card max-w-3xl w-full"
        >
          <h2 className="text-3xl font-bold text-center mb-6">Round Complete!</h2>

          {mySubmission && (
            <div className="text-center mb-8">
              <p className="text-5xl font-bold mb-2" style={{
                color: mySubmission.valid ? '#00D4AA' : '#FF4757'
              }}>
                {mySubmission.word || '(No word)'}
              </p>
              <p className="text-2xl text-ui-textMuted mb-4">
                {mySubmission.valid ? (
                  <>
                    {mySubmission.isLongest ? 'Longest Word!' : 'Valid!'}
                    <br />
                    {mySubmission.length} letters
                  </>
                ) : (
                  'Invalid word'
                )}
              </p>
              {mySubmission.valid && (
                <div className="space-y-2">
                    <p className="text-xl">
                      You earned <span className="text-game-leader font-bold">{mySubmission.points}</span> points!
                    </p>
                    <p className="text-lg text-ui-textMuted">
                        Current Game Score: {mySubmission.newScore || 0}
                    </p>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-ui-border pt-6">
            <h3 className="font-bold mb-4 text-center">All Submissions</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {roundResults.submissions.map((submission: any, index: number) => (
                <motion.div
                  key={submission.playerId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-3 rounded-lg ${
                    submission.playerId === playerId
                      ? 'bg-primary-purple bg-opacity-20 border-2 border-primary-purple'
                      : 'bg-ui-background'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">
                      {submission.playerName}: {submission.word || '(No word)'}
                    </span>
                    <span className={`font-bold ${
                      submission.valid ? 'text-game-correct' : 'text-game-incorrect'
                    }`}>
                      {submission.valid ? `${submission.length} (${submission.points} pts)` : 'Invalid'}
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

  // Game End Phase
  if (phase === 'gameEnd' && gameResults) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card max-w-2xl w-full text-center"
        >
          <h2 className="text-4xl font-bold mb-8">Countdown Complete!</h2>
          <p className="text-ui-textMuted text-lg">
            Well done to all players!
          </p>
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

