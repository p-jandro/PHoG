import { HostNumberTile } from './HostNumberTile';

interface HostTilePoolProps {
  tiles: number[];
}

export const HostTilePool = ({ tiles }: HostTilePoolProps) => (
  <div className="flex flex-wrap items-center justify-center gap-5">
    {tiles.map((value, idx) => (
      <HostNumberTile key={idx} value={value} />
    ))}
  </div>
);
