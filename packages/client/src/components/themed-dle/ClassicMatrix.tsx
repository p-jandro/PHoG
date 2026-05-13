import { useEffect, useRef } from 'react';
import { AutocompletePicker, RosterEntry } from './AutocompletePicker';
import { Tile, Chip } from '../../ui';
import { stagger, duration } from '../../lib/motion';

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

export const ClassicMatrix = ({ data, guesses, onGuess }: ClassicMatrixProps) => {
  const solved = guesses.some((g) => g.solved);
  const used = guesses.length;
  const headerRow = guesses[0]?.feedback?.map((c) => c.label) ?? [];
  const colCount = headerRow.length;

  // Track which guess rows have already completed their flip animation
  const flippedRows = useRef<Set<number>>(new Set());
  const latestIdx = used - 1;

  // Mark the latest row as "done flipping" after the cascade completes
  useEffect(() => {
    if (latestIdx < 0 || flippedRows.current.has(latestIdx)) return;
    const totalFlipMs = ((colCount * stagger.tile) + duration.reveal) * 1000;
    const t = setTimeout(() => {
      flippedRows.current.add(latestIdx);
    }, totalFlipMs);
    return () => clearTimeout(t);
  }, [latestIdx, colCount]);

  return (
    <div className="space-y-4">
      {headerRow.length > 0 && (
        <div className="overflow-x-auto">
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `minmax(7rem, 1.5fr) repeat(${colCount}, minmax(0, 1fr))` }}
          >
            {/* Header row */}
            <div /> {/* empty top-left corner */}
            {headerRow.map((label) => (
              <div key={label} className="flex justify-center">
                <Chip variant="muted">{label}</Chip>
              </div>
            ))}

            {/* Guess rows */}
            {guesses.map((g, idx) => {
              const isLatest = idx === latestIdx;
              const shouldFlip = isLatest && !flippedRows.current.has(idx);
              return (
                <>
                  <div key={`name-${idx}`} className="flex items-center">
                    <Chip variant="default">{g.guess}</Chip>
                  </div>
                  {g.feedback.map((c, cellIdx) => {
                    const v = Array.isArray(c.value) ? c.value.join(', ') : (c.value ?? '—');
                    const state = c.color === 'green' ? 'correct' : c.color === 'yellow' ? 'partial' : 'wrong';
                    return (
                      <Tile
                        key={c.key}
                        state={state}
                        flipping={shouldFlip}
                        flipDelaySec={cellIdx * stagger.tile}
                        className="w-full aspect-square min-h-[3rem]"
                      >
                        <span className="px-1 text-center text-[10px] leading-tight font-extrabold">{String(v)}</span>
                      </Tile>
                    );
                  })}
                </>
              );
            })}
          </div>
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
