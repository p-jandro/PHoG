interface HostTilePoolProps {
  tiles: number[];
}

export const HostTilePool = ({ tiles }: HostTilePoolProps) => (
  <div className="flex flex-wrap items-center justify-center gap-5">
    {tiles.map((value, idx) => (
      <div
        key={idx}
        className={`flex h-32 w-32 items-center justify-center rounded-3xl border-4 text-6xl font-bold ${
          value >= 25
            ? 'border-game-leader bg-game-leader/15 text-white'
            : 'border-white/30 bg-white/10 text-white'
        }`}
      >
        {value}
      </div>
    ))}
  </div>
);
