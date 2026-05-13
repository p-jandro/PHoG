import { motion } from 'framer-motion';
import { AutocompletePicker, RosterEntry } from './AutocompletePicker';

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
  };
  guesses: SilhouetteResult[];
  onGuess: (payload: { name: string }) => void;
}

const ZOOM      = [3.0, 2.4, 1.8, 1.4, 1.1, 1.0, 1.0];
const BRIGHTNESS = [0, 0, 0, 0.1, 0.3, 0.6, 1.0];

export const Silhouette = ({ data, guesses, onGuess }: SilhouetteProps) => {
  const stage = guesses.length > 0 ? guesses[guesses.length - 1].silhouetteStage : 0;
  const solved = guesses.some((g) => g.solved);
  const zoom = ZOOM[Math.min(stage, ZOOM.length - 1)];
  const brightness = solved ? 1.0 : BRIGHTNESS[Math.min(stage, BRIGHTNESS.length - 1)];

  return (
    <div className="space-y-5">
      <div className="mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-black/40">
        <motion.img
          src={data.spriteUrl}
          alt="silhouette"
          initial={false}
          animate={{ scale: zoom }}
          transition={{ duration: 0.6 }}
          style={{
            // brightness 0 → fully obscured silhouette. Invert so it renders WHITE on the
            // dark container background (classic "Who's That Pokémon" look); once brightness
            // climbs above 0 we drop invert and let the real colours fade in.
            filter: brightness === 0
              ? 'brightness(0) invert(1)'
              : `brightness(${brightness}) saturate(${Math.min(1, brightness + 0.2)})`,
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
        />
      </div>

      <ul className="space-y-1">
        {guesses.map((g, i) => (
          <li key={i} className={`rounded-xl px-3 py-2 ${g.correct ? 'bg-game-correct/30 text-game-correct' : 'bg-game-incorrect/15 text-ui-textMuted'}`}>
            <span className="mr-2">{g.correct ? '✓' : '✗'}</span>{g.guess}
          </li>
        ))}
      </ul>

      {!solved && guesses.length < data.maxGuesses && (
        <AutocompletePicker roster={data.roster} onSubmit={(name) => onGuess({ name })} placeholder="Guess the Pokémon…" />
      )}
      {solved && <p className="text-center text-game-correct text-lg font-bold">🎉 Solved!</p>}
      {!solved && guesses.length >= data.maxGuesses && (
        <p className="text-center text-game-incorrect text-lg font-bold">Out of guesses</p>
      )}
    </div>
  );
};
