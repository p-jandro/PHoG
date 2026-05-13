import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';

type GameKey = 'quiz' | 'trueFalse' | 'countdown' | 'pointless' | 'pokedle' | 'hpdle' | 'numbers';
const CHAMPIONSHIP_PREVIEW_DELAY = 5000;

const GAME_LABELS: Record<GameKey, string> = {
  quiz: 'Quiz',
  trueFalse: 'True/False',
  countdown: 'Countdown',
  pointless: 'Pointless',
  pokedle: 'Pokédle',
  hpdle: 'HP-dle',
  numbers: 'Numbers'
};

const getOrdinalLabel = (value: number | null | undefined) => {
  if (!value || value <= 0) {
    return '-';
  }

  if (value % 10 === 1 && value % 100 !== 11) return `${value}st`;
  if (value % 10 === 2 && value % 100 !== 12) return `${value}nd`;
  if (value % 10 === 3 && value % 100 !== 13) return `${value}rd`;
  return `${value}th`;
};

export const FinalLeaderboard = () => {
  const { players, playerId, phase, currentGame } = useGameStore();
  const activeGame = currentGame as GameKey | null;
  const [showChampionshipPreview, setShowChampionshipPreview] = useState(false);

  useEffect(() => {
    if (phase === 'finished') {
      setShowChampionshipPreview(true);
      return;
    }

    if (phase !== 'leaderboard') {
      setShowChampionshipPreview(false);
      return;
    }

    setShowChampionshipPreview(false);
    const timeoutId = setTimeout(() => {
      setShowChampionshipPreview(true);
    }, CHAMPIONSHIP_PREVIEW_DELAY);

    return () => clearTimeout(timeoutId);
  }, [phase, currentGame]);

  const currentPlayer = players.find((player) => player.id === playerId) || null;
  const showTotalPlacement = phase === 'finished' || showChampionshipPreview;
  const activeGameLabel = activeGame ? GAME_LABELS[activeGame] : 'Current Game';

  const championshipSortedPlayers = [...players].sort((a, b) => {
    if (!a.totalPlacementScore) return 1;
    if (!b.totalPlacementScore) return -1;
    return a.totalPlacementScore - b.totalPlacementScore;
  });
  const championshipRank = currentPlayer
    ? championshipSortedPlayers.findIndex((player) => player.id === playerId) + 1
    : null;
  const currentGamePlacement = activeGame ? currentPlayer?.gamePlacements?.[activeGame] ?? null : null;

  const placementSummary = [
    { label: 'Quiz', value: currentPlayer?.gamePlacements?.quiz ?? null },
    { label: 'True/False', value: currentPlayer?.gamePlacements?.trueFalse ?? null },
    { label: 'Pointless', value: currentPlayer?.gamePlacements?.pointless ?? null },
    { label: 'Pokédle', value: currentPlayer?.gamePlacements?.pokedle ?? null },
    { label: 'HP-dle', value: currentPlayer?.gamePlacements?.hpdle ?? null },
    { label: 'Numbers', value: currentPlayer?.gamePlacements?.numbers ?? null },
    { label: 'Overall', value: championshipRank || null }
  ];

  return (
    <div className="screen-shell overflow-y-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="screen-frame max-w-4xl space-y-5 py-6"
      >
        <motion.div
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="card p-7 sm:p-9"
        >
          <div className="max-w-2xl">
              <p className="eyebrow mb-3">
                {phase === 'finished' ? 'Session Complete' : showTotalPlacement ? 'Championship Snapshot' : 'Game Complete'}
              </p>
              <h1 className="text-4xl font-bold sm:text-5xl">
                {showTotalPlacement ? 'Your Championship Standing' : `Your ${activeGameLabel} Result`}
              </h1>
              <p className="mt-3 text-base leading-relaxed text-ui-textMuted sm:text-lg">
                The full table is on the house display.
              </p>
          </div>
        </motion.div>

        {showTotalPlacement ? (
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="card p-7 sm:p-8"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {placementSummary.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[1.35rem] border border-ui-border/80 bg-black/20 p-5 text-center"
                >
                  <p className="section-label mb-2">{item.label}</p>
                  <p className="text-4xl font-semibold tabular-nums text-white sm:text-5xl">
                    {item.value ? getOrdinalLabel(item.value) : '-'}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="card p-7 text-center sm:p-8">
              <p className="section-label mb-2">Place</p>
              <p className="text-5xl font-bold text-white sm:text-6xl">
                {currentGamePlacement ? getOrdinalLabel(currentGamePlacement) : '-'}
              </p>
            </div>
            <div className="card p-7 text-center sm:p-8">
              <p className="section-label mb-2">Score</p>
              <p className="text-5xl font-bold text-white sm:text-6xl tabular-nums">
                {currentPlayer?.currentGameScore ?? '-'}
              </p>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
