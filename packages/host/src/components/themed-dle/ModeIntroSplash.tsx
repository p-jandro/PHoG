import { motion } from 'framer-motion';

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
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
    className="flex h-full flex-col items-center justify-center text-center">
    <p className="eyebrow text-2xl">{data.theme === 'pokemon' ? 'Pokédle' : 'HP-dle'}</p>
    <h1 className="mt-3 text-8xl font-bold text-game-leader">{data.title}</h1>
    <p className="mt-5 max-w-3xl text-3xl text-white">{data.description}</p>
    {data.attributes && (
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {data.attributes.map((a) => (
          <span key={a} className="rounded-full bg-white/10 px-4 py-2 text-lg">{a}</span>
        ))}
      </div>
    )}
    {data.maxGuesses !== undefined && (
      <p className="mt-5 text-xl text-ui-textMuted">{data.maxGuesses} guesses each</p>
    )}
  </motion.div>
);
