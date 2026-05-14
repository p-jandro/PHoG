import { useEffect, useMemo, useState } from 'react';
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

// Stage 0 = before any guess (most zoomed-in onto the body).
// Each wrong guess advances one stage, zooming out and slowly revealing colour.
// 11 entries cover stages 0..10 (initial + up to MAX_GUESSES=10 wrong guesses).
const ZOOM       = [2.4, 2.1, 1.8, 1.55, 1.35, 1.2, 1.1, 1.05, 1.0, 1.0, 1.0];
const BRIGHTNESS = [0,   0,   0.05, 0.1, 0.2, 0.3, 0.4, 0.55, 0.7, 0.8, 0.85];

/**
 * Compute the centroid of the silhouette (non-transparent pixels) for the
 * given sprite, returned as CSS transform-origin percentages. The result is
 * cached per sprite URL across renders/instances.
 */
const centroidCache = new Map<string, { x: number; y: number }>();

function useSilhouetteCentroid(spriteUrl: string) {
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(() =>
    centroidCache.get(spriteUrl) ?? null
  );

  useEffect(() => {
    const cached = centroidCache.get(spriteUrl);
    if (cached) {
      setOrigin(cached);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const { data: px, width: w, height: h } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let sumX = 0, sumY = 0, count = 0;
        // Step by 2 px to keep the cost low on big artwork.
        for (let y = 0; y < h; y += 2) {
          for (let x = 0; x < w; x += 2) {
            const alpha = px[(y * w + x) * 4 + 3];
            if (alpha > 32) {
              sumX += x;
              sumY += y;
              count++;
            }
          }
        }
        if (count === 0) return;
        const result = {
          x: (sumX / count / w) * 100,
          y: (sumY / count / h) * 100
        };
        centroidCache.set(spriteUrl, result);
        setOrigin(result);
      } catch (err) {
        // CORS or other failure — fall back to center.
        // eslint-disable-next-line no-console
        console.warn('[silhouette] centroid analysis failed', err);
      }
    };
    img.src = spriteUrl;
    return () => { cancelled = true; };
  }, [spriteUrl]);

  return origin;
}

export const Silhouette = ({ data, guesses, onGuess }: SilhouetteProps) => {
  const stage = guesses.length > 0 ? guesses[guesses.length - 1].silhouetteStage : 0;
  const solved = guesses.some((g) => g.solved);
  const zoom = ZOOM[Math.min(stage, ZOOM.length - 1)];
  const brightness = solved ? 1.0 : BRIGHTNESS[Math.min(stage, BRIGHTNESS.length - 1)];

  const wasJustSolved = solved && guesses.length > 0 && guesses[guesses.length - 1].solved;
  const wasJustWrong  = !solved && guesses.length > 0 && !guesses[guesses.length - 1].correct;

  const [shaking, setShaking] = useState(false);
  const used = guesses.length;
  const centroid = useSilhouetteCentroid(data.spriteUrl);
  // Once fully zoomed out (zoom === 1), the origin doesn't matter — center it.
  // Until then, anchor on the silhouette's body so the first frames never land
  // on transparent padding.
  const transformOrigin = useMemo(() => {
    if (zoom <= 1.001 || !centroid) return '50% 50%';
    return `${centroid.x}% ${centroid.y}%`;
  }, [zoom, centroid]);

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
              crossOrigin="anonymous"
              animate={reduce ? undefined : { scale: zoom }}
              transition={{ duration: 0.6 }}
              style={{
                filter: brightness === 0
                  ? 'brightness(0) invert(1)'
                  : `brightness(${brightness}) saturate(${Math.min(1, brightness + 0.2)})`,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                transformOrigin,
                transition: 'filter 350ms ease-out, transform-origin 350ms ease-out',
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
