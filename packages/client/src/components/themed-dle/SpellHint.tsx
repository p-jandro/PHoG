import { motion } from 'framer-motion';
import { AutocompletePicker } from './AutocompletePicker';

type SpellResult = {
  guess: string;
  correct: boolean;
  guessesUsed: number;
  guessesRemaining: number;
  solved: boolean;
  hint: { type: 'whenUsed' | 'caster' | 'letters'; text: string } | null;
};

interface SpellHintProps {
  data: {
    effect: string;
    category: string;
    incantationLength: number;
    spellList: string[];
    maxGuesses: number;
  };
  guesses: SpellResult[];
  onGuess: (payload: { name: string }) => void;
}

const HINT_TITLES: Record<string, string> = {
  whenUsed: 'When used',
  caster: 'Notable caster',
  letters: 'First & last letter'
};

export const SpellHint = ({ data, guesses, onGuess }: SpellHintProps) => {
  const solved = guesses.some((g) => g.solved);
  const used = guesses.length;
  const revealedHints = guesses.map((g) => g.hint).filter(Boolean) as Exclude<SpellResult['hint'], null>[];

  const roster = data.spellList.map((s) => ({ name: s }));

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-white/10 bg-black/40 p-6 text-center">
        <p className="eyebrow">{data.category}</p>
        <p className="mt-2 text-2xl font-bold text-white">{data.effect}</p>
        <p className="mt-2 text-sm text-ui-textMuted">Incantation: {data.incantationLength} characters</p>
      </div>

      {revealedHints.length > 0 && (
        <div className="space-y-2">
          {revealedHints.map((h, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              className="rounded-2xl border border-game-leader/30 bg-game-leader/10 px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-game-leader">{HINT_TITLES[h.type] || 'Hint'}</p>
              <p className="text-base">{h.text}</p>
            </motion.div>
          ))}
        </div>
      )}

      <ul className="space-y-1">
        {guesses.map((g, i) => (
          <li key={i} className={`rounded-xl px-3 py-2 ${g.correct ? 'bg-game-correct/30 text-game-correct' : 'bg-game-incorrect/15 text-ui-textMuted'}`}>
            <span className="mr-2">{g.correct ? '✓' : '✗'}</span>{g.guess}
          </li>
        ))}
      </ul>

      {!solved && used < data.maxGuesses && (
        <AutocompletePicker
          roster={roster}
          onSubmit={(name) => onGuess({ name })}
          placeholder="Speak the incantation…"
        />
      )}
      {solved && <p className="text-center text-game-correct text-lg font-bold">🎉 Spell cast!</p>}
      {!solved && used >= data.maxGuesses && (
        <p className="text-center text-game-incorrect text-lg font-bold">Out of attempts</p>
      )}
      {!solved && used < data.maxGuesses && (
        <p className="text-center text-xs text-ui-textMuted">{data.maxGuesses - used} attempts left</p>
      )}
    </div>
  );
};
