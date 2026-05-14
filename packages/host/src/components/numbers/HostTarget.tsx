interface HostTargetProps { target: number; }

/**
 * TV-scale target card. Per bug-report 2026-05-14 §A3: large numeric displays
 * render flat (text-ink on the surface) rather than wrapped in a chunky
 * `bg-now` accent — the value itself is the focal point, not the colour box.
 */
export const HostTarget = ({ target }: HostTargetProps) => (
  <div className="flex flex-col items-center gap-3 rounded-[2.5rem] border-2 border-ink bg-bg-surface px-12 py-8 shadow-ink-lg">
    <p className="text-2xl font-extrabold uppercase tracking-[0.18em] text-ink-muted">Target</p>
    <p className="font-display text-[12rem] font-extrabold leading-none tabular-nums text-ink">{target}</p>
  </div>
);
