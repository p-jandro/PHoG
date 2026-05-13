import { motion, AnimatePresence } from 'framer-motion';
import { AutocompletePicker, RosterEntry } from './AutocompletePicker';

type EmojiResult = {
  guess: string;
  correct: boolean;
  feedback: 'correct' | 'wrong';
  guessesUsed: number;
  guessesRemaining: number;
  solved: boolean;
  emojisRevealed: string[];
};

interface EmojiClueProps {
  data: {
    emojis: string[];
    revealedCount: number;
    roster: RosterEntry[];
    maxGuesses: number;
  };
  guesses: EmojiResult[];
  onGuess: (payload: { name: string }) => void;
}

export const EmojiClue = ({ data, guesses, onGuess }: EmojiClueProps) => {
  const revealed = guesses.length > 0 ? guesses[guesses.length - 1].emojisRevealed : data.emojis;
  const solved = guesses.some((g) => g.solved);
  const used = guesses.length;

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-white/10 bg-black/40 p-8 text-center">
        <div className="flex justify-center gap-3 text-6xl sm:text-7xl">
          <AnimatePresence>
            {revealed.map((e, i) => (
              <motion.span
                key={`${i}-${e}`}
                initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                {e}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
        <p className="mt-4 text-xs text-ui-textMuted">{revealed.length}/5 emojis revealed</p>
      </div>

      <ul className="space-y-1">
        {guesses.map((g, idx) => (
          <li
            key={idx}
            className={`rounded-xl px-3 py-2 font-medium ${g.correct ? 'bg-game-correct/30 text-game-correct' : 'bg-game-incorrect/15 text-ui-textMuted'}`}
          >
            <span className="mr-2">{g.correct ? '✓' : '✗'}</span>{g.guess}
          </li>
        ))}
      </ul>

      {!solved && used < data.maxGuesses && (
        <AutocompletePicker roster={data.roster} onSubmit={(name) => onGuess({ name })} placeholder="Guess a name…" />
      )}
      {solved && <p className="text-center text-game-correct text-lg font-bold">🎉 Solved in {used}</p>}
      {!solved && used >= data.maxGuesses && <p className="text-center text-game-incorrect text-lg font-bold">Out of guesses</p>}
    </div>
  );
};
