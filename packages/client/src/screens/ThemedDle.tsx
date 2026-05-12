import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import { ModeIntro } from '../components/themed-dle/ModeIntro';
import { ModeResults } from '../components/themed-dle/ModeResults';
import { CumulativeScoreBar } from '../components/themed-dle/CumulativeScoreBar';

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
  const [modeIndex, setModeIndex] = useState(0);
  const [introData, setIntroData] = useState<any>(null);
  const [playData, setPlayData] = useState<any>(null);
  const [resultsData, setResultsData] = useState<any>(null);
  const [guessEvents, setGuessEvents] = useState<any[]>([]);
  const [cellEvents, setCellEvents] = useState<any[]>([]);
  const [cumulative, setCumulative] = useState(0);
  const [timerMs, setTimerMs] = useState(0);
  const [totalMs, setTotalMs] = useState(0);
  const [invalidToast, setInvalidToast] = useState<string | null>(null);

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
      const msg = d.reason === 'duplicate' ? `"${d.name}" already used` : `"${d.name}" not in roster`;
      setInvalidToast(msg);
      setTimeout(() => setInvalidToast(null), 2500);
    };
    const onResults = (d: any) => {
      setPhase('results');
      setResultsData(d);
      setModeIndex(d.modeIndex);
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
    };
  }, [socket, gamePrefix, playerId]);

  if (phase === 'intro' && introData) return <ModeIntro data={introData} />;
  if (phase === 'results' && resultsData) return <ModeResults data={resultsData} />;
  if (phase !== 'playing' || !playData) {
    return (
      <div className="screen-shell flex flex-col items-center justify-center">
        <div className="screen-frame max-w-xl text-center">
          <p className="eyebrow">{theme === 'pokemon' ? 'Pokédle' : 'HP-dle'}</p>
          <h1 className="text-3xl font-bold">Loading…</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-shell py-6">
      <div className="screen-frame max-w-3xl">
        <CumulativeScoreBar
          theme={theme}
          mode={mode}
          modeIndex={playData.modeIndex ?? modeIndex}
          totalModes={4}
          cumulative={cumulative}
          timerMs={timerMs}
          totalMs={totalMs}
        />
        {invalidToast && (
          <div className="mb-3 rounded-xl border border-game-incorrect/40 bg-game-incorrect/10 px-3 py-2 text-center text-sm text-game-incorrect">
            {invalidToast}
          </div>
        )}

        {/* Mode bodies (filled in Phases 3–7) */}
        <ModeBodyPlaceholder mode={mode} />
      </div>
    </div>
  );

  function ModeBodyPlaceholder({ mode }: { mode: Mode }) {
    const interactions = guessEvents.length + cellEvents.length;
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-center text-ui-textMuted">
        Mode <strong>{mode}</strong> UI coming next.
        <p className="mt-2 text-xs">Use the host display to advance the round.</p>
        {interactions > 0 && (
          <p className="mt-2 text-xs">{interactions} interaction{interactions === 1 ? '' : 's'} received</p>
        )}
      </div>
    );
  }
};
