import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';

const GAME_LABELS = {
  quiz: 'Quiz',
  trueFalse: 'True/False',
  countdown: 'Countdown',
  pointless: 'Pointless',
  pokedle: 'Pokédle',
  hpdle: 'HP-dle',
  numbers: 'Numbers'
} as const;

export const RoundLeaderboardOverlay = () => {
  const { roundLeaderboard, playerId } = useGameStore();

  if (!roundLeaderboard) {
    return null;
  }

  const { game, leaderboard, roundNumber, totalRounds, unitLabel } = roundLeaderboard;
  const gameLabel = GAME_LABELS[game];
  const currentPlayerRow = leaderboard.find((entry) => entry.id === playerId) || null;

  if (!currentPlayerRow) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] overflow-y-auto bg-[#08131ddd]/90 px-3 py-4 backdrop-blur-md sm:px-4 sm:py-8"
      >
        <div className="flex min-h-full items-start justify-center sm:items-center">
          <motion.div
            initial={{ y: 36, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -24, opacity: 0, scale: 0.98 }}
            className="screen-frame max-w-xl"
          >
            <div className="card p-6 sm:p-8">
              <div className="mb-6 text-center">
                <p className="eyebrow mb-2">Round Standing</p>
                <h2 className="text-2xl font-bold sm:text-4xl">{gameLabel}</h2>
                {roundNumber && totalRounds ? (
                  <p className="mt-2 text-ui-textMuted">
                    {unitLabel || 'Round'} {roundNumber} of {totalRounds}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.55rem] border border-primary-teal/35 bg-primary-teal/10 p-5 text-center">
                  <p className="section-label mb-2">Place</p>
                  <p className="text-5xl font-bold text-white sm:text-6xl">#{currentPlayerRow.rank}</p>
                </div>
                <div className="rounded-[1.55rem] border border-ui-border/80 bg-black/20 p-5 text-center">
                  <p className="section-label mb-2">Score</p>
                  <p className="text-5xl font-bold text-white sm:text-6xl">{currentPlayerRow.score}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
