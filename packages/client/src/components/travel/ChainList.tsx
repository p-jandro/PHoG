import { motion } from 'framer-motion';

type Color = 'green' | 'orange' | 'red';

interface ChainListProps {
  start: string;
  end: string;
  history: Array<{ name: string; color: Color }>;
}

const TONE: Record<Color, string> = {
  green: 'border-game-correct bg-game-correct/15',
  orange: 'border-game-warning bg-game-warning/15',
  red: 'border-game-incorrect bg-game-incorrect/15'
};

const EMOJI: Record<Color, string> = {
  green: '🟢',
  orange: '🟠',
  red: '🔴'
};

export const ChainList = ({ start, end, history }: ChainListProps) => (
  <ol className="space-y-2">
    <li className="rounded-2xl border-2 border-white/30 bg-white/5 px-4 py-3 text-lg font-bold">
      <span className="text-xs uppercase tracking-wider text-ui-textMuted">Start</span> · {start}
    </li>
    {history.map((step, idx) => (
      <motion.li
        key={idx}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        className={`rounded-2xl border-2 px-4 py-3 text-lg ${TONE[step.color]}`}
      >
        <span className="mr-2">{EMOJI[step.color]}</span>
        <span className="font-bold">{step.name}</span>
      </motion.li>
    ))}
    <li className="rounded-2xl border-2 border-dashed border-white/30 px-4 py-3 text-lg text-ui-textMuted">
      <span className="text-xs uppercase tracking-wider">Goal</span> · {end}
    </li>
  </ol>
);
