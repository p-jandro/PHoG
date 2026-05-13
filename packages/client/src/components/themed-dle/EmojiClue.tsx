import { motion } from 'framer-motion';
import { AutocompletePicker, RosterEntry } from './AutocompletePicker';
import { Card, Chip } from '../../ui';
import { emojiPop, stagger, easing } from '../../lib/motion';

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
      <Card>
        <div className="flex justify-center gap-3 text-6xl sm:text-7xl">
          {revealed.map((e, i) => (
            <motion.span
              key={`${i}-${e}`}
              variants={emojiPop}
              initial="hidden"
              animate="visible"
              transition={{ delay: i * stagger.emoji, duration: 0.14, times: [0, 0.65, 1], ease: easing.backOut }}
            >
              {e}
            </motion.span>
          ))}
        </div>
        <p className="mt-4 text-center">
          <Chip variant="muted">{revealed.length} of 5 emojis revealed</Chip>
        </p>
      </Card>

      <ul className="space-y-2">
        {guesses.map((g, idx) => (
          <li key={idx} className="flex items-center gap-2 rounded-xl border-2 border-ink bg-bg-surface px-3 py-2 shadow-ink-sm">
            <Chip variant={g.correct ? 'streak' : 'muted'}>{g.correct ? 'Correct' : 'Wrong'}</Chip>
            <span className="font-semibold text-ink">{g.guess}</span>
          </li>
        ))}
      </ul>

      {!solved && used < data.maxGuesses && (
        <AutocompletePicker roster={data.roster} onSubmit={(name) => onGuess({ name })} placeholder="Guess a name…" />
      )}

      {solved && (
        <div className="flex justify-center">
          <Chip variant="streak">Solved in {used} {used === 1 ? 'guess' : 'guesses'}</Chip>
        </div>
      )}
      {!solved && used >= data.maxGuesses && (
        <div className="flex justify-center">
          <Chip variant="muted">Out of guesses</Chip>
        </div>
      )}
    </div>
  );
};
