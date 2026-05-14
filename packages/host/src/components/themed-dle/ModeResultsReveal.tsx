import { Fragment } from 'react';
import { motion } from 'framer-motion';
import { Card, LeaderboardRow, Chip } from '../../ui';

interface ModeResultsRevealProps {
  data: {
    mode: string;
    modeIndex: number;
    totalModes: number;
    target: any;
    results: Array<{ playerId: string; playerName: string; modeScore: number; cumulativeScore: number }>;
    cumulativeScores: Record<string, number>;
    isLastMode: boolean;
  };
}

const renderGridReveal = (target: any) => {
  if (!target?.cellAnswers || !target?.rows || !target?.cols) return null;
  return (
    <div
      className="grid w-full max-w-5xl gap-2"
      style={{ gridTemplateColumns: 'minmax(7rem, 1fr) repeat(3, minmax(0, 1fr))' }}
    >
      <div />
      {target.cols.map((c: string) => (
        <div
          key={c}
          className="flex items-center justify-center overflow-hidden rounded-2xl border-2 border-ink bg-ink p-2 text-center font-extrabold uppercase tracking-[0.08em] leading-tight text-bg-surface break-words"
          style={{ fontSize: 'clamp(0.7rem, 1.3vw, 1.1rem)' }}
        >
          {c}
        </div>
      ))}
      {target.rows.map((rowLabel: string, r: number) => (
        <Fragment key={rowLabel}>
          <div
            className="flex items-center justify-center overflow-hidden rounded-2xl border-2 border-ink bg-premium p-2 text-center font-extrabold uppercase tracking-[0.06em] leading-tight text-on-premium break-words"
            style={{ fontSize: 'clamp(0.7rem, 1.3vw, 1.1rem)' }}
          >
            {rowLabel}
          </div>
          {target.cols.map((_: string, c: number) => {
            const names: string[] = (target.cellAnswers[`${r},${c}`] || []).slice(0, 5);
            return (
              <div
                key={c}
                className="min-h-[5rem] rounded-2xl border-2 border-ink bg-bg-surface p-2 text-left text-xs leading-tight"
              >
                {names.length ? (
                  <ul className="space-y-0.5">
                    {names.map((n) => (
                      <li key={n} className="truncate font-semibold">{n}</li>
                    ))}
                    {(target.cellAnswers[`${r},${c}`] || []).length > 5 && (
                      <li className="text-ink-muted">+{(target.cellAnswers[`${r},${c}`] || []).length - 5} more</li>
                    )}
                  </ul>
                ) : (
                  <span className="text-ink-muted">—</span>
                )}
              </div>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
};

const renderTarget = (mode: string, target: any) => {
  if (!target) return null;
  if (mode === 'grid') return renderGridReveal(target);
  if (mode === 'spell') return (
    <>
      <p className="font-serif text-7xl font-bold text-premium">{target.incantation}</p>
      <p className="mt-2 text-2xl text-ink-muted">{target.effect}</p>
    </>
  );
  if (mode === 'silhouette') return (
    <div className="flex items-center gap-6">
      {target.spriteUrl && <img src={target.spriteUrl} alt={target.name} className="h-44 w-44 object-contain" />}
      <p className="font-serif text-7xl font-bold text-premium">{target.name}</p>
    </div>
  );
  return <p className="font-serif text-7xl font-bold text-premium">{target.name}</p>;
};

export const ModeResultsReveal = ({ data }: ModeResultsRevealProps) => {
  const sorted = [...data.results].sort((a, b) => b.cumulativeScore - a.cumulativeScore);
  const top = sorted.slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full flex-col items-center justify-center gap-10 px-12 text-center"
    >
      <Chip variant="streak">It was…</Chip>
      {renderTarget(data.mode, data.target)}

      <Card className="w-full max-w-3xl" eyebrow="Top of the standings">
        <ol className="space-y-2">
          {top.map((r, i) => (
            <LeaderboardRow
              key={r.playerId}
              rank={i + 1}
              name={r.playerName}
              score={r.cumulativeScore}
            />
          ))}
        </ol>
      </Card>

      {!data.isLastMode && <Chip variant="info">Next mode coming up</Chip>}
      {data.isLastMode  && <Chip variant="streak">Wrapping up</Chip>}
    </motion.div>
  );
};
