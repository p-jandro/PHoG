interface HostTargetProps { target: number; }

/**
 * TV-scale sun-yellow target card. Spec §7.3 keeps the player-facing tone:
 * big bold target front and centre.
 */
export const HostTarget = ({ target }: HostTargetProps) => (
  <div className="flex flex-col items-center gap-3 rounded-[2.5rem] border-4 border-ink bg-now px-12 py-8 shadow-ink-lg">
    <p className="text-2xl font-extrabold uppercase tracking-[0.18em] text-on-now/80">Target</p>
    <p className="font-display text-[12rem] font-extrabold leading-none tabular-nums text-on-now">{target}</p>
  </div>
);
