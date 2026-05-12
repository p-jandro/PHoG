import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { ModeIntroSplash } from '../components/themed-dle/ModeIntroSplash';
import { ModeResultsReveal } from '../components/themed-dle/ModeResultsReveal';
import { PlayerProgressPanel } from '../components/themed-dle/PlayerProgressPanel';

interface Player { id: string; name: string; connected: boolean; }

interface ThemedDleDisplayProps {
  socket: Socket | null;
  currentGame: 'pokedle' | 'hpdle';
  players: Player[];
}

type Phase = 'intro' | 'playing' | 'results';
type Mode = 'classic' | 'emoji' | 'silhouette' | 'spell' | 'grid';

export const ThemedDleDisplay = ({ socket, currentGame, players }: ThemedDleDisplayProps) => {
  const theme: 'pokemon' | 'hp' = currentGame === 'pokedle' ? 'pokemon' : 'hp';
  const [phase, setPhase] = useState<Phase>('intro');
  const [mode, setMode] = useState<Mode>('classic');
  const [introData, setIntroData] = useState<any>(null);
  const [playData, setPlayData] = useState<any>(null);
  const [resultsData, setResultsData] = useState<any>(null);
  const [progress, setProgress] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!socket) return;
    const prefix = currentGame;
    const onIntro = (d: any) => { setPhase('intro'); setIntroData(d); setMode(d.mode); setProgress({}); };
    const onPlay  = (d: any) => { setPhase('playing'); setPlayData(d); setMode(d.mode); };
    const onProg  = (d: any) => { setProgress(d.playerProgress || {}); };
    const onRes   = (d: any) => { setPhase('results'); setResultsData(d); };

    socket.on(`${prefix}:intro`, onIntro);
    socket.on(`${prefix}:playing:start`, onPlay);
    socket.on(`${prefix}:progress`, onProg);
    socket.on(`${prefix}:mode:results`, onRes);

    return () => {
      socket.off(`${prefix}:intro`, onIntro);
      socket.off(`${prefix}:playing:start`, onPlay);
      socket.off(`${prefix}:progress`, onProg);
      socket.off(`${prefix}:mode:results`, onRes);
    };
  }, [socket, currentGame]);

  if (phase === 'intro' && introData) return (
    <div className="h-screen w-screen px-16 py-20">
      <ModeIntroSplash data={introData} />
    </div>
  );

  if (phase === 'results' && resultsData) return (
    <div className="h-screen w-screen px-16 py-20">
      <ModeResultsReveal data={resultsData} />
    </div>
  );

  if (phase !== 'playing' || !playData) {
    return <div className="flex h-screen w-screen items-center justify-center text-2xl">Loading…</div>;
  }

  return (
    <div className="flex h-screen w-screen gap-8 px-12 py-10">
      <main className="flex flex-1 flex-col">
        <header className="mb-6">
          <p className="eyebrow">{theme === 'pokemon' ? 'Pokédle' : 'HP-dle'} · {mode}</p>
          <h1 className="text-4xl font-bold">{playData.title || mode}</h1>
        </header>
        <div className="flex-1 rounded-3xl border border-white/10 bg-black/30 p-8">
          <p className="text-center text-2xl text-ui-textMuted">Mode {mode} display coming…</p>
        </div>
      </main>
      <PlayerProgressPanel
        mode={mode}
        players={players}
        progress={progress}
        maxGuesses={playData.maxGuesses || undefined}
      />
    </div>
  );
};
