import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const COLORS = ['#d96a3a', '#5b3a5b', '#2ec27e', '#ffd23f'] as const;
const PIECE_COUNT = 60;

interface Piece {
  id: number;
  left: number; // 0–100 (vw)
  drift: number; // -20 to +20 (vw)
  delay: number; // 0–0.6 (s)
  duration: number; // 2.2–3.0 (s)
  rotateStart: number;
  rotateEnd: number;
  color: string;
  size: number; // 6–12 (px)
  shape: 'square' | 'rect';
}

function buildPieces(): Piece[] {
  const pieces: Piece[] = [];
  for (let i = 0; i < PIECE_COUNT; i++) {
    pieces.push({
      id: i,
      left: Math.random() * 100,
      drift: (Math.random() - 0.5) * 40,
      delay: Math.random() * 0.6,
      duration: 2.2 + Math.random() * 0.8,
      rotateStart: Math.random() * 360,
      rotateEnd: Math.random() * 720 + 360,
      color: COLORS[i % COLORS.length],
      size: 6 + Math.random() * 6,
      shape: Math.random() > 0.5 ? 'square' : 'rect',
    });
  }
  return pieces;
}

interface ConfettiProps {
  show: boolean;
}

/**
 * Heritage-palette confetti burst.
 * Renders nothing if `show` is false or if the user prefers reduced motion.
 */
export function Confetti({ show }: ConfettiProps) {
  const reduced = useReducedMotion();
  const pieces = useMemo(buildPieces, []);

  if (!show || reduced) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[90] overflow-hidden"
    >
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ y: '-40vh', x: 0, rotate: p.rotateStart, opacity: 1 }}
          animate={{ y: '110vh', x: `${p.drift}vw`, rotate: p.rotateEnd, opacity: 1 }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: [0.22, 0.61, 0.36, 1],
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: `${p.left}vw`,
            width: p.shape === 'rect' ? p.size * 1.6 : p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.shape === 'rect' ? 2 : 1,
          }}
        />
      ))}
    </div>
  );
}
