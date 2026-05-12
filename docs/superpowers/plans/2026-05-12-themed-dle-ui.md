# Themed-dle UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the player (client) and host display UIs for the two themed-dle games (Pokédle and HP-dle). Server is already complete on this branch (`claude/elegant-hermann-2af09b`, commit `beb1c3d`).

**Architecture:**
- Each themed-dle game plays 4 modes back-to-back (intro → playing → results between each). The client and host both subscribe to `${game}:intro | playing:start | guess:result | grid:cell:result | guess:invalid | progress | mode:results` where `${game}` is `pokedle` or `hpdle`.
- Single client screen `ThemedDle.tsx` switches sub-components per `mode`. Single host screen `ThemedDleDisplay.tsx` does the same for the big display.
- A shared `AutocompletePicker` powers the four name-pick modes (classic, emoji, silhouette, grid). Spell mode uses a free-text input with autocomplete.
- The 4-mode score bar (`CumulativeScoreBar`) and intro/results splashes (`ModeIntro`, `ModeResults`) are mode-agnostic shells.

**Tech Stack:** React 18 + TypeScript + Vite + Zustand + Framer Motion + Tailwind + socket.io-client.

**Reference docs (read first):**
- [docs/themedDle-implementation.md](../../themedDle-implementation.md) — the source-of-truth handoff spec (event payloads, mode UI rules, scoring, file layout). Every task below assumes you have this open.
- [packages/server/src/games/themedDle.js](../../../packages/server/src/games/themedDle.js) — exact event shapes (definitive over the doc if they disagree).

**Conventions:**
- Worktree: `C:/FutureCode/PHoG/.claude/worktrees/elegant-hermann-2af09b`. All paths below are relative to that root.
- After each phase: commit. Use the existing PHoG commit-message style ("Add Pokedle…", "Revamp game flow…" — short title, no Conventional-Commits prefix).
- No test framework on the client/host — verification is smoke-tested via `npm run dev` for the three services. Pure-function helpers go through a tiny ad-hoc vitest harness only where the spec calls for it (Phase 3 utility, Phase 5 utility).
- TypeScript: `npm run build` in `packages/client` and `packages/host` must pass at the end of every phase. Run it as the final verification step before committing.

---

## File Structure

**Client — to be created:**

| Path | Responsibility |
|---|---|
| `packages/client/src/screens/ThemedDle.tsx` | Outer shell; subscribes to socket events; switches between intro/playing/results sub-views and between mode subcomponents |
| `packages/client/src/components/themed-dle/AutocompletePicker.tsx` | Shared input — debounced filter on `name + aliases`, top-5 dropdown, submit-on-tap |
| `packages/client/src/components/themed-dle/CumulativeScoreBar.tsx` | Header strip — mode label, mode index (e.g. "Mode 2 of 4"), cumulative score |
| `packages/client/src/components/themed-dle/ModeIntro.tsx` | 8-second splash before each mode (title, description, attribute list / max-guesses) |
| `packages/client/src/components/themed-dle/ModeResults.tsx` | 8-second post-mode reveal (target identity + player mode-score + cumulative rank teaser) |
| `packages/client/src/components/themed-dle/ClassicMatrix.tsx` | Mode 1 — attribute matrix board |
| `packages/client/src/components/themed-dle/EmojiClue.tsx` | Mode 2 — emoji reveal board |
| `packages/client/src/components/themed-dle/Silhouette.tsx` | Mode 3a (Pokédle) — cropped/dimmed sprite |
| `packages/client/src/components/themed-dle/SpellHint.tsx` | Mode 3b (HP-dle) — effect + hint reveal + free-text incantation entry |
| `packages/client/src/components/themed-dle/Grid3x3.tsx` | Mode 4 — 3×3 immaculate grid with cell-tap modal |

**Client — to be modified:**

| Path | Change |
|---|---|
| `packages/client/src/App.tsx` | Add `case 'pokedle': case 'hpdle': return <ThemedDle socket={socket} />` |
| `packages/client/src/stores/gameStore.ts` | Extend `currentGame` and `Player.placements`/`gamePlacements` unions to include `'pokedle' \| 'hpdle'`; same for `RoundLeaderboardState.game` |

**Host — to be created:**

| Path | Responsibility |
|---|---|
| `packages/host/src/screens/ThemedDleDisplay.tsx` | Host-side outer shell mirroring the client — but no input, more "big screen" feel |
| `packages/host/src/components/themed-dle/PlayerProgressPanel.tsx` | Sidebar list of `{name, guessCount/filledCells, solved}` |
| `packages/host/src/components/themed-dle/ModeIntroSplash.tsx` | Host's mode-intro splash (mirrors client `ModeIntro` but larger) |
| `packages/host/src/components/themed-dle/ModeResultsReveal.tsx` | Host's mode-results — target reveal + top-3 emphasis + cumulative leaderboard |
| `packages/host/src/components/themed-dle/HostClassicView.tsx` | Big puzzle prompt + attribute column header + no per-player guesses |
| `packages/host/src/components/themed-dle/HostEmojiView.tsx` | Centered emoji clue (mirrors player's revealed count) |
| `packages/host/src/components/themed-dle/HostSilhouetteView.tsx` | Centered silhouette (driven by host's own progress, since per-player silhouette stages differ) — show the *minimum* stage across all players, i.e. the easiest revealed view |
| `packages/host/src/components/themed-dle/HostSpellView.tsx` | Big effect card; hints area mirrors max hint tier any player has unlocked |
| `packages/host/src/components/themed-dle/HostGridView.tsx` | Big 3×3 grid with row/col labels; cells empty during play; full reveal during results |

**Host — to be modified:**

| Path | Change |
|---|---|
| `packages/host/src/screens/Display.tsx` | Extend `GameKey` type, add `case 'pokedle'` and `'hpdle'` branches that render `<ThemedDleDisplay />` |
| `packages/host/src/screens/Dashboard.tsx` | Add `pokedle` and `hpdle` to `availableGames`; add two start buttons in the non-championship block |

---

## Phase 0 — Types, routing scaffolds (no UI yet)

Make the codebase compile with the new game keys before adding any UI. After this phase, kicking off `pokedle` or `hpdle` from the host shows a "Loading game…" placeholder on the client; the host display goes to a placeholder too.

### Task 0.1: Extend client `gameStore` types

**Files:**
- Modify: `packages/client/src/stores/gameStore.ts`

- [ ] **Step 1: Update `RoundLeaderboardState.game` union**

In `packages/client/src/stores/gameStore.ts` change:

```ts
export interface RoundLeaderboardState {
  game: 'quiz' | 'trueFalse' | 'countdown' | 'pointless' | 'pokedle' | 'hpdle';
  // ...rest unchanged
}
```

- [ ] **Step 2: Update `Player.placements` and `Player.gamePlacements`**

```ts
export interface Player {
  // ...
  placements?: {
    quiz: number | null;
    trueFalse: number | null;
    countdown: number | null;
    pointless: number | null;
    pokedle: number | null;
    hpdle: number | null;
  };
  gamePlacements?: {
    quiz: number | null;
    trueFalse: number | null;
    countdown: number | null;
    pointless: number | null;
    pokedle: number | null;
    hpdle: number | null;
  };
  // ...
}
```

- [ ] **Step 3: Update `GameState.currentGame`**

```ts
export interface GameState {
  // ...
  currentGame: 'quiz' | 'trueFalse' | 'countdown' | 'pointless' | 'pokedle' | 'hpdle' | null;
  // ...
}
```

- [ ] **Step 4: Verify `npm run build` passes**

Run from `packages/client/`:
```bash
npm run build
```
Expected: build succeeds. (`App.tsx`'s switch on `currentGame` already has a `default` branch, so unhandled cases fall through cleanly.)

---

### Task 0.2: Extend host `Display.tsx` types

**Files:**
- Modify: `packages/host/src/screens/Display.tsx` (top of file — type aliases only)

- [ ] **Step 1: Extend `GameKey`**

```ts
type GameKey = 'quiz' | 'trueFalse' | 'countdown' | 'pointless' | 'pokedle' | 'hpdle';
```

- [ ] **Step 2: Extend `Player.gamePlacements` (interface in this file)**

Add `pokedle: number | null; hpdle: number | null;` to the inline `gamePlacements` shape.

- [ ] **Step 3: Extend `RoundLeaderboardState.game`**

Same union widening as Task 0.1 Step 1.

- [ ] **Step 4: Verify `npm run build` passes**

Run from `packages/host/`:
```bash
npm run build
```
Expected: build succeeds.

---

### Task 0.3: Commit foundation

- [ ] **Step 1: Commit**

```bash
cd C:/FutureCode/PHoG/.claude/worktrees/elegant-hermann-2af09b
git add packages/client/src/stores/gameStore.ts packages/host/src/screens/Display.tsx docs/superpowers/plans/2026-05-12-themed-dle-ui.md
git commit -m "Extend client/host types to accept pokedle and hpdle game keys"
```

---

## Phase 1 — Shared client primitives

Three reusable building blocks every mode component depends on. No socket wiring yet.

### Task 1.1: `AutocompletePicker`

**Files:**
- Create: `packages/client/src/components/themed-dle/AutocompletePicker.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useMemo, useState } from 'react';

export interface RosterEntry {
  name: string;
  aliases?: string[];
}

interface AutocompletePickerProps {
  roster: RosterEntry[];
  onSubmit: (name: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxResults?: number;
}

export const AutocompletePicker = ({
  roster,
  onSubmit,
  placeholder = 'Type a name…',
  disabled = false,
  maxResults = 5
}: AutocompletePickerProps) => {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return roster
      .filter((entry) => {
        if (entry.name.toLowerCase().includes(q)) return true;
        return (entry.aliases || []).some((a) => a.toLowerCase().includes(q));
      })
      .slice(0, maxResults);
  }, [query, roster, maxResults]);

  const submit = (name: string) => {
    if (disabled || !name) return;
    onSubmit(name);
    setQuery('');
    setActive(0);
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setActive(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(suggestions.length - 1, i + 1)); }
          if (e.key === 'ArrowUp')   { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
          if (e.key === 'Enter') {
            e.preventDefault();
            if (suggestions[active]) submit(suggestions[active].name);
            else if (query.trim()) submit(query.trim());
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-lg text-white placeholder:text-ui-textMuted focus:border-game-leader focus:outline-none disabled:opacity-50"
      />
      {suggestions.length > 0 && !disabled && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-2xl border border-white/10 bg-ui-card shadow-xl">
          {suggestions.map((entry, idx) => (
            <li
              key={entry.name}
              onMouseDown={(e) => { e.preventDefault(); submit(entry.name); }}
              onMouseEnter={() => setActive(idx)}
              className={`cursor-pointer px-4 py-3 text-lg ${idx === active ? 'bg-game-leader text-black' : 'text-white hover:bg-white/10'}`}
            >
              {entry.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify it type-checks**

Run from `packages/client/`:
```bash
npm run build
```
Expected: build succeeds (component is currently unused — TS will warn but Vite/tsc don't fail on unused exports).

---

### Task 1.2: `CumulativeScoreBar`

**Files:**
- Create: `packages/client/src/components/themed-dle/CumulativeScoreBar.tsx`

- [ ] **Step 1: Create the component**

```tsx
interface CumulativeScoreBarProps {
  theme: 'pokemon' | 'hp';
  mode: 'classic' | 'emoji' | 'silhouette' | 'spell' | 'grid';
  modeIndex: number;        // 0..3
  totalModes: number;       // 4
  cumulative: number;
  timerMs?: number;
  totalMs?: number;
}

const MODE_LABELS: Record<string, string> = {
  classic: 'Classic',
  emoji: 'Emoji',
  silhouette: 'Silhouette',
  spell: 'Spell',
  grid: '3×3 Grid'
};

const THEME_LABEL: Record<string, string> = {
  pokemon: 'Pokédle',
  hp: 'HP-dle'
};

export const CumulativeScoreBar = ({
  theme, mode, modeIndex, totalModes, cumulative, timerMs, totalMs
}: CumulativeScoreBarProps) => {
  const progress = (typeof timerMs === 'number' && totalMs) ? (timerMs / totalMs) * 100 : null;

  return (
    <div className="mb-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow">{THEME_LABEL[theme]}</p>
          <h2 className="text-2xl font-bold">{MODE_LABELS[mode]} · Mode {modeIndex + 1}/{totalModes}</h2>
        </div>
        <div className="text-right">
          <p className="eyebrow">Score</p>
          <p className="text-3xl font-bold text-game-leader">{cumulative}</p>
        </div>
      </div>
      {progress !== null && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-game-leader" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify build passes**

```bash
cd packages/client && npm run build
```

---

### Task 1.3: Commit shared primitives

- [ ] **Step 1: Commit**

```bash
git add packages/client/src/components/themed-dle/
git commit -m "Add AutocompletePicker and CumulativeScoreBar shared themed-dle components"
```

---

## Phase 2 — Client shell + intro/results + routing (end-to-end stub)

After this phase, the client renders a working flow — intro splash → "mode body coming soon" placeholder → results splash → next mode → game end. No mode-specific UI yet, but the socket-event plumbing is fully tested.

### Task 2.1: `ModeIntro` component

**Files:**
- Create: `packages/client/src/components/themed-dle/ModeIntro.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface ModeIntroProps {
  data: {
    theme: 'pokemon' | 'hp';
    mode: 'classic' | 'emoji' | 'silhouette' | 'spell' | 'grid';
    duration: number;
    endsAt: number;
    title: string;
    description: string;
    maxGuesses?: number;
    attributes?: string[];
  };
}

export const ModeIntro = ({ data }: ModeIntroProps) => {
  const [remaining, setRemaining] = useState(Math.max(0, data.endsAt - Date.now()));

  useEffect(() => {
    const i = setInterval(() => {
      setRemaining(Math.max(0, data.endsAt - Date.now()));
    }, 100);
    return () => clearInterval(i);
  }, [data.endsAt]);

  const progress = data.duration ? ((data.duration - remaining) / data.duration) * 100 : 0;

  return (
    <div className="screen-shell flex flex-col items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="screen-frame max-w-3xl text-center space-y-5"
      >
        <p className="eyebrow">{data.theme === 'pokemon' ? 'Pokédle' : 'HP-dle'}</p>
        <h1 className="text-5xl font-bold text-game-leader">{data.title}</h1>
        <p className="text-xl text-ui-textMuted">{data.description}</p>

        {data.attributes && (
          <div className="flex flex-wrap justify-center gap-2">
            {data.attributes.map((a) => (
              <span key={a} className="status-pill">{a}</span>
            ))}
          </div>
        )}
        {data.maxGuesses !== undefined && (
          <p className="text-base text-ui-textMuted">{data.maxGuesses} guesses</p>
        )}

        <div className="mx-auto h-2 w-full max-w-md overflow-hidden rounded-full bg-gray-700">
          <motion.div className="h-full bg-game-accent" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-sm text-ui-textMuted">Starting in {Math.ceil(remaining / 1000)}s…</p>
      </motion.div>
    </div>
  );
};
```

- [ ] **Step 2: Verify build**

```bash
cd packages/client && npm run build
```

---

### Task 2.2: `ModeResults` component

**Files:**
- Create: `packages/client/src/components/themed-dle/ModeResults.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';

interface ModeResultsProps {
  data: {
    mode: string;
    modeIndex: number;
    totalModes: number;
    target: any;
    results: Array<{
      playerId: string;
      playerName: string;
      modeScore: number;
      cumulativeScore: number;
    }>;
    cumulativeScores: Record<string, number>;
    isLastMode: boolean;
    duration: number;
    endsAt: number;
  };
}

const MODE_LABELS: Record<string, string> = {
  classic: 'Classic', emoji: 'Emoji', silhouette: 'Silhouette', spell: 'Spell', grid: '3×3 Grid'
};

const renderTarget = (mode: string, target: any) => {
  if (!target) return null;
  if (mode === 'grid') return <p className="text-lg">Grid revealed</p>;
  if (mode === 'spell') return (
    <>
      <p className="text-3xl font-bold text-game-leader">{target.incantation}</p>
      <p className="text-base text-ui-textMuted mt-1">{target.effect}</p>
    </>
  );
  if (mode === 'silhouette') return (
    <>
      <p className="text-3xl font-bold text-game-leader">{target.name}</p>
      {target.spriteUrl && <img src={target.spriteUrl} alt={target.name} className="mx-auto mt-3 h-40 w-40 object-contain" />}
    </>
  );
  return <p className="text-3xl font-bold text-game-leader">{target.name}</p>;
};

export const ModeResults = ({ data }: ModeResultsProps) => {
  const { playerId } = useGameStore();
  const [remaining, setRemaining] = useState(Math.max(0, data.endsAt - Date.now()));

  useEffect(() => {
    const i = setInterval(() => setRemaining(Math.max(0, data.endsAt - Date.now())), 100);
    return () => clearInterval(i);
  }, [data.endsAt]);

  const me = data.results.find((r) => r.playerId === playerId);
  const sorted = [...data.results].sort((a, b) => b.cumulativeScore - a.cumulativeScore);
  const myRank = sorted.findIndex((r) => r.playerId === playerId) + 1;

  return (
    <div className="screen-shell flex flex-col items-center justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="screen-frame max-w-3xl text-center space-y-5">
        <p className="eyebrow">{MODE_LABELS[data.mode]} — Mode {data.modeIndex + 1}/{data.totalModes}</p>
        <h1 className="text-3xl font-bold">It was…</h1>
        {renderTarget(data.mode, data.target)}

        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <p className="text-base text-ui-textMuted">You scored</p>
          <p className="text-4xl font-bold text-game-leader">+{me?.modeScore ?? 0}</p>
          <p className="mt-2 text-base">
            Cumulative: <span className="font-bold text-white">{me?.cumulativeScore ?? 0}</span>
            {myRank > 0 && <> · Rank <span className="font-bold">#{myRank}</span></>}
          </p>
        </div>

        <p className="text-sm text-ui-textMuted">
          {data.isLastMode ? 'Game wrapping up…' : 'Next mode in '}
          {!data.isLastMode && `${Math.ceil(remaining / 1000)}s`}
        </p>
      </motion.div>
    </div>
  );
};
```

- [ ] **Step 2: Verify build**

```bash
cd packages/client && npm run build
```

---

### Task 2.3: `ThemedDle` outer shell

**Files:**
- Create: `packages/client/src/screens/ThemedDle.tsx`

This shell wires every socket event but routes the *playing* sub-view to placeholder text. Mode bodies land in Phases 3–7.

- [ ] **Step 1: Create the file**

```tsx
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

  const submit = (payload: any) => socket?.emit('themedDle:guess', payload);

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

  // tiny inline placeholder so the file is self-contained until phases 3–7 land
  function ModeBodyPlaceholder({ mode }: { mode: Mode }) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-center text-ui-textMuted">
        Mode <strong>{mode}</strong> UI coming next.
        <p className="mt-2 text-xs">Use the host display to advance the round.</p>
      </div>
    );
  }
};
```

**Note:** the inline `ModeBodyPlaceholder` gets *replaced* in Phase 3 by a switch over real mode components, but leave it here for now so the shell renders something while the host's skip control can still drive the flow forward.

- [ ] **Step 2: Verify build**

```bash
cd packages/client && npm run build
```

---

### Task 2.4: Wire routing in `App.tsx`

**Files:**
- Modify: `packages/client/src/App.tsx`

- [ ] **Step 1: Import and add cases**

After `import { Pointless } from './screens/Pointless';` add:

```tsx
import { ThemedDle } from './screens/ThemedDle';
```

Inside the `case 'playing'` switch on `currentGame`, add:

```tsx
case 'pokedle':
case 'hpdle':
  return <ThemedDle socket={socket} />;
```

- [ ] **Step 2: Verify build**

```bash
cd packages/client && npm run build
```

---

### Task 2.5: End-to-end smoke test (client only)

Server is already wired. Host can't yet start the game from the UI (Phase 9), so we'll use a direct socket call from the browser console.

- [ ] **Step 1: Start the services**

In three separate terminals:
```powershell
cd packages/server; npm run dev
cd packages/client; npm run dev
cd packages/host;   npm run dev
```

- [ ] **Step 2: Join + force-start a Pokédle game**

1. Open the host control panel http://localhost:5174 (login `admin123`)
2. Open http://localhost:5173, join with a name
3. In the host browser's DevTools console run:

```js
window.__socket?.emit?.('host:control', { action: 'start', game: 'pokedle' });
```

  If `window.__socket` isn't exposed, look for the actual host socket variable in Dashboard.tsx (`hostSocket` or similar) and call `.emit` on it.

- [ ] **Step 3: Verify on the player browser**

You should see, in this order:
- **Intro splash** — "Pokédex Match", 8-second countdown
- **Playing placeholder** — `CumulativeScoreBar` + "Mode classic UI coming next."
- After 3 min OR after host hits the skip button, the **mode results** splash for Classic.
- 8 sec later, intro for Emoji. And so on through 4 modes.

If any phase doesn't render: inspect the browser console for the relevant socket events (`pokedle:intro`, `pokedle:playing:start`, `pokedle:mode:results`). Match against the server logs.

- [ ] **Step 4: Commit shell**

```bash
git add packages/client/src/screens/ThemedDle.tsx packages/client/src/components/themed-dle/ModeIntro.tsx packages/client/src/components/themed-dle/ModeResults.tsx packages/client/src/App.tsx
git commit -m "Add client ThemedDle shell with intro and mode-results splashes"
```

---

## Phase 3 — Classic mode (client)

### Task 3.1: `ClassicMatrix` component

**Files:**
- Create: `packages/client/src/components/themed-dle/ClassicMatrix.tsx`

The component receives `playData` (which holds `roster` and `attributes` from the intro merged in) and accumulated `guessEvents` (each is a `:guess:result` payload — only Classic shape applies here).

- [ ] **Step 1: Create the component**

```tsx
import { motion } from 'framer-motion';
import { AutocompletePicker, RosterEntry } from './AutocompletePicker';

type Cell = { key: string; label: string; value: any; color: 'green' | 'yellow' | 'red' };
type GuessResult = {
  guess: string;
  correct: boolean;
  feedback: Cell[];
  guessesUsed: number;
  guessesRemaining: number;
  solved: boolean;
};

interface ClassicMatrixProps {
  data: {
    roster: RosterEntry[];
    maxGuesses: number;
    duration: number;
    endsAt: number;
  };
  guesses: GuessResult[];
  onGuess: (payload: { name: string }) => void;
}

const COLOR_CLASSES: Record<Cell['color'], string> = {
  green: 'bg-game-correct text-black',
  yellow: 'bg-game-warning text-black',
  red: 'bg-game-incorrect/80 text-white'
};

export const ClassicMatrix = ({ data, guesses, onGuess }: ClassicMatrixProps) => {
  const solved = guesses.some((g) => g.solved);
  const used = guesses.length;
  const headerRow = guesses[0]?.feedback?.map((c) => c.label) ?? [];

  return (
    <div className="space-y-4">
      {headerRow.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th className="text-left text-xs text-ui-textMuted">Guess</th>
                {headerRow.map((label) => (
                  <th key={label} className="text-xs text-ui-textMuted">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {guesses.map((g, idx) => (
                <motion.tr key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <td className="rounded-xl bg-black/30 px-3 py-2 font-medium">{g.guess}</td>
                  {g.feedback.map((c) => {
                    const v = Array.isArray(c.value) ? c.value.join(', ') : (c.value ?? '—');
                    return (
                      <td key={c.key} className={`rounded-xl px-2 py-2 text-center font-semibold ${COLOR_CLASSES[c.color]}`}>
                        {String(v)}
                      </td>
                    );
                  })}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!solved && used < data.maxGuesses && (
        <AutocompletePicker
          roster={data.roster}
          onSubmit={(name) => onGuess({ name })}
          placeholder="Guess a name…"
        />
      )}

      {solved && (
        <p className="text-center text-game-correct text-lg font-bold">🎉 Solved in {used} {used === 1 ? 'guess' : 'guesses'}</p>
      )}
      {!solved && used >= data.maxGuesses && (
        <p className="text-center text-game-incorrect text-lg font-bold">Out of guesses</p>
      )}
      <p className="text-center text-xs text-ui-textMuted">{data.maxGuesses - used} guesses left</p>
    </div>
  );
};
```

- [ ] **Step 2: Verify build**

```bash
cd packages/client && npm run build
```

---

### Task 3.2: Wire `ClassicMatrix` into `ThemedDle.tsx`

**Files:**
- Modify: `packages/client/src/screens/ThemedDle.tsx`

- [ ] **Step 1: Import and replace placeholder**

At top of file:
```tsx
import { ClassicMatrix } from '../components/themed-dle/ClassicMatrix';
```

Replace the `<ModeBodyPlaceholder mode={mode} />` line with:

```tsx
{mode === 'classic' && (
  <ClassicMatrix
    data={playData}
    guesses={guessEvents}
    onGuess={submit}
  />
)}
{mode !== 'classic' && <ModeBodyPlaceholder mode={mode} />}
```

- [ ] **Step 2: Verify build**

```bash
cd packages/client && npm run build
```

- [ ] **Step 3: Smoke test**

Restart `client` dev server. Force-start `pokedle` again. During Classic mode:
- Type a partial Pokémon name — top-5 suggestions appear
- Select one and press Enter — see a colored feedback row appear above the input
- Guess wrong 5 more times to confirm 6-guess cap; or guess Pikachu/etc. correctly to confirm "Solved in N guesses"
- Verify the matrix header row populates after the first guess

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/themed-dle/ClassicMatrix.tsx packages/client/src/screens/ThemedDle.tsx
git commit -m "Implement ClassicMatrix mode UI for themed-dle"
```

---

## Phase 4 — Emoji mode (client)

### Task 4.1: `EmojiClue` component

**Files:**
- Create: `packages/client/src/components/themed-dle/EmojiClue.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { motion, AnimatePresence } from 'framer-motion';
import { AutocompletePicker, RosterEntry } from './AutocompletePicker';

type EmojiResult = {
  guess: string;
  correct: boolean;
  feedback: 'correct' | 'wrong';
  guessesUsed: number;
  guessesRemaining: number;
  solved: boolean;
  emojisRevealed: string[];
};

interface EmojiClueProps {
  data: {
    emojis: string[];        // initial 1 emoji
    revealedCount: number;
    roster: RosterEntry[];
    maxGuesses: number;
  };
  guesses: EmojiResult[];
  onGuess: (payload: { name: string }) => void;
}

export const EmojiClue = ({ data, guesses, onGuess }: EmojiClueProps) => {
  const revealed = guesses.length > 0 ? guesses[guesses.length - 1].emojisRevealed : data.emojis;
  const solved = guesses.some((g) => g.solved);
  const used = guesses.length;

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-white/10 bg-black/40 p-8 text-center">
        <div className="flex justify-center gap-3 text-6xl sm:text-7xl">
          <AnimatePresence>
            {revealed.map((e, i) => (
              <motion.span
                key={`${i}-${e}`}
                initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                {e}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
        <p className="mt-4 text-xs text-ui-textMuted">{revealed.length}/5 emojis revealed</p>
      </div>

      <ul className="space-y-1">
        {guesses.map((g, idx) => (
          <li
            key={idx}
            className={`rounded-xl px-3 py-2 font-medium ${g.correct ? 'bg-game-correct/30 text-game-correct' : 'bg-game-incorrect/15 text-ui-textMuted'}`}
          >
            <span className="mr-2">{g.correct ? '✓' : '✗'}</span>{g.guess}
          </li>
        ))}
      </ul>

      {!solved && used < data.maxGuesses && (
        <AutocompletePicker roster={data.roster} onSubmit={(name) => onGuess({ name })} placeholder="Guess a name…" />
      )}
      {solved && <p className="text-center text-game-correct text-lg font-bold">🎉 Solved in {used}</p>}
      {!solved && used >= data.maxGuesses && <p className="text-center text-game-incorrect text-lg font-bold">Out of guesses</p>}
    </div>
  );
};
```

- [ ] **Step 2: Wire into `ThemedDle.tsx`**

Replace the `mode !== 'classic'` fallback with explicit branches:

```tsx
{mode === 'classic' && <ClassicMatrix data={playData} guesses={guessEvents} onGuess={submit} />}
{mode === 'emoji' && <EmojiClue data={playData} guesses={guessEvents} onGuess={submit} />}
{!['classic','emoji'].includes(mode) && <ModeBodyPlaceholder mode={mode} />}
```

Add the `import { EmojiClue } from '../components/themed-dle/EmojiClue';` line at the top.

- [ ] **Step 3: Verify build + smoke test**

```bash
cd packages/client && npm run build
```

Restart client; force-start `pokedle`; skip Classic via the host emergency-skip button so Emoji starts within a few seconds. Verify:
- 1 emoji shows initially
- Wrong guess adds an emoji (animation slides in)
- Correct guess locks the matrix

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/themed-dle/EmojiClue.tsx packages/client/src/screens/ThemedDle.tsx
git commit -m "Implement EmojiClue mode UI for themed-dle"
```

---

## Phase 5 — Silhouette mode (client, Pokédle only)

### Task 5.1: `Silhouette` component

**Files:**
- Create: `packages/client/src/components/themed-dle/Silhouette.tsx`

The component uses CSS filters on a regular `<img>` instead of canvas — simpler and works fine for the spec's stages.

- [ ] **Step 1: Create the component**

```tsx
import { motion } from 'framer-motion';
import { AutocompletePicker, RosterEntry } from './AutocompletePicker';

type SilhouetteResult = {
  guess: string;
  correct: boolean;
  feedback: 'correct' | 'wrong';
  guessesUsed: number;
  guessesRemaining: number;
  solved: boolean;
  silhouetteStage: number; // 1..6 (server emits guesses.length, where stage=0 is the initial pre-guess view)
};

interface SilhouetteProps {
  data: {
    spriteUrl: string;
    revealStage: number;
    roster: RosterEntry[];
    maxGuesses: number;
  };
  guesses: SilhouetteResult[];
  onGuess: (payload: { name: string }) => void;
}

// stage 0 = initial pre-guess; stages 1..5 follow wrong guesses
const ZOOM      = [3.0, 2.4, 1.8, 1.4, 1.1, 1.0, 1.0];
const BRIGHTNESS = [0, 0, 0, 0.1, 0.3, 0.6, 1.0];

export const Silhouette = ({ data, guesses, onGuess }: SilhouetteProps) => {
  const stage = guesses.length > 0 ? guesses[guesses.length - 1].silhouetteStage : 0;
  const solved = guesses.some((g) => g.solved);
  const zoom = ZOOM[Math.min(stage, ZOOM.length - 1)];
  const brightness = solved ? 1.0 : BRIGHTNESS[Math.min(stage, BRIGHTNESS.length - 1)];

  return (
    <div className="space-y-5">
      <div className="mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-black/40">
        <motion.img
          src={data.spriteUrl}
          alt="silhouette"
          initial={false}
          animate={{ scale: zoom }}
          transition={{ duration: 0.6 }}
          style={{
            filter: `brightness(${brightness}) contrast(${brightness === 0 ? 100 : 1})`,
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
        />
      </div>

      <ul className="space-y-1">
        {guesses.map((g, i) => (
          <li key={i} className={`rounded-xl px-3 py-2 ${g.correct ? 'bg-game-correct/30 text-game-correct' : 'bg-game-incorrect/15 text-ui-textMuted'}`}>
            <span className="mr-2">{g.correct ? '✓' : '✗'}</span>{g.guess}
          </li>
        ))}
      </ul>

      {!solved && guesses.length < data.maxGuesses && (
        <AutocompletePicker roster={data.roster} onSubmit={(name) => onGuess({ name })} placeholder="Guess the Pokémon…" />
      )}
      {solved && <p className="text-center text-game-correct text-lg font-bold">🎉 Solved!</p>}
      {!solved && guesses.length >= data.maxGuesses && (
        <p className="text-center text-game-incorrect text-lg font-bold">Out of guesses</p>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Wire into `ThemedDle.tsx`**

```tsx
import { Silhouette } from '../components/themed-dle/Silhouette';
```

```tsx
{mode === 'silhouette' && <Silhouette data={playData} guesses={guessEvents} onGuess={submit} />}
```

Update the fallback condition:
```tsx
{!['classic','emoji','silhouette'].includes(mode) && <ModeBodyPlaceholder mode={mode} />}
```

- [ ] **Step 3: Verify build + smoke test**

```bash
cd packages/client && npm run build
```

Restart client, force-start `pokedle`, skip through Classic + Emoji to reach Silhouette. Verify:
- Initial sprite is fully black + zoomed-in
- Each wrong guess reduces zoom and adds brightness
- Correct guess shows the full sprite

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/themed-dle/Silhouette.tsx packages/client/src/screens/ThemedDle.tsx
git commit -m "Implement Silhouette mode UI for Pokédle"
```

---

## Phase 6 — Spell mode (client, HP-dle only)

### Task 6.1: `SpellHint` component

**Files:**
- Create: `packages/client/src/components/themed-dle/SpellHint.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { AutocompletePicker } from './AutocompletePicker';

type SpellResult = {
  guess: string;
  correct: boolean;
  guessesUsed: number;
  guessesRemaining: number;
  solved: boolean;
  hint: { type: 'whenUsed' | 'caster' | 'letters'; text: string } | null;
};

interface SpellHintProps {
  data: {
    effect: string;
    category: string;
    incantationLength: number;
    spellList: string[];   // list of incantation strings — used for autocomplete
    maxGuesses: number;    // 5 for spell
  };
  guesses: SpellResult[];
  onGuess: (payload: { name: string }) => void;
}

const HINT_TITLES: Record<string, string> = {
  whenUsed: 'When used',
  caster: 'Notable caster',
  letters: 'First & last letter'
};

export const SpellHint = ({ data, guesses, onGuess }: SpellHintProps) => {
  const [draft, setDraft] = useState('');
  const solved = guesses.some((g) => g.solved);
  const used = guesses.length;
  const revealedHints = guesses.map((g) => g.hint).filter(Boolean) as Exclude<SpellResult['hint'], null>[];

  // Build a roster shape for the picker
  const roster = data.spellList.map((s) => ({ name: s }));

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-white/10 bg-black/40 p-6 text-center">
        <p className="eyebrow">{data.category}</p>
        <p className="mt-2 text-2xl font-bold text-white">{data.effect}</p>
        <p className="mt-2 text-sm text-ui-textMuted">Incantation: {data.incantationLength} characters</p>
      </div>

      {revealedHints.length > 0 && (
        <div className="space-y-2">
          {revealedHints.map((h, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              className="rounded-2xl border border-game-leader/30 bg-game-leader/10 px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-game-leader">{HINT_TITLES[h.type] || 'Hint'}</p>
              <p className="text-base">{h.text}</p>
            </motion.div>
          ))}
        </div>
      )}

      <ul className="space-y-1">
        {guesses.map((g, i) => (
          <li key={i} className={`rounded-xl px-3 py-2 ${g.correct ? 'bg-game-correct/30 text-game-correct' : 'bg-game-incorrect/15 text-ui-textMuted'}`}>
            <span className="mr-2">{g.correct ? '✓' : '✗'}</span>{g.guess}
          </li>
        ))}
      </ul>

      {!solved && used < data.maxGuesses && (
        <AutocompletePicker
          roster={roster}
          onSubmit={(name) => { setDraft(''); onGuess({ name }); }}
          placeholder="Speak the incantation…"
        />
      )}
      {solved && <p className="text-center text-game-correct text-lg font-bold">🎉 Spell cast!</p>}
      {!solved && used >= data.maxGuesses && (
        <p className="text-center text-game-incorrect text-lg font-bold">Out of attempts</p>
      )}
      <p className="text-center text-xs text-ui-textMuted">{data.maxGuesses - used} attempts left</p>
    </div>
  );
};
```

- [ ] **Step 2: Wire into `ThemedDle.tsx`**

```tsx
import { SpellHint } from '../components/themed-dle/SpellHint';
```

```tsx
{mode === 'spell' && <SpellHint data={playData} guesses={guessEvents} onGuess={submit} />}
```

Update fallback:
```tsx
{!['classic','emoji','silhouette','spell'].includes(mode) && <ModeBodyPlaceholder mode={mode} />}
```

- [ ] **Step 3: Verify build + smoke test (HP-dle path)**

```bash
cd packages/client && npm run build
```

Force-start `hpdle`. Skip through Classic + Emoji to land in Spell. Verify:
- Effect text + category + length show on a card
- A wrong guess unlocks "When used" hint; second wrong → "Notable caster"; third → "Letters"
- A correct guess (case-insensitive, punctuation-tolerant) ends the mode

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/themed-dle/SpellHint.tsx packages/client/src/screens/ThemedDle.tsx
git commit -m "Implement SpellHint mode UI for HP-dle"
```

---

## Phase 7 — Grid mode (client)

### Task 7.1: `Grid3x3` component

**Files:**
- Create: `packages/client/src/components/themed-dle/Grid3x3.tsx`

This mode uses a **separate** server event (`${gamePrefix}:grid:cell:result`) and a different submit shape (`{ row, col, name }`). The `ThemedDle` shell already routes those into `cellEvents` — pass those in.

- [ ] **Step 1: Create the component**

```tsx
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AutocompletePicker, RosterEntry } from './AutocompletePicker';

type GridCellResult = {
  row: number;
  col: number;
  name: string;
  valid: boolean;
  cellAnswers: Record<string, string | null>;
};

interface Grid3x3Props {
  data: {
    rows: string[];
    cols: string[];
    roster: RosterEntry[];
  };
  cellEvents: GridCellResult[];
  onGuess: (payload: { row: number; col: number; name: string }) => void;
}

export const Grid3x3 = ({ data, cellEvents, onGuess }: Grid3x3Props) => {
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);

  // Latest cellEvents collapsed into the freshest grid state
  const cellState = useMemo(() => {
    const latest: Record<string, { name: string; valid: boolean }> = {};
    for (const ev of cellEvents) {
      for (const [k, name] of Object.entries(ev.cellAnswers)) {
        if (!name) continue;
        // valid status is only set for the cell that was last guessed; treat existing entries as valid by default.
        latest[k] = { name, valid: latest[k]?.valid ?? true };
      }
      const key = `${ev.row},${ev.col}`;
      if (ev.valid) latest[key] = { name: ev.name, valid: true };
      else if (!ev.cellAnswers[key]) {
        // server cleared it because invalid choice for that cell
        latest[key] = { name: ev.name, valid: false };
      }
    }
    return latest;
  }, [cellEvents]);

  const filledCount = Object.values(cellState).filter((c) => c.valid).length;

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-ui-textMuted">{filledCount}/9 filled</p>

      <div className="overflow-x-auto">
        <table className="mx-auto table-fixed border-separate border-spacing-1">
          <thead>
            <tr>
              <th />
              {data.cols.map((c) => (
                <th key={c} className="px-2 py-2 text-center text-xs font-semibold text-ui-textMuted">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((rowLabel, r) => (
              <tr key={rowLabel}>
                <th className="pr-2 text-right text-xs font-semibold text-ui-textMuted">{rowLabel}</th>
                {data.cols.map((_, c) => {
                  const cell = cellState[`${r},${c}`];
                  const tone = !cell
                    ? 'border-dashed border-white/20 text-ui-textMuted'
                    : cell.valid
                      ? 'border-game-correct bg-game-correct/15 text-white'
                      : 'border-game-incorrect bg-game-incorrect/10 text-ui-textMuted';
                  return (
                    <td key={c} className="h-24 w-24">
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setActiveCell({ row: r, col: c })}
                        className={`h-full w-full rounded-2xl border-2 px-1 text-center text-xs font-medium leading-tight ${tone}`}
                      >
                        {cell?.name ?? '+'}
                      </motion.button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {activeCell && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/70"
            onMouseDown={() => setActiveCell(null)}
          >
            <motion.div
              initial={{ y: 20 }} animate={{ y: 0 }} exit={{ y: 10 }}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl border border-white/10 bg-ui-card p-5"
            >
              <p className="eyebrow mb-2">{data.rows[activeCell.row]} × {data.cols[activeCell.col]}</p>
              <AutocompletePicker
                roster={data.roster}
                onSubmit={(name) => {
                  onGuess({ row: activeCell.row, col: activeCell.col, name });
                  setActiveCell(null);
                }}
                placeholder="Pick a name…"
              />
              <button
                onClick={() => setActiveCell(null)}
                className="mt-4 w-full rounded-xl border border-white/10 px-3 py-2 text-sm text-ui-textMuted hover:bg-white/5"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
```

- [ ] **Step 2: Wire into `ThemedDle.tsx`**

```tsx
import { Grid3x3 } from '../components/themed-dle/Grid3x3';
```

Replace the mode dispatch block with:

```tsx
{mode === 'classic' && <ClassicMatrix data={playData} guesses={guessEvents} onGuess={submit} />}
{mode === 'emoji' && <EmojiClue data={playData} guesses={guessEvents} onGuess={submit} />}
{mode === 'silhouette' && <Silhouette data={playData} guesses={guessEvents} onGuess={submit} />}
{mode === 'spell' && <SpellHint data={playData} guesses={guessEvents} onGuess={submit} />}
{mode === 'grid' && (
  <Grid3x3
    data={playData}
    cellEvents={cellEvents}
    onGuess={(p) => socket?.emit('themedDle:guess', p)}
  />
)}
```

Remove the inline `ModeBodyPlaceholder` and its usage — all 5 modes are now covered.

- [ ] **Step 3: Verify build + smoke test**

```bash
cd packages/client && npm run build
```

Force-start `pokedle`, skip to Grid mode (mode 4). Verify:
- Empty 3×3 grid with row labels left, col labels top
- Tap a cell → autocomplete modal opens → pick a Pokémon → cell shows green if it fits both constraints, red if not
- Trying to reuse a valid name shows the "already used" toast (driven by `guess:invalid`)
- Filled count updates ("3/9")
- After 4 minutes, mode results show the valid answers per cell

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/themed-dle/Grid3x3.tsx packages/client/src/screens/ThemedDle.tsx
git commit -m "Implement Grid3x3 mode UI for themed-dle"
```

---

## Phase 8 — Host display shell + intro/results

### Task 8.1: `PlayerProgressPanel`

**Files:**
- Create: `packages/host/src/components/themed-dle/PlayerProgressPanel.tsx`

- [ ] **Step 1: Create the component**

```tsx
interface PlayerProgress {
  guessCount?: number;
  solved?: boolean;
  filledCells?: number;
}
interface PlayerLite { id: string; name: string; connected: boolean; }

interface PlayerProgressPanelProps {
  mode: 'classic' | 'emoji' | 'silhouette' | 'spell' | 'grid';
  players: PlayerLite[];
  progress: Record<string, PlayerProgress>;
  maxGuesses?: number;
}

export const PlayerProgressPanel = ({ mode, players, progress, maxGuesses }: PlayerProgressPanelProps) => {
  const connected = players.filter((p) => p.connected);

  return (
    <aside className="w-80 rounded-3xl border border-white/10 bg-black/30 p-5">
      <p className="eyebrow mb-3">Players</p>
      <ul className="space-y-2">
        {connected.map((p) => {
          const ps = progress[p.id];
          let detail = '⏳';
          if (mode === 'grid') {
            detail = `${ps?.filledCells ?? 0}/9 filled`;
          } else if (ps?.solved) {
            detail = '✓ solved';
          } else if (ps?.guessCount !== undefined) {
            detail = `${ps.guessCount}${maxGuesses ? `/${maxGuesses}` : ''} guesses`;
          }
          return (
            <li key={p.id} className="flex items-baseline justify-between gap-3 rounded-xl bg-black/30 px-3 py-2">
              <span className="font-medium">{p.name}</span>
              <span className="text-sm text-ui-textMuted">{detail}</span>
            </li>
          );
        })}
        {connected.length === 0 && (
          <li className="rounded-xl bg-black/30 px-3 py-3 text-center text-sm text-ui-textMuted">No players connected.</li>
        )}
      </ul>
    </aside>
  );
};
```

---

### Task 8.2: `ModeIntroSplash` + `ModeResultsReveal` (host)

**Files:**
- Create: `packages/host/src/components/themed-dle/ModeIntroSplash.tsx`
- Create: `packages/host/src/components/themed-dle/ModeResultsReveal.tsx`

- [ ] **Step 1: Create `ModeIntroSplash`**

```tsx
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
```

- [ ] **Step 2: Create `ModeResultsReveal`**

```tsx
import { motion } from 'framer-motion';

interface ModeResultsRevealProps {
  data: {
    mode: string;
    modeIndex: number;
    totalModes: number;
    target: any;
    results: Array<{ playerId: string; playerName: string; modeScore: number; cumulativeScore: number }>;
    cumulativeScores: Record<string, number>;
    isLastMode: boolean;
  };
}

const renderTarget = (mode: string, target: any) => {
  if (!target) return null;
  if (mode === 'grid')      return <p className="text-3xl">All valid answers revealed below</p>;
  if (mode === 'spell')     return (<><p className="text-7xl font-bold text-game-leader">{target.incantation}</p><p className="mt-2 text-2xl text-ui-textMuted">{target.effect}</p></>);
  if (mode === 'silhouette') return (
    <div className="flex items-center gap-6">
      {target.spriteUrl && <img src={target.spriteUrl} alt={target.name} className="h-44 w-44 object-contain" />}
      <p className="text-7xl font-bold text-game-leader">{target.name}</p>
    </div>
  );
  return <p className="text-7xl font-bold text-game-leader">{target.name}</p>;
};

export const ModeResultsReveal = ({ data }: ModeResultsRevealProps) => {
  const sorted = [...data.results].sort((a, b) => b.cumulativeScore - a.cumulativeScore);
  const top = sorted.slice(0, 3);
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="flex h-full flex-col items-center justify-center gap-8 px-12 text-center">
      <p className="eyebrow text-xl">It was…</p>
      {renderTarget(data.mode, data.target)}

      <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-black/40 p-6">
        <p className="eyebrow mb-3">Top of the standings</p>
        <ul className="space-y-2 text-2xl">
          {top.map((r, i) => (
            <li key={r.playerId} className="flex items-baseline justify-between gap-4">
              <span className="font-bold">#{i + 1} · {r.playerName}</span>
              <span className="text-game-leader">{r.cumulativeScore} pts</span>
            </li>
          ))}
        </ul>
      </div>

      {!data.isLastMode && <p className="text-xl text-ui-textMuted">Next mode coming…</p>}
      {data.isLastMode  && <p className="text-xl text-game-leader">Wrapping up…</p>}
    </motion.div>
  );
};
```

---

### Task 8.3: `ThemedDleDisplay` host shell

**Files:**
- Create: `packages/host/src/screens/ThemedDleDisplay.tsx`

This is the host's outer shell — wires socket events, dispatches between intro / playing / results, embeds `PlayerProgressPanel`.

- [ ] **Step 1: Create the file**

```tsx
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
          {/* Per-mode views land in Phase 9 */}
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
```

---

### Task 8.4: Wire `ThemedDleDisplay` into `Display.tsx`

**Files:**
- Modify: `packages/host/src/screens/Display.tsx`

The host's `Display.tsx` is large; we slot the themed-dle screen in at the top of the per-game branching, so other branches are untouched.

- [ ] **Step 1: Import + branch**

Near the other screen-component imports at the top:
```tsx
import { ThemedDleDisplay } from './ThemedDleDisplay';
```

Inside the render where `currentGame` is dispatched (after the existing `quiz` / `pointless` blocks but before the fallback), add:

```tsx
if (currentGame === 'pokedle' || currentGame === 'hpdle') {
  return (
    <ThemedDleDisplay
      socket={socket}
      currentGame={currentGame as 'pokedle' | 'hpdle'}
      players={players}
    />
  );
}
```

Use whatever the existing variables are called in this file (search for `socket` and `players` — they should already be in scope). If the existing pattern uses a top-level switch rather than `if`-chain, follow that convention.

- [ ] **Step 2: Verify build**

```bash
cd packages/host && npm run build
```

- [ ] **Step 3: Commit shell**

```bash
git add packages/host/src/components/themed-dle/ packages/host/src/screens/ThemedDleDisplay.tsx packages/host/src/screens/Display.tsx
git commit -m "Add host ThemedDleDisplay shell with intro and results splashes"
```

---

## Phase 9 — Host per-mode views

Same pattern as Phase 3–7 client work: one component per mode, each owns its big-screen rendering. Drop them into `ThemedDleDisplay`'s playing branch.

### Task 9.1: `HostClassicView`

**Files:**
- Create: `packages/host/src/components/themed-dle/HostClassicView.tsx`

- [ ] **Step 1: Create**

```tsx
interface HostClassicViewProps {
  attributes: string[];
}

export const HostClassicView = ({ attributes }: HostClassicViewProps) => (
  <div className="flex h-full flex-col items-center justify-center gap-6">
    <h2 className="text-5xl font-bold">Guess the hidden answer</h2>
    <p className="text-2xl text-ui-textMuted">Match these attributes:</p>
    <div className="flex flex-wrap justify-center gap-3">
      {attributes.map((a) => (
        <span key={a} className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xl">{a}</span>
      ))}
    </div>
  </div>
);
```

### Task 9.2: `HostEmojiView`

**Files:**
- Create: `packages/host/src/components/themed-dle/HostEmojiView.tsx`

The host mirrors *the maximum* number of emojis revealed across all players (so the audience can see hints unlocking).

```tsx
interface HostEmojiViewProps {
  initialEmojis: string[];   // playData.emojis (length 1)
  maxRevealed: number;        // computed from progress.guessCount max + 1, capped at 5
  fullPuzzle?: string[];      // if we receive results.target.emojis, switch to full reveal
}

export const HostEmojiView = ({ initialEmojis, maxRevealed, fullPuzzle }: HostEmojiViewProps) => {
  const visible = fullPuzzle ?? initialEmojis.slice(0, Math.min(5, maxRevealed));
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <div className="flex gap-4 text-9xl">{visible.map((e, i) => <span key={i}>{e}</span>)}</div>
      <p className="text-2xl text-ui-textMuted">{visible.length}/5 emojis</p>
    </div>
  );
};
```

The data plumbing for `maxRevealed` happens in `ThemedDleDisplay`. Since the server doesn't emit per-emoji reveal events to the host, derive it as `1 + max guessCount across non-solved players` (capped at 5). This is approximate but visually fine; refine in the polish phase if needed.

### Task 9.3: `HostSilhouetteView`

**Files:**
- Create: `packages/host/src/components/themed-dle/HostSilhouetteView.tsx`

```tsx
interface HostSilhouetteViewProps {
  spriteUrl: string;
  stage: number; // 0..5 — derived from min(guessCount across players)
}
const ZOOM       = [3.0, 2.4, 1.8, 1.4, 1.1, 1.0];
const BRIGHTNESS = [0, 0, 0.1, 0.3, 0.6, 1.0];
export const HostSilhouetteView = ({ spriteUrl, stage }: HostSilhouetteViewProps) => {
  const idx = Math.max(0, Math.min(5, stage));
  return (
    <div className="flex h-full items-center justify-center">
      <div className="aspect-square w-[40vmin] overflow-hidden rounded-3xl border border-white/10 bg-black/40">
        <img
          src={spriteUrl}
          alt="silhouette"
          style={{
            transform: `scale(${ZOOM[idx]})`,
            filter: `brightness(${BRIGHTNESS[idx]})`,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transition: 'all 0.5s'
          }}
        />
      </div>
    </div>
  );
};
```

### Task 9.4: `HostSpellView`

**Files:**
- Create: `packages/host/src/components/themed-dle/HostSpellView.tsx`

```tsx
interface HostSpellViewProps {
  effect: string;
  category: string;
  incantationLength: number;
  hintsUnlocked: number; // max hint tier any player reached (0..3)
}

const HINT_PLACEHOLDERS = [
  '·',
  'When used: hidden',
  'Caster: hidden',
  'Letters: ?…?'
];

export const HostSpellView = ({ effect, category, incantationLength, hintsUnlocked }: HostSpellViewProps) => (
  <div className="flex h-full flex-col items-center justify-center gap-6 px-12 text-center">
    <p className="eyebrow text-2xl">{category}</p>
    <p className="text-5xl font-bold text-white">{effect}</p>
    <p className="text-xl text-ui-textMuted">Incantation: {incantationLength} characters</p>
    <p className="text-xl text-ui-textMuted">Hint tier reached: {hintsUnlocked}/3</p>
  </div>
);
```

### Task 9.5: `HostGridView`

**Files:**
- Create: `packages/host/src/components/themed-dle/HostGridView.tsx`

```tsx
interface HostGridViewProps {
  rows: string[];
  cols: string[];
  reveal?: Record<string, string[]>; // cellAnswers from results — present on the results splash, omit during play
}

export const HostGridView = ({ rows, cols, reveal }: HostGridViewProps) => (
  <div className="flex h-full flex-col items-center justify-center">
    <table className="border-separate border-spacing-2">
      <thead>
        <tr>
          <th />
          {cols.map((c) => <th key={c} className="px-2 py-2 text-lg">{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={r}>
            <th className="pr-3 text-right text-lg">{r}</th>
            {cols.map((_, ci) => {
              const answers = reveal?.[`${ri},${ci}`] || [];
              return (
                <td key={ci} className="h-28 w-44 rounded-2xl border-2 border-white/10 bg-black/30 px-2 py-1 align-top text-xs">
                  {answers.slice(0, 4).map((a) => <div key={a}>{a}</div>)}
                  {answers.length > 4 && <div className="text-ui-textMuted">+{answers.length - 4}</div>}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
```

### Task 9.6: Wire all host mode views into `ThemedDleDisplay`

**Files:**
- Modify: `packages/host/src/screens/ThemedDleDisplay.tsx`

- [ ] **Step 1: Compute derived host state, dispatch by mode**

Replace the `<p>Mode {mode} display coming…</p>` line with a switch on `mode` that uses `playData` + `progress`:

```tsx
import { HostClassicView } from '../components/themed-dle/HostClassicView';
import { HostEmojiView } from '../components/themed-dle/HostEmojiView';
import { HostSilhouetteView } from '../components/themed-dle/HostSilhouetteView';
import { HostSpellView } from '../components/themed-dle/HostSpellView';
import { HostGridView } from '../components/themed-dle/HostGridView';
```

```tsx
const maxGuess = Math.max(0, ...Object.values(progress).map((p: any) => p.guessCount ?? 0));
const minGuess = Object.keys(progress).length > 0
  ? Math.min(...Object.values(progress).map((p: any) => p.guessCount ?? 0))
  : 0;
// emoji revealed = 1 + maxGuess, capped at 5
const emojiRevealCount = Math.min(5, 1 + maxGuess);
const hintsUnlocked = Math.min(3, maxGuess); // 1 wrong → 1 hint, etc.

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
```

- [ ] **Step 2: Verify build**

```bash
cd packages/host && npm run build
```

- [ ] **Step 3: Smoke test (host display)**

Start the host display alongside the player. Force-start `pokedle`. Walk through each mode and confirm:
- Classic: big "Guess the hidden answer" + attribute chips
- Emoji: emoji count on host grows as any player's `guessCount` rises
- Silhouette: silhouette de-zooms as the slowest player makes guesses
- Spell: shows effect + category + hint tier reached
- Grid: shows blank 3×3 with row/col labels

- [ ] **Step 4: Commit**

```bash
git add packages/host/src/components/themed-dle/Host*.tsx packages/host/src/screens/ThemedDleDisplay.tsx
git commit -m "Implement host per-mode views for themed-dle"
```

---

## Phase 10 — Host dashboard buttons

### Task 10.1: Add Pokédle + HP-dle to dashboard

**Files:**
- Modify: `packages/host/src/screens/Dashboard.tsx`

- [ ] **Step 1: Extend `availableGames`**

Find the `availableGames` array (around line 61) and replace with:

```tsx
const availableGames = [
  { id: 'quiz', name: 'Quiz' },
  { id: 'trueFalse', name: 'True or False' },
  { id: 'pointless', name: 'Pointless' },
  { id: 'pokedle', name: 'Pokédle' },
  { id: 'hpdle', name: 'HP-dle' }
];
```

- [ ] **Step 2: Add two start buttons**

Find the `!championshipMode &&` block (around line 586). Inside the `<div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">`, after the existing three buttons, add:

```tsx
<button
  onClick={() => startGame('pokedle')}
  disabled={gameState?.phase !== 'lobby'}
  className="btn bg-yellow-500 text-black"
>
  Start Pokédle
</button>
<button
  onClick={() => startGame('hpdle')}
  disabled={gameState?.phase !== 'lobby'}
  className="btn bg-purple-600"
>
  Start HP-dle
</button>
```

- [ ] **Step 3: Update default `selectedGames` if you want themed-dle in the default championship**

Optional — adjust `useState<Set<string>>(new Set(['quiz', 'trueFalse', 'pointless']))` to include `'pokedle', 'hpdle'` if desired. Leave alone for now.

- [ ] **Step 4: Extend the championship-standings render array**

Around line 768 of `Dashboard.tsx`:
```tsx
{(['quiz', 'trueFalse', 'pointless'] as GameKey[]).map((game) => (
```

Replace with:
```tsx
{(['quiz', 'trueFalse', 'pointless', 'pokedle', 'hpdle'] as GameKey[]).map((game) => (
```

(`countdown` is intentionally absent — it's not championship-eligible in this build.)

- [ ] **Step 5: Verify build**

```bash
cd packages/host && npm run build
```

- [ ] **Step 5: Smoke test**

Open the host dashboard. In the non-championship block, confirm two new buttons appear. Click Start Pokédle — verify the player and the host display both transition into the Pokédle flow. Return to lobby, then Start HP-dle.

- [ ] **Step 6: Commit**

```bash
git add packages/host/src/screens/Dashboard.tsx
git commit -m "Add Pokédle and HP-dle to host dashboard start menu"
```

---

## Phase 11 — Full smoke test + polish

### Task 11.1: Full end-to-end run

- [ ] **Step 1: Run the full Pokédle session**

Three terminals up. Join 2 players (different browser tabs). From the host, click **Start Pokédle**. Walk through all four modes for both players. Verify:

- Each mode's intro splash plays for ~8s
- During play, each player can submit guesses; private feedback isolated per player
- `cumulative` score persists across modes (visible in the score bar)
- After mode 4 (Grid), `game:end` fires, leaderboard shows, then return-to-lobby works

- [ ] **Step 2: Repeat for HP-dle**

Same flow but with **Start HP-dle**. Confirm spell mode replaces silhouette.

- [ ] **Step 3: Edge cases**

For each of these, verify the spec's expected behavior:
- Player submits a non-roster name → toast "X not in roster", no guess consumed
- Player tries to reuse a name in Grid mode → toast "already used"
- All players solve before timer → mode auto-ends
- Player joins mid-game → sees current mode without retroactive score
- Player disconnects mid-mode → marked as 0 / unsolved on results screen

- [ ] **Step 4: Run the championship flow**

Toggle championship mode on dashboard. Select Pokédle + HP-dle. Click Start Championship. Confirm:
- Pokédle runs all 4 modes
- Leaderboard between games shows "Continue to Next Round"
- Clicking continue starts HP-dle automatically (via `requestGameStart` engine event)
- Final session leaderboard shows on `session:end`

### Task 11.2: Final verification + commit

- [ ] **Step 1: Run all builds**

```bash
cd packages/client && npm run build
cd ../host && npm run build
cd ../server && npm run start &  # confirm server still boots
```

- [ ] **Step 2: Tag the worktree state**

```bash
git status
git log --oneline -15
```

Confirm phase commits are present in order.

- [ ] **Step 3: Final polish commit (if needed)**

If smoke-testing exposes small visual issues (label truncation, missing eyebrow, etc.), fix in a single commit:

```bash
git add -A
git commit -m "Polish themed-dle UI after end-to-end smoke test"
```

---

## Self-Review Checklist

Run before declaring the plan ready for execution:

1. **Spec coverage** — every section of `docs/themedDle-implementation.md`:
   - §2 server status — N/A, already done ✓
   - §4 socket events — covered (Phase 2 ThemedDle shell + Phase 8 ThemedDleDisplay shell wire all event names) ✓
   - §6 Mode-by-mode UI — covered (Phases 3, 4, 5, 6, 7 for client; Phase 9 for host) ✓
   - §7 client file list — every file listed has a creation task ✓
   - §8 host file list — every file listed has a creation task ✓
   - §9 host dashboard buttons — Phase 10 ✓
   - §11 test plan — Phase 11 ✓
2. **Placeholder scan** — no "TBD"/"add appropriate error handling" — verified.
3. **Type consistency** — `pokedle | hpdle` unions added in Task 0.1 and 0.2 in the same shape; mode unions identical in every component; `themedDle:guess` payload shape matches server-side router in [packages/server/src/index.js:479](../../../packages/server/src/index.js:479).
4. **Ambiguity** — host emoji-reveal logic uses an approximation (`max guessCount + 1`); flagged as "refine in polish if needed."
