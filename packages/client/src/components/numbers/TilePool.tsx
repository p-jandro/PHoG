import { motion, AnimatePresence } from 'framer-motion';

export interface Tile { id: string; value: number; }

interface TilePoolProps {
  tiles: Tile[];
  selectedId: string | null;     // the "a" operand awaiting an operator (or "b" if a+op already chosen)
  pendingBId?: string | null;    // not normally needed — we auto-execute on second tap
  onTileClick: (id: string) => void;
  disabled?: boolean;
}

export const TilePool = ({ tiles, selectedId, onTileClick, disabled }: TilePoolProps) => (
  <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
    <AnimatePresence>
      {tiles.map((t) => {
        const isSelected = selectedId === t.id;
        const big = t.value >= 25;
        const tone = isSelected
          ? 'border-game-leader bg-game-leader text-black ring-4 ring-game-leader/40'
          : big
            ? 'border-game-leader bg-game-leader/15 text-white hover:brightness-110'
            : 'border-white/20 bg-white/10 text-white hover:bg-white/20';
        return (
          <motion.button
            key={t.id}
            layout
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.25 }}
            disabled={disabled}
            onClick={() => onTileClick(t.id)}
            whileTap={{ scale: disabled ? 1 : 0.94 }}
            className={`flex h-16 w-16 items-center justify-center rounded-2xl border-2 text-2xl font-bold transition-all sm:h-20 sm:w-20 sm:text-3xl ${tone} disabled:opacity-50`}
          >
            {t.value}
          </motion.button>
        );
      })}
    </AnimatePresence>
  </div>
);
