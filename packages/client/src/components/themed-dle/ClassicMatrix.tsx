import { useEffect, useRef, useState } from 'react';
import { AutocompletePicker, RosterEntry } from './AutocompletePicker';
import { Tile, Chip } from '../../ui';
import { stagger } from '../../lib/motion';

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

// 2×3 layout: render each guess as a header "name" chip plus a 2-row × 3-col
// block of attribute tiles. Each tile flips (rotateX 0→90→0 ≈250ms) on the
// newly-arrived row, staggered by 180ms per cell — matching Wordle.
export const ClassicMatrix = ({ data, guesses, onGuess }: ClassicMatrixProps) => {
  const solved = guesses.some((g) => g.solved);
  const used = guesses.length;

  // State-driven flip trigger (Wordle pattern). Holds the guess index that is
  // currently animating; null when no row is flipping.
  const [flippingIdx, setFlippingIdx] = useState<number | null>(null);
  const lastSeenLength = useRef(0);

  useEffect(() => {
    if (guesses.length > lastSeenLength.current) {
      const newIdx = guesses.length - 1;
      setFlippingIdx(newIdx);
      // 6 cells × 0.18s stagger + 0.25s flip ≈ 1.33s. Add a tiny safety margin.
      const totalMs = (6 * stagger.tile + 0.25) * 1000 + 80;
      const t = setTimeout(() => {
        setFlippingIdx((cur) => (cur === newIdx ? null : cur));
      }, totalMs);
      lastSeenLength.current = guesses.length;
      return () => clearTimeout(t);
    }
    lastSeenLength.current = guesses.length;
  }, [guesses.length]);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {guesses.map((g, idx) => {
          const isFlipping = idx === flippingIdx;
          return (
            <div
              key={`guess-${idx}`}
              className="rounded-2xl border-2 border-ink bg-bg-surface p-3 shadow-ink-sm"
            >
              {/* Guess label */}
              <div className="mb-2 flex justify-center">
                <Chip variant="default">{g.guess}</Chip>
              </div>
              {/* 2 rows × 3 cols attribute grid */}
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
              >
                {g.feedback.map((c, cellIdx) => {
                  const v = Array.isArray(c.value) ? c.value.join(', ') : (c.value ?? '—');
                  const state =
                    c.color === 'green' ? 'correct' : c.color === 'yellow' ? 'partial' : 'wrong';
                  return (
                    <div key={c.key} className="flex flex-col items-stretch gap-1">
                      {/* Header label above the tile — roomy, allowed to wrap to 2 lines */}
                      <div className="flex min-h-[2.25rem] items-center justify-center px-1">
                        <span className="block text-center text-[10px] font-extrabold uppercase leading-tight tracking-[0.08em] text-ink-muted">
                          {c.label}
                        </span>
                      </div>
                      <Tile
                        state={state}
                        flipping={isFlipping}
                        flipDelaySec={cellIdx * stagger.tile}
                        className="min-h-[3.25rem] w-full px-2 py-2"
                      >
                        <span className="block w-full whitespace-normal break-words px-1 text-center text-[11px] font-extrabold leading-tight">
                          {String(v)}
                        </span>
                      </Tile>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {!solved && used < data.maxGuesses && (
        <AutocompletePicker
          roster={data.roster}
          onSubmit={(name) => onGuess({ name })}
          placeholder="Guess a name…"
        />
      )}

      {solved && (
        <div className="flex justify-center">
          <Chip variant="streak">Solved in {used} {used === 1 ? 'guess' : 'guesses'}</Chip>
        </div>
      )}
      {!solved && used >= data.maxGuesses && (
        <div className="flex justify-center">
          <Chip variant="muted">Out of guesses — the answer was hidden</Chip>
        </div>
      )}
      {!solved && used < data.maxGuesses && (
        <div className="flex justify-center">
          <Chip variant="info">{data.maxGuesses - used} guesses left</Chip>
        </div>
      )}
    </div>
  );
};
