import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import { WordleBoard } from '../components/wordle/WordleBoard';
import { Keyboard } from '../components/wordle/Keyboard';

type Phase = 'intro' | 'playing' | 'results';
type Color = 'green' | 'yellow' | 'grey';
type GuessRow = { guess: string; colors: Color[] };

interface WordleProps { socket: Socket | null; }

const MAX = 6;

export const Wordle = ({ socket }: WordleProps) => {
  const { playerId } = useGameStore();
  const [phase, setPhase] = useState<Phase>('intro');
  const [introData, setIntroData] = useState<any>(null);
  const [roundData, setRoundData] = useState<any>(null);
  const [resultsData, setResultsData] = useState<any>(null);
  const [draft, setDraft] = useState('');
  const [rows, setRows] = useState<GuessRow[]>([]);
  const [solved, setSolved] = useState(false);
  const [invalidToast, setInvalidToast] = useState<string | null>(null);
  const [timerMs, setTimerMs] = useState(0);

  // Cumulative keyboard state — derived from rows
  const keyboardStates = useMemo(() => {
    const rank: Record<Color, number> = { grey: 0, yellow: 1, green: 2 };
    const out: Record<string, Color> = {};
    for (const r of rows) {
      for (let i = 0; i < r.guess.length; i++) {
        const c = r.guess[i].toLowerCase();
        const col = r.colors[i];
        if (!out[c] || rank[col] > rank[out[c]]) out[c] = col;
      }
    }
    return out;
  }, [rows]);

  // Timer
  useEffect(() => {
    if (phase !== 'playing' || !roundData?.endsAt) return;
    const tick = () => setTimerMs(Math.max(0, roundData.endsAt - Date.now()));
    tick();
    const i = setInterval(tick, 100);
    return () => clearInterval(i);
  }, [phase, roundData]);

  // Socket
  useEffect(() => {
    if (!socket) return;
    const onIntro = (d: any) => {
      setPhase('intro');
      setIntroData(d);
      setRows([]);
      setDraft('');
      setSolved(false);
    };
    const onStart = (d: any) => {
      setPhase('playing');
      setRoundData(d);
    };
    const onResult = (d: any) => {
      setRows((prev) => [...prev, { guess: d.guess, colors: d.colors }]);
      setDraft('');
      if (d.solved) setSolved(true);
    };
    const onInvalid = (d: any) => {
      setInvalidToast(d.reason || 'invalid');
      setTimeout(() => setInvalidToast(null), 2200);
    };
    const onResults = (d: any) => {
      setPhase('results');
      setResultsData(d);
    };
    socket.on('wordle:intro', onIntro);
    socket.on('wordle:round:start', onStart);
    socket.on('wordle:guess:result', onResult);
    socket.on('wordle:guess:invalid', onInvalid);
    socket.on('wordle:round:results', onResults);
    return () => {
      socket.off('wordle:intro', onIntro);
      socket.off('wordle:round:start', onStart);
      socket.off('wordle:guess:result', onResult);
      socket.off('wordle:guess:invalid', onInvalid);
      socket.off('wordle:round:results', onResults);
    };
  }, [socket, playerId]);

  const addLetter = (l: string) => {
    if (solved || rows.length >= MAX) return;
    if (draft.length >= 5) return;
    setDraft(draft + l);
  };
  const backspace = () => {
    if (solved) return;
    setDraft(draft.slice(0, -1));
  };
  const submit = () => {
    if (solved || rows.length >= MAX) return;
    if (draft.length !== 5) {
      setInvalidToast('need 5 letters');
      setTimeout(() => setInvalidToast(null), 1800);
      return;
    }
    socket?.emit('wordle:submit', { guess: draft });
  };

  // Hardware keyboard support (optional convenience for laptop users)
  useEffect(() => {
    if (phase !== 'playing') return;
    const onKey = (ev: KeyboardEvent) => {
      const k = ev.key;
      if (k === 'Enter') { ev.preventDefault(); submit(); return; }
      if (k === 'Backspace') { ev.preventDefault(); backspace(); return; }
      if (/^[a-zA-Z]$/.test(k)) { ev.preventDefault(); addLetter(k.toLowerCase()); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, draft, solved, rows]);

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
          <p className="eyebrow">Wordle — Reveal</p>
          <p className="text-2xl text-ui-textMuted">The word was</p>
          <p className="text-5xl font-bold uppercase tracking-widest text-game-leader">{resultsData.answer}</p>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-left">
            <p className="eyebrow mb-2 text-center">Your result</p>
            {me ? (
              <>
                <p className="text-center text-xl">{me.solved ? `✓ solved in ${me.guessesUsed}` : `✗ not solved (${me.guessesUsed} guesses)`}</p>
                <p className="mt-2 text-center text-4xl font-bold text-game-leader">+{me.score} pts{me.firstSolver && ' (first!)'}</p>
              </>
            ) : (
              <p className="text-center text-ui-textMuted">No result.</p>
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
          <p className="eyebrow">Wordle</p>
          <h1 className="text-3xl font-bold">Loading…</h1>
        </div>
      </div>
    );
  }

  const totalMs = roundData.duration || 120000;
  const progress = totalMs > 0 ? Math.max(0, Math.min(100, (timerMs / totalMs) * 100)) : 0;

  return (
    <div className="screen-shell py-4">
      <div className="screen-frame max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Wordle</p>
          <p className="tabular-nums text-2xl font-bold text-white">{Math.ceil(timerMs / 1000)}s</p>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-game-leader" style={{ width: `${progress}%` }} />
        </div>

        <WordleBoard rows={rows} current={solved ? '' : draft} maxGuesses={MAX} />

        {invalidToast && (
          <div className="rounded-xl border border-game-incorrect/40 bg-game-incorrect/10 px-3 py-2 text-center text-sm text-game-incorrect">
            {invalidToast}
          </div>
        )}

        <Keyboard
          states={keyboardStates}
          onLetter={addLetter}
          onBackspace={backspace}
          onEnter={submit}
          disabled={solved || rows.length >= MAX}
        />

        {solved && <p className="text-center text-lg font-bold text-game-correct">🎉 solved!</p>}
        {!solved && rows.length >= MAX && (
          <p className="text-center text-lg font-bold text-game-incorrect">Out of guesses — waiting for round to end…</p>
        )}
      </div>
    </div>
  );
};
