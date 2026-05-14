import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AutocompletePicker, RosterEntry } from './AutocompletePicker';
import { Card, Chip } from '../../ui';
import { silhouetteReveal, shake } from '../../lib/motion';

type SilhouetteResult = {
  guess: string;
  correct: boolean;
  feedback: 'correct' | 'wrong';
  guessesUsed: number;
  guessesRemaining: number;
  solved: boolean;
  silhouetteStage: number;
};

interface SilhouetteProps {
  data: {
    spriteUrl: string;
    revealStage: number;
    roster: RosterEntry[];
    maxGuesses: number;
    theme?: 'pokemon' | 'hp';
  };
  guesses: SilhouetteResult[];
  onGuess: (payload: { name: string }) => void;
}

// Stage 0 = before any guess (most zoomed-in, pure silhouette).
// Each wrong guess advances one stage, zooming out and slowly revealing colour.
// 11 entries cover stages 0..10 (initial + up to MAX_GUESSES=10 wrong guesses).
const ZOOM       = [4.0, 3.6, 3.2, 2.8, 2.4, 2.0, 1.7, 1.4, 1.2, 1.05, 1.0];
const BRIGHTNESS = [0,   0,   0,   0,   0.1, 0.2, 0.3, 0.45, 0.6, 0.8, 1.0];

export const Silhouette = ({ data, guesses, onGuess }: SilhouetteProps) => {
  const stage = guesses.length > 0 ? guesses[guesses.length - 1].silhouetteStage : 0;
  const solved = guesses.some((g) => g.solved);
  const zoom = ZOOM[Math.min(stage, ZOOM.length - 1)];
  const brightness = solved ? 1.0 : BRIGHTNESS[Math.min(stage, BRIGHTNESS.length - 1)];

  const wasJustSolved = solved && guesses.length > 0 && guesses[guesses.length - 1].solved;
  const wasJustWrong  = !solved && guesses.length > 0 && !guesses[guesses.length - 1].correct;

  const [shaking, setShaking] = useState(false);
  const used = guesses.length;

  useEffect(() => {
    if (!wasJustWrong) return;
    setShaking(true);
    const t = setTimeout(() => setShaking(false), 350);
    return () => clearTimeout(t);
  }, [guesses.length, wasJustWrong]);

  const reduce = useReducedMotion();
  const placeholder = data.theme === 'pokemon' ? 'Guess the Pokémon…' : 'Guess the character…';

  return (
    <div className="space-y-5">
      <motion.div variants={reduce ? undefined : shake} animate={!reduce && shaking ? 'shaking' : 'rest'}>
        <Card className={shaking ? 'border-danger' : ''}>
          <motion.div
            key={solved ? 'solved' : 'obscured'}
            variants={reduce ? undefined : silhouetteReveal}
            initial={false}
            animate={!reduce && wasJustSolved ? 'revealed' : 'obscured'}
            className="mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl border-2 border-ink bg-bg-sunken shadow-ink-sm"
          >
            <motion.img
              src={data.spriteUrl}
              alt="silhouette"
              animate={reduce ? undefined : { scale: zoom }}
              transition={{ duration: 0.6 }}
              style={{
                filter: brightness === 0
                  ? 'brightness(0) invert(1)'
                  : `brightness(${brightness}) saturate(${Math.min(1, brightness + 0.2)})`,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                transition: 'filter 350ms ease-out',
              }}
            />
          </motion.div>
        </Card>
      </motion.div>

      <ul className="space-y-2">
        {guesses.map((g, i) => (
          <li key={i} className="flex items-center gap-2 rounded-xl border-2 border-ink bg-bg-surface px-3 py-2 shadow-ink-sm">
            <Chip variant={g.correct ? 'streak' : 'muted'}>{g.correct ? 'Correct' : 'Wrong'}</Chip>
            <span className="font-semibold text-ink">{g.guess}</span>
          </li>
        ))}
      </ul>

      {!solved && used < data.maxGuesses && (
        <AutocompletePicker roster={data.roster} onSubmit={(name) => onGuess({ name })} placeholder={placeholder} />
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
