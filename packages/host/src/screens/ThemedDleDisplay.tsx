import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { ModeIntroSplash } from '../components/themed-dle/ModeIntroSplash';
import { ModeResultsReveal } from '../components/themed-dle/ModeResultsReveal';
import { PlayerProgressPanel } from '../components/themed-dle/PlayerProgressPanel';
import { HostClassicView } from '../components/themed-dle/HostClassicView';
import { HostEmojiView } from '../components/themed-dle/HostEmojiView';
import { HostSilhouetteView } from '../components/themed-dle/HostSilhouetteView';
import { HostSpellView } from '../components/themed-dle/HostSpellView';
import { HostGridView } from '../components/themed-dle/HostGridView';

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

  const maxGuess = Math.max(0, ...Object.values(progress).map((p: any) => p.guessCount ?? 0));
  const minGuess = Object.keys(progress).length > 0
    ? Math.min(...Object.values(progress).map((p: any) => p.guessCount ?? 0))
    : 0;
  const emojiRevealCount = Math.min(5, 1 + maxGuess);
  const hintsUnlocked = Math.min(3, maxGuess);

  return (
    <div className="flex h-screen w-screen gap-8 px-12 py-10">
      <main className="flex flex-1 flex-col">
        <header className="mb-6">
          <p className="eyebrow">{theme === 'pokemon' ? 'Pokédle' : 'HP-dle'} · {mode}</p>
        </header>
        <div className="flex-1 rounded-3xl border border-white/10 bg-black/30 p-8">
          {mode === 'classic' && <HostClassicView attributes={(introData?.attributes) || []} />}
          {mode === 'emoji'   && <HostEmojiView initialEmojis={playData.emojis || []} maxRevealed={emojiRevealCount} />}
          {mode === 'silhouette' && <HostSilhouetteView spriteUrl={playData.spriteUrl} stage={minGuess} />}
          {mode === 'spell'   && <HostSpellView effect={playData.effect} category={playData.category} incantationLength={playData.incantationLength} hintsUnlocked={hintsUnlocked} />}
          {mode === 'grid'    && <HostGridView rows={playData.rows || []} cols={playData.cols || []} />}
        </div>
      </main>
      <PlayerProgressPanel mode={mode} players={players} progress={progress} maxGuesses={playData.maxGuesses || undefined} />
    </div>
  );
};
