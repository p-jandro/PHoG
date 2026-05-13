interface HostNumberTileProps {
  value: number;
}

/**
 * TV-scale chunky tile for the host's pool display.
 * Big-number tiles (>=25) get a sun-yellow accent so the player sees them clearly across the room.
 */
export const HostNumberTile = ({ value }: HostNumberTileProps) => {
  const big = value >= 25;
  return (
    <div
      className={[
        'flex h-32 w-32 items-center justify-center rounded-3xl border-4 border-ink shadow-ink-lg',
        'font-display text-6xl font-extrabold tabular-nums',
        big ? 'bg-now text-on-now' : 'bg-bg-surface text-ink',
      ].join(' ')}
    >
      {value}
    </div>
  );
};
