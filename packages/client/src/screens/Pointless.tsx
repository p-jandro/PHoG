import { useEffect, useState, memo } from 'react';
import { Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { ColumnReveal } from './Pointless/ColumnReveal';
import { useGameStore } from '../stores/gameStore';

interface PointlessProps {
  socket: Socket;
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

// Helper for ordinal suffix
const getOrdinalSuffix = (num: number) => {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
};

// Persistent Score Bar (memoized to prevent blinking)
const PointlessScoreBar = memo(({
  score,
  round,
  totalRounds,
  placement
}: {
  score: number;
  round: number;
  totalRounds: number;
  placement: number | null;
}) => (
  <motion.div
    initial={{ y: -100 }}
    animate={{ y: 0 }}
    className="fixed top-0 left-0 right-0 z-10 bg-ui-card border-b border-ui-border p-4"
  >
    <div className="max-w-7xl mx-auto flex items-center justify-between">
      <div className="text-ui-textMuted text-sm sm:text-base">
        Pointless • Round {round}/{totalRounds}
      </div>
      <div className="flex items-center gap-4">
        <div className="text-game-accent font-bold text-xl sm:text-2xl">
          {score} pts
        </div>
        {placement !== null && placement > 0 && (
          <div className="text-ui-textMuted text-sm sm:text-base">
            <span className="font-bold text-white">{placement}{getOrdinalSuffix(placement)}</span> Place
          </div>
        )}
      </div>
    </div>
  </motion.div>
));

export const Pointless = ({ socket }: PointlessProps) => {
  const { playerId } = useGameStore();
  const [phase, setPhase] = useState<'waiting' | 'playing' | 'submitted' | 'reveal'>('waiting');
  const [roundData, setRoundData] = useState<RoundData | null>(null);
  const [revealData, setRevealData] = useState<RevealData | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [myCurrentScore, setMyCurrentScore] = useState(0);
  const [myCurrentPlacement, setMyCurrentPlacement] = useState<number | null>(null);

  // Subscribe to players from store
  const players = useGameStore((state) => state.players);

  // Track current placement - recalculate whenever players update
  useEffect(() => {
    if (!playerId || players.length === 0) {
      setMyCurrentPlacement(null);
      return;
    }

    // During Pointless, lower score is better (ascending sort)
    const sortedPlayers = [...players]
      .filter(p => p.connected)
      .sort((a, b) => a.score - b.score);

    const placement = sortedPlayers.findIndex(p => p.id === playerId) + 1;
    setMyCurrentPlacement(placement > 0 ? placement : null);
  }, [playerId, players]);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (phase === 'playing' && timeRemaining > 0) {
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
  }, [phase, roundData]); // Re-run when phase or round changes

  useEffect(() => {
    socket.on('pointless:round:start', (data: RoundData) => {
      console.log('[Pointless] Round start:', data);
      setRoundData(data);
      setPhase('playing');
      setInput('');
      setError('');
      setRevealData(null);
      setTimeRemaining(data.duration || 15000);  // Match server's 15s default

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
      // Accumulate score instead of setting it
      setMyCurrentScore(prev => prev + data.score);
      setPhase('reveal');
    });

    // Handle late joiners or state sync
    socket.emit('request:state'); // Ensure server sends current state if needed

    return () => {
      socket.off('pointless:round:start');
      socket.off('pointless:answer:received');
      socket.off('game:pointless:reveal');
    };
  }, [socket]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) {
      setError('Please enter an answer');
      return;
    }

    socket.emit('pointless:submit', { text: input });
  };

  if (!roundData && phase === 'waiting') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <h1 className="text-2xl font-bold text-center animate-pulse">
          Waiting for Pointless to start...
        </h1>
      </div>
    );
  }

  return (
    <>
      <PointlessScoreBar
        score={myCurrentScore}
        round={(roundData?.roundIndex || 0) + 1}
        totalRounds={roundData?.totalRounds || 5}
        placement={myCurrentPlacement}
      />
      <div className="min-h-screen bg-gray-900 text-white p-4 pt-24 flex flex-col items-center">
      {/* Header */}
      <div className="w-full max-w-md mb-6">
        <div className="flex justify-between items-center text-sm text-gray-400 mb-2">
          <span>Round {roundData ? roundData.roundIndex + 1 : '-'}/{roundData ? roundData.totalRounds : '-'}</span>
          <span>POINTLESS</span>
        </div>
        <h2 className="text-xl font-bold text-primary-teal mb-1">
          {roundData?.category || 'Category'}
        </h2>
        <p className="text-lg text-white">
          {roundData?.question || 'Question loading...'}
        </p>

        {/* Timer Bar */}
        {phase === 'playing' && roundData && (
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden mt-4">
            <motion.div
              className="h-full bg-primary-teal"
              initial={{ width: '100%' }}
              animate={{ width: `${(timeRemaining / (roundData.duration || 15000)) * 100}%` }}
              transition={{ duration: 0.1, ease: "linear" }}
            />
          </div>
        )}
        {phase === 'playing' && (
          <div className="text-right mt-1 font-mono text-primary-teal">
            {Math.ceil(timeRemaining / 1000)}s
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-md flex-1 flex flex-col justify-center">
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
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your obscure answer..."
                    className="w-full px-4 py-4 bg-gray-800 border-2 border-gray-700 rounded-xl text-lg focus:border-primary-teal focus:outline-none transition-colors"
                    autoFocus
                    autoComplete="off"
                  />
                  {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                </div>
                <button
                  type="submit"
                  className="w-full py-4 bg-primary-teal hover:bg-primary-teal/85 rounded-xl font-bold text-xl shadow-lg active:scale-95 transition-transform"
                >
                  Submit Answer
                </button>
              </form>
              <p className="text-center text-gray-500 mt-4 text-sm">
                Try to find an answer with the lowest score!
              </p>
            </motion.div>
          )}

          {/* Submitted Phase */}
          {phase === 'submitted' && (
            <motion.div
              key="submitted"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="text-center py-12"
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
              className="w-full"
            >
              <div className="mb-6 text-center">
                <p className="text-gray-400 text-sm uppercase tracking-wider mb-1">You Answered</p>
                <h3 className="text-2xl font-bold text-white">
                  {revealData.correctAnswer || revealData.originalInput}
                  {revealData.originalInput.toLowerCase() !== revealData.correctAnswer?.toLowerCase() && revealData.isCorrect && (
                    <span className="block text-xs text-gray-400 font-normal">(Autocorrected from "{revealData.originalInput}")</span>
                  )}
                </h3>
              </div>

              <ColumnReveal
                score={revealData.score}
                triggerTime={revealData.triggerTime}
                isCorrect={revealData.isCorrect}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
    </>
  );
};


