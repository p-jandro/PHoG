interface TargetDisplayProps {
  target: number;
}

export const TargetDisplay = ({ target }: TargetDisplayProps) => (
  <div className="rounded-3xl border-2 border-game-leader bg-game-leader/10 px-6 py-4 text-center">
    <p className="eyebrow">Target</p>
    <p className="text-6xl font-bold tabular-nums text-game-leader sm:text-7xl">{target}</p>
  </div>
);
