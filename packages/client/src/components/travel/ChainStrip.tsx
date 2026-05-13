import { ChainPill, ChainColor } from './ChainPill';

export interface ChainEntry { name: string; color?: ChainColor; }

interface ChainStripProps {
  frontChain: ChainEntry[];   // [{name:start}, …]
  backChain: ChainEntry[];    // […, {name:end}]
  solved: boolean;
}

/* The two chains meet in the middle. Layout left-to-right:
 *   [Start] → [front1] → [front2] … … [back1] → [End]
 * with a dashed "meet" pill between them while unsolved. */
export function ChainStrip({ frontChain, backChain, solved }: ChainStripProps) {
  const [startEntry, ...frontRest] = frontChain;
  const backRest = backChain.slice(0, -1);
  const endEntry = backChain[backChain.length - 1];

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {startEntry && <ChainPill name={startEntry.name} role="start" />}
      {frontRest.map((e, i) => (
        <span key={`f-${i}`} className="flex items-center gap-2">
          <Arrow />
          <ChainPill name={e.name} color={e.color} role="mid" />
        </span>
      ))}
      {!solved && (
        <span className="flex items-center gap-2">
          <Arrow />
          <span className="rounded-xl border-2 border-dashed border-ink/40 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-ink-muted">
            keep going
          </span>
          <Arrow />
        </span>
      )}
      {solved && backRest.length > 0 && <Arrow />}
      {backRest.map((e, i) => (
        <span key={`b-${i}`} className="flex items-center gap-2">
          <ChainPill name={e.name} color={e.color} role="mid" />
          <Arrow />
        </span>
      ))}
      {endEntry && <ChainPill name={endEntry.name} role="end" />}
    </div>
  );
}

function Arrow() {
  return <span aria-hidden className="font-black text-ink-muted">→</span>;
}
