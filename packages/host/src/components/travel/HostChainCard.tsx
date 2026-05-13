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
  green: 'bg-game-correct',
  orange: 'bg-game-warning',
  red: 'bg-game-incorrect'
};

export const HostChainCard = ({ playerName, frontHead, backHead, chainTotal, colors, solved, maxGuesses }: HostChainCardProps) => (
  <div className={`rounded-3xl border-2 p-4 ${solved ? 'border-game-correct bg-game-correct/10' : 'border-white/10 bg-black/30'}`}>
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <p className="truncate text-xl font-bold">{playerName}</p>
      <p className="text-xs text-ui-textMuted">{Math.max(0, chainTotal - 2)}/{maxGuesses}{solved && ' ✓'}</p>
    </div>
    <p className="truncate text-sm text-ui-textMuted">
      front <span className="font-semibold text-white">{frontHead ?? '—'}</span>
      {' · '}back <span className="font-semibold text-white">{backHead ?? '—'}</span>
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
