import type { ReactNode } from 'react';
import { ThemeToggle } from './ThemeToggle';

interface TimeLeftSlotProps {
  /** Number of seconds remaining, or `null` to render the dimmed "—:—" placeholder. */
  seconds: number | null;
  /** When `true` (default for Dashboard), the slot renders fully dimmed regardless of `seconds`. */
  dimmed?: boolean;
}

/** Top-right time-left slot. Same component, same place, every host screen.
 *  Dashboard passes `dimmed` and a `null` value so the slot reads "—:—" muted. */
function TimeLeftSlot({ seconds, dimmed = false }: TimeLeftSlotProps) {
  const label =
    seconds == null
      ? '—:—'
      : seconds < 60
        ? `${seconds.toString().padStart(2, '0')}s`
        : `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  return (
    <div
      className={[
        'flex min-w-[8rem] items-center justify-center rounded-2xl border-2 border-ink bg-bg-surface px-4 py-2 shadow-ink-sm',
        'font-display text-2xl font-black leading-none tracking-tight text-ink',
        dimmed ? 'opacity-40' : '',
      ].join(' ')}
      role="timer"
      aria-label={seconds == null ? 'No active timer' : `${seconds} seconds remaining`}
    >
      {label}
    </div>
  );
}

interface HostScreenShellProps {
  /** Top-left location label, e.g. "Host Dashboard · Lobby" or "Quiz Round · Question 7 of 15". Spelled out, no abbreviations. */
  location: string;
  /** Top-right slot. By default renders the time-left panel; pass `'theme-toggle'` to replace it with the theme toggle (Dashboard does this per spec §5.6). */
  topRight?:
    | { kind: 'time-left'; seconds: number | null; dimmed?: boolean }
    | { kind: 'theme-toggle' };
  /** Centred content. */
  children: ReactNode;
  /** Optional bottom slot. Per spec §7.3 this is reserved for the player tracker on every game screen — and nothing competes with it above. */
  footer?: ReactNode;
}

export function HostScreenShell({ location, topRight, children, footer }: HostScreenShellProps) {
  const top = topRight ?? { kind: 'time-left' as const, seconds: null, dimmed: true };
  return (
    <div className="flex min-h-screen flex-col bg-bg-base text-ink">
      <header className="flex items-center justify-between gap-4 border-b-2 border-ink/10 px-6 py-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">
            Host
          </div>
          <div className="truncate font-display text-xl font-black tracking-tight text-ink sm:text-2xl">
            {location}
          </div>
        </div>
        <div className="shrink-0">
          {top.kind === 'theme-toggle'
            ? <ThemeToggle />
            : <TimeLeftSlot seconds={top.seconds} dimmed={top.dimmed} />}
        </div>
      </header>

      <main className="flex-1 px-6 py-6">
        {children}
      </main>

      {footer && (
        <footer className="border-t-2 border-ink/10 px-6 py-4">
          {footer}
        </footer>
      )}
    </div>
  );
}
