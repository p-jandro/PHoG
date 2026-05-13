import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import { CountryAutocomplete, Country } from '../components/travel/CountryAutocomplete';
import { ChainStrip } from '../components/travel/ChainStrip';
import { ChainPill } from '../components/travel/ChainPill';
import { TravelMap, MapGuess } from '../components/travel/TravelMap';
import { Card, Chip, Countdown } from '../ui';
import { screenEnter, reducedFade } from '../lib/motion';

type Phase = 'intro' | 'playing' | 'results';

interface TravelProps { socket: Socket | null; }

export const Travel = ({ socket }: TravelProps) => {
  const reduce = useReducedMotion();
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

  // Timer effect — unchanged
  useEffect(() => {
    if (phase !== 'playing' || !roundData?.endsAt) return;
    const tick = () => setTimerMs(Math.max(0, roundData.endsAt - Date.now()));
    tick();
    const i = setInterval(tick, 100);
    return () => clearInterval(i);
  }, [phase, roundData]);

  // Socket effect — unchanged
  useEffect(() => {
    if (!socket) return;
    const onIntro = (d: any) => {
      setPhase('intro');
      setIntroData(d);
      setCountries(d.countries || []);
      setFrontChain([]); setBackChain([]); setSolved(false);
    };
    const onStart = (d: any) => {
      setPhase('playing'); setRoundData(d);
      setFrontChain([{ name: d.start }]); setBackChain([{ name: d.end }]);
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
    const onResults = (d: any) => { setPhase('results'); setResultsData(d); };
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

  // ── INTRO ──────────────────────────────────────────────────────────────
  if (phase === 'intro' && introData) {
    return (
      <div className="min-h-screen px-4 py-6 sm:py-8 flex flex-col items-center justify-center">
        <motion.div variants={reduce ? reducedFade : screenEnter} initial="hidden" animate="visible" className="w-full max-w-2xl">
          <Card>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-streak">Game starting</p>
            <h1 className="mt-2 font-serif text-5xl font-extrabold text-ink">{introData.title}</h1>
            <p className="mt-3 text-lg text-ink-muted">{introData.description}</p>
            {Array.isArray(introData.scoringRules) && introData.scoringRules.length > 0 && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {introData.scoringRules.map((r: string) => (
                  <Chip key={r}>{r}</Chip>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    );
  }

  // ── RESULTS ────────────────────────────────────────────────────────────
  if (phase === 'results' && resultsData) {
    const me = resultsData.results.find((r: any) => r.playerId === playerId);
    type Color = 'green' | 'orange' | 'red';
    const history: Array<{ name: string; color: Color; side: 'front' | 'back' }> = me?.history || [];

    // Map history → MapGuess[] for the reveal animation.
    // Front-side guesses arc toward start, back-side guesses arc toward end.
    const guesses: MapGuess[] = history
      .filter((h) => h.color !== 'red')  // reds are deliberately hidden on the map
      .map((h) => ({
        guess: h.name,
        answer: h.side === 'front' ? resultsData.start : resultsData.end,
        color: h.color,
      }));

    // Streak-tinted card via className (Card has no variant prop)
    const streakCardCls = 'border-streak bg-streak text-on-streak shadow-[4px_4px_0_var(--ink)]';

    return (
      <div className="min-h-screen flex flex-col items-center overflow-y-auto px-4 py-4">
        <motion.div variants={reduce ? reducedFade : screenEnter} initial="hidden" animate="visible" className="w-full max-w-2xl space-y-4">
          <Card>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-streak">Travel — Reveal</p>
            <p className="mt-2 text-2xl font-extrabold text-ink">
              {resultsData.start} <span className="text-ink-muted">→</span> {resultsData.end}
            </p>
          </Card>

          <TravelMap
            startName={resultsData.start}
            endName={resultsData.end}
            relevantNames={resultsData.relevantNames || resultsData.optimalChain || []}
            frontChain={frontChain}
            backChain={backChain}
            solved={true}
            guesses={guesses}
          />

          <Card className={streakCardCls}>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] opacity-80">Shortest path</p>
            <p className="mt-1 break-words text-xl font-extrabold">
              {(resultsData.optimalChain || []).join(' → ')}
            </p>
            <p className="mt-1 text-sm opacity-80">
              {resultsData.optimalDistance} hops · your budget was {resultsData.optimalDistance + 2}
            </p>
          </Card>

          <Card>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink-muted">Your guesses</p>
            {history.length === 0 ? (
              <p className="mt-2 text-center text-sm italic text-ink-muted">No submissions this round.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {history.map((h, i) => (
                  <ChainPill key={i} name={h.name} color={h.color} />
                ))}
              </div>
            )}
          </Card>

          <Card>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink-muted">Your result</p>
            {me ? (
              <div className="mt-2 text-center">
                <p className="text-lg text-ink">{me.solved ? 'Solved' : 'Not solved'}</p>
                <p className="mt-1 font-display text-4xl font-black text-action">+{me.score} pts</p>
                {me.firstSolver && (
                  <Chip variant="streak" className="mt-2">First solver</Chip>
                )}
              </div>
            ) : (
              <p className="mt-2 text-ink-muted">No result.</p>
            )}
          </Card>
        </motion.div>
      </div>
    );
  }

  // ── LOADING ────────────────────────────────────────────────────────────
  if (phase !== 'playing' || !roundData) {
    return (
      <div className="min-h-screen px-4 py-6 sm:py-8 flex flex-col items-center justify-center">
        <Card>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink-muted">Travel</p>
          <h1 className="mt-2 text-3xl font-extrabold text-ink">Loading…</h1>
        </Card>
      </div>
    );
  }

  // ── PLAYING (map hidden!) ──────────────────────────────────────────────
  const guessesUsed = Math.max(0, (frontChain.length - 1) + (backChain.length - 1));
  const guessesLeft = Math.max(0, roundData.maxGuesses - guessesUsed);
  const noBudget = guessesLeft <= 0;
  const seconds = Math.ceil(timerMs / 1000);
  const totalSec = Math.max(1, Math.ceil((roundData.duration || 90000) / 1000));

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-4">
      <motion.div variants={reduce ? reducedFade : screenEnter} initial="hidden" animate="visible" className="w-full max-w-2xl space-y-4">
        {/* Challenge banner */}
        <Card>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-streak">Travel</p>
          <p className="mt-2 break-words text-3xl font-extrabold text-ink">
            {roundData.start}{' '}
            <span className="text-ink-muted">→ ??? →</span>{' '}
            {roundData.end}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Chip variant="info">Optimal {roundData.optimalDistance} hops</Chip>
            <Chip variant="muted">Budget {roundData.maxGuesses}</Chip>
            <span className="inline-flex items-center gap-1.5 rounded-lg border-2 border-ink px-2.5 py-1 text-xs font-extrabold shadow-ink-sm bg-bg-surface text-ink">
              {guessesLeft} guesses left
            </span>
          </div>
        </Card>

        {/* Countdown */}
        <div className="flex justify-center">
          <Countdown seconds={seconds} total={totalSec} />
        </div>

        {/* Chain strip (replaces ChainList; meets in the middle) */}
        <Card>
          <ChainStrip frontChain={frontChain} backChain={backChain} solved={solved} />
        </Card>

        {/* Invalid toast */}
        {invalidToast && (
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-danger px-3 py-1.5 text-sm font-bold text-on-danger shadow-ink-sm">
              {invalidToast}
            </span>
          </div>
        )}

        {/* Autocomplete OR end-of-round message */}
        {!solved && !noBudget && (
          <CountryAutocomplete
            countries={countries}
            onSubmit={submit}
            placeholder={`Border of ${frontChain[frontChain.length - 1]?.name ?? roundData.start} or ${backChain[0]?.name ?? roundData.end}…`}
          />
        )}
        {solved && (
          <p className="text-center font-display text-2xl font-black text-action">
            Reached {roundData.end}!
          </p>
        )}
        {!solved && noBudget && (
          <p className="text-center font-display text-2xl font-black text-danger">
            Budget exhausted — waiting for round to end…
          </p>
        )}
      </motion.div>
    </div>
  );
};
