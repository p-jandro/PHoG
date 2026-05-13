import { motion } from 'framer-motion';

type Color = 'green' | 'orange' | 'red';
export interface ChainEntry { name: string; color?: Color; }

interface ChainListProps {
  frontChain: ChainEntry[];   // [{name:start}, …]
  backChain: ChainEntry[];    // […, {name:end}]
  solved: boolean;
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

const renderRow = (entry: ChainEntry, role: 'start' | 'end' | 'mid', key: string) => {
  if (role === 'start' || role === 'end') {
    return (
      <li key={key} className="rounded-2xl border-2 border-white/30 bg-white/5 px-4 py-3 text-lg font-bold">
        <span className="text-xs uppercase tracking-wider text-ui-textMuted">{role === 'start' ? 'Start' : 'Goal'}</span> · {entry.name}
      </li>
    );
  }
  const tone = entry.color ? TONE[entry.color] : 'border-white/20 bg-white/5';
  return (
    <motion.li
      key={key}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={`rounded-2xl border-2 px-4 py-3 text-lg ${tone}`}
    >
      {entry.color && <span className="mr-2">{EMOJI[entry.color]}</span>}
      <span className="font-bold">{entry.name}</span>
    </motion.li>
  );
};

export const ChainList = ({ frontChain, backChain, solved }: ChainListProps) => {
  const [startEntry, ...frontRest] = frontChain;
  const backRest = backChain.slice(0, -1);
  const endEntry = backChain[backChain.length - 1];

  return (
    <ol className="space-y-2">
      {startEntry && renderRow(startEntry, 'start', `f-start`)}
      {frontRest.map((e, i) => renderRow(e, 'mid', `f-${i}`))}
      {!solved && (
        <li className="rounded-2xl border-2 border-dashed border-white/20 bg-transparent px-4 py-3 text-center text-sm text-ui-textMuted">
          … keep going from either side …
        </li>
      )}
      {backRest.map((e, i) => renderRow(e, 'mid', `b-${i}`))}
      {endEntry && renderRow(endEntry, 'end', `b-end`)}
    </ol>
  );
};
