import { motion } from 'framer-motion';

type Color = 'green' | 'yellow' | 'grey' | 'empty';

interface WordleBoardProps {
  rows: Array<{ guess: string; colors: ('green' | 'yellow' | 'grey')[] }>;
  current: string;         // the in-progress guess on the next row
  maxGuesses: number;
}

const TONE: Record<Color, string> = {
  green: 'bg-game-correct text-black border-game-correct',
  yellow: 'bg-game-warning text-black border-game-warning',
  grey: 'bg-ui-textMuted/40 text-white border-ui-textMuted/40',
  empty: 'bg-transparent text-white border-white/20'
};

export const WordleBoard = ({ rows, current, maxGuesses }: WordleBoardProps) => {
  const visible: Array<Array<{ ch: string; color: Color }>> = [];
  for (const r of rows) {
    visible.push(r.guess.toUpperCase().split('').map((ch, i) => ({ ch, color: r.colors[i] })));
  }
  if (visible.length < maxGuesses) {
    const cur = current.toUpperCase().padEnd(5, ' ').split('').map((ch) => ({ ch: ch.trim(), color: 'empty' as Color }));
    visible.push(cur);
    while (visible.length < maxGuesses) {
      visible.push([0, 1, 2, 3, 4].map(() => ({ ch: '', color: 'empty' as Color })));
    }
  }

  return (
    <div className="mx-auto grid grid-rows-6 gap-2">
      {visible.map((row, ri) => (
        <div key={ri} className="grid grid-cols-5 gap-2">
          {row.map((cell, ci) => (
            <motion.div
              key={ci}
              initial={false}
              animate={{ scale: cell.ch ? 1 : 0.95 }}
              className={`flex aspect-square w-14 items-center justify-center rounded-md border-2 text-2xl font-bold uppercase ${TONE[cell.color]}`}
            >
              {cell.ch}
            </motion.div>
          ))}
        </div>
      ))}
    </div>
  );
};
