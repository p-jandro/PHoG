import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { correctPulse, wrongShake, prefersReducedMotion } from '../lib/motion';

export type AnswerFeedbackState = 'idle' | 'correct' | 'wrong';

interface AnswerFeedbackProps {
  state: AnswerFeedbackState;
  children: ReactNode;
  className?: string;
}

/**
 * Wraps a clickable answer (or group of answers) and runs the universal
 * §4.3 correct/wrong feedback animation when `state` flips away from 'idle'.
 *
 * Composes both variants into a single `animate` prop so the same wrapper
 * can play either reaction without re-mounting children.
 */
export function AnswerFeedback({ state, children, className = '' }: AnswerFeedbackProps) {
  const reduced = prefersReducedMotion();

  if (reduced) {
    // Reduced motion: skip transforms, lean on color (children already show it).
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={state === 'wrong' ? wrongShake : correctPulse}
      initial="rest"
      animate={state === 'wrong' ? 'shake' : state === 'correct' ? 'pulse' : 'rest'}
    >
      {children}
    </motion.div>
  );
}
