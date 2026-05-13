import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import { CountryAutocomplete, Country } from '../components/travel/CountryAutocomplete';
import { ChainList } from '../components/travel/ChainList';
import { TravelMap } from '../components/travel/TravelMap';

type Phase = 'intro' | 'playing' | 'results';

interface TravelProps { socket: Socket | null; }

export const Travel = ({ socket }: TravelProps) => {
  const { playerId } = useGameStore();
  const [phase, setPhase] = useState<Phase>('intro');
  const [introData, setIntroData] = useState<any>(null);
  const [roundData, setRoundData] = useState<any>(null);
  const [resultsData, setResultsData] = useState<any>(null);
  const [frontChain, setFrontChain] = useState<Array<{ name: string; color?: 'green'|'orange'|'red' }>>([]);
  const [backChain, setBackChain] = useState<Array<{ name: string; color?: 'green'|'orange'|'red' }>>([]);
  const [solved, setSolved] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [invalidToast, setInvalidToast] = useState<string | null>(null);
  const [timerMs, setTimerMs] = useState(0);

  useEffect(() => {
    if (phase !== 'playing' || !roundData?.endsAt) return;
    const tick = () => setTimerMs(Math.max(0, roundData.endsAt - Date.now()));
    tick();
    const i = setInterval(tick, 100);
    return () => clearInterval(i);
  }, [phase, roundData]);

  useEffect(() => {
    if (!socket) return;
    const onIntro = (d: any) => {
      setPhase('intro');
      setIntroData(d);
      setCountries(d.countries || []);
      setFrontChain([]);
      setBackChain([]);
      setSolved(false);
    };
    const onStart = (d: any) => {
      setPhase('playing');
      setRoundData(d);
      setFrontChain([{ name: d.start }]);
      setBackChain([{ name: d.end }]);
      setSolved(false);
    };
    const onResult = (d: any) => {
      if (Array.isArray(d.frontChain)) setFrontChain(d.frontChain);
      if (Array.isArray(d.backChain)) setBackChain(d.backChain);
      if (d.solved) setSolved(true);
    };
    const onInvalid = (d: any) => {
      setInvalidToast(d.reason || 'invalid');
      setTimeout(() => setInvalidToast(null), 2400);
    };
    const onResults = (d: any) => {
      setPhase('results');
      setResultsData(d);
    };
    socket.on('travel:intro', onIntro);
    socket.on('travel:round:start', onStart);
    socket.on('travel:guess:result', onResult);
    socket.on('travel:guess:invalid', onInvalid);
    socket.on('travel:round:results', onResults);
    return () => {
      socket.off('travel:intro', onIntro);
      socket.off('travel:round:start', onStart);
      socket.off('travel:guess:result', onResult);
      socket.off('travel:guess:invalid', onInvalid);
      socket.off('travel:round:results', onResults);
    };
  }, [socket, playerId]);

  const submit = (name: string) => {
    if (!socket || solved) return;
    socket.emit('travel:submit', { name });
  };

  if (phase === 'intro' && introData) {
    return (
      <div className="screen-shell flex flex-col items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="screen-frame max-w-2xl space-y-4 text-center">
          <p className="eyebrow">Game starting</p>
          <h1 className="text-5xl font-bold text-game-leader">{introData.title}</h1>
          <p className="text-xl text-ui-textMuted">{introData.description}</p>
          {Array.isArray(introData.scoringRules) && (
            <ul className="mx-auto max-w-md space-y-1 text-left text-base">
              {introData.scoringRules.map((r: string) => (
                <li key={r} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">{r}</li>
              ))}
            </ul>
          )}
        </motion.div>
      </div>
    );
  }

  if (phase === 'results' && resultsData) {
    const me = resultsData.results.find((r: any) => r.playerId === playerId);
    return (
      <div className="screen-shell flex flex-col items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="screen-frame max-w-2xl space-y-4 text-center">
          <p className="eyebrow">Travel — Reveal</p>
          <p className="text-2xl text-ui-textMuted">A shortest path</p>
          <p className="break-words text-2xl font-bold text-game-leader">{(resultsData.optimalChain || []).join(' → ')}</p>
          <p className="text-sm text-ui-textMuted">{resultsData.optimalDistance} hops · your budget was {resultsData.optimalDistance + 2}</p>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-center">
            <p className="eyebrow mb-2">Your result</p>
            {me ? (
              <>
                <p className="text-xl">{me.solved ? '✓ solved' : '✗ not solved'}</p>
                <p className="mt-1 text-3xl font-bold text-game-leader">+{me.score} pts{me.firstSolver && ' (first!)'}</p>
              </>
            ) : (
              <p className="text-ui-textMuted">No result.</p>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  if (phase !== 'playing' || !roundData) {
    return (
      <div className="screen-shell flex flex-col items-center justify-center">
        <div className="screen-frame max-w-md text-center">
          <p className="eyebrow">Travel</p>
          <h1 className="text-3xl font-bold">Loading…</h1>
        </div>
      </div>
    );
  }

  const totalMs = roundData.duration || 90000;
  const progress = totalMs > 0 ? Math.max(0, Math.min(100, (timerMs / totalMs) * 100)) : 0;
  const guessesUsed = Math.max(0, (frontChain.length - 1) + (backChain.length - 1));
  const guessesLeft = roundData.maxGuesses - guessesUsed;
  const noBudget = guessesLeft <= 0;

  return (
    <div className="screen-shell py-4">
      <div className="screen-frame max-w-2xl space-y-4">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="eyebrow">Travel · {roundData.start} → {roundData.end}</p>
            <p className="text-xs text-ui-textMuted">optimal {roundData.optimalDistance} hops · budget {roundData.maxGuesses}</p>
          </div>
          <p className="tabular-nums text-2xl font-bold text-white">{Math.ceil(timerMs / 1000)}s</p>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-game-leader" style={{ width: `${progress}%` }} />
        </div>

        <TravelMap
          startName={roundData.start}
          endName={roundData.end}
          relevantNames={roundData.relevantNames || []}
          frontChain={frontChain}
          backChain={backChain}
          solved={solved}
        />

        <ChainList frontChain={frontChain} backChain={backChain} solved={solved} />

        {invalidToast && (
          <div className="rounded-xl border border-game-incorrect/40 bg-game-incorrect/10 px-3 py-2 text-center text-sm text-game-incorrect">
            {invalidToast}
          </div>
        )}

        {!solved && !noBudget && (
          <CountryAutocomplete countries={countries} onSubmit={submit} placeholder={`Border of ${frontChain[frontChain.length-1]?.name ?? roundData.start} or ${backChain[0]?.name ?? roundData.end}…`} />
        )}
        {solved && <p className="text-center text-lg font-bold text-game-correct">🎉 reached {roundData.end}!</p>}
        {!solved && noBudget && (
          <p className="text-center text-lg font-bold text-game-incorrect">Budget exhausted — waiting for round to end…</p>
        )}
        <p className="text-center text-xs text-ui-textMuted">{Math.max(0, guessesLeft)} guesses left</p>
      </div>
    </div>
  );
};
