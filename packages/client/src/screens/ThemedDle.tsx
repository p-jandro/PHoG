import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import { ModeIntro } from '../components/themed-dle/ModeIntro';
import { ModeResults } from '../components/themed-dle/ModeResults';
import { CumulativeScoreBar } from '../components/themed-dle/CumulativeScoreBar';
import { ClassicMatrix } from '../components/themed-dle/ClassicMatrix';
import { EmojiClue } from '../components/themed-dle/EmojiClue';
import { Silhouette } from '../components/themed-dle/Silhouette';
import { SpellHint } from '../components/themed-dle/SpellHint';
import { Grid3x3 } from '../components/themed-dle/Grid3x3';
import { Card, Chip } from '../ui';

type Phase = 'intro' | 'playing' | 'results';
type Mode = 'classic' | 'emoji' | 'silhouette' | 'spell' | 'grid';

interface ThemedDleProps {
  socket: Socket | null;
}

export const ThemedDle = ({ socket }: ThemedDleProps) => {
  const { currentGame, playerId } = useGameStore();
  const gamePrefix = currentGame as 'pokedle' | 'hpdle';
  const theme: 'pokemon' | 'hp' = currentGame === 'pokedle' ? 'pokemon' : 'hp';

  const [phase, setPhase] = useState<Phase>('intro');
  const [mode, setMode] = useState<Mode>('classic');
  const [introData, setIntroData] = useState<any>(null);
  const [playData, setPlayData] = useState<any>(null);
  const [resultsData, setResultsData] = useState<any>(null);
  const [guessEvents, setGuessEvents] = useState<any[]>([]);
  const [cellEvents, setCellEvents] = useState<any[]>([]);
  const [cumulative, setCumulative] = useState(0);
  const [timerMs, setTimerMs] = useState(0);
  const [totalMs, setTotalMs] = useState(0);
  const [invalidToast, setInvalidToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drive the playing-phase timer
  useEffect(() => {
    if (phase !== 'playing' || !playData?.endsAt) return;
    const tick = () => {
      const remaining = Math.max(0, playData.endsAt - Date.now());
      setTimerMs(remaining);
    };
    tick();
    const i = setInterval(tick, 100);
    return () => clearInterval(i);
  }, [phase, playData]);

  useEffect(() => {
    if (!socket || !gamePrefix) return;

    const onIntro = (d: any) => {
      setPhase('intro');
      setIntroData(d);
      setMode(d.mode);
      setGuessEvents([]);
      setCellEvents([]);
      setInvalidToast(null);
    };
    const onPlay = (d: any) => {
      setPhase('playing');
      setPlayData(d);
      setMode(d.mode);
      setTotalMs(d.duration || 0);
      setTimerMs(Math.max(0, (d.endsAt || Date.now()) - Date.now()));
    };
    const onGuessResult = (d: any) => setGuessEvents((prev) => [...prev, d]);
    const onCellResult = (d: any) => setCellEvents((prev) => [...prev, d]);
    const onInvalid = (d: any) => {
      const msg = d.reason === 'duplicate' ? `"${d.name ?? 'Unknown'}" already used` : `"${d.name ?? 'Unknown'}" not in roster`;
      setInvalidToast(msg);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => {
        setInvalidToast(null);
        toastTimeoutRef.current = null;
      }, 2500);
    };
    const onResults = (d: any) => {
      setPhase('results');
      setResultsData(d);
      const me = d.results.find((r: any) => r.playerId === playerId);
      if (me) setCumulative(me.cumulativeScore);
    };

    socket.on(`${gamePrefix}:intro`, onIntro);
    socket.on(`${gamePrefix}:playing:start`, onPlay);
    socket.on(`${gamePrefix}:guess:result`, onGuessResult);
    socket.on(`${gamePrefix}:grid:cell:result`, onCellResult);
    socket.on(`${gamePrefix}:guess:invalid`, onInvalid);
    socket.on(`${gamePrefix}:mode:results`, onResults);

    return () => {
      socket.off(`${gamePrefix}:intro`, onIntro);
      socket.off(`${gamePrefix}:playing:start`, onPlay);
      socket.off(`${gamePrefix}:guess:result`, onGuessResult);
      socket.off(`${gamePrefix}:grid:cell:result`, onCellResult);
      socket.off(`${gamePrefix}:guess:invalid`, onInvalid);
      socket.off(`${gamePrefix}:mode:results`, onResults);
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
      }
    };
  }, [socket, gamePrefix, playerId]);

  const submit = (payload: any) => socket?.emit('themedDle:guess', payload);

  if (phase === 'intro' && introData) return <ModeIntro data={introData} />;
  if (phase === 'results' && resultsData) return <ModeResults data={resultsData} />;
  if (phase !== 'playing' || !playData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-base px-4 text-ink">
        <Card className="w-full max-w-md text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-streak">
            {theme === 'pokemon' ? 'Pokédle' : 'HP-dle'}
          </p>
          <h1 className="mt-2 text-3xl font-extrabold">Loading…</h1>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base px-4 py-6 text-ink">
      <div className="mx-auto max-w-3xl">
        <CumulativeScoreBar
          theme={theme}
          mode={mode}
          cumulative={cumulative}
          timerMs={timerMs}
          totalMs={totalMs}
        />
        {invalidToast && (
          <div className="mb-3 flex justify-center">
            <Chip variant="muted" className="!bg-danger !text-on-danger !border-ink">
              {invalidToast}
            </Chip>
          </div>
        )}

        {/* Mode bodies */}
        {mode === 'classic' && <ClassicMatrix data={playData} guesses={guessEvents} onGuess={submit} />}
        {mode === 'emoji' && <EmojiClue data={playData} guesses={guessEvents} onGuess={submit} />}
        {mode === 'silhouette' && <Silhouette data={playData} guesses={guessEvents} onGuess={submit} />}
        {mode === 'spell' && <SpellHint data={playData} guesses={guessEvents} onGuess={submit} />}
        {mode === 'grid' && <Grid3x3 data={playData} cellEvents={cellEvents} onGuess={submit} />}
      </div>
    </div>
  );
};
