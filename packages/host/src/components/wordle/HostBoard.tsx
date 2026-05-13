type Color = 'green' | 'yellow' | 'grey';

interface HostBoardProps {
  rows: Color[][];   // length 0..6
  maxGuesses: number;
}

const TONE: Record<Color, string> = {
  green: 'bg-game-correct',
  yellow: 'bg-game-warning',
  grey: 'bg-ui-textMuted/40'
};

export const HostBoard = ({ rows, maxGuesses }: HostBoardProps) => {
  const filled = rows.length;
  const placeholders = Math.max(0, maxGuesses - filled);
  return (
    <div className="grid grid-rows-6 gap-1">
      {rows.map((row, ri) => (
        <div key={ri} className="grid grid-cols-5 gap-1">
          {row.map((c, ci) => (
            <div key={ci} className={`h-3 w-3 rounded-sm ${TONE[c]}`} />
          ))}
        </div>
      ))}
      {Array.from({ length: placeholders }).map((_, ri) => (
        <div key={`p${ri}`} className="grid grid-cols-5 gap-1">
          {[0, 1, 2, 3, 4].map((ci) => (
            <div key={ci} className="h-3 w-3 rounded-sm border border-white/15" />
          ))}
        </div>
      ))}
    </div>
  );
};
