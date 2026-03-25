import { motion } from 'framer-motion';

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
}

const MedalBadge = ({ placement }: { placement: number }) => {
  if (placement === 1) return (
    <span className="w-10 h-10 rounded-full bg-medal-gold text-black font-bold flex items-center justify-center text-lg">1</span>
  );
  if (placement === 2) return (
    <span className="w-10 h-10 rounded-full bg-medal-silver text-black font-bold flex items-center justify-center text-lg">2</span>
  );
  if (placement === 3) return (
    <span className="w-10 h-10 rounded-full bg-medal-bronze text-white font-bold flex items-center justify-center text-lg">3</span>
  );
  return null;
};

export const PlacementLeaderboard = ({ players, showTotalPlacement = false }: PlacementLeaderboardProps) => {
  // Sort players by total placement if available (lower is better)
  const sortedPlayers = [...players].sort((a, b) => {
    if (showTotalPlacement) {
      if ((a.totalPlacementScore || 0) === 0 && (b.totalPlacementScore || 0) === 0) return 0;
      if ((a.totalPlacementScore || 0) === 0) return 1;
      if ((b.totalPlacementScore || 0) === 0) return -1;
      return (a.totalPlacementScore || 0) - (b.totalPlacementScore || 0);
    }
    return (b.currentGameScore || 0) - (a.currentGameScore || 0);
  });

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">
          {showTotalPlacement ? 'Final Standings' : 'Current Standings'}
        </h2>
        {showTotalPlacement && (
          <p className="text-sm text-ui-textMuted">
            Lower total placement = Better! (Golf scoring)
          </p>
        )}
      </div>

      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
        {sortedPlayers.map((player, index) => (
          <motion.div
            key={player.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`bg-ui-card border rounded-2xl p-4 transition-all duration-300
              ${index < 3 && showTotalPlacement
                ? 'border-ui-border/50 shadow-lg'
                : 'border-ui-border/30 hover:border-ui-border/50'
              }`}
          >
            <div className="flex items-center gap-4">
              {/* Rank */}
              <div className="flex-shrink-0 w-16 flex justify-center">
                {index < 3 ? (
                  <MedalBadge placement={index + 1} />
                ) : (
                  <span className="text-2xl font-bold text-ui-textMuted">#{index + 1}</span>
                )}
              </div>

              {/* Player name */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    player.connected ? 'bg-game-correct' : 'bg-ui-textMuted'
                  }`} />
                  <span className="font-semibold text-lg truncate">{player.name}</span>
                </div>
              </div>

              {/* Scores/Placements */}
              {showTotalPlacement ? (
                <div className="flex items-center gap-3">
                  {/* Game placements */}
                  <div className="hidden sm:flex items-center gap-2 text-sm">
                    <div className="text-center px-2">
                      <div className="text-xs text-ui-textMuted mb-0.5">Quiz</div>
                      <div className={player.gamePlacements?.quiz && player.gamePlacements.quiz <= 3 ? 'font-bold text-primary-blue' : ''}>
                        {player.gamePlacements?.quiz || '-'}
                      </div>
                    </div>
                    <div className="text-center px-2">
                      <div className="text-xs text-ui-textMuted mb-0.5">T/F</div>
                      <div className={player.gamePlacements?.trueFalse && player.gamePlacements.trueFalse <= 3 ? 'font-bold text-primary-teal' : ''}>
                        {player.gamePlacements?.trueFalse || '-'}
                      </div>
                    </div>
                    <div className="text-center px-2">
                      <div className="text-xs text-ui-textMuted mb-0.5">PTL</div>
                      <div className={player.gamePlacements?.pointless && player.gamePlacements.pointless <= 3 ? 'font-bold text-primary-purple' : ''}>
                        {player.gamePlacements?.pointless || '-'}
                      </div>
                    </div>
                  </div>

                  {/* Total placement */}
                  <div className="text-center px-4 py-2 bg-ui-background/50 rounded-xl min-w-[4rem]">
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
                <div className="text-right px-4 py-2 bg-ui-background/50 rounded-xl min-w-[5rem]">
                  <span className={`font-bold text-xl ${
                    index === 0 ? 'text-game-leader' : 'text-primary-teal'
                  }`}>
                    {player.currentGameScore}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

