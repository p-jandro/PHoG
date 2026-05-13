import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
import { Card, Chip } from '../ui';

const GAME_LABELS = {
  quiz: 'Quiz',
  trueFalse: 'True/False',
  countdown: 'Countdown',
  pointless: 'Pointless',
  pokedle: 'Pokédle',
  hpdle: 'HP-dle',
  numbers: 'Numbers',
  wordle: 'Wordle',
  travel: 'Travel',
} as const;

export const RoundLeaderboardOverlay = () => {
  const { roundLeaderboard, playerId } = useGameStore();
  const reduced = useReducedMotion();

  if (!roundLeaderboard) return null;

  const { game, leaderboard, roundNumber, totalRounds, unitLabel } = roundLeaderboard;
  const gameLabel = GAME_LABELS[game];
  const currentPlayerRow = leaderboard.find((entry) => entry.id === playerId) || null;

  if (!currentPlayerRow) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        className="fixed inset-0 z-[80] overflow-y-auto bg-ink/70 px-3 py-4 backdrop-blur-md sm:px-4 sm:py-8"
        role="dialog"
        aria-modal="true"
        aria-label={`${gameLabel} round standing`}
      >
        <div className="flex min-h-full items-start justify-center sm:items-center">
          <motion.div
            initial={reduced ? { opacity: 0 } : { y: 36, opacity: 0, scale: 0.96 }}
            animate={reduced ? { opacity: 1 } : { y: 0, opacity: 1, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { y: -24, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
            className="w-full max-w-xl"
          >
            <Card
              eyebrow="Round Standing"
              title={gameLabel}
              className="text-center"
            >
              {roundNumber && totalRounds && (
                <div className="mb-6 flex justify-center">
                  <Chip variant="info">
                    {unitLabel || 'Round'} {roundNumber} of {totalRounds}
                  </Chip>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border-2 border-ink bg-now p-5 text-on-now shadow-ink">
                  <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em]">Place</p>
                  <p className="font-display text-5xl font-black leading-none tracking-tighter sm:text-6xl">
                    #{currentPlayerRow.rank}
                  </p>
                </div>
                <div className="rounded-2xl border-2 border-ink bg-bg-surface p-5 text-ink shadow-ink">
                  <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">Score</p>
                  <p className="font-display text-5xl font-black leading-none tracking-tighter sm:text-6xl">
                    {currentPlayerRow.score}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
