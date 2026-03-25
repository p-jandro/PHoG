import { useEffect, useRef, useState } from 'react';
import { motion, useAnimation, useMotionValue, useTransform, animate } from 'framer-motion';

interface ColumnRevealProps {
  score: number;
  triggerTime: number;
  isCorrect: boolean;
  className?: string;
  onSequenceComplete?: () => void;
}

const getRevealDuration = (score: number) => {
  if (score === 0) return 4.2;
  if (score <= 3) return 3.8;
  if (score <= 10) return 3.4;
  if (score <= 25) return 3;
  if (score <= 50) return 2.7;
  return 2.35;
};

export const ColumnReveal = ({
  score,
  triggerTime,
  isCorrect,
  className = 'h-[60vh]',
  onSequenceComplete
}: ColumnRevealProps) => {
  const controls = useAnimation();
  const scoreValue = useMotionValue(100);
  const [displayScore, setDisplayScore] = useState(100);
  const [isSettled, setIsSettled] = useState(false);
  const onSequenceCompleteRef = useRef(onSequenceComplete);

  // Transform score value to height percentage (100% -> score%)
  // We want the column to drop down, so height goes from 100% to score%
  const height = useTransform(scoreValue, (value) => `${value}%`);

  // Transform score value to color
  // Red (100) -> Orange (50) -> Teal (0)
  const backgroundColor = useTransform(
    scoreValue,
    [100, 50, 0],
    ['#FF4757', '#FFA502', '#00D4AA']
  );

  useEffect(() => {
    // Subscribe to motion value updates to update the displayed number
    const unsubscribe = scoreValue.on('change', (latest) => {
      setDisplayScore(Math.round(latest));
    });
    return () => unsubscribe();
  }, [scoreValue]);

  useEffect(() => {
    onSequenceCompleteRef.current = onSequenceComplete;
  }, [onSequenceComplete]);

  useEffect(() => {
    if (!triggerTime) return;

    scoreValue.set(100);
    setDisplayScore(100);
    setIsSettled(false);

    const now = Date.now();
    const delay = Math.max(0, triggerTime - now);
    const playbackControls: Array<{ stop: () => void }> = [];
    let cancelled = false;

    const animateScore = (target: number, duration: number) => (
      new Promise<void>((resolve) => {
        const playback = animate(scoreValue, target, {
          duration,
          ease: [0.18, 0.84, 0.28, 1],
          onComplete: () => resolve()
        });
        playbackControls.push(playback);
      })
    );

    const timer = setTimeout(async () => {
      if (cancelled) {
        return;
      }

      if (navigator.vibrate) {
        navigator.vibrate(isCorrect ? 160 : 240);
      }

      if (!isCorrect) {
        controls.set({
          x: 0,
          scale: 1,
          boxShadow: '0 0 0 rgba(255, 71, 87, 0)',
          filter: 'brightness(1)'
        });

        await controls.start({
          x: [0, -16, 16, -12, 12, -6, 6, 0],
          scale: [1, 1.03, 1],
          backgroundColor: '#FF4757',
          boxShadow: [
            '0 0 0 rgba(255, 71, 87, 0)',
            '0 0 28px rgba(255, 71, 87, 0.4)',
            '0 0 0 rgba(255, 71, 87, 0)'
          ],
          transition: { duration: 0.85, ease: 'easeInOut' }
        });

        if (!cancelled) {
          setIsSettled(true);
          onSequenceCompleteRef.current?.();
        }
        return;
      }

      const duration = getRevealDuration(score);
      const glow =
        score === 0 ? '0 0 52px rgba(0, 212, 170, 0.42)' :
        score <= 10 ? '0 0 36px rgba(0, 212, 170, 0.3)' :
        score <= 25 ? '0 0 28px rgba(255, 165, 2, 0.24)' :
        '0 0 18px rgba(255, 71, 87, 0.18)';

      controls.set({
        x: 0,
        scale: 1,
        boxShadow: '0 0 0 rgba(255,255,255,0)',
        filter: 'brightness(1)'
      });

      const settleAnimation = controls.start({
        boxShadow: glow,
        filter: 'brightness(1.04)',
        transition: { duration, ease: 'easeOut' }
      });
      playbackControls.push({ stop: () => controls.stop() });

      await animateScore(score, duration);
      await settleAnimation;

      await controls.start({
        scale: 1,
        boxShadow: glow,
        filter: 'brightness(1.06)',
        transition: { duration: 0.2, ease: 'easeOut' }
      });

      if (!cancelled) {
        setIsSettled(true);
        onSequenceCompleteRef.current?.();
      }
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      playbackControls.forEach((playback) => playback.stop());
    };
  }, [triggerTime, score, isCorrect, controls, scoreValue]);

  return (
    <div className={`relative w-full overflow-hidden rounded-[1.75rem] border-4 border-gray-700 bg-gray-800 shadow-inner ${className}`}>
      {/* Background Grid/Lines */}
      <div className="absolute inset-0 flex flex-col justify-between opacity-20 pointer-events-none">
        {[...Array(11)].map((_, i) => (
          <div key={i} className="w-full h-px bg-white" style={{ top: `${i * 10}%` }} />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0.22 }}
        animate={{ opacity: isSettled ? 0.16 : 0.22 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.24),transparent_48%)]"
      />

      {/* The Column */}
      <motion.div
        initial={{ height: '100%', backgroundColor: '#FF4757' }}
        style={{ height, backgroundColor }}
        animate={controls}
        className="w-full absolute bottom-0 flex items-center justify-center"
      >
        <div className="text-white font-bold text-6xl drop-shadow-lg">
          {displayScore}
        </div>
      </motion.div>

      {/* 100 Marker (Incorrect) */}
      {isCorrect === false && (
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center z-10 pointer-events-none">
          <motion.div 
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="text-9xl text-red-500 font-black transform rotate-[-15deg] border-4 border-red-500 p-4 rounded-xl bg-white/90 backdrop-blur-sm"
          >
            XXX
          </motion.div>
        </div>
      )}
      
      {/* Pointless (0) Celebration */}
      {score === 0 && displayScore === 0 && (
         <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center z-20 pointer-events-none">
           <motion.div
             initial={{ scale: 0 }}
             animate={{ scale: [0, 1.2, 1] }}
             className="text-5xl md:text-7xl text-white font-black text-center drop-shadow-[0_0_15px_rgba(0,212,170,0.8)]"
           >
             POINTLESS!
           </motion.div>
         </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 text-center">
        <motion.p
          animate={{ opacity: isSettled ? 0.92 : 0.72 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="text-xs font-semibold uppercase tracking-[0.32em] text-white/75"
        >
          {isSettled ? 'Score Locked' : 'Score Reveal'}
        </motion.p>
      </div>
    </div>
  );
};
