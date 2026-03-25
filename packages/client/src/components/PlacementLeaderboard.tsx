import { motion } from 'framer-motion';

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
}

const GAME_LABELS: Record<GameKey, string> = {
  quiz: 'Quiz',
  trueFalse: 'True/False',
  countdown: 'Countdown',
  pointless: 'Pointless'
};

const MedalBadge = ({ placement }: { placement: number }) => {
  if (placement === 1) return (
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-medal-gold text-black font-bold text-lg shadow-[0_10px_24px_rgba(0,0,0,0.18)]">1</span>
  );
  if (placement === 2) return (
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-medal-silver text-black font-bold text-lg shadow-[0_10px_24px_rgba(0,0,0,0.18)]">2</span>
  );
  if (placement === 3) return (
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-medal-bronze text-white font-bold text-lg shadow-[0_10px_24px_rgba(0,0,0,0.18)]">3</span>
  );
  return null;
};

const getGamePlacement = (player: Player, currentGame?: GameKey | null) => {
  if (!currentGame) {
    return null;
  }

  return player.gamePlacements?.[currentGame] ?? null;
};

export const PlacementLeaderboard = ({
  players,
  showTotalPlacement = false,
  currentGame = null
}: PlacementLeaderboardProps) => {
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
          <p className="eyebrow mb-2">Scoreboard</p>
          <h2 className="text-3xl font-bold">
            {showTotalPlacement ? 'Final Standings' : `${gameLabel} Placements`}
          </h2>
        </div>
        <span className="status-pill">
          {showTotalPlacement ? 'Lower total placement leads' : 'This game only'}
        </span>
      </div>

      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
        {sortedPlayers.map((player, index) => (
          (() => {
            const gamePlacement = getGamePlacement(player, currentGame);
            const highlighted = showTotalPlacement
              ? index < 3
              : gamePlacement !== null && gamePlacement <= 3;
            const displayPlacement = showTotalPlacement ? index + 1 : gamePlacement;

            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`rounded-[1.7rem] border px-4 py-4 transition-all duration-300 ${
                  highlighted
                    ? 'border-white/10 bg-white/[0.06] shadow-[0_18px_35px_rgba(0,0,0,0.25)]'
                    : 'border-ui-border/80 bg-black/20'
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  <div className="flex w-16 flex-shrink-0 justify-center">
                    {displayPlacement !== null && displayPlacement <= 3 ? (
                      <MedalBadge placement={displayPlacement} />
                    ) : displayPlacement ? (
                      <span className="text-2xl font-bold text-ui-textMuted">#{displayPlacement}</span>
                    ) : (
                      <span className="text-2xl font-bold text-ui-textMuted">-</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                        player.connected ? 'bg-game-correct' : 'bg-ui-textMuted'
                      }`} />
                      <span className="truncate text-lg font-semibold">{player.name}</span>
                    </div>
                    <p className="mt-1 text-sm text-ui-textMuted">
                      {showTotalPlacement
                        ? 'Tournament placement table'
                        : `${gameLabel} result`}
                    </p>
                  </div>

                  {showTotalPlacement ? (
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="rounded-2xl border border-ui-border/70 bg-black/15 px-3 py-2 text-center">
                          <div className="mb-0.5 text-[0.68rem] uppercase tracking-[0.18em] text-ui-textMuted">Quiz</div>
                          <div className={player.gamePlacements?.quiz && player.gamePlacements.quiz <= 3 ? 'font-bold text-primary-blue' : ''}>
                            {player.gamePlacements?.quiz || '-'}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-ui-border/70 bg-black/15 px-3 py-2 text-center">
                          <div className="mb-0.5 text-[0.68rem] uppercase tracking-[0.18em] text-ui-textMuted">T/F</div>
                          <div className={player.gamePlacements?.trueFalse && player.gamePlacements.trueFalse <= 3 ? 'font-bold text-primary-teal' : ''}>
                            {player.gamePlacements?.trueFalse || '-'}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-ui-border/70 bg-black/15 px-3 py-2 text-center">
                          <div className="mb-0.5 text-[0.68rem] uppercase tracking-[0.18em] text-ui-textMuted">PTL</div>
                          <div className={player.gamePlacements?.pointless && player.gamePlacements.pointless <= 3 ? 'font-bold text-primary-purple' : ''}>
                            {player.gamePlacements?.pointless || '-'}
                          </div>
                        </div>
                      </div>

                      <div className="w-full rounded-[1.25rem] border border-white/10 bg-white/[0.05] px-4 py-3 text-center sm:w-auto sm:min-w-[5.5rem]">
                        <div className="mb-1 text-[0.68rem] uppercase tracking-[0.18em] text-ui-textMuted">Total</div>
                        {player.totalPlacementScore && player.totalPlacementScore > 0 ? (
                          <span className={`font-bold text-2xl ${
                            index === 0 ? 'text-game-leader' :
                            index === 1 ? 'text-primary-blue' :
                            index === 2 ? 'text-primary-teal' :
                            'text-white'
                          }`}>
                            {player.totalPlacementScore}
                          </span>
                        ) : (
                          <span className="text-ui-textMuted">-</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="w-full rounded-[1.25rem] border border-white/10 bg-white/[0.05] px-4 py-3 text-center sm:w-auto sm:min-w-[6rem]">
                        <div className="mb-1 text-[0.68rem] uppercase tracking-[0.18em] text-ui-textMuted">Place</div>
                        <span className={`font-bold text-2xl ${
                          gamePlacement === 1 ? 'text-game-leader' :
                          gamePlacement === 2 ? 'text-primary-blue' :
                          gamePlacement === 3 ? 'text-primary-teal' :
                          'text-white'
                        }`}>
                          {gamePlacement || '-'}
                        </span>
                      </div>

                      <div className="w-full rounded-[1.25rem] border border-white/10 bg-white/[0.05] px-4 py-3 text-center sm:w-auto sm:min-w-[6rem] sm:text-right">
                        <div className="mb-1 text-[0.68rem] uppercase tracking-[0.18em] text-ui-textMuted">Score</div>
                        <span className={`font-bold text-xl ${
                          gamePlacement === 1 ? 'text-game-leader' : 'text-primary-teal'
                        }`}>
                          {player.currentGameScore}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })()
        ))}
      </div>
    </div>
  );
};
