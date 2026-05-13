import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
import { Card, Chip } from '../ui';
import { screenEnter, reducedFade, stagger } from '../lib/motion';
import { Confetti } from '../components/Confetti';

type GameKey =
  | 'quiz'
  | 'trueFalse'
  | 'countdown'
  | 'pointless'
  | 'pokedle'
  | 'hpdle'
  | 'numbers'
  | 'wordle'
  | 'travel';

const CHAMPIONSHIP_PREVIEW_DELAY = 5000;

const GAME_LABELS: Record<GameKey, string> = {
  quiz: 'Quiz',
  trueFalse: 'True/False',
  countdown: 'Countdown',
  pointless: 'Pointless',
  pokedle: 'Pokédle',
  hpdle: 'HP-dle',
  numbers: 'Numbers',
  wordle: 'Wordle',
  travel: 'Travel',
};

const getOrdinalLabel = (value: number | null | undefined) => {
  if (!value || value <= 0) return '-';
  if (value % 10 === 1 && value % 100 !== 11) return `${value}st`;
  if (value % 10 === 2 && value % 100 !== 12) return `${value}nd`;
  if (value % 10 === 3 && value % 100 !== 13) return `${value}rd`;
  return `${value}th`;
};

export const FinalLeaderboard = () => {
  const { players, playerId, phase, currentGame } = useGameStore();
  const activeGame = currentGame as GameKey | null;
  const reduced = useReducedMotion();
  const enterVariants = reduced ? reducedFade : screenEnter;

  const [showChampionshipPreview, setShowChampionshipPreview] = useState(false);
  const [confettiArmed, setConfettiArmed] = useState(false);

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
    const t = setTimeout(() => setShowChampionshipPreview(true), CHAMPIONSHIP_PREVIEW_DELAY);
    return () => clearTimeout(t);
  }, [phase, currentGame]);

  const currentPlayer = players.find((p) => p.id === playerId) || null;
  const showTotalPlacement = phase === 'finished' || showChampionshipPreview;
  const activeGameLabel = activeGame ? GAME_LABELS[activeGame] : 'Current Game';

  const championshipSortedPlayers = [...players].sort((a, b) => {
    if (!a.totalPlacementScore) return 1;
    if (!b.totalPlacementScore) return -1;
    return a.totalPlacementScore - b.totalPlacementScore;
  });
  const championshipRank = currentPlayer
    ? championshipSortedPlayers.findIndex((p) => p.id === playerId) + 1
    : null;
  const currentGamePlacement = activeGame
    ? currentPlayer?.gamePlacements?.[activeGame] ?? null
    : null;

  const placementSummary: { label: string; value: number | null }[] = [
    { label: 'Quiz', value: currentPlayer?.gamePlacements?.quiz ?? null },
    { label: 'True/False', value: currentPlayer?.gamePlacements?.trueFalse ?? null },
    { label: 'Pointless', value: currentPlayer?.gamePlacements?.pointless ?? null },
    { label: 'Pokédle', value: currentPlayer?.gamePlacements?.pokedle ?? null },
    { label: 'HP-dle', value: currentPlayer?.gamePlacements?.hpdle ?? null },
    { label: 'Numbers', value: currentPlayer?.gamePlacements?.numbers ?? null },
    { label: 'Wordle', value: currentPlayer?.gamePlacements?.wordle ?? null },
    { label: 'Travel', value: currentPlayer?.gamePlacements?.travel ?? null },
    { label: 'Overall', value: championshipRank || null },
  ];

  useEffect(() => {
    if (!showTotalPlacement) {
      setConfettiArmed(false);
      return;
    }
    if (championshipRank === 1) {
      // Fire after the bottom-up reveal lands on rank 1 (~5 ranks × stagger.rank seconds).
      const totalRevealMs = Math.min(placementSummary.length, 5) * stagger.rank * 1000;
      const t = setTimeout(() => setConfettiArmed(true), totalRevealMs);
      return () => clearTimeout(t);
    }
  }, [showTotalPlacement, championshipRank, placementSummary.length]);

  const eyebrow =
    phase === 'finished'
      ? 'Session Complete'
      : showTotalPlacement
        ? 'Championship Snapshot'
        : 'Game Complete';
  const headline = showTotalPlacement
    ? 'Your Championship Standing'
    : `Your ${activeGameLabel} Result`;

  return (
    <div className="screen-shell overflow-y-auto">
      <motion.div
        variants={enterVariants}
        initial="hidden"
        animate="visible"
        className="screen-frame max-w-4xl space-y-5 py-6"
      >
        <Card eyebrow={eyebrow} title={<span className="font-serif text-4xl sm:text-5xl">{headline}</span>}>
          <div className="flex flex-col gap-3">
            <p className="text-base leading-relaxed text-ink-muted sm:text-lg">
              The full table is on the house display.
            </p>
            <Chip variant="info">
              {phase === 'finished' ? 'Championship over' : 'Live results'}
            </Chip>
          </div>
        </Card>

        {showTotalPlacement ? (
          <Card title="Placements by game">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {placementSummary.map((item, index) => {
                const isOverall = item.label === 'Overall';
                const isTopThree =
                  typeof item.value === 'number' && item.value > 0 && item.value <= 3;
                // Bottom-up: the visually last item animates first.
                const revealIndex = placementSummary.length - 1 - index;
                return (
                  <motion.div
                    key={item.label}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
                    animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      delay: revealIndex * stagger.rank,
                      duration: reduced ? 0.18 : 0.55,
                      ease: [0.34, 1.56, 0.64, 1],
                    }}
                    className={[
                      'rounded-2xl border-2 border-ink p-5 text-center shadow-ink',
                      isOverall
                        ? 'bg-premium text-on-premium'
                        : isTopThree
                          ? 'bg-now text-on-now'
                          : 'bg-bg-surface text-ink',
                    ].join(' ')}
                  >
                    <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em]">
                      {item.label}
                    </p>
                    <p className="font-display text-4xl font-black leading-none tracking-tighter tabular-nums sm:text-5xl">
                      {item.value ? getOrdinalLabel(item.value) : '-'}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Card title="Place">
              <p className="text-center font-display text-5xl font-black leading-none tracking-tighter text-ink sm:text-6xl">
                {currentGamePlacement ? getOrdinalLabel(currentGamePlacement) : '-'}
              </p>
            </Card>
            <Card title="Score">
              <p className="text-center font-display text-5xl font-black leading-none tracking-tighter tabular-nums text-ink sm:text-6xl">
                {currentPlayer?.currentGameScore ?? '-'}
              </p>
            </Card>
          </div>
        )}
      </motion.div>
      <Confetti show={confettiArmed} />
    </div>
  );
};
