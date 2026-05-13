# PHoG UI Redesign — Phase 7: Wordle + WordleDisplay

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Wordle player screen (`packages/client/src/screens/Wordle.tsx` + `components/wordle/WordleBoard.tsx` + `components/wordle/Keyboard.tsx`) and the Wordle host display (`packages/host/src/screens/WordleDisplay.tsx`) to the new UI design system. Replace the hand-rolled tile/keyboard markup with the `Tile` primitive (and Tile-styled keyboard buttons) consuming the design tokens. Use the primitive's `flipping` + `flipDelaySec` props for the row-reveal cascade. Keep the existing socket plumbing, game logic, and cumulative-keyboard-state derivation unchanged.

**Architecture:**

- The **player board** becomes a 6 × 5 grid of `Tile` components. State per tile is `idle | correct | partial | wrong`. The `green/yellow/grey` palette from the server maps to `correct/partial/wrong`. Greys are rendered as `wrong` (red) per spec §2.1 ("Tile / keyboard colors map to: green = --action, yellow = --now, red = --danger").
- The **row-reveal animation** uses the existing `Tile` primitive — pass `flipping={true}` to the five tiles of the just-submitted row, each with `flipDelaySec` of `0, 0.18, 0.36, 0.54, 0.72`. No new animation code is added.
- The **keyboard** keeps the existing `keyboardStates` `useMemo` derivation; only the rendered keys change — each key is a `<motion.button>` shaped like a `Tile` (border-ink, hard shadow), recoloured via the same `idle/correct/partial/wrong` palette. On row resolution, the cumulative keyboard recolour happens automatically (state derives from `rows`); each newly coloured key animates a small scale pop (`1.0 → 1.06 → 1.0`, 200ms).
- The **invalid-word toast** becomes a `Chip variant="default"` styled with the `danger` palette, mounted with a fade/slide-in via framer-motion.
- The **host display** keeps the same socket subscriptions. Its layout is rebuilt to the host-screen skeleton sketch from spec §7.3:
  - Top-left: "Wordle — round in progress" location label
  - Top-right: time-left panel
  - Centre during play: hidden answer (server only reveals it in `:round:results`), so during play the centre shows large empty placeholder tiles (5 × `Tile state="idle"`) under a "Find the 5-letter word" banner. **The actual word reveal only renders on the results screen.**
  - Bottom: player tracker — per-player guess counts in a `Chip`-styled card row showing `Ana — 2 guesses`, `Fern — did not solve`, etc.
- The **results phase** on the host renders the answer as a row of 5 large `Tile state="correct"` tiles with the answer letters, plus a per-player guess-count list below.
- The **results phase** on the player keeps the same content (answer + your-result block) but is restyled to consume `Card`, `Chip`, and `Tile` primitives.

**Tech stack:** React 18 · TypeScript 5.3 · Tailwind 3.4 · framer-motion 10. No new dependencies.

**Spec reference:** [docs/superpowers/specs/2026-05-13-ui-redesign-design.md](../specs/2026-05-13-ui-redesign-design.md) — §3.5 (Tile), §4.4 (Wordle flip cascade + keyboard recolor cascade), §7.1 (Wordle player), §7.3 (Wordle host display).

**Out of scope for this plan:**

- Any change to `packages/server/` — the `wordle:*` socket protocol, scoring, and `coloring.ts` algorithm are unchanged.
- Migrating any other game (ThemedDle, Numbers, Travel, etc.) — those are separate phases.
- Removing the legacy `index.css` rules `.screen-shell`, `.screen-frame`, `.eyebrow` — they stay until the final cleanup phase.
- A shared host-screen "chrome" primitive — until that exists, this plan implements the location-top-left / time-top-right / tracker-bottom skeleton inline in `WordleDisplay.tsx`. A later phase can extract it.

---

## File map

**Client (`packages/client/`):**

- Modify: `src/screens/Wordle.tsx`
- Modify: `src/components/wordle/WordleBoard.tsx` (rebuilt around `Tile` primitive)
- Modify: `src/components/wordle/Keyboard.tsx` (rebuilt around `Tile`-shaped buttons)

**Host (`packages/host/`):**

- Modify: `src/screens/WordleDisplay.tsx`

No new files, no test files. Visual QA happens via a real playthrough (per spec §7.6).

---

## Tasks

### Task 1: Migrate `WordleBoard` to the `Tile` primitive (idle / static states only)

Replace the hand-rolled `<motion.div>` tiles with the existing `Tile` primitive. No animation changes yet — the row flip stagger comes in Task 3. This task only swaps the static appearance + colour palette.

**Files:**

- Modify: `packages/client/src/components/wordle/WordleBoard.tsx`

- [ ] **Step 1: Rewrite `WordleBoard.tsx`**

The new file:

```tsx
import { Tile, type TileState } from '../../ui/Tile';

interface WordleBoardProps {
  rows: Array<{ guess: string; colors: ('green' | 'yellow' | 'grey')[] }>;
  current: string;         // the in-progress guess on the next row
  maxGuesses: number;
  /**
   * Index of the row currently being flipped (i.e. the row that was just
   * appended to `rows`). When set, the 5 tiles in that row animate the
   * flip cascade (Task 3 wires this in from Wordle.tsx). `null` = no flip.
   */
  flippingRowIndex?: number | null;
}

// Server `green/yellow/grey` → Tile primitive state (`grey` becomes `wrong` red
// per spec §2.1 — Wordle tile colors map to action/now/danger).
const COLOR_TO_STATE: Record<'green' | 'yellow' | 'grey', TileState> = {
  green: 'correct',
  yellow: 'partial',
  grey: 'wrong',
};

export const WordleBoard = ({ rows, current, maxGuesses, flippingRowIndex = null }: WordleBoardProps) => {
  // Build a 6-row × 5-col view model.
  type Cell = { ch: string; state: TileState };
  const visible: Cell[][] = [];

  for (const r of rows) {
    visible.push(
      r.guess.toUpperCase().split('').map((ch, i) => ({
        ch,
        state: COLOR_TO_STATE[r.colors[i]],
      })),
    );
  }
  if (visible.length < maxGuesses) {
    const padded = current.toUpperCase().padEnd(5, ' ').split('');
    visible.push(padded.map((ch) => ({ ch: ch.trim(), state: 'idle' as TileState })));
    while (visible.length < maxGuesses) {
      visible.push([0, 1, 2, 3, 4].map(() => ({ ch: '', state: 'idle' as TileState })));
    }
  }

  return (
    <div className="mx-auto grid grid-rows-6 gap-2">
      {visible.map((row, ri) => {
        const isFlipping = ri === flippingRowIndex;
        return (
          <div key={ri} className="grid grid-cols-5 gap-2">
            {row.map((cell, ci) => (
              <Tile
                key={ci}
                state={cell.state}
                flipping={isFlipping}
                flipDelaySec={isFlipping ? ci * 0.18 : 0}
                className="aspect-square w-14 text-2xl"
              >
                {cell.ch}
              </Tile>
            ))}
          </div>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript + build**

```bash
cd packages/client
npm run build
```

Expected: build succeeds. The `flippingRowIndex` prop is optional and unused by callers yet, so no other file needs changing.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/wordle/WordleBoard.tsx
git commit -m "feat(client/wordle): rebuild WordleBoard on Tile primitive"
```

---

### Task 2: Migrate the on-screen Keyboard to Tile-styled buttons

Keep the API and `states` prop shape unchanged so `Wordle.tsx` doesn't need any logic edits in this task — only the rendered look changes. Letter keys become Tile-shaped buttons; Enter and Backspace get distinguishing variants.

**Files:**

- Modify: `packages/client/src/components/wordle/Keyboard.tsx`

- [ ] **Step 1: Rewrite `Keyboard.tsx`**

```tsx
import { motion } from 'framer-motion';
import type { TileState } from '../../ui/Tile';

type ServerColor = 'green' | 'yellow' | 'grey';

interface KeyboardProps {
  states: Record<string, ServerColor>;
  onLetter: (l: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  disabled?: boolean;
}

const ROW1 = 'qwertyuiop'.split('');
const ROW2 = 'asdfghjkl'.split('');
const ROW3 = 'zxcvbnm'.split('');

// Server color → Tile state palette (matches WordleBoard).
const COLOR_TO_STATE: Record<ServerColor, TileState> = {
  green: 'correct',
  yellow: 'partial',
  grey: 'wrong',
};

const KEY_BG: Record<TileState | 'unused', string> = {
  unused:  'bg-bg-surface text-ink',
  idle:    'bg-bg-surface text-ink', // shouldn't appear, kept for completeness
  correct: 'bg-action text-on-action',
  partial: 'bg-now text-on-now',
  wrong:   'bg-danger text-on-danger',
};

export const Keyboard = ({ states, onLetter, onBackspace, onEnter, disabled }: KeyboardProps) => {
  const letterButton = (l: string) => {
    const serverState = states[l];
    const state: TileState | 'unused' = serverState ? COLOR_TO_STATE[serverState] : 'unused';
    return (
      <motion.button
        key={l}
        type="button"
        disabled={disabled}
        onClick={() => onLetter(l)}
        // Pop the key when it first gets a non-unused state. framer-motion
        // re-runs `animate` whenever the dependency-deduped value changes;
        // when a fresh row colours a key, `state` flips from "unused" to
        // correct/partial/wrong and the scale keyframes play once.
        initial={false}
        animate={{ scale: state === 'unused' ? 1 : [1, 1.06, 1] }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        whileTap={!disabled ? { scale: 0.94 } : undefined}
        className={[
          'h-12 min-w-[2rem] flex-1 rounded-lg border-2 border-ink px-1 text-sm font-extrabold uppercase shadow-ink-sm',
          'disabled:opacity-50',
          'sm:h-14 sm:text-base',
          KEY_BG[state],
        ].join(' ')}
      >
        {l}
      </motion.button>
    );
  };

  return (
    <div className="space-y-1.5">
      <div className="flex justify-center gap-1.5">{ROW1.map(letterButton)}</div>
      <div className="flex justify-center gap-1.5">{ROW2.map(letterButton)}</div>
      <div className="flex justify-center gap-1.5">
        <motion.button
          type="button"
          disabled={disabled}
          onClick={onEnter}
          whileTap={!disabled ? { scale: 0.94 } : undefined}
          className="h-12 rounded-lg border-2 border-ink bg-action px-3 text-xs font-extrabold uppercase text-on-action shadow-ink-sm disabled:opacity-50 sm:h-14 sm:text-sm"
        >
          Enter
        </motion.button>
        {ROW3.map(letterButton)}
        <motion.button
          type="button"
          disabled={disabled}
          onClick={onBackspace}
          whileTap={!disabled ? { scale: 0.94 } : undefined}
          className="h-12 rounded-lg border-2 border-ink bg-bg-sunken px-3 text-xs font-extrabold uppercase text-ink shadow-ink-sm disabled:opacity-50 sm:h-14 sm:text-sm"
        >
          ⌫
        </motion.button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Build**

```bash
cd packages/client
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/wordle/Keyboard.tsx
git commit -m "feat(client/wordle): rebuild Keyboard on Tile-styled buttons + pop animation"
```

---

### Task 3: Wire the row-flip cascade in `Wordle.tsx`

The board now accepts an optional `flippingRowIndex` prop. In `Wordle.tsx`, whenever a new row is appended (i.e. `onResult` fires), set `flippingRowIndex` to that row's index, then clear it after the animation completes (the longest tile finishes at `flipDelaySec 0.72 + 0.25 = 0.97s`; clear at ~1.05s to be safe).

**Files:**

- Modify: `packages/client/src/screens/Wordle.tsx`

- [ ] **Step 1: Add `flippingRowIndex` state and update `onResult`**

In `Wordle.tsx`, near the other state hooks (after `const [invalidToast, setInvalidToast] = ...`), add:

```ts
const [flippingRowIndex, setFlippingRowIndex] = useState<number | null>(null);
```

Replace the `onResult` handler with:

```ts
const onResult = (d: any) => {
  setRows((prev) => {
    const next = [...prev, { guess: d.guess, colors: d.colors }];
    // Trigger flip on the newly added row.
    const newIndex = next.length - 1;
    setFlippingRowIndex(newIndex);
    // Clear after the cascade completes (4 × 0.18 + 0.25 ≈ 0.97s).
    setTimeout(() => setFlippingRowIndex((cur) => (cur === newIndex ? null : cur)), 1100);
    return next;
  });
  setDraft('');
  if (d.solved) setSolved(true);
};
```

- [ ] **Step 2: Pass `flippingRowIndex` to `WordleBoard`**

Find the existing `<WordleBoard rows={rows} current={solved ? '' : draft} maxGuesses={MAX} />` and replace with:

```tsx
<WordleBoard
  rows={rows}
  current={solved ? '' : draft}
  maxGuesses={MAX}
  flippingRowIndex={flippingRowIndex}
/>
```

- [ ] **Step 3: Build**

```bash
cd packages/client
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/screens/Wordle.tsx
git commit -m "feat(client/wordle): wire row-flip cascade via Tile flipping + flipDelaySec"
```

---

### Task 4: Restyle the Wordle playing-phase chrome (timer + invalid toast)

Replace the legacy `eyebrow / screen-shell / screen-frame / bg-game-leader` chrome on the playing-phase view with primitives + tokens. Keep the layout shape (header + timer bar + board + toast + keyboard + status line).

**Files:**

- Modify: `packages/client/src/screens/Wordle.tsx`

- [ ] **Step 1: Import primitives**

At the top of `Wordle.tsx`, add:

```ts
import { AnimatePresence } from 'framer-motion';
import { Chip } from '../ui/Chip';
```

- [ ] **Step 2: Replace the playing-phase JSX**

Replace the entire `return (...)` block at the end of the component (the one starting `<div className="screen-shell py-4">` and ending `</div></div>`) with:

```tsx
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
```

- [ ] **Step 3: Build**

```bash
cd packages/client
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/screens/Wordle.tsx
git commit -m "feat(client/wordle): restyle playing-phase chrome with tokens + Chip toast"
```

---

### Task 5: Restyle the Wordle intro and results phases

Replace the `screen-shell / screen-frame / text-game-leader` styles on the intro and results phases with the new token-driven layout. Render the answer on the results screen as a row of 5 `Tile state="correct"` tiles. Wrap the per-player result in a `Card`.

**Files:**

- Modify: `packages/client/src/screens/Wordle.tsx`

- [ ] **Step 1: Add Card + Tile imports**

Add to the top imports:

```ts
import { Card } from '../ui/Card';
import { Tile } from '../ui/Tile';
```

- [ ] **Step 2: Replace the intro-phase JSX**

Replace the `if (phase === 'intro' && introData) { return (...) }` block with:

```tsx
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
```

- [ ] **Step 3: Replace the results-phase JSX**

Replace the `if (phase === 'results' && resultsData) { return (...) }` block with:

```tsx
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
```

- [ ] **Step 4: Replace the loading fallback JSX**

The remaining `if (phase !== 'playing' || !roundData) { return (...) }` block becomes:

```tsx
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
```

- [ ] **Step 5: Build**

```bash
cd packages/client
npm run build
```

Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/screens/Wordle.tsx
git commit -m "feat(client/wordle): restyle intro + results phases with Card + Tile"
```

---

### Task 6: Migrate the `WordleDisplay` host playing screen (chrome skeleton)

Rebuild the host playing-phase layout to the spec §7.3 skeleton: location top-left, time-left top-right, content centre, player tracker bottom. Use design tokens. Don't change the results phase yet (Task 7) or the intro phase (Task 9).

**Files:**

- Modify: `packages/host/src/screens/WordleDisplay.tsx`

- [ ] **Step 1: Add primitive imports**

At the top of `WordleDisplay.tsx`, add:

```ts
import { Chip } from '../ui/Chip';
import { Tile } from '../ui/Tile';
```

- [ ] **Step 2: Replace the playing-phase JSX**

Replace the entire `return (...)` block at the end of the component (the one starting `<div className="flex h-screen w-screen flex-col items-center px-10 py-10">`) with:

```tsx
const connected = players.filter((p) => p.connected);
const solvedCount = connected.filter((p) => progress[p.id]?.solved).length;

return (
  <div className="flex h-screen w-screen flex-col bg-bg-base px-10 py-8 text-ink">
    {/* Top row: location top-left, time-left top-right */}
    <header className="flex items-start justify-between">
      <div className="font-display text-2xl font-extrabold tracking-tight">
        Wordle — round in progress
      </div>
      <div className="text-right">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">
          Time left
        </p>
        <p className="font-display text-5xl font-extrabold tabular-nums">
          {Math.ceil(timerMs / 1000)}s
        </p>
      </div>
    </header>

    {/* Centre: play-phase banner (server keeps the answer secret until results) */}
    <section className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <Chip variant="info">Find the 5-letter word</Chip>
      <div className="flex gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Tile key={i} state="idle" className="aspect-square w-24 text-5xl">
            {''}
          </Tile>
        ))}
      </div>
      <p className="text-lg text-ink-muted">
        {solvedCount} of {connected.length} solved
      </p>
    </section>

    {/* Bottom: player tracker */}
    <footer className="w-full">
      {connected.length === 0 ? (
        <p className="text-center text-ink-muted">No players connected.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {connected.map((p) => {
            const s = progress[p.id];
            const guessesUsed = s?.guessesUsed ?? 0;
            const isSolved = s?.solved ?? false;
            const isFailed = !isSolved && guessesUsed >= 6;
            let statusLabel = `${guessesUsed} of 6 guesses`;
            if (isSolved) statusLabel = `Solved in ${guessesUsed}`;
            else if (isFailed) statusLabel = 'Did not solve';
            const tone = isSolved
              ? 'border-action bg-action text-on-action'
              : isFailed
                ? 'border-danger bg-danger text-on-danger'
                : 'border-ink bg-bg-surface text-ink';
            return (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl border-2 px-4 py-3 shadow-ink-sm ${tone}`}
              >
                <p className="truncate font-display text-xl font-extrabold">{p.name}</p>
                <p className="mt-1 text-sm font-semibold">{statusLabel}</p>
              </motion.div>
            );
          })}
        </div>
      )}
    </footer>
  </div>
);
```

- [ ] **Step 3: Build**

```bash
cd packages/host
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/host/src/screens/WordleDisplay.tsx
git commit -m "feat(host/wordle): rebuild playing-phase layout on host-screen skeleton"
```

---

### Task 7: Migrate the `WordleDisplay` host results-phase word reveal

Render the final answer on the host as a row of 5 large `Tile state="correct"` tiles (TV-sized). Replace the existing top-5 list with the per-player guess-count tracker the spec requires (§7.3 — "player tracker shows per-player guess counts"). Keep the existing socket subscriptions; only rendering changes.

**Files:**

- Modify: `packages/host/src/screens/WordleDisplay.tsx`

- [ ] **Step 1: Replace the results-phase JSX**

Replace the `if (phase === 'results' && resultsData) { return (...) }` block with:

```tsx
if (phase === 'results' && resultsData) {
  const answer = String(resultsData.answer || '').toUpperCase().padEnd(5, ' ').slice(0, 5);
  const byPlayer = new Map<string, any>();
  for (const r of resultsData.results || []) byPlayer.set(r.playerId, r);

  return (
    <div className="flex h-screen w-screen flex-col bg-bg-base px-10 py-8 text-ink">
      {/* Top row: location top-left, time dimmed top-right (results phase) */}
      <header className="flex items-start justify-between">
        <div className="font-display text-2xl font-extrabold tracking-tight">
          Wordle — Reveal
        </div>
        <div className="text-right">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">
            Time left
          </p>
          <p className="font-display text-5xl font-extrabold tabular-nums text-ink-muted">
            —:—
          </p>
        </div>
      </header>

      {/* Centre: TV-sized word reveal */}
      <section className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <Chip variant="streak">The word was</Chip>
        <div className="flex gap-3">
          {answer.split('').map((ch, i) => (
            <Tile
              key={i}
              state="correct"
              flipping
              flipDelaySec={i * 0.18}
              className="aspect-square w-32 text-7xl"
            >
              {ch.trim()}
            </Tile>
          ))}
        </div>
      </section>

      {/* Bottom: player tracker — per-player guess counts (spec §7.3) */}
      <footer className="w-full">
        {players.length === 0 ? (
          <p className="text-center text-ink-muted">No players this round.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {players.map((p) => {
              const r = byPlayer.get(p.id);
              const solved = r?.solved ?? false;
              const guessesUsed = r?.guessesUsed ?? 0;
              let label = 'No submission';
              if (r) {
                label = solved
                  ? `Solved in ${guessesUsed} guess${guessesUsed === 1 ? '' : 'es'}`
                  : `Did not solve (${guessesUsed} guesses)`;
              }
              const tone = solved
                ? 'border-action bg-action text-on-action'
                : r
                  ? 'border-danger bg-danger text-on-danger'
                  : 'border-ink bg-bg-surface text-ink';
              return (
                <div
                  key={p.id}
                  className={`rounded-2xl border-2 px-4 py-3 shadow-ink-sm ${tone}`}
                >
                  <p className="truncate font-display text-xl font-extrabold">
                    {p.name}
                    {r?.firstSolver && (
                      <span className="ml-2 align-middle text-sm">⭐ first</span>
                    )}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{label}</p>
                </div>
              );
            })}
          </div>
        )}
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Build**

```bash
cd packages/host
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/host/src/screens/WordleDisplay.tsx
git commit -m "feat(host/wordle): TV-sized word reveal + per-player guess-count tracker"
```

---

### Task 8: Migrate the `WordleDisplay` intro phase

Restyle the host intro phase to match the new design system. The intro is brief (the server moves to `:round:start` quickly) so just align it visually.

**Files:**

- Modify: `packages/host/src/screens/WordleDisplay.tsx`

- [ ] **Step 1: Replace the intro-phase JSX**

Replace the `if (phase === 'intro' && introData) { return (...) }` block with:

```tsx
if (phase === 'intro' && introData) {
  return (
    <div className="flex h-screen w-screen flex-col bg-bg-base px-10 py-8 text-ink">
      <header className="flex items-start justify-between">
        <div className="font-display text-2xl font-extrabold tracking-tight">
          Wordle
        </div>
        <div className="text-right">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">
            Time left
          </p>
          <p className="font-display text-5xl font-extrabold tabular-nums text-ink-muted">
            —:—
          </p>
        </div>
      </header>
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-1 flex-col items-center justify-center gap-6 text-center"
      >
        <Chip variant="info">Game starting</Chip>
        <h1 className="font-serif text-7xl font-extrabold tracking-tight sm:text-8xl">
          {introData.title}
        </h1>
        <p className="text-2xl text-ink-muted sm:text-3xl">{introData.description}</p>
      </motion.section>
      <footer />
    </div>
  );
}
```

Also replace the loading fallback (the `if (phase !== 'playing' || !roundData)` block):

```tsx
if (phase !== 'playing' || !roundData) {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-bg-base text-ink">
      <p className="font-display text-3xl font-extrabold">Loading…</p>
    </div>
  );
}
```

- [ ] **Step 2: Build**

```bash
cd packages/host
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/host/src/screens/WordleDisplay.tsx
git commit -m "feat(host/wordle): restyle intro + loading phases on token system"
```

---

### Task 9: End-to-end verification — Wordle player + host playthrough

- [ ] **Step 1: Build all three packages**

```bash
cd packages/server && npm run build
cd ../client && npm run build
cd ../host && npm run build
```

Expected: all three builds succeed.

- [ ] **Step 2: Start the three dev servers**

Per `QUICKSTART.md`:

```bash
# Terminal 1
cd packages/server && npm run dev
# Terminal 2
cd packages/client && npm run dev
# Terminal 3
cd packages/host && npm run dev
```

- [ ] **Step 3: Play one Wordle round end-to-end**

1. Open the host at http://localhost:5174 and log in.
2. Open the client at http://localhost:5173 in two tabs and join as two different players.
3. Start a Wordle round from the host dashboard.

Verify:

- **Player intro screen:** chunky `Chip` eyebrow, big title, scoring rules in token-styled cards.
- **Player playing screen:** 6 × 5 grid of `Tile`s, info Chip + timer at top, action-coloured timer bar.
- **Player keyboard:** Tile-shaped keys; greys/yellows/greens land on submitted rows; keyboard recolours after the row reveal.
- **Player flip cascade:** submitting a guess flips the row tile-by-tile (left→right, 180 ms stagger, 250 ms each flip), colours appear at the flip midpoint.
- **Player invalid toast:** typing 4 letters and pressing Enter shows a red Chip-styled toast for ~2 s.
- **Player results screen:** answer rendered as 5 green `Tile`s; per-player result in a `Card`.
- **Host playing screen:** "Wordle — round in progress" top-left, time-left top-right, empty Tiles centre, player tracker grid bottom with "X of Y guesses" / "Solved in N" / "Did not solve" status.
- **Host results screen:** answer rendered as 5 TV-sized green `Tile`s with a left-to-right flip cascade, time-left dimmed to "—:—", per-player tracker shows "Solved in N" / "Did not solve" / "No submission" for every player.

- [ ] **Step 4: Verify light + dark themes**

On both client and host:

1. Open the theme toggle (currently lives on the `?showcase` page; verify by appending `?showcase` and clicking it, then navigating back).
2. Reload — wordle screens render correctly in both light and dark.

Expected: every primitive recolours; no hard-coded dark hexes leak through.

- [ ] **Step 5: Smoke-test the other games still work**

Open Quiz, TrueFalse, Pointless, ThemedDle, Numbers, Travel from the host dashboard. Each game should look exactly as it did before this plan (still using legacy `index.css`).

Expected: no visual regression outside Wordle.

- [ ] **Step 6: Stop dev servers**

Nothing to commit in this task — it's pure verification.

---

## Done criteria

All of the following must be true before the plan is considered complete:

- [ ] `npm run build` succeeds in `packages/server`, `packages/client`, and `packages/host`.
- [ ] Player Wordle board is rendered by the `Tile` primitive; row submission triggers a 5-tile flip cascade with 180 ms stagger and colours resolve at flip midpoint.
- [ ] Player keyboard renders as Tile-styled buttons; recolours cumulatively from `keyboardStates`; newly coloured keys pop once (`1.0 → 1.06 → 1.0`, 200 ms).
- [ ] Invalid-word toast renders as a red Chip-styled banner that fades in/out.
- [ ] Player intro and results phases consume `Card`, `Chip`, and `Tile`; no `screen-shell`/`screen-frame`/`text-game-leader` classes remain in `Wordle.tsx`.
- [ ] Host `WordleDisplay` uses the host-screen skeleton (location top-left, time top-right, content centre, tracker bottom) on every phase; time-left is dimmed to "—:—" on intro and results.
- [ ] Host results-phase word reveal is a 5-tile TV-sized row of `Tile state="correct"`, animated with a left-to-right flip cascade.
- [ ] Host player tracker shows per-player guess counts (spec §7.3).
- [ ] Light and dark themes both render Wordle correctly with no hard-coded dark hexes.
- [ ] No other game visually regressed.

---

## What this plan does NOT do

- Touch the `wordle:*` socket protocol or server-side `coloring.ts`.
- Extract a shared `HostScreenChrome` primitive — the location/time/tracker skeleton is implemented inline in `WordleDisplay.tsx` for now; a later phase can extract it once two or more host screens converge on the same shape.
- Migrate `GamePromptHeader` — Wordle's player chrome is simple enough that it doesn't consume the header. If Phase 5 (Quiz + TrueFalse) introduces a token-aware `GamePromptHeader`, no edits to Wordle are needed.
- Remove deprecated Tailwind tokens (`game.correct`, `game.warning`, `primary.teal`, `bg-game-leader`, etc.) or `index.css` rules — those go in the final cleanup phase (spec §7.4 item 11).
