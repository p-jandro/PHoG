# PHoG UI Redesign — Phase 4: Countdown + FinalLeaderboard + Leaderboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate five existing player surfaces to the new design system primitives — the **Countdown** word-game screen, the **FinalLeaderboard** end-of-game screen, the **RoundLeaderboardOverlay** between-round overlay, the **PlacementLeaderboard** shared scoreboard component, and the **PausedOverlay**. After this plan ships, all five surfaces consume `Card`, `Chip`, `Avatar`, `LeaderboardRow`, and `Countdown` from `packages/client/src/ui/`, plus the `motion` utility module, and respect `prefers-reduced-motion`. No other screens are touched. Legacy `index.css` rules and old Tailwind tokens (`primary.*`, `game.*`, `ui.*`) stay in place — they will be removed in Phase 11.

**Architecture:** Each surface keeps its current props and socket-event contracts. We replace the **rendering layer** only:
- Containers move from `.card`/`.screen-frame` legacy classes to the new `<Card />` primitive.
- Player-rank rows move to `<LeaderboardRow />` with framer-motion `layout` (the parent renders rows in current rank order; FLIP transitions are automatic).
- The 30-second word-game timer in Countdown gets fed into the new `<Countdown />` primitive (ring + beat).
- The end-of-game winner moment gets a Fraunces headline, a bottom-up rank reveal (place 5 → 1, ~600 ms each), and a confetti burst in the heritage palette.
- A new `Confetti` sub-component is added as a leaf component beside the screens that use it (only `FinalLeaderboard`); it builds on framer-motion + CSS keyframes — no extra dependency.
- Reduced-motion: a single `useReducedMotion()` hook (from framer-motion) gates every transform-based reveal. Crossfade substitution is the fallback. Color/information still lands.

**Tech stack:** React 18 · TypeScript 5.3 · Tailwind 3.4 · framer-motion 10. No new dependencies.

**Spec reference:** [docs/superpowers/specs/2026-05-13-ui-redesign-design.md](../specs/2026-05-13-ui-redesign-design.md) — §3.3 Card, §3.4 Chip, §3.6 LeaderboardRow, §3.7 Avatar, §3.8 Countdown, §4.4 per-game animation catalog (Countdown / Round leaderboard / Final leaderboard rows), §4.5 accessibility, §7.1 player screens, §7.2 player shared components.

**Foundation plan reference:** [docs/superpowers/plans/2026-05-13-ui-redesign-foundation.md](2026-05-13-ui-redesign-foundation.md) — all primitives referenced here are already built (Tasks 8, 12, 13, 15, 16, 17) and exported from `packages/client/src/ui/index.ts`.

**Out of scope for this plan:**
- Migrating any other screen (Lobby, Quiz, Pointless, Wordle, etc.) — those are Phases 3, 5, 6, 7…
- Removing legacy `index.css` rules (`.card`, `.screen-frame`, `.eyebrow`, `.section-label`, `.status-pill`) — Phase 11
- Removing old Tailwind tokens (`primary.purple`, `game.accent`, `ui.textMuted`, etc.) — Phase 11
- Migrating the host display's mirror of any of these screens — host already shows a tracker-only view per the merged `0fa1e91` / `90660db` series; no Phase 4 work needed on the host side
- Audio in the Countdown screen — `useAudio('/audio/countdown-theme.mp3', …)` stays exactly as-is
- Server-side event payloads or scoring logic
- Adding rank-delta tracking to the gameStore (the round leaderboard payload already carries `rankDelta`; a points-delta `delta` field is a follow-up if/when the server starts emitting it — for Phase 4 we pass `rankDelta` through as the LeaderboardRow `delta` prop, see Task 4)

---

## File map

**Client (`packages/client/`) — only the five surfaces named:**
- `src/screens/Countdown.tsx` — *modify* (Task 1)
- `src/components/PausedOverlay.tsx` — *modify* (Task 2)
- `src/components/RoundLeaderboardOverlay.tsx` — *modify* (Task 3)
- `src/components/PlacementLeaderboard.tsx` — *modify* (Task 4)
- `src/screens/FinalLeaderboard.tsx` — *modify* (Tasks 5, 6, 7)
- `src/components/Confetti.tsx` — *create* (Task 6)

**Nothing else is touched.** No new files in `ui/`, no changes to `App.tsx`, no `gameStore` changes, no `tailwind.config.js` changes, no `index.css` changes.

---

## Tasks

### Task 1: Migrate the Countdown word-game screen to the new primitives

The Countdown screen has four phases: `intro`, `playing`, `roundEnd`, `gameEnd`. The big lift here is the **playing phase** — the spec calls for the circular `<Countdown />` primitive in place of the current `text-3xl` numeric + linear bar. The intro and round-end phases get re-skinned to the new `Card` + `Chip` look. The submit button and word input keep their current contract (no `Button`/`Input` primitive swap yet — that's a later cleanup, since the existing styling already covers the touch-friendly states well enough and the foundation `Button`/`Input` primitives aren't required for the spec's named Phase 4 animations).

**Files:**
- Modify: `packages/client/src/screens/Countdown.tsx`

- [ ] **Step 1: Add the new imports at the top of the file**

Replace the top import block (lines 1-5) so the file pulls in the new primitives + motion utilities. Keep the existing `useGameStore` and `useAudio` imports.

```tsx
import { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import { useAudio } from '../hooks/useAudio';
import { Card, Chip, Countdown as CountdownTimer, LeaderboardRow } from '../ui';
import { screenEnter, reducedFade } from '../lib/motion';
```

Then inside the component body, immediately after `const { playerId } = useGameStore();`, add:

```tsx
const reduced = useReducedMotion();
const enterVariants = reduced ? reducedFade : screenEnter;
```

- [ ] **Step 2: Rebuild the intro phase using `Card` + `Chip`**

Replace the entire `if (phase === 'intro' && introData) { … }` block (currently lines ~173-259) with the version below. Notes:
- The outer wrapper keeps `screen-shell` so the page background stays consistent across migration (Phase 11 removes that legacy class).
- The progress bar becomes a small `Chip` showing `Starting in Xs…` — simpler than a bar, matches the new chunky aesthetic.
- The "Scoring Rules" list goes inside a `<Card title="Scoring Rules">`.
- The staggered list items use `motion.li` with a `reduced ? reducedFade : letterDrop` pattern via inline variants (kept inline because it's the only list in the screen).

```tsx
if (phase === 'intro' && introData) {
  return (
    <div className="screen-shell flex flex-col items-center justify-center">
      <motion.div
        variants={enterVariants}
        initial="hidden"
        animate="visible"
        className="screen-frame max-w-4xl space-y-6 text-center"
      >
        <Card
          eyebrow="Countdown Briefing"
          title={introData.title}
          className="text-left"
        >
          <p className="text-lg text-ink-muted">{introData.description}</p>
        </Card>

        <Card title="Scoring Rules" className="text-left">
          <ul className="space-y-2 text-lg">
            {introData.scoringRules?.map((rule: string, index: number) => (
              <motion.li
                key={index}
                initial={reduced ? { opacity: 0 } : { opacity: 0, x: -20 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.08, duration: 0.22 }}
                className="flex items-start gap-2 text-ink"
              >
                <span aria-hidden="true" className="text-streak">•</span>
                <span>{rule}</span>
              </motion.li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-col items-center gap-3">
          {introData.placementInfo && (
            <Chip variant="info">{introData.placementInfo}</Chip>
          )}
          {introData.shuffleInfo && (
            <p className="text-sm text-ink-muted">{introData.shuffleInfo}</p>
          )}
          <Chip variant="now">
            Starting in {Math.ceil(timeRemaining / 1000)}s
          </Chip>
        </div>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 3: Rebuild the playing phase around the `Countdown` primitive**

Replace the `if (phase === 'playing' && currentRound) { … }` block (currently lines ~262-368) with the version below. The big change: the `text-3xl` numeric + linear timer bar both disappear, replaced by a single circular `<CountdownTimer />` in the top-right. The audio toggle moves into a `Chip` button next to it. Letters and the input form keep their layout but the outer `card` wrapper becomes `<Card>`.

```tsx
if (phase === 'playing' && currentRound) {
  const timeSeconds = Math.max(0, Math.ceil(timeRemaining / 1000));
  const totalSeconds = Math.max(1, Math.ceil(currentRound.duration / 1000));

  return (
    <div className="screen-shell flex flex-col items-center justify-center">
      <motion.div
        variants={enterVariants}
        initial="hidden"
        animate="visible"
        className="screen-frame max-w-5xl space-y-6"
      >
        <div className="flex items-center justify-between gap-4">
          <Chip variant="info">
            Round {currentRound.roundNumber} of {currentRound.totalRounds}
          </Chip>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => (audio.isPlaying ? audio.pause() : audio.play())}
              aria-label={audio.isPlaying ? 'Mute music' : 'Play music'}
              className="rounded-lg border-2 border-ink bg-bg-surface px-3 py-1.5 text-sm font-extrabold text-ink shadow-ink-sm"
            >
              {audio.isPlaying ? 'Sound On' : 'Sound Off'}
            </button>
            <CountdownTimer
              seconds={timeSeconds}
              total={totalSeconds}
              size={96}
            />
          </div>
        </div>

        <Card title="Available Letters">
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={handleShuffle}
              className="rounded-lg border-2 border-ink bg-info px-4 py-2 text-sm font-extrabold text-on-info shadow-ink-sm active:translate-x-[2px] active:translate-y-[2px]"
            >
              Shuffle
            </button>
          </div>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            {shuffledLetters.map((letter, index) => (
              <motion.div
                key={`${letter}-${index}`}
                initial={reduced ? { opacity: 0 } : { scale: 0, rotate: -180 }}
                animate={reduced ? { opacity: 1 } : { scale: 1, rotate: 0 }}
                transition={{ delay: index * 0.05, duration: 0.22 }}
                className={[
                  'flex h-14 w-14 items-center justify-center rounded-lg border-2 border-ink text-2xl font-extrabold uppercase shadow-ink-sm sm:h-16 sm:w-16 sm:text-3xl',
                  isLetterUsed(letter, index)
                    ? 'bg-premium text-on-premium'
                    : 'bg-bg-surface text-ink',
                ].join(' ')}
              >
                {letter}
              </motion.div>
            ))}
          </div>
        </Card>

        <Card title="Your Word">
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              value={word}
              onChange={handleWordChange}
              placeholder="Enter your word..."
              className="w-full rounded-lg border-2 border-ink bg-bg-sunken px-4 py-3 text-center text-xl font-extrabold uppercase text-ink shadow-ink-sm placeholder:text-ink-muted focus:outline-none focus:ring-4 focus:ring-info/40 disabled:opacity-60 sm:text-2xl"
              maxLength={15}
              disabled={submitted}
              autoFocus
            />
            <button
              type="submit"
              disabled={!word || submitted}
              className="w-full rounded-lg border-2 border-ink bg-action px-4 py-3 text-lg font-extrabold text-on-action shadow-ink active:translate-x-[3px] active:translate-y-[3px] active:shadow-ink-sm disabled:opacity-50"
            >
              {submitted ? 'Submitted' : 'Submit Word'}
            </button>
            {word && (
              <p className="text-center text-sm text-ink-muted">
                {word.length} letter{word.length !== 1 ? 's' : ''}
              </p>
            )}
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 4: Rebuild the round-end phase using `LeaderboardRow`**

Replace the `if (phase === 'roundEnd' && roundResults) { … }` block (currently lines ~371-446) with the version below. The "your submission" hero card stays as a `<Card>` block; the list of all submissions becomes a column of `LeaderboardRow`s sorted by score descending. The "you" highlighting flips to `isYou`. Word length feeds into the `score` slot, points awarded feed into `delta` (positive = green, the LeaderboardRow primitive already handles the sign-flip styling).

```tsx
if (phase === 'roundEnd' && roundResults) {
  const mySubmission = roundResults.submissions.find((s: any) => s.playerId === playerId);
  const sorted = [...roundResults.submissions].sort((a: any, b: any) => {
    if (a.valid && !b.valid) return -1;
    if (b.valid && !a.valid) return 1;
    return (b.length || 0) - (a.length || 0);
  });

  return (
    <div className="screen-shell flex flex-col items-center justify-center">
      <motion.div
        variants={enterVariants}
        initial="hidden"
        animate="visible"
        className="screen-frame max-w-4xl space-y-5"
      >
        <Card eyebrow="Round Complete" title={mySubmission?.word || '(No word)'}>
          {mySubmission && (
            <div className="space-y-2 text-lg">
              <p className="text-ink">
                {mySubmission.valid
                  ? `${mySubmission.isLongest ? 'Longest Word — ' : ''}${mySubmission.length} letters`
                  : 'Invalid word'}
              </p>
              {mySubmission.valid && (
                <>
                  <p>
                    You earned{' '}
                    <span className="font-extrabold text-action">
                      {mySubmission.points}
                    </span>{' '}
                    points
                  </p>
                  <p className="text-ink-muted">
                    Current game score: {mySubmission.newScore ?? 0}
                  </p>
                </>
              )}
            </div>
          )}
        </Card>

        <Card title="All Submissions">
          <div className="space-y-2">
            {sorted.map((submission: any, index: number) => (
              <LeaderboardRow
                key={submission.playerId}
                rank={index + 1}
                name={`${submission.playerName}: ${submission.word || '(No word)'}`}
                score={submission.valid ? submission.length : 0}
                delta={submission.valid ? submission.points : undefined}
                isYou={submission.playerId === playerId}
              />
            ))}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 5: Rebuild the game-end phase using `Card`**

Replace the `if (phase === 'gameEnd' && gameResults) { … }` block (currently lines ~449-463) with:

```tsx
if (phase === 'gameEnd' && gameResults) {
  return (
    <div className="screen-shell flex flex-col items-center justify-center">
      <motion.div
        variants={enterVariants}
        initial="hidden"
        animate="visible"
        className="screen-frame max-w-3xl"
      >
        <Card eyebrow="Countdown Complete" title="Well done to all players!">
          <p className="text-lg text-ink-muted">
            Final placements on the next screen.
          </p>
        </Card>
      </motion.div>
    </div>
  );
}
```

The remaining loading-state block (`return (<div className="min-h-screen…`) stays unchanged.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd packages/client
npm run build
```
Expected: build succeeds. If you see a type error on `roundResults.submissions` (it's typed `any`), nothing should change — but if a Tailwind class is unrecognised, double-check it exists in the rewritten `tailwind.config.js` from the foundation plan.

- [ ] **Step 7: Smoke-test in dev**

Start server + client, log in as two players, and have the host launch Countdown. Walk through intro → letters → round-end → game-end. Verify:
- The intro `Chip variant="now"` shows the start-in timer
- The circular `CountdownTimer` ticks and the ring fills smoothly while playing
- The "you" row on the round-end leaderboard is sun-yellow
- Toggle OS `prefers-reduced-motion: reduce` and reload — letter pops become fades

- [ ] **Step 8: Commit**

```bash
git add packages/client/src/screens/Countdown.tsx
git commit -m "feat(client/screen): migrate Countdown to Card/Chip/LeaderboardRow + ring timer"
```

---

### Task 2: Migrate PausedOverlay to the new Card primitive

The PausedOverlay is the simplest of the five — a full-screen scrim with a centred `Card`. The pulsing "PAUSED" text becomes a `Chip variant="now"` with the same `[1, 1.05, 1]` scale loop. Reduced-motion drops the scale loop but keeps the chip colour.

**Files:**
- Modify: `packages/client/src/components/PausedOverlay.tsx`

- [ ] **Step 1: Replace the entire file contents**

```tsx
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
import { Card, Chip } from '../ui';

export const PausedOverlay = () => {
  const { paused } = useGameStore();
  const reduced = useReducedMotion();

  return (
    <AnimatePresence>
      {paused && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 px-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Game paused"
        >
          <motion.div
            initial={reduced ? { opacity: 0 } : { scale: 0.92, opacity: 0 }}
            animate={reduced ? { opacity: 1 } : { scale: 1, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
            className="w-full max-w-xl"
          >
            <Card className="text-center">
              <motion.div
                animate={reduced ? undefined : { scale: [1, 1.05, 1] }}
                transition={
                  reduced
                    ? undefined
                    : { duration: 2, repeat: Infinity, ease: 'easeInOut' }
                }
                className="mb-6 flex justify-center"
              >
                <Chip variant="now" className="text-base tracking-[0.28em]">
                  PAUSED
                </Chip>
              </motion.div>
              <h1 className="mb-3 text-3xl font-extrabold text-ink sm:text-5xl">
                Game Paused
              </h1>
              <p className="text-lg text-ink-muted sm:text-xl">
                Waiting for the host to resume…
              </p>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/client
npm run build
```
Expected: build succeeds.

- [ ] **Step 3: Smoke-test**

Start the host, launch any game, pause it. The new Card should slide in. Toggle `prefers-reduced-motion: reduce` — the pulse stops and the scale-in becomes a crossfade.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/PausedOverlay.tsx
git commit -m "feat(client/components): rebuild PausedOverlay with Card + Chip primitives"
```

---

### Task 3: Migrate RoundLeaderboardOverlay to the new Card + Chip primitives

The between-round overlay shows "Place" and "Score" for the current player against the chosen unit (round, turn, leg). No row list — just two big stat tiles. We keep that shape but rebuild it with `<Card>` and `<Chip>`. Reduced-motion swaps the entrance from `y: 36, scale: 0.96` to a crossfade.

**Files:**
- Modify: `packages/client/src/components/RoundLeaderboardOverlay.tsx`

- [ ] **Step 1: Replace the entire file contents**

```tsx
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
import { Card, Chip } from '../ui';

const GAME_LABELS = {
  quiz: 'Quiz',
  trueFalse: 'True/False',
  countdown: 'Countdown',
  pointless: 'Pointless',
  pokedle: 'Pokédle',
  hpdle: 'HP-dle',
  numbers: 'Numbers',
  wordle: 'Wordle',
  travel: 'Travel',
} as const;

export const RoundLeaderboardOverlay = () => {
  const { roundLeaderboard, playerId } = useGameStore();
  const reduced = useReducedMotion();

  if (!roundLeaderboard) return null;

  const { game, leaderboard, roundNumber, totalRounds, unitLabel } = roundLeaderboard;
  const gameLabel = GAME_LABELS[game];
  const currentPlayerRow = leaderboard.find((entry) => entry.id === playerId) || null;

  if (!currentPlayerRow) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        className="fixed inset-0 z-[80] overflow-y-auto bg-ink/70 px-3 py-4 backdrop-blur-md sm:px-4 sm:py-8"
        role="dialog"
        aria-modal="true"
        aria-label={`${gameLabel} round standing`}
      >
        <div className="flex min-h-full items-start justify-center sm:items-center">
          <motion.div
            initial={reduced ? { opacity: 0 } : { y: 36, opacity: 0, scale: 0.96 }}
            animate={reduced ? { opacity: 1 } : { y: 0, opacity: 1, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { y: -24, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
            className="w-full max-w-xl"
          >
            <Card
              eyebrow="Round Standing"
              title={gameLabel}
              className="text-center"
            >
              {roundNumber && totalRounds && (
                <div className="mb-6 flex justify-center">
                  <Chip variant="info">
                    {unitLabel || 'Round'} {roundNumber} of {totalRounds}
                  </Chip>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border-2 border-ink bg-now p-5 text-on-now shadow-ink">
                  <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em]">Place</p>
                  <p className="font-display text-5xl font-black leading-none tracking-tighter sm:text-6xl">
                    #{currentPlayerRow.rank}
                  </p>
                </div>
                <div className="rounded-2xl border-2 border-ink bg-bg-surface p-5 text-ink shadow-ink">
                  <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">Score</p>
                  <p className="font-display text-5xl font-black leading-none tracking-tighter sm:text-6xl">
                    {currentPlayerRow.score}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/client
npm run build
```
Expected: build succeeds.

- [ ] **Step 3: Smoke-test**

Play Quiz to the end of round 1 with two players. Confirm the overlay appears with the new Card + sun-yellow Place tile. Toggle reduced-motion and confirm the transform-y is replaced with a crossfade.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/RoundLeaderboardOverlay.tsx
git commit -m "feat(client/components): rebuild RoundLeaderboardOverlay with Card + Chip"
```

---

### Task 4: Migrate PlacementLeaderboard to LeaderboardRow with FLIP reorder

`PlacementLeaderboard` is currently unused in `App.tsx` (only `FinalLeaderboard` is rendered) but lives as a shared component and is listed explicitly in spec §7.2. We migrate it so it's ready for a future re-introduction (and because the spec treats it as a Phase 4 deliverable). The component takes `players`, `showTotalPlacement`, `currentGame` props — we keep that exact shape. Inside, every row becomes a `<LeaderboardRow />` with framer-motion `layout`, so when the parent re-sorts on prop change the rows FLIP between positions automatically.

The current row has medal + name + score + a 3-cell mini grid (per-game placements). LeaderboardRow's grid is `[medal | name | score | delta]` — to keep the per-game mini grid, we render two children: the LeaderboardRow on top, and a small `Chip` strip underneath in a single wrapping `<motion.div layout>` so they FLIP together.

The `delta` prop is wired to `rankDelta` from the round-leaderboard payload when available (positive rankDelta means the player climbed, so we pass it as a *positive* delta — the LeaderboardRow primitive renders positive deltas with `bg-action` green). `PlacementLeaderboard` itself doesn't have rankDelta on its `Player` prop today; we leave `delta` undefined and document this as a follow-up tied to whenever a parent starts passing rank changes.

**Files:**
- Modify: `packages/client/src/components/PlacementLeaderboard.tsx`

- [ ] **Step 1: Replace the entire file contents**

```tsx
import { motion, useReducedMotion } from 'framer-motion';
import { Chip, LeaderboardRow } from '../ui';

type GameKey = 'quiz' | 'trueFalse' | 'countdown' | 'pointless';

interface Player {
  id: string;
  name: string;
  score: number;
  currentGameScore: number;
  totalPlacementScore: number;
  gamePlacements?: {
    quiz: number | null;
    trueFalse: number | null;
    countdown: number | null;
    pointless: number | null;
  };
  connected: boolean;
}

interface PlacementLeaderboardProps {
  players: Player[];
  showTotalPlacement?: boolean;
  currentGame?: GameKey | null;
  /** Optional: the current viewer's player id, so their row is highlighted. */
  selfId?: string | null;
}

const GAME_LABELS: Record<GameKey, string> = {
  quiz: 'Quiz',
  trueFalse: 'True/False',
  countdown: 'Countdown',
  pointless: 'Pointless',
};

const getGamePlacement = (player: Player, currentGame?: GameKey | null) => {
  if (!currentGame) return null;
  return player.gamePlacements?.[currentGame] ?? null;
};

export const PlacementLeaderboard = ({
  players,
  showTotalPlacement = false,
  currentGame = null,
  selfId = null,
}: PlacementLeaderboardProps) => {
  const reduced = useReducedMotion();
  const gameLabel = currentGame ? GAME_LABELS[currentGame] : 'Current Game';

  const sortedPlayers = [...players].sort((a, b) => {
    if (showTotalPlacement) {
      if ((a.totalPlacementScore || 0) === 0 && (b.totalPlacementScore || 0) === 0) return 0;
      if ((a.totalPlacementScore || 0) === 0) return 1;
      if ((b.totalPlacementScore || 0) === 0) return -1;
      return (a.totalPlacementScore || 0) - (b.totalPlacementScore || 0);
    }

    const aPlacement = getGamePlacement(a, currentGame);
    const bPlacement = getGamePlacement(b, currentGame);

    if (aPlacement === null && bPlacement === null) {
      return currentGame === 'pointless'
        ? (a.currentGameScore || 0) - (b.currentGameScore || 0)
        : (b.currentGameScore || 0) - (a.currentGameScore || 0);
    }
    if (aPlacement === null) return 1;
    if (bPlacement === null) return -1;
    if (aPlacement !== bPlacement) return aPlacement - bPlacement;
    return currentGame === 'pointless'
      ? (a.currentGameScore || 0) - (b.currentGameScore || 0)
      : (b.currentGameScore || 0) - (a.currentGameScore || 0);
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-streak">
            Scoreboard
          </p>
          <h2 className="text-3xl font-extrabold text-ink">
            {showTotalPlacement ? 'Final Standings' : `${gameLabel} Placements`}
          </h2>
        </div>
        <Chip variant={showTotalPlacement ? 'info' : 'muted'}>
          {showTotalPlacement ? 'Lower total placement leads' : 'This game only'}
        </Chip>
      </div>

      <div className="max-h-[600px] space-y-3 overflow-y-auto pr-1">
        {sortedPlayers.map((player, index) => {
          const gamePlacement = getGamePlacement(player, currentGame);
          const displayPlacement = showTotalPlacement ? index + 1 : gamePlacement;
          const rank = displayPlacement ?? index + 1;
          const score = showTotalPlacement
            ? player.totalPlacementScore || 0
            : player.currentGameScore;

          return (
            <motion.div
              key={player.id}
              layout={!reduced}
              transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
              className="space-y-2"
            >
              <LeaderboardRow
                rank={rank}
                name={player.name}
                score={score}
                isYou={selfId !== null && player.id === selfId}
              />
              {showTotalPlacement && (
                <div className="flex flex-wrap items-center gap-2 pl-12 text-xs">
                  {(['quiz', 'trueFalse', 'countdown', 'pointless'] as const).map((key) => {
                    const placement = player.gamePlacements?.[key];
                    return (
                      <Chip
                        key={key}
                        variant={placement && placement <= 3 ? 'now' : 'muted'}
                      >
                        {GAME_LABELS[key]}: {placement ?? '—'}
                      </Chip>
                    );
                  })}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/client
npm run build
```
Expected: build succeeds. No call sites currently exist, so no callers to update.

- [ ] **Step 3: Visual QA via `?showcase`**

Since the component has no live render path in `App.tsx`, drop a quick sanity check into the showcase route. *Skip this step* if the showcase doesn't currently render `PlacementLeaderboard` — the build alone is sufficient gate, and Phase 11 will round-trip every shared component.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/PlacementLeaderboard.tsx
git commit -m "feat(client/components): rebuild PlacementLeaderboard with LeaderboardRow FLIP"
```

---

### Task 5: Migrate FinalLeaderboard — header card + result panel

FinalLeaderboard runs in two modes: `currentGame` result (Place + Score grid) and `showTotalPlacement` (full 9-cell championship grid). This task replaces the page chrome and both grids with the new `<Card>` + `<Chip>` look. The bottom-up rank reveal animation and the confetti burst are added in **Tasks 6 + 7** — keep this task tightly scoped to the static layout.

**Files:**
- Modify: `packages/client/src/screens/FinalLeaderboard.tsx`

- [ ] **Step 1: Replace the entire file contents**

```tsx
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
import { Card, Chip } from '../ui';
import { screenEnter, reducedFade } from '../lib/motion';

type GameKey =
  | 'quiz'
  | 'trueFalse'
  | 'countdown'
  | 'pointless'
  | 'pokedle'
  | 'hpdle'
  | 'numbers'
  | 'wordle'
  | 'travel';

const CHAMPIONSHIP_PREVIEW_DELAY = 5000;

const GAME_LABELS: Record<GameKey, string> = {
  quiz: 'Quiz',
  trueFalse: 'True/False',
  countdown: 'Countdown',
  pointless: 'Pointless',
  pokedle: 'Pokédle',
  hpdle: 'HP-dle',
  numbers: 'Numbers',
  wordle: 'Wordle',
  travel: 'Travel',
};

const getOrdinalLabel = (value: number | null | undefined) => {
  if (!value || value <= 0) return '-';
  if (value % 10 === 1 && value % 100 !== 11) return `${value}st`;
  if (value % 10 === 2 && value % 100 !== 12) return `${value}nd`;
  if (value % 10 === 3 && value % 100 !== 13) return `${value}rd`;
  return `${value}th`;
};

export const FinalLeaderboard = () => {
  const { players, playerId, phase, currentGame } = useGameStore();
  const activeGame = currentGame as GameKey | null;
  const reduced = useReducedMotion();
  const enterVariants = reduced ? reducedFade : screenEnter;

  const [showChampionshipPreview, setShowChampionshipPreview] = useState(false);

  useEffect(() => {
    if (phase === 'finished') {
      setShowChampionshipPreview(true);
      return;
    }
    if (phase !== 'leaderboard') {
      setShowChampionshipPreview(false);
      return;
    }
    setShowChampionshipPreview(false);
    const t = setTimeout(() => setShowChampionshipPreview(true), CHAMPIONSHIP_PREVIEW_DELAY);
    return () => clearTimeout(t);
  }, [phase, currentGame]);

  const currentPlayer = players.find((p) => p.id === playerId) || null;
  const showTotalPlacement = phase === 'finished' || showChampionshipPreview;
  const activeGameLabel = activeGame ? GAME_LABELS[activeGame] : 'Current Game';

  const championshipSortedPlayers = [...players].sort((a, b) => {
    if (!a.totalPlacementScore) return 1;
    if (!b.totalPlacementScore) return -1;
    return a.totalPlacementScore - b.totalPlacementScore;
  });
  const championshipRank = currentPlayer
    ? championshipSortedPlayers.findIndex((p) => p.id === playerId) + 1
    : null;
  const currentGamePlacement = activeGame
    ? currentPlayer?.gamePlacements?.[activeGame] ?? null
    : null;

  const placementSummary: { label: string; value: number | null }[] = [
    { label: 'Quiz', value: currentPlayer?.gamePlacements?.quiz ?? null },
    { label: 'True/False', value: currentPlayer?.gamePlacements?.trueFalse ?? null },
    { label: 'Pointless', value: currentPlayer?.gamePlacements?.pointless ?? null },
    { label: 'Pokédle', value: currentPlayer?.gamePlacements?.pokedle ?? null },
    { label: 'HP-dle', value: currentPlayer?.gamePlacements?.hpdle ?? null },
    { label: 'Numbers', value: currentPlayer?.gamePlacements?.numbers ?? null },
    { label: 'Wordle', value: currentPlayer?.gamePlacements?.wordle ?? null },
    { label: 'Travel', value: currentPlayer?.gamePlacements?.travel ?? null },
    { label: 'Overall', value: championshipRank || null },
  ];

  const eyebrow =
    phase === 'finished'
      ? 'Session Complete'
      : showTotalPlacement
        ? 'Championship Snapshot'
        : 'Game Complete';
  const headline = showTotalPlacement
    ? 'Your Championship Standing'
    : `Your ${activeGameLabel} Result`;

  return (
    <div className="screen-shell overflow-y-auto">
      <motion.div
        variants={enterVariants}
        initial="hidden"
        animate="visible"
        className="screen-frame max-w-4xl space-y-5 py-6"
      >
        <Card eyebrow={eyebrow} title={<span className="font-serif text-4xl sm:text-5xl">{headline}</span>}>
          <div className="flex flex-col gap-3">
            <p className="text-base leading-relaxed text-ink-muted sm:text-lg">
              The full table is on the house display.
            </p>
            <Chip variant="info">
              {phase === 'finished' ? 'Championship over' : 'Live results'}
            </Chip>
          </div>
        </Card>

        {showTotalPlacement ? (
          <Card title="Placements by game">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {placementSummary.map((item) => {
                const isOverall = item.label === 'Overall';
                const isTopThree =
                  typeof item.value === 'number' && item.value > 0 && item.value <= 3;
                return (
                  <div
                    key={item.label}
                    className={[
                      'rounded-2xl border-2 border-ink p-5 text-center shadow-ink',
                      isOverall
                        ? 'bg-premium text-on-premium'
                        : isTopThree
                          ? 'bg-now text-on-now'
                          : 'bg-bg-surface text-ink',
                    ].join(' ')}
                  >
                    <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em]">
                      {item.label}
                    </p>
                    <p className="font-display text-4xl font-black leading-none tracking-tighter tabular-nums sm:text-5xl">
                      {item.value ? getOrdinalLabel(item.value) : '-'}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Card title="Place">
              <p className="text-center font-display text-5xl font-black leading-none tracking-tighter text-ink sm:text-6xl">
                {currentGamePlacement ? getOrdinalLabel(currentGamePlacement) : '-'}
              </p>
            </Card>
            <Card title="Score">
              <p className="text-center font-display text-5xl font-black leading-none tracking-tighter tabular-nums text-ink sm:text-6xl">
                {currentPlayer?.currentGameScore ?? '-'}
              </p>
            </Card>
          </div>
        )}
      </motion.div>
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/client
npm run build
```
Expected: build succeeds.

- [ ] **Step 3: Smoke-test**

Run a one-game championship to completion. Verify the header card shows the Fraunces serif headline (`font-serif`) — this is the *only* place in the player client where the heritage serif appears. The placement grid shows the active player's per-game placements; Overall is plum, top-3 placements are sun-yellow, everything else is plain.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/screens/FinalLeaderboard.tsx
git commit -m "feat(client/screen): rebuild FinalLeaderboard layout with Card + serif headline"
```

---

### Task 6: Add the Confetti component (heritage palette)

Confetti is a one-off celebratory burst, used only by `FinalLeaderboard` on rank-1 reveal. Built from framer-motion + a simple keyframe falling motion — no extra dependency. 60 pieces, each given a random horizontal drift and rotation, falling from `y = -40vh` to `y = 110vh` over 2.6 s, randomly tinted from the four heritage colours (`#d96a3a` terracotta, `#5b3a5b` plum, `#2ec27e` grass, `#ffd23f` sun). Pieces unmount after the burst; the component takes a `show` prop. Under `prefers-reduced-motion` the component renders nothing — confetti is decorative, the rank/podium info still lands via Task 7.

**Files:**
- Create: `packages/client/src/components/Confetti.tsx`

- [ ] **Step 1: Create `packages/client/src/components/Confetti.tsx`**

```tsx
import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const COLORS = ['#d96a3a', '#5b3a5b', '#2ec27e', '#ffd23f'] as const;
const PIECE_COUNT = 60;

interface Piece {
  id: number;
  left: number; // 0–100 (vw)
  drift: number; // -20 to +20 (vw)
  delay: number; // 0–0.6 (s)
  duration: number; // 2.2–3.0 (s)
  rotateStart: number;
  rotateEnd: number;
  color: string;
  size: number; // 6–12 (px)
  shape: 'square' | 'rect';
}

function buildPieces(): Piece[] {
  const pieces: Piece[] = [];
  for (let i = 0; i < PIECE_COUNT; i++) {
    pieces.push({
      id: i,
      left: Math.random() * 100,
      drift: (Math.random() - 0.5) * 40,
      delay: Math.random() * 0.6,
      duration: 2.2 + Math.random() * 0.8,
      rotateStart: Math.random() * 360,
      rotateEnd: Math.random() * 720 + 360,
      color: COLORS[i % COLORS.length],
      size: 6 + Math.random() * 6,
      shape: Math.random() > 0.5 ? 'square' : 'rect',
    });
  }
  return pieces;
}

interface ConfettiProps {
  show: boolean;
}

/**
 * Heritage-palette confetti burst.
 * Renders nothing if `show` is false or if the user prefers reduced motion.
 */
export function Confetti({ show }: ConfettiProps) {
  const reduced = useReducedMotion();
  const pieces = useMemo(buildPieces, []);

  if (!show || reduced) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[90] overflow-hidden"
    >
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ y: '-40vh', x: 0, rotate: p.rotateStart, opacity: 1 }}
          animate={{ y: '110vh', x: `${p.drift}vw`, rotate: p.rotateEnd, opacity: 1 }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: [0.22, 0.61, 0.36, 1],
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: `${p.left}vw`,
            width: p.shape === 'rect' ? p.size * 1.6 : p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.shape === 'rect' ? 2 : 1,
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/client
npm run build
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/Confetti.tsx
git commit -m "feat(client/components): add Confetti burst (heritage palette)"
```

---

### Task 7: Add bottom-up rank reveal + confetti to FinalLeaderboard

Spec §4.4 says: "Bottom-up rank reveal (place 5 → 1, ~600ms each); rank 1 confetti burst in heritage palette." We add this **only when `showTotalPlacement` is true** (the championship view) — the per-game `Place / Score` grid is too small to merit a staged reveal. Reduced-motion drops the stagger and renders the grid statically, and the `Confetti` component already opts out under reduced-motion (Task 6).

**Files:**
- Modify: `packages/client/src/screens/FinalLeaderboard.tsx`

- [ ] **Step 1: Import the `Confetti` component and `stagger`**

At the top of `FinalLeaderboard.tsx`, add:

```tsx
import { Confetti } from '../components/Confetti';
import { stagger } from '../lib/motion';
```

- [ ] **Step 2: Track when to fire confetti**

Inside the component, after `const [showChampionshipPreview, …]`, add a `showConfetti` state and an effect that flips it on when `showTotalPlacement` becomes true AND the current player is the championship leader. Confetti fires once per championship — track it with a ref-like state so it doesn't re-fire on re-renders.

```tsx
const [confettiArmed, setConfettiArmed] = useState(false);
useEffect(() => {
  if (!showTotalPlacement) {
    setConfettiArmed(false);
    return;
  }
  if (championshipRank === 1) {
    // Fire after the bottom-up reveal lands on rank 1 (~5 ranks × stagger.rank seconds).
    const totalRevealMs = Math.min(placementSummary.length, 5) * stagger.rank * 1000;
    const t = setTimeout(() => setConfettiArmed(true), totalRevealMs);
    return () => clearTimeout(t);
  }
}, [showTotalPlacement, championshipRank, placementSummary.length]);
```

- [ ] **Step 3: Stage the championship grid bottom-up**

Replace the `<Card title="Placements by game">…</Card>` block from Task 5 with the version below. The grid is rendered in reverse order via `placementSummary.slice().reverse()` so the FIRST item to animate in is the LAST item visually, then the second-to-last, etc., implementing the spec's "place 5 → 1" sweep. Each tile uses an `initial` y-offset that's substituted for a fade when `reduced` is true.

```tsx
{showTotalPlacement ? (
  <Card title="Placements by game">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {placementSummary.map((item, index) => {
        const isOverall = item.label === 'Overall';
        const isTopThree =
          typeof item.value === 'number' && item.value > 0 && item.value <= 3;
        // Bottom-up: the visually last item animates first.
        const revealIndex = placementSummary.length - 1 - index;
        return (
          <motion.div
            key={item.label}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            transition={{
              delay: revealIndex * stagger.rank,
              duration: reduced ? 0.18 : 0.55,
              ease: [0.34, 1.56, 0.64, 1],
            }}
            className={[
              'rounded-2xl border-2 border-ink p-5 text-center shadow-ink',
              isOverall
                ? 'bg-premium text-on-premium'
                : isTopThree
                  ? 'bg-now text-on-now'
                  : 'bg-bg-surface text-ink',
            ].join(' ')}
          >
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em]">
              {item.label}
            </p>
            <p className="font-display text-4xl font-black leading-none tracking-tighter tabular-nums sm:text-5xl">
              {item.value ? getOrdinalLabel(item.value) : '-'}
            </p>
          </motion.div>
        );
      })}
    </div>
  </Card>
) : (
  /* ...unchanged Place + Score split from Task 5... */
)}
```

- [ ] **Step 4: Render `<Confetti />` at the bottom of the screen**

Just before the closing `</div>` of the outer `screen-shell` wrapper, add:

```tsx
<Confetti show={confettiArmed} />
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd packages/client
npm run build
```
Expected: build succeeds.

- [ ] **Step 6: Smoke-test**

Run a one-game championship with two players and the local-player wins. After the per-game card sits for 5 s, the championship grid appears, the placements pop in from bottom to top with the back-out spring, and ~3 s after the last tile lands, the heritage-palette confetti burst fires. Toggle reduced-motion and confirm:
- All tiles fade in simultaneously (no transform stagger)
- Confetti does not fire

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/screens/FinalLeaderboard.tsx
git commit -m "feat(client/screen): bottom-up rank reveal + heritage confetti on rank 1"
```

---

### Task 8: End-of-phase verification

- [ ] **Step 1: Run the full client build**

```bash
cd packages/client
npm run build
```
Expected: succeeds with no TS errors, no Tailwind "class not recognised" warnings.

- [ ] **Step 2: Run the client test suite (foundation tests still pass)**

```bash
npm run test:run
```
Expected: the 6 ThemeProvider tests from the foundation plan still pass. No new tests were added in Phase 4.

- [ ] **Step 3: Full playthrough**

Start server + client + host. Log in two players. From the host:
1. Launch Countdown — verify intro, the circular timer during play, the round-end leaderboard with the "you" row highlighted sun-yellow, and game-end "Countdown Complete" card.
2. Mid-round, pause from the host — verify the new PausedOverlay with the pulsing PAUSED chip. Resume.
3. Wait for the round-leaderboard overlay — verify Card + Chip layout with Place + Score tiles.
4. Let the championship complete (or trigger a single-game finish) — verify FinalLeaderboard renders, the Fraunces serif headline ("Your Championship Standing"), the bottom-up grid reveal, and confetti on rank 1 if the local player wins.

- [ ] **Step 4: Light + dark theme parity**

Toggle the theme via the dev console (`localStorage.setItem('phog-theme', 'dark'); location.reload()`) and replay each of the four moments above. Borders, shadows, and chip backgrounds should all flip cleanly. No color leftovers from legacy `index.css`.

- [ ] **Step 5: Reduced-motion check**

In Chrome DevTools, Rendering → Emulate CSS media → `prefers-reduced-motion: reduce`. Reload, replay each moment:
- Countdown: letter pops become fades; the circular ring still ticks (no transforms involved)
- PausedOverlay: PAUSED chip stops pulsing; the overlay crossfades in
- RoundLeaderboardOverlay: y-slide becomes crossfade
- FinalLeaderboard: bottom-up reveal becomes a simultaneous fade; confetti does NOT fire

- [ ] **Step 6: Confirm no other screens regressed**

Open Quiz, TrueFalse, Wordle, Numbers, ThemedDle, Travel, Pointless, Lobby. They should all look **exactly as they did before this plan** — same legacy `card`/`screen-frame` styling. (Phase 11 is when they all flip.)

- [ ] **Step 7: Confirm working tree is clean**

```bash
git status
```
Expected: "nothing to commit, working tree clean." If any file changed during smoke-testing, revert.

---

## Done criteria

All of the following must be true before the plan is considered complete:

- [ ] `npm run build` succeeds in `packages/client`
- [ ] `npm run test:run` in `packages/client` still shows the 6 ThemeProvider tests passing
- [ ] All 7 feature commits are on the branch, each independently building (`feat(client/screen): …` or `feat(client/components): …` prefixes)
- [ ] Countdown screen uses `Card`, `Chip`, `LeaderboardRow`, and the `Countdown` primitive — no `text-3xl text-primary-purple` numeric timer, no linear progress bar in the playing phase
- [ ] FinalLeaderboard headline uses `font-serif` (Fraunces)
- [ ] FinalLeaderboard championship grid reveals bottom-up at `stagger.rank` (600 ms) per tile
- [ ] Confetti fires for rank 1 in heritage palette (terracotta + plum + grass + sun) and is gated by `useReducedMotion()`
- [ ] PausedOverlay uses `Card` + `Chip`
- [ ] RoundLeaderboardOverlay uses `Card` + `Chip`
- [ ] PlacementLeaderboard uses `LeaderboardRow` with framer-motion `layout` for FLIP reorder
- [ ] Reduced-motion: every transform-based reveal in the five surfaces has an explicit crossfade fallback
- [ ] Light + dark theme both render cleanly on each of the five surfaces
- [ ] No legacy `index.css` rules or Tailwind tokens were removed (Phase 11)
- [ ] No screens outside the five named in this plan were touched

---

## What this plan does NOT do (next plans)

- **Phase 5** — Migrate Quiz + TrueFalse
- **Phase 6** — Migrate Pointless (consuming `ScoreDrop`)
- **Phase 7** — Migrate Wordle + WordleDisplay
- **Phase 8** — Migrate ThemedDle (all 5 modes) + ThemedDleDisplay
- **Phase 9** — Migrate Numbers + NumbersDisplay
- **Phase 10** — Migrate Travel + TravelDisplay
- **Phase 11** — Final-cleanup pass — remove deprecated `index.css` rules and old Tailwind tokens; WCAG AA contrast audit; mobile QA; final `prefers-reduced-motion` audit
