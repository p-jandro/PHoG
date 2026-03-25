import { useEffect, useState } from 'react';
import { motion, useAnimation, useMotionValue, useTransform, animate } from 'framer-motion';

interface ColumnRevealProps {
  score: number;
  triggerTime: number;
  isCorrect: boolean;
}

export const ColumnReveal = ({ score, triggerTime, isCorrect }: ColumnRevealProps) => {
  const controls = useAnimation();
  const scoreValue = useMotionValue(100);
  const [displayScore, setDisplayScore] = useState(100);

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
    if (!triggerTime) return;

    const now = Date.now();
    const delay = Math.max(0, triggerTime - now);

    console.log(`[ColumnReveal] Animation scheduled in ${delay}ms`);

    const timer = setTimeout(() => {
      if (!isCorrect) {
        // If incorrect, shake and turn red/stay at 100
        controls.start({
          x: [0, -10, 10, -10, 10, 0],
          backgroundColor: '#FF4757',
          transition: { duration: 0.5 }
        });
      } else {
        // Animate score down using the motion value (which drives height and color)
        animate(scoreValue, score, {
            duration: 3,
            ease: "easeOut"
        });
      }

      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(200);
      }

    }, delay);

    return () => clearTimeout(timer);
  }, [triggerTime, score, isCorrect, controls, scoreValue]);

  return (
    <div className="relative w-full h-[60vh] bg-gray-800 rounded-lg overflow-hidden border-4 border-gray-700 shadow-inner">
      {/* Background Grid/Lines */}
      <div className="absolute inset-0 flex flex-col justify-between opacity-20 pointer-events-none">
        {[...Array(11)].map((_, i) => (
          <div key={i} className="w-full h-px bg-white" style={{ top: `${i * 10}%` }} />
        ))}
      </div>

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
    </div>
  );
};


