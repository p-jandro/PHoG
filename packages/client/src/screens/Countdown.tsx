import { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import { useAudio } from '../hooks/useAudio';
import { Card, Chip, Countdown as CountdownTimer, LeaderboardRow } from '../ui';
import { screenEnter, reducedFade } from '../lib/motion';

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
  const reduced = useReducedMotion();
  const enterVariants = reduced ? reducedFade : screenEnter;

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
    return (
      <div className="min-h-screen px-4 py-6 sm:px-6 sm:py-8 flex flex-col items-center justify-center">
        <motion.div
          variants={enterVariants}
          initial="hidden"
          animate="visible"
          className="mx-auto w-full max-w-4xl space-y-6 text-center"
        >
          <Card
            eyebrow="Countdown Briefing"
            title={introData.title}
            className="text-left"
          >
            <p className="text-lg text-ink-muted">{introData.description}</p>
          </Card>

          <Card title="Scoring Rules" className="text-left">
            <ul className="space-y-2 text-lg">
              {introData.scoringRules?.map((rule: string, index: number) => (
                <motion.li
                  key={index}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, x: -20 }}
                  animate={reduced ? { opacity: 1 } : { opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + index * 0.08, duration: 0.22 }}
                  className="flex items-start gap-2 text-ink"
                >
                  <span aria-hidden="true" className="text-streak">•</span>
                  <span>{rule}</span>
                </motion.li>
              ))}
            </ul>
          </Card>

          <div className="flex flex-col items-center gap-3">
            {introData.placementInfo && (
              <Chip variant="info">{introData.placementInfo}</Chip>
            )}
            {introData.shuffleInfo && (
              <p className="text-sm text-ink-muted">{introData.shuffleInfo}</p>
            )}
            <Chip variant="now">
              Starting in {Math.ceil(timeRemaining / 1000)}s
            </Chip>
          </div>
        </motion.div>
      </div>
    );
  }

  // Playing Phase
  if (phase === 'playing' && currentRound) {
    const timeSeconds = Math.max(0, Math.ceil(timeRemaining / 1000));
    const totalSeconds = Math.max(1, Math.ceil(currentRound.duration / 1000));

    return (
      <div className="min-h-screen px-4 py-6 sm:px-6 sm:py-8 flex flex-col items-center justify-center">
        <motion.div
          variants={enterVariants}
          initial="hidden"
          animate="visible"
          className="mx-auto w-full max-w-5xl space-y-6"
        >
          <div className="flex items-center justify-between gap-4">
            <Chip variant="info">
              Round {currentRound.roundNumber} of {currentRound.totalRounds}
            </Chip>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => (audio.isPlaying ? audio.pause() : audio.play())}
                aria-label={audio.isPlaying ? 'Mute music' : 'Play music'}
                className="rounded-lg border-2 border-ink bg-bg-surface px-3 py-1.5 text-sm font-extrabold text-ink shadow-ink-sm"
              >
                {audio.isPlaying ? 'Sound On' : 'Sound Off'}
              </button>
              <CountdownTimer
                seconds={timeSeconds}
                total={totalSeconds}
                size={96}
              />
            </div>
          </div>

          <Card title="Available Letters">
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={handleShuffle}
                className="rounded-lg border-2 border-ink bg-info px-4 py-2 text-sm font-extrabold text-on-info shadow-ink-sm active:translate-x-[2px] active:translate-y-[2px]"
              >
                Shuffle
              </button>
            </div>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
              {shuffledLetters.map((letter, index) => (
                <motion.div
                  key={`${letter}-${index}`}
                  initial={reduced ? { opacity: 0 } : { scale: 0, rotate: -180 }}
                  animate={reduced ? { opacity: 1 } : { scale: 1, rotate: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.22 }}
                  className={[
                    'flex h-14 w-14 items-center justify-center rounded-lg border-2 border-ink text-2xl font-extrabold uppercase shadow-ink-sm sm:h-16 sm:w-16 sm:text-3xl',
                    isLetterUsed(letter, index)
                      ? 'bg-premium text-on-premium'
                      : 'bg-bg-surface text-ink',
                  ].join(' ')}
                >
                  {letter}
                </motion.div>
              ))}
            </div>
          </Card>

          <Card title="Your Word">
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                value={word}
                onChange={handleWordChange}
                placeholder="Enter your word..."
                className="w-full rounded-lg border-2 border-ink bg-bg-sunken px-4 py-3 text-center text-xl font-extrabold uppercase text-ink shadow-ink-sm placeholder:text-ink-muted focus:outline-none focus:ring-4 focus:ring-info/40 disabled:opacity-60 sm:text-2xl"
                maxLength={15}
                disabled={submitted}
                autoFocus
              />
              <button
                type="submit"
                disabled={!word || submitted}
                className="w-full rounded-lg border-2 border-ink bg-action px-4 py-3 text-lg font-extrabold text-on-action shadow-ink active:translate-x-[3px] active:translate-y-[3px] active:shadow-ink-sm disabled:opacity-50"
              >
                {submitted ? 'Submitted' : 'Submit Word'}
              </button>
              {word && (
                <p className="text-center text-sm text-ink-muted">
                  {word.length} letter{word.length !== 1 ? 's' : ''}
                </p>
              )}
            </form>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Round End Phase
  if (phase === 'roundEnd' && roundResults) {
    const mySubmission = roundResults.submissions.find((s: any) => s.playerId === playerId);
    const sorted = [...roundResults.submissions].sort((a: any, b: any) => {
      if (a.valid && !b.valid) return -1;
      if (b.valid && !a.valid) return 1;
      return (b.length || 0) - (a.length || 0);
    });

    return (
      <div className="min-h-screen px-4 py-6 sm:px-6 sm:py-8 flex flex-col items-center justify-center">
        <motion.div
          variants={enterVariants}
          initial="hidden"
          animate="visible"
          className="mx-auto w-full max-w-4xl space-y-5"
        >
          <Card eyebrow="Round Complete" title={mySubmission?.word || '(No word)'}>
            {mySubmission && (
              <div className="space-y-2 text-lg">
                <p className="text-ink">
                  {mySubmission.valid
                    ? `${mySubmission.isLongest ? 'Longest Word — ' : ''}${mySubmission.length} letters`
                    : 'Invalid word'}
                </p>
                {mySubmission.valid && (
                  <>
                    <p>
                      You earned{' '}
                      <span className="font-extrabold text-action">
                        {mySubmission.points}
                      </span>{' '}
                      points
                    </p>
                    <p className="text-ink-muted">
                      Current game score: {mySubmission.newScore ?? 0}
                    </p>
                  </>
                )}
              </div>
            )}
          </Card>

          <Card title="All Submissions">
            <div className="space-y-2">
              {sorted.map((submission: any, index: number) => (
                <LeaderboardRow
                  key={submission.playerId}
                  rank={index + 1}
                  name={`${submission.playerName}: ${submission.word || '(No word)'}`}
                  score={submission.valid ? submission.length : 0}
                  delta={submission.valid ? submission.points : undefined}
                  isYou={submission.playerId === playerId}
                />
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Game End Phase
  if (phase === 'gameEnd' && gameResults) {
    return (
      <div className="min-h-screen px-4 py-6 sm:px-6 sm:py-8 flex flex-col items-center justify-center">
        <motion.div
          variants={enterVariants}
          initial="hidden"
          animate="visible"
          className="mx-auto w-full max-w-3xl"
        >
          <Card eyebrow="Countdown Complete" title="Well done to all players!">
            <p className="text-lg text-ink-muted">
              Final placements on the next screen.
            </p>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card>
        <h2 className="text-2xl font-bold text-center">Loading...</h2>
      </Card>
    </div>
  );
};
