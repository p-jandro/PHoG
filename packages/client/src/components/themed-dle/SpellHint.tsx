import { motion } from 'framer-motion';
import { AutocompletePicker } from './AutocompletePicker';
import { Card, Chip } from '../../ui';
import { letterDrop, popIn, easing } from '../../lib/motion';

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
      <Card eyebrow={data.category} title={data.effect}>
        <div className="flex justify-center gap-2">
          {Array.from({ length: data.incantationLength }).map((_, i) => (
            <motion.span
              key={i}
              variants={letterDrop}
              initial="hidden"
              animate="visible"
              transition={{ delay: i * 0.09, duration: 0.28, ease: easing.easeOut }}
              className="inline-flex h-10 w-7 items-center justify-center rounded-md border-2 border-ink bg-bg-sunken font-serif text-xl font-bold text-ink-muted shadow-ink-sm"
            >
              ·
            </motion.span>
          ))}
        </div>
        <p className="mt-3 text-center">
          <Chip variant="muted">{data.incantationLength} letters</Chip>
        </p>
      </Card>

      {revealedHints.length > 0 && (
        <div className="space-y-2">
          {revealedHints.map((h, i) => (
            <motion.div
              key={i}
              variants={popIn}
              initial="hidden"
              animate="visible"
              transition={{ delay: i * 0.1 }}
            >
              <Card className="!p-4">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-premium">{HINT_TITLES[h.type] || 'Hint'}</p>
                <p className="mt-1 text-base text-ink">{h.text}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <ul className="space-y-2">
        {guesses.map((g, i) => (
          <li key={i} className="flex items-center gap-2 rounded-xl border-2 border-ink bg-bg-surface px-3 py-2 shadow-ink-sm">
            <Chip variant={g.correct ? 'streak' : 'muted'}>{g.correct ? 'Correct' : 'Wrong'}</Chip>
            <span className="font-semibold text-ink">{g.guess}</span>
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
      {solved && (
        <div className="flex justify-center">
          <Chip variant="streak">Spell cast in {used} {used === 1 ? 'attempt' : 'attempts'}</Chip>
        </div>
      )}
      {!solved && used >= data.maxGuesses && (
        <div className="flex justify-center">
          <Chip variant="muted">Out of attempts</Chip>
        </div>
      )}
      {!solved && used < data.maxGuesses && (
        <div className="flex justify-center">
          <Chip variant="info">{data.maxGuesses - used} attempts left</Chip>
        </div>
      )}
    </div>
  );
};
