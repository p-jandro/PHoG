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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="text-center"
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
              className="text-7xl font-black tracking-widest mb-6"
            >
              PAUSED
            </motion.div>
            <h1 className="text-6xl font-bold text-white mb-4">
              Game Paused
            </h1>
            <p className="text-2xl text-ui-textMuted">
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
              className="mt-8 text-xl text-primary-teal"
            >
              Hang tight...
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
