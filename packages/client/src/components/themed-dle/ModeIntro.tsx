import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

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
    <div className="screen-shell flex flex-col items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="screen-frame max-w-3xl text-center space-y-5"
      >
        <p className="eyebrow">{data.theme === 'pokemon' ? 'Pokédle' : 'HP-dle'}</p>
        <h1 className="text-5xl font-bold text-game-leader">{data.title}</h1>
        <p className="text-xl text-ui-textMuted">{data.description}</p>

        {data.attributes && (
          <div className="flex flex-wrap justify-center gap-2">
            {data.attributes.map((a) => (
              <span key={a} className="status-pill">{a}</span>
            ))}
          </div>
        )}
        {data.maxGuesses !== undefined && (
          <p className="text-base text-ui-textMuted">{data.maxGuesses} guesses</p>
        )}

        <div className="mx-auto h-2 w-full max-w-md overflow-hidden rounded-full bg-gray-700">
          <motion.div className="h-full bg-game-accent" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-sm text-ui-textMuted">Starting in {Math.ceil(remaining / 1000)}s…</p>
      </motion.div>
    </div>
  );
};
