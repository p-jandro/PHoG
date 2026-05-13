import { motion } from 'framer-motion';
import { Chip } from '../../ui';

interface ModeIntroSplashProps {
  data: {
    theme: 'pokemon' | 'hp';
    mode: string;
    title: string;
    description: string;
    attributes?: string[];
    maxGuesses?: number;
    duration: number;
    endsAt: number;
  };
}

export const ModeIntroSplash = ({ data }: ModeIntroSplashProps) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
    className="flex h-full w-full flex-col items-center justify-center gap-6 rounded-3xl border-2 border-ink bg-premium px-12 py-16 text-center shadow-ink-lg"
  >
    <Chip variant="streak">{data.theme === 'pokemon' ? 'Pokédle' : 'HP-dle'}</Chip>
    <h1 className="font-serif text-8xl font-bold tracking-tight text-on-premium">{data.title}</h1>
    <p className="max-w-3xl text-3xl text-on-premium/85">{data.description}</p>
    {data.attributes && (
      <div className="flex flex-wrap justify-center gap-3">
        {data.attributes.map((a) => (
          <Chip key={a} variant="now">{a}</Chip>
        ))}
      </div>
    )}
    {data.maxGuesses !== undefined && (
      <Chip variant="muted">{data.maxGuesses} guesses each</Chip>
    )}
  </motion.div>
);
