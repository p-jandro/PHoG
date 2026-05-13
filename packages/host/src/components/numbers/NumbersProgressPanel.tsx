interface SubmittedEntry { hasSubmitted: boolean; valid: boolean; }
interface PlayerLite { id: string; name: string; connected: boolean; }

interface NumbersProgressPanelProps {
  players: PlayerLite[];
  submitted: Record<string, SubmittedEntry>;
}

export const NumbersProgressPanel = ({ players, submitted }: NumbersProgressPanelProps) => {
  const connected = players.filter((p) => p.connected);
  return (
    <aside className="w-80 rounded-3xl border border-white/10 bg-black/30 p-5">
      <p className="eyebrow mb-3">Players</p>
      <ul className="space-y-2">
        {connected.map((p) => {
          const s = submitted[p.id];
          let detail = '⏳ thinking…';
          if (s?.valid) detail = '✓ submitted';
          else if (s) detail = '✗ invalid';
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
