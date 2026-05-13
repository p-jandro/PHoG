import { motion } from 'framer-motion';
import { Avatar } from './Avatar';
import { Chip } from './Chip';

export interface TrackedPlayer {
  id: string;
  name: string;
  /** Connection status. Disconnected players render dimmed but still appear in the list. */
  connected: boolean;
  /** Optional score. Hidden when omitted (lobby phase). */
  score?: number;
  /** Optional per-player status chip — used by per-game host displays in later phases (e.g. "answered", "guess 3 of 6"). */
  status?: string;
  /** Optional explicit highlight (e.g. current player on their turn). */
  highlight?: boolean;
}

interface PlayerTrackerProps {
  players: TrackedPlayer[];
  /** Heading shown above the list. Spec §7.3 demands an explicit "X of Y" count. */
  title: string;
  /** When `true`, the list is scrollable with a max height; otherwise it grows. */
  scrollable?: boolean;
  className?: string;
  /** Optional empty-state node (e.g. "Share <url> with players"). */
  emptyState?: React.ReactNode;
}

export function PlayerTracker({
  players,
  title,
  scrollable = true,
  className = '',
  emptyState,
}: PlayerTrackerProps) {
  return (
    <div className={['flex flex-col gap-3', className].join(' ')}>
      <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">
        {title}
      </div>
      <div
        className={[
          'flex flex-col gap-2 rounded-2xl border-2 border-ink bg-bg-surface p-3 shadow-ink',
          scrollable ? 'max-h-[28rem] overflow-y-auto' : '',
        ].join(' ')}
      >
        {players.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-ink-muted">
            {emptyState ?? 'No players yet.'}
          </div>
        ) : (
          players.map((p) => (
            <motion.div
              key={p.id}
              layout
              transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
              className={[
                'flex items-center justify-between gap-3 rounded-xl border-2 px-3 py-2',
                p.highlight
                  ? 'border-ink bg-now text-on-now'
                  : p.connected
                    ? 'border-ink bg-bg-base text-ink'
                    : 'border-ink/30 bg-bg-sunken text-ink-muted opacity-60',
              ].join(' ')}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={p.name} size="sm" />
                <span className="truncate text-base font-bold">{p.name}</span>
                {p.status && (
                  <Chip variant="muted" className="ml-1">{p.status}</Chip>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {typeof p.score === 'number' && (
                  <span className="font-display text-lg font-black leading-none tracking-tight">
                    {p.score}
                  </span>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
