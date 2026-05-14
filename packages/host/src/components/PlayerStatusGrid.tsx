/**
 * Shared host-display tracker. Renders one chip per player with a status
 * variant. Never shows player-submitted text — only status. Used across every
 * game's *Display.tsx so the host TV gets a consistent at-a-glance roster.
 */

export type PlayerStatus =
  | 'connected'
  | 'disconnected'
  | 'thinking'
  | 'submitted'
  | 'correct'
  | 'wrong'
  | 'solved'
  | 'in-progress'
  | 'out-of-guesses';

export interface PlayerStatusEntry {
  playerId: string;
  name: string;
  status: PlayerStatus;
}

const VARIANT: Record<PlayerStatus, { bg: string; label: string }> = {
  'connected':      { bg: 'bg-bg-surface text-ink',         label: '' },
  'disconnected':   { bg: 'bg-bg-sunken text-ink-muted opacity-60', label: '×' },
  'thinking':       { bg: 'bg-bg-surface text-ink',         label: '…' },
  'submitted':      { bg: 'bg-info text-on-info',           label: '✓' },
  'correct':        { bg: 'bg-action text-on-action',       label: '✓' },
  'wrong':          { bg: 'bg-danger text-on-danger',       label: '✗' },
  'solved':         { bg: 'bg-action text-on-action',       label: '✓' },
  'in-progress':    { bg: 'bg-bg-surface text-ink',         label: '…' },
  'out-of-guesses': { bg: 'bg-danger/70 text-on-danger',    label: '·' }
};

interface PlayerStatusGridProps {
  players: PlayerStatusEntry[];
  title?: string;
}

export const PlayerStatusGrid = ({ players, title }: PlayerStatusGridProps) => (
  <div className="rounded-2xl border-2 border-ink bg-bg-surface p-3 shadow-ink-sm">
    {title && (
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">{title}</span>
        <span className="text-xs font-extrabold tabular-nums text-ink-muted">{players.length}</span>
      </div>
    )}
    {players.length === 0 ? (
      <p className="py-2 text-center text-sm text-ink-muted">No players.</p>
    ) : (
      <div className="flex flex-wrap gap-2">
        {players.map((p) => {
          const v = VARIANT[p.status];
          return (
            <div
              key={p.playerId}
              className={`rounded-xl border-2 border-ink px-3 py-1 text-sm font-extrabold shadow-ink-sm ${v.bg}`}
            >
              {v.label && <span className="mr-1 opacity-80">{v.label}</span>}
              <span>{p.name}</span>
            </div>
          );
        })}
      </div>
    )}
  </div>
);
