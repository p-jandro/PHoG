import { motion, useReducedMotion } from 'framer-motion';

interface CountdownProps {
  seconds: number;       // current value to display (e.g. 3, 2, 1)
  total: number;         // the starting value, used to compute ring fill
  size?: number;         // diameter in px
  className?: string;
}

export function Countdown({ seconds, total, size = 130, className = '' }: CountdownProps) {
  const reduce = useReducedMotion();
  const radius = (size / 2) - 6;
  const circumference = 2 * Math.PI * radius;
  const elapsed = Math.max(0, total - seconds);
  const dashOffset = circumference - (elapsed / total) * circumference;

  return (
    <div
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`${seconds} seconds remaining`}
    >
      <svg
        className="absolute inset-0"
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--ink)" strokeWidth={4} opacity={0.15}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--streak)" strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 200ms linear' }}
        />
      </svg>
      <motion.div
        key={seconds}
        initial={reduce ? { opacity: 0 } : { scale: 1.2 }}
        animate={reduce ? { opacity: 1 } : { scale: 1 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="absolute inset-0 flex items-center justify-center font-display text-5xl font-black leading-none tracking-tighter text-ink"
      >
        {seconds > 0 ? seconds : 'GO'}
      </motion.div>
    </div>
  );
}
