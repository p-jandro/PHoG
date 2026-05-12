import { motion } from 'framer-motion';
import { AutocompletePicker, RosterEntry } from './AutocompletePicker';

type Cell = { key: string; label: string; value: any; color: 'green' | 'yellow' | 'red' };
type GuessResult = {
  guess: string;
  correct: boolean;
  feedback: Cell[];
  guessesUsed: number;
  guessesRemaining: number;
  solved: boolean;
};

interface ClassicMatrixProps {
  data: {
    roster: RosterEntry[];
    maxGuesses: number;
    duration: number;
    endsAt: number;
  };
  guesses: GuessResult[];
  onGuess: (payload: { name: string }) => void;
}

const COLOR_CLASSES: Record<Cell['color'], string> = {
  green: 'bg-game-correct text-black',
  yellow: 'bg-game-warning text-black',
  red: 'bg-game-incorrect/80 text-white'
};

export const ClassicMatrix = ({ data, guesses, onGuess }: ClassicMatrixProps) => {
  const solved = guesses.some((g) => g.solved);
  const used = guesses.length;
  const headerRow = guesses[0]?.feedback?.map((c) => c.label) ?? [];

  return (
    <div className="space-y-4">
      {headerRow.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th className="text-left text-xs text-ui-textMuted">Guess</th>
                {headerRow.map((label) => (
                  <th key={label} className="text-xs text-ui-textMuted">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {guesses.map((g, idx) => (
                <motion.tr key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <td className="rounded-xl bg-black/30 px-3 py-2 font-medium">{g.guess}</td>
                  {g.feedback.map((c) => {
                    const v = Array.isArray(c.value) ? c.value.join(', ') : (c.value ?? '—');
                    return (
                      <td key={c.key} className={`rounded-xl px-2 py-2 text-center font-semibold ${COLOR_CLASSES[c.color]}`}>
                        {String(v)}
                      </td>
                    );
                  })}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!solved && used < data.maxGuesses && (
        <AutocompletePicker
          roster={data.roster}
          onSubmit={(name) => onGuess({ name })}
          placeholder="Guess a name…"
        />
      )}

      {solved && (
        <p className="text-center text-game-correct text-lg font-bold">🎉 Solved in {used} {used === 1 ? 'guess' : 'guesses'}</p>
      )}
      {!solved && used >= data.maxGuesses && (
        <p className="text-center text-game-incorrect text-lg font-bold">Out of guesses</p>
      )}
      <p className="text-center text-xs text-ui-textMuted">{data.maxGuesses - used} guesses left</p>
    </div>
  );
};
