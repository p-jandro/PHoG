import { Tile, type TileState } from '../../ui/Tile';

interface WordleBoardProps {
  rows: Array<{ guess: string; colors: ('green' | 'yellow' | 'grey')[] }>;
  current: string;         // the in-progress guess on the next row
  maxGuesses: number;
  /**
   * Index of the row currently being flipped (i.e. the row that was just
   * appended to `rows`). When set, the 5 tiles in that row animate the
   * flip cascade (Task 3 wires this in from Wordle.tsx). `null` = no flip.
   */
  flippingRowIndex?: number | null;
}

// Server `green/yellow/grey` → Tile primitive state (`grey` becomes `wrong` red
// per spec §2.1 — Wordle tile colors map to action/now/danger).
const COLOR_TO_STATE: Record<'green' | 'yellow' | 'grey', TileState> = {
  green: 'correct',
  yellow: 'partial',
  grey: 'wrong',
};

export const WordleBoard = ({ rows, current, maxGuesses, flippingRowIndex = null }: WordleBoardProps) => {
  // Build a 6-row × 5-col view model.
  type Cell = { ch: string; state: TileState };
  const visible: Cell[][] = [];

  for (const r of rows) {
    visible.push(
      r.guess.toUpperCase().split('').map((ch, i) => ({
        ch,
        state: COLOR_TO_STATE[r.colors[i]],
      })),
    );
  }
  if (visible.length < maxGuesses) {
    const padded = current.toUpperCase().padEnd(5, ' ').split('');
    visible.push(padded.map((ch) => ({ ch: ch.trim(), state: 'idle' as TileState })));
    while (visible.length < maxGuesses) {
      visible.push([0, 1, 2, 3, 4].map(() => ({ ch: '', state: 'idle' as TileState })));
    }
  }

  return (
    <div className="mx-auto grid grid-rows-6 gap-2">
      {visible.map((row, ri) => {
        const isFlipping = ri === flippingRowIndex;
        return (
          <div key={ri} className="grid grid-cols-5 gap-2">
            {row.map((cell, ci) => (
              <Tile
                key={ci}
                state={cell.state}
                flipping={isFlipping}
                flipDelaySec={isFlipping ? ci * 0.18 : 0}
                className="aspect-square w-14 text-2xl"
              >
                {cell.ch}
              </Tile>
            ))}
          </div>
        );
      })}
    </div>
  );
};
