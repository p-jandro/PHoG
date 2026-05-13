import { Pill } from '../../ui/Pill';

interface PlayerProgressEntry { solved?: boolean; operations?: number; bestValue?: number | null; }
interface PlayerLite { id: string; name: string; connected: boolean; }

interface NumbersProgressPanelProps {
  players: PlayerLite[];
  progress: Record<string, PlayerProgressEntry>;
}

/**
 * Bottom-of-screen player tracker for the host's Numbers display.
 * Spec §7.3: "exact / closest so far / in progress / no submission".
 */
function statusFor(entry: PlayerProgressEntry | undefined): { label: string; tone: 'on' | 'off' | 'done' } {
  if (!entry) return { label: 'no submission yet', tone: 'off' };
  if (entry.solved) return { label: `Exact (${entry.bestValue})`, tone: 'done' };
  if (entry.bestValue != null) return { label: `Closest so far (${entry.bestValue})`, tone: 'on' };
  if (entry.operations && entry.operations > 0) return { label: `In progress · ${entry.operations} op${entry.operations === 1 ? '' : 's'}`, tone: 'on' };
  return { label: 'No submission yet', tone: 'off' };
}

export const NumbersProgressPanel = ({ players, progress }: NumbersProgressPanelProps) => {
  const connected = players.filter((p) => p.connected);
  const total = connected.length;
  const solvedCount = connected.filter((p) => progress[p.id]?.solved).length;

  return (
    <div className="w-full">
      <p className="mb-3 text-center text-xl font-extrabold uppercase tracking-[0.18em] text-ink-muted">
        Players · {solvedCount} of {total} solved
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {connected.length === 0 && (
          <p className="text-lg text-ink-muted">No players connected.</p>
        )}
        {connected.map((p) => {
          const { label, tone } = statusFor(progress[p.id]);
          const dotColor =
            tone === 'done' ? 'bg-action' :
            tone === 'on'   ? 'bg-info' :
            'bg-ink-muted/50';
          return (
            <Pill key={p.id} className="text-base">
              <span className={['inline-block h-2 w-2 rounded-full', dotColor].join(' ')} aria-hidden="true" />
              <span className="font-extrabold">{p.name}</span>
              <span className="text-ink-muted">— {label}</span>
            </Pill>
          );
        })}
      </div>
    </div>
  );
};
