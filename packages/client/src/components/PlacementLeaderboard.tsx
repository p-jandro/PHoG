import { motion, useReducedMotion } from 'framer-motion';
import { Chip, LeaderboardRow } from '../ui';

type GameKey = 'quiz' | 'trueFalse' | 'countdown' | 'pointless';

interface Player {
  id: string;
  name: string;
  score: number;
  currentGameScore: number;
  totalPlacementScore: number;
  gamePlacements?: {
    quiz: number | null;
    trueFalse: number | null;
    countdown: number | null;
    pointless: number | null;
  };
  connected: boolean;
}

interface PlacementLeaderboardProps {
  players: Player[];
  showTotalPlacement?: boolean;
  currentGame?: GameKey | null;
  /** Optional: the current viewer's player id, so their row is highlighted. */
  selfId?: string | null;
}

const GAME_LABELS: Record<GameKey, string> = {
  quiz: 'Quiz',
  trueFalse: 'True/False',
  countdown: 'Countdown',
  pointless: 'Pointless',
};

const getGamePlacement = (player: Player, currentGame?: GameKey | null) => {
  if (!currentGame) return null;
  return player.gamePlacements?.[currentGame] ?? null;
};

export const PlacementLeaderboard = ({
  players,
  showTotalPlacement = false,
  currentGame = null,
  selfId = null,
}: PlacementLeaderboardProps) => {
  const reduced = useReducedMotion();
  const gameLabel = currentGame ? GAME_LABELS[currentGame] : 'Current Game';

  const sortedPlayers = [...players].sort((a, b) => {
    if (showTotalPlacement) {
      if ((a.totalPlacementScore || 0) === 0 && (b.totalPlacementScore || 0) === 0) return 0;
      if ((a.totalPlacementScore || 0) === 0) return 1;
      if ((b.totalPlacementScore || 0) === 0) return -1;
      return (a.totalPlacementScore || 0) - (b.totalPlacementScore || 0);
    }

    const aPlacement = getGamePlacement(a, currentGame);
    const bPlacement = getGamePlacement(b, currentGame);

    if (aPlacement === null && bPlacement === null) {
      return currentGame === 'pointless'
        ? (a.currentGameScore || 0) - (b.currentGameScore || 0)
        : (b.currentGameScore || 0) - (a.currentGameScore || 0);
    }
    if (aPlacement === null) return 1;
    if (bPlacement === null) return -1;
    if (aPlacement !== bPlacement) return aPlacement - bPlacement;
    return currentGame === 'pointless'
      ? (a.currentGameScore || 0) - (b.currentGameScore || 0)
      : (b.currentGameScore || 0) - (a.currentGameScore || 0);
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-streak">
            Scoreboard
          </p>
          <h2 className="text-3xl font-extrabold text-ink">
            {showTotalPlacement ? 'Final Standings' : `${gameLabel} Placements`}
          </h2>
        </div>
        <Chip variant={showTotalPlacement ? 'info' : 'muted'}>
          {showTotalPlacement ? 'Lower total placement leads' : 'This game only'}
        </Chip>
      </div>

      <div className="max-h-[600px] space-y-3 overflow-y-auto pr-1">
        {sortedPlayers.map((player, index) => {
          const gamePlacement = getGamePlacement(player, currentGame);
          const displayPlacement = showTotalPlacement ? index + 1 : gamePlacement;
          const rank = displayPlacement ?? index + 1;
          const score = showTotalPlacement
            ? player.totalPlacementScore || 0
            : player.currentGameScore;

          return (
            <motion.div
              key={player.id}
              layout={!reduced}
              transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
              className="space-y-2"
            >
              <LeaderboardRow
                rank={rank}
                name={player.name}
                score={score}
                isYou={selfId !== null && player.id === selfId}
              />
              {showTotalPlacement && (
                <div className="flex flex-wrap items-center gap-2 pl-12 text-xs">
                  {(['quiz', 'trueFalse', 'countdown', 'pointless'] as const).map((key) => {
                    const placement = player.gamePlacements?.[key];
                    return (
                      <Chip
                        key={key}
                        variant={placement && placement <= 3 ? 'now' : 'muted'}
                      >
                        {GAME_LABELS[key]}: {placement ?? '—'}
                      </Chip>
                    );
                  })}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
