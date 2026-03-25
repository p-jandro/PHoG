import { motion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
import { PlacementLeaderboard } from '../components/PlacementLeaderboard';

export const FinalLeaderboard = () => {
  const { players, playerId } = useGameStore();

  // Check if all three games have been completed
  const allGamesComplete = players.some(p =>
    p.placements?.quiz && p.placements?.trueFalse && p.placements?.pointless
  );

  // Find player's rank
  const sortedPlayers = [...players].sort((a, b) => {
    if (!a.totalPlacementScore) return 1;
    if (!b.totalPlacementScore) return -1;
    return a.totalPlacementScore - b.totalPlacementScore;
  });

  const currentPlayer = sortedPlayers.find(p => p.id === playerId);
  const currentPlayerRank = currentPlayer ? sortedPlayers.indexOf(currentPlayer) + 1 : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 py-8 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-6xl w-full"
      >
        {/* Title */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 text-white">
            {allGamesComplete ? 'Final Results' : 'Current Standings'}
          </h1>
          <p className="text-xl sm:text-2xl text-ui-textMuted">
            {allGamesComplete ? 'PHoG Championship Complete!' : 'The tournament continues...'}
          </p>
        </motion.div>

        {/* Your placement */}
        {currentPlayerRank && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: 'spring' }}
            className="card p-8 mb-8 text-center"
          >
            <p className="text-xl text-ui-textMuted mb-2">Your Placement</p>
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 3
              }}
              className={`text-5xl sm:text-6xl md:text-7xl font-bold ${
                currentPlayerRank === 1 ? 'text-game-leader' :
                currentPlayerRank === 2 ? 'text-primary-blue' :
                currentPlayerRank === 3 ? 'text-primary-teal' :
                'text-primary-purple'
              }`}
            >
              {currentPlayerRank <= 3
                ? `${currentPlayerRank}${currentPlayerRank === 1 ? 'st' : currentPlayerRank === 2 ? 'nd' : 'rd'}`
                : `#${currentPlayerRank}`}
            </motion.div>
            <p className="text-2xl sm:text-3xl font-bold mt-4">
              {currentPlayerRank === 1 ? 'Leading the Pack!' :
               currentPlayerRank === 2 ? 'Close Second!' :
               currentPlayerRank === 3 ? 'In the Top 3!' :
               'Keep Pushing!'}
            </p>
            {currentPlayer?.totalPlacementScore && (
              <p className="text-lg sm:text-xl text-ui-textMuted mt-2">
                Total Placement Score: {currentPlayer.totalPlacementScore}
              </p>
            )}
          </motion.div>
        )}

        {/* Full leaderboard */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <PlacementLeaderboard players={players} showTotalPlacement={true} />
        </motion.div>

        {/* Explanation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="card p-6 mt-6 bg-ui-background"
        >
          <h3 className="text-xl font-bold mb-3">How Placement Scoring Works</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-ui-textMuted">
            <div>
              <p className="mb-2">
                <strong className="text-white">Golf Scoring System:</strong> Lower is better!
              </p>
              <p>
                • 1st place = 1 point<br />
                • 2nd place = 2 points<br />
                • 3rd place = 3 points<br />
                • etc.
              </p>
            </div>
            <div>
              <p className="mb-2">
                <strong className="text-white">Final Score:</strong> Sum of all placements
              </p>
              <p>
                Example: If you placed 1st in Quiz, 4th in True/False, and 6th in Pointless,
                your total would be 1 + 4 + 6 = <strong className="text-white">11 points</strong>.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Wait for next game */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-center mt-8 text-ui-textMuted"
        >
          <p>Waiting for host to start next round...</p>
        </motion.div>
      </motion.div>
    </div>
  );
};

