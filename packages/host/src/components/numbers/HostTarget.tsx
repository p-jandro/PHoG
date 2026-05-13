interface HostTargetProps { target: number; }

export const HostTarget = ({ target }: HostTargetProps) => (
  <div className="flex flex-col items-center gap-2">
    <p className="eyebrow text-2xl">Target</p>
    <p className="text-[12rem] font-bold leading-none tabular-nums text-game-leader">{target}</p>
  </div>
);
