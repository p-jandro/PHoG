interface TargetDisplayProps {
  target: number;
}

/**
 * Chunky sun-yellow target card. Spec §7.1: "target shown as a chunky sun-yellow
 * card (bg-now), big Inter Tight digits."
 *
 * We intentionally DO NOT digit-roll the target on initial reveal — the target
 * is a fixed value for the round, not a score reveal. DigitRoll is reserved
 * for the score-reveal moment (RoundResults).
 */
export const TargetDisplay = ({ target }: TargetDisplayProps) => (
  <div className="rounded-3xl border-2 border-ink bg-now px-6 py-4 text-center shadow-ink-lg">
    <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-on-now/80">Target</p>
    <p className="mt-1 font-display text-7xl font-extrabold leading-none tabular-nums text-on-now sm:text-8xl">
      {target}
    </p>
  </div>
);
