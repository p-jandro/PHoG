import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
import { Card, Chip } from '../ui';

export const PausedOverlay = () => {
  const { paused } = useGameStore();
  const reduced = useReducedMotion();

  return (
    <AnimatePresence>
      {paused && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 px-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Game paused"
        >
          <motion.div
            initial={reduced ? { opacity: 0 } : { scale: 0.92, opacity: 0 }}
            animate={reduced ? { opacity: 1 } : { scale: 1, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
            className="w-full max-w-xl"
          >
            <Card className="text-center">
              <motion.div
                animate={reduced ? undefined : { scale: [1, 1.05, 1] }}
                transition={
                  reduced
                    ? undefined
                    : { duration: 2, repeat: Infinity, ease: 'easeInOut' }
                }
                className="mb-6 flex justify-center"
              >
                <Chip variant="now" className="text-base tracking-[0.28em]">
                  PAUSED
                </Chip>
              </motion.div>
              <h1 className="mb-3 text-3xl font-extrabold text-ink sm:text-5xl">
                Game Paused
              </h1>
              <p className="text-lg text-ink-muted sm:text-xl">
                Waiting for the host to resume…
              </p>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
