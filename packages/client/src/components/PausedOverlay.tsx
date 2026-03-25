import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';

export const PausedOverlay = () => {
  const { paused } = useGameStore();

  return (
    <AnimatePresence>
      {paused && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
        >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="card max-w-xl px-6 py-8 text-center sm:px-8"
        >
          <motion.div
            animate={{
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="mb-4 text-4xl font-black tracking-[0.18em] text-game-leader sm:text-6xl sm:tracking-[0.28em]"
            >
              PAUSED
            </motion.div>
            <h1 className="mb-4 text-3xl font-bold text-white sm:text-5xl">
              Game Paused
            </h1>
            <p className="text-lg text-ui-textMuted sm:text-2xl">
              Waiting for host to resume...
            </p>
            <motion.div
              animate={{
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="mt-8 text-base text-primary-teal sm:text-xl"
            >
              Waiting for the host...
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
