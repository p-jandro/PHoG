interface PlayerProgress {
  guessCount?: number;
  solved?: boolean;
  filledCells?: number;
}
interface PlayerLite { id: string; name: string; connected: boolean; }

interface PlayerProgressPanelProps {
  mode: 'classic' | 'emoji' | 'silhouette' | 'spell' | 'grid';
  players: PlayerLite[];
  progress: Record<string, PlayerProgress>;
  maxGuesses?: number;
}

export const PlayerProgressPanel = ({ mode, players, progress, maxGuesses }: PlayerProgressPanelProps) => {
  const connected = players.filter((p) => p.connected);

  return (
    <aside className="w-80 rounded-3xl border border-white/10 bg-black/30 p-5">
      <p className="eyebrow mb-3">Players</p>
      <ul className="space-y-2">
        {connected.map((p) => {
          const ps = progress[p.id];
          let detail = '⏳';
          if (mode === 'grid') {
            detail = `${ps?.filledCells ?? 0}/9 filled`;
          } else if (ps?.solved) {
            detail = '✓ solved';
          } else if (ps?.guessCount !== undefined) {
            detail = `${ps.guessCount}${maxGuesses ? `/${maxGuesses}` : ''} guesses`;
          }
          return (
            <li key={p.id} className="flex items-baseline justify-between gap-3 rounded-xl bg-black/30 px-3 py-2">
              <span className="font-medium">{p.name}</span>
              <span className="text-sm text-ui-textMuted">{detail}</span>
            </li>
          );
        })}
        {connected.length === 0 && (
          <li className="rounded-xl bg-black/30 px-3 py-3 text-center text-sm text-ui-textMuted">No players connected.</li>
        )}
      </ul>
    </aside>
  );
};
