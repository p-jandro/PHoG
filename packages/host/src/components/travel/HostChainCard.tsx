type Color = 'green' | 'orange' | 'red';

interface HostChainCardProps {
  playerName: string;
  frontHead: string | null;
  backHead: string | null;
  chainTotal: number;     // number of countries across both chains (including endpoints)
  colors: Color[];
  solved: boolean;
  maxGuesses: number;
}

const DOT: Record<Color, string> = {
  green: 'bg-action',
  orange: 'bg-warn',
  red: 'bg-danger'
};

export const HostChainCard = ({ playerName, frontHead, backHead, chainTotal, colors, solved, maxGuesses }: HostChainCardProps) => (
  <div className={`rounded-3xl border-2 p-4 ${solved ? 'border-action bg-action/10' : 'border-ink/20 bg-bg-surface'}`}>
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <p className="truncate text-xl font-bold text-ink">{playerName}</p>
      <p className="text-xs text-ink-muted">{Math.max(0, chainTotal - 2)}/{maxGuesses}{solved && ' ✓'}</p>
    </div>
    <p className="truncate text-sm text-ink-muted">
      front <span className="font-semibold text-ink">{frontHead ?? '—'}</span>
      {' · '}back <span className="font-semibold text-ink">{backHead ?? '—'}</span>
    </p>
    <div className="mt-3 flex gap-1">
      {colors.map((c, i) => (
        <span key={i} className={`h-2.5 w-6 rounded-full ${DOT[c]}`} />
      ))}
      {Array.from({ length: Math.max(0, maxGuesses - colors.length) }).map((_, i) => (
        <span key={`p${i}`} className="h-2.5 w-6 rounded-full border border-white/15" />
      ))}
    </div>
  </div>
);
