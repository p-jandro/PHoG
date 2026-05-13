import { motion, AnimatePresence } from 'framer-motion';
import { NumberTile } from './NumberTile';

export interface Tile { id: string; value: number; }

interface TilePoolProps {
  tiles: Tile[];
  /** Full original pool — anything in `tiles` is "available", anything missing is "used". */
  originalTiles?: Tile[];
  selectedId: string | null;
  pendingBId?: string | null;
  onTileClick: (id: string) => void;
  disabled?: boolean;
}

export const TilePool = ({
  tiles, originalTiles, selectedId, onTileClick, disabled,
}: TilePoolProps) => {
  // If we don't have the original pool, just render whatever is here.
  const slots = originalTiles ?? tiles;
  const aliveIds = new Set(tiles.map((t) => t.id));

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      <AnimatePresence>
        {slots.map((t) => {
          const isAlive = aliveIds.has(t.id);
          const state = !isAlive ? 'used' : selectedId === t.id ? 'selected' : 'idle';
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.4 }}
              transition={{ duration: 0.25 }}
            >
              <NumberTile
                value={t.value}
                state={state}
                disabled={disabled}
                onClick={() => onTileClick(t.id)}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
