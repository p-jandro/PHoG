import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, Chip } from '../../ui';
import { screenEnter } from '../../lib/motion';

interface ModeIntroProps {
  data: {
    theme: 'pokemon' | 'hp';
    mode: 'classic' | 'emoji' | 'silhouette' | 'spell' | 'grid';
    duration: number;
    endsAt: number;
    title: string;
    description: string;
    maxGuesses?: number;
    attributes?: string[];
  };
}

export const ModeIntro = ({ data }: ModeIntroProps) => {
  const [remaining, setRemaining] = useState(Math.max(0, data.endsAt - Date.now()));

  useEffect(() => {
    const i = setInterval(() => {
      setRemaining(Math.max(0, data.endsAt - Date.now()));
    }, 100);
    return () => clearInterval(i);
  }, [data.endsAt]);

  const progress = data.duration
    ? Math.max(0, Math.min(100, ((data.duration - remaining) / data.duration) * 100))
    : 0;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-base px-4 py-6">
      <motion.div
        variants={screenEnter}
        initial="hidden"
        animate="visible"
        className="w-full max-w-3xl"
      >
        <Card className="text-center space-y-5">
          <Chip variant="streak">{data.theme === 'pokemon' ? 'Pokédle' : 'HP-dle'}</Chip>
          <h1 className="font-serif font-bold text-5xl md:text-6xl text-ink tracking-tight">{data.title}</h1>
          <p className="text-xl text-ink-muted">{data.description}</p>

          {data.attributes && (
            <div className="flex flex-wrap justify-center gap-2">
              {data.attributes.map((a) => (
                <Chip key={a} variant="info">{a}</Chip>
              ))}
            </div>
          )}
          {data.maxGuesses !== undefined && (
            <div className="flex justify-center">
              <Chip variant="muted">{data.maxGuesses} guesses</Chip>
            </div>
          )}

          <div className="mx-auto w-full max-w-md overflow-hidden rounded-full border-2 border-ink bg-bg-sunken shadow-ink-sm" style={{ height: 8 }}>
            <div className="h-full bg-streak" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-sm text-ink-muted">Starting in {Math.ceil(remaining / 1000)}s…</p>
        </Card>
      </motion.div>
    </div>
  );
};
