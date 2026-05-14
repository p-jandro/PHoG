import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import { WordleBoard } from '../components/wordle/WordleBoard';
import { Keyboard } from '../components/wordle/Keyboard';
import { Chip } from '../ui/Chip';
import { Card } from '../ui/Card';
import { Tile } from '../ui/Tile';

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
  const [flippingRowIndex, setFlippingRowIndex] = useState<number | null>(null);

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
      // AUDIT: the server emits `wordle:round:start` to all sockets (host + players).
      // The payload intentionally contains NO `target` field — that would leak the
      // answer to players before the round ends.  The target is only delivered via
      // the host-only `wordle:round:start:host` event, which the server emits
      // directly to the host socket and NEVER broadcasts here.
      // DO NOT add `target` handling here; players must not see the word before results.
      setPhase('playing');
      setRoundData(d);
    };
    const onResult = (d: any) => {
      setRows((prev) => {
        const next = [...prev, { guess: d.guess, colors: d.colors }];
        // Trigger flip on the newly added row.
        const newIndex = next.length - 1;
        setFlippingRowIndex(newIndex);
        // Clear after the cascade completes (4 × 0.18 + 0.5 ≈ 1.22s — small buffer).
        setTimeout(() => setFlippingRowIndex((cur) => (cur === newIndex ? null : cur)), 1500);
        return next;
      });
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
      <div className="min-h-screen bg-bg-base px-4 py-8 text-ink">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center"
        >
          <Chip variant="info">Game starting</Chip>
          <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            {introData.title}
          </h1>
          <p className="text-lg text-ink-muted sm:text-xl">{introData.description}</p>
          {Array.isArray(introData.scoringRules) && (
            <ul className="mx-auto w-full max-w-md space-y-2 text-left">
              {introData.scoringRules.map((r: string) => (
                <li
                  key={r}
                  className="rounded-xl border-2 border-ink bg-bg-surface px-3 py-2 font-semibold shadow-ink-sm"
                >
                  {r}
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </div>
    );
  }

  if (phase === 'results' && resultsData) {
    const me = resultsData.results.find((r: any) => r.playerId === playerId);
    const answer = String(resultsData.answer || '').toUpperCase().padEnd(5, ' ').slice(0, 5);

    return (
      <div className="min-h-screen bg-bg-base px-4 py-8 text-ink">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center"
        >
          <Chip variant="streak">Wordle — Reveal</Chip>
          <p className="text-lg text-ink-muted">The word was</p>
          <div className="flex justify-center gap-2">
            {answer.split('').map((ch, i) => (
              <Tile key={i} state="correct" className="aspect-square w-14 text-2xl">
                {ch.trim()}
              </Tile>
            ))}
          </div>
          <Card eyebrow="Your result" className="w-full max-w-md text-center">
            {me ? (
              <>
                <p className="text-xl font-bold">
                  {me.solved
                    ? `Solved in ${me.guessesUsed} guess${me.guessesUsed === 1 ? '' : 'es'}`
                    : `Not solved (${me.guessesUsed} guesses)`}
                </p>
                <p className="mt-2 font-display text-4xl font-extrabold text-action">
                  +{me.score} pts{me.firstSolver && ' (first!)'}
                </p>
              </>
            ) : (
              <p className="text-ink-muted">No result.</p>
            )}
          </Card>
        </motion.div>
      </div>
    );
  }

  if (phase !== 'playing' || !roundData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-base text-ink">
        <div className="text-center">
          <Chip variant="info">Wordle</Chip>
          <h1 className="mt-3 font-display text-3xl font-extrabold">Loading…</h1>
        </div>
      </div>
    );
  }

  const totalMs = roundData.duration || 120000;
  const progress = totalMs > 0 ? Math.max(0, Math.min(100, (timerMs / totalMs) * 100)) : 0;

  return (
    <div className="min-h-screen bg-bg-base px-4 py-4 text-ink">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <header className="flex items-center justify-between">
          <Chip variant="info">Wordle</Chip>
          <span className="font-display text-2xl font-extrabold tabular-nums text-ink">
            {Math.ceil(timerMs / 1000)}s
          </span>
        </header>

        <div className="h-2 w-full overflow-hidden rounded-full border-2 border-ink bg-bg-sunken">
          <motion.div
            className="h-full bg-action"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1, ease: 'linear' }}
          />
        </div>

        <WordleBoard
          rows={rows}
          current={solved ? '' : draft}
          maxGuesses={MAX}
          flippingRowIndex={flippingRowIndex}
        />

        <AnimatePresence>
          {invalidToast && (
            <motion.div
              key="invalid-toast"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="flex justify-center"
            >
              <span className="inline-flex items-center gap-1.5 rounded-lg border-2 border-ink bg-danger px-2.5 py-1 text-xs font-extrabold uppercase text-on-danger shadow-ink-sm">
                {invalidToast}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <Keyboard
          states={keyboardStates}
          onLetter={addLetter}
          onBackspace={backspace}
          onEnter={submit}
          disabled={solved || rows.length >= MAX}
        />

        {solved && (
          <p className="text-center font-display text-xl font-extrabold text-action">Solved!</p>
        )}
        {!solved && rows.length >= MAX && (
          <p className="text-center font-display text-lg font-extrabold text-danger">
            Out of guesses — waiting for round to end…
          </p>
        )}
      </div>
    </div>
  );
};
