import { useEffect, useRef, useState } from 'react';
import { pointlessDrop, pointlessDropDurationMs, prefersReducedMotion } from '../lib/motion';

interface ScoreDropProps {
  /** The final score the bar should land on (0–100). */
  targetScore: number;
  /** If true, the drop animation runs once on mount. */
  autoStart?: boolean;
  /** Called when the drop finishes (after landing pause). */
  onLanded?: () => void;
  className?: string;
}

export function ScoreDrop({
  targetScore,
  autoStart = true,
  onLanded,
  className = '',
}: ScoreDropProps) {
  const [displayScore, setDisplayScore] = useState(100);
  const [dropPct, setDropPct] = useState(0);
  const [showPointless, setShowPointless] = useState(false);
  const rafRef = useRef<number | null>(null);
  // Keep onLanded in a ref so parent re-renders don't restart the RAF loop.
  // See bug-report 2026-05-14 §D4.
  const onLandedRef = useRef(onLanded);
  useEffect(() => { onLandedRef.current = onLanded; }, [onLanded]);

  useEffect(() => {
    if (!autoStart) return;
    setDisplayScore(100);
    setDropPct(0);
    setShowPointless(false);

    // Under reduced-motion: jump directly to final state.
    if (prefersReducedMotion()) {
      const fullDrop = 100 - targetScore;
      setDropPct(fullDrop);
      setDisplayScore(targetScore);
      if (targetScore === 0) setShowPointless(true);
      setTimeout(() => onLandedRef.current?.(), 400);
      return;
    }

    const startTime = performance.now();
    const fullDrop = 100 - targetScore;
    const duration = pointlessDropDurationMs(fullDrop);

    const frame = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const currentDrop = fullDrop * eased;
      setDropPct(currentDrop);
      setDisplayScore(Math.round(100 - currentDrop));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        if (targetScore === 0) setShowPointless(true);
        const pauseMs = targetScore === 0 ? pointlessDrop.landingPauseAtZeroMs : pointlessDrop.landingPauseMs;
        setTimeout(() => onLandedRef.current?.(), pauseMs);
      }
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [autoStart, targetScore]);

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div
        className="relative overflow-hidden rounded-2xl border-2 border-ink shadow-ink-lg"
        style={{
          width: 96, height: 240,
          background: 'linear-gradient(180deg, #e54848 0%, #d96a3a 20%, #ffd23f 50%, #6ec27e 80%, #2ec27e 100%)',
        }}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={displayScore}
        aria-label="Pointless score"
      >
        <div
          className="absolute inset-x-0 top-0 flex items-end justify-center pb-1.5"
          style={{
            height: `${dropPct}%`,
            background: 'var(--ink)',
            borderBottom: '4px solid var(--now)',
          }}
        >
          <span className="font-display text-3xl font-black leading-none text-white">
            {displayScore}
          </span>
        </div>
        {showPointless && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md border-2 border-ink bg-ink px-2.5 py-1 font-serif text-sm font-extrabold text-action shadow-ink-sm">
            POINTLESS
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 text-xs font-extrabold uppercase tracking-[0.16em] text-ink-muted">
        <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
      </div>
    </div>
  );
}
