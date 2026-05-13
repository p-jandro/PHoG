import { motion } from 'framer-motion';

interface TilePoolProps {
  tiles: number[];
  usedIndexes: Set<number>;   // which slots are currently consumed by the live expression
  onTileClick: (index: number, value: number) => void;
}

export const TilePool = ({ tiles, usedIndexes, onTileClick }: TilePoolProps) => (
  <div className="grid grid-cols-6 gap-2 sm:gap-3">
    {tiles.map((value, idx) => {
      const used = usedIndexes.has(idx);
      return (
        <motion.button
          key={idx}
          disabled={used}
          onClick={() => onTileClick(idx, value)}
          whileTap={{ scale: used ? 1 : 0.92 }}
          className={`aspect-square rounded-2xl border-2 text-2xl font-bold transition-all sm:text-3xl ${
            used
              ? 'border-white/10 bg-black/30 text-ui-textMuted opacity-40'
              : value >= 25
                ? 'border-game-leader bg-game-leader/15 text-white hover:brightness-110'
                : 'border-white/20 bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          {value}
        </motion.button>
      );
    })}
  </div>
);
