# PHoG UI Redesign — Phase 5: Quiz + TrueFalse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the player-side Quiz and TrueFalse screens, the shared `GamePromptHeader` and `GameStatusBar` components, and the host `Display.tsx` branches that render Quiz / TrueFalse rounds, to the new design system (primitives in `ui/`, motion variants in `lib/motion.ts`, semantic Tailwind color classes). The Wordle, ThemedDle, Numbers, Travel and Pointless screens that *also* consume `GamePromptHeader` must keep working — the component's prop surface is preserved while only its internals are reskinned.

**Architecture:** The redesign primitives (`Button`, `Card`, `Chip`, `Pill`, `Countdown`) and `ThemeToggle` already exist from the foundation plan. This phase adds two new framer-motion variants — `correctPulse`, `wrongShake` — to `src/lib/motion.ts` for the universal correct/wrong feedback contract (§4.3 of the spec) and one streak chip pop variant. A small reusable component `AnswerFeedback` (a thin wrapper around `motion.div` with the variants and `prefers-reduced-motion` fallback) is added to `ui/` so Quiz and TrueFalse share the same code path. Quiz's `QUIZ_ANSWER_COLORS` hex map is replaced by semantic Tailwind classes (`bg-answer-a` … `bg-answer-d`) on both the player and host side. The host `Display.tsx` is a giant phase-switch — *only* its Quiz and TrueFalse branches are migrated; every other branch (`pokedle/hpdle/numbers/wordle/travel/countdown/pointless/lobby/leaderboard`) is left untouched.

**Tech stack:** React 18 · TypeScript 5.3 · Tailwind 3.4 (with redesign tokens from the foundation) · framer-motion 10. No new dependencies.

**Spec reference:** [docs/superpowers/specs/2026-05-13-ui-redesign-design.md](../specs/2026-05-13-ui-redesign-design.md) — §3 (Button/Chip/Pill primitives + answer-letter colors), §4.3 (universal correct/wrong/streak feedback), §4.4 (Quiz / TrueFalse animation catalog), §7.1 (player screens), §7.3 (host screens).

**Foundation reference:** [docs/superpowers/plans/2026-05-13-ui-redesign-foundation.md](./2026-05-13-ui-redesign-foundation.md) — primitives, `tokens.css`, motion utilities.

**Out of scope for this plan:**
- Pointless screen migration (Phase 6) — but `GamePromptHeader` changes must keep Pointless rendering correctly (it imports the component)
- Wordle / ThemedDle / Numbers / Travel screens or their host `Display.tsx` branches (Phases 7–10)
- Lobby, Countdown, RoundLeaderboard, FinalLeaderboard (Phases 3 and 4)
- Audio, server-side, new game logic
- Removing old `index.css` rules (`.btn-answer`, `.screen-shell`, `.screen-frame`, `.eyebrow`, `.status-pill`, `.card`) — kept alive so non-migrated screens keep rendering until their phases run; final cleanup is Phase 11

---

## File map

**Client (`packages/client/`):**
- `src/lib/motion.ts` — *modify* (add `correctPulse`, `wrongShake`, `streakChipPop` variants + a `prefers-reduced-motion` helper)
- `src/ui/AnswerFeedback.tsx` — *create* (reusable wrapper that applies correct/wrong variants to a child element)
- `src/ui/index.ts` — *modify* (export `AnswerFeedback`)
- `src/components/GamePromptHeader.tsx` — *modify* (rebuild internals from primitives; preserve prop signature exactly)
- `src/components/GameStatusBar.tsx` — *modify* (rebuild internals from primitives; preserve prop signature exactly)
- `src/screens/Quiz.tsx` — *modify* (all 5 phases: intro, voting, votingResults, question, results)
- `src/screens/TrueFalse.tsx` — *modify* (all 3 phases: intro, playing, results)

**Host (`packages/host/`):**
- `src/lib/motion.ts` — *modify* (mirror the client additions)
- `src/ui/AnswerFeedback.tsx` — *create* (mirror)
- `src/ui/index.ts` — *modify* (export `AnswerFeedback`)
- `src/screens/Display.tsx` — *modify* (only the Quiz and TrueFalse branches: `quizIntro`, `quizVoting` + `quizVotingResults`, `quizQuestion`, `trueFalseIntro`, `tfStatement`, `tfReveal`; preserve all other branches verbatim)

No new files outside the two `AnswerFeedback.tsx` mirrors. No existing files are renamed. Old class names in `index.css` (`.btn-answer`, `.eyebrow`, `.status-pill`, `.screen-shell`, `.screen-frame`, `.section-label`, `.card`) are left in place — the migrated screens stop referencing them in favor of primitives, but other screens still need them.

---

## Tasks

### Task 1: Add universal correct/wrong/streak motion variants

**Files:**
- Modify: `packages/client/src/lib/motion.ts`
- Modify: `packages/host/src/lib/motion.ts`

The spec §4.3 defines three universal feedback animations that Quiz and TrueFalse both consume. Adding them here means both screens (and any future game) share one source of truth.

- [ ] **Step 1: Append the new variants to `packages/client/src/lib/motion.ts`**

Open the file and add these exports below the existing `screenEnter` / `reducedFade` variants (before the `pointlessDrop` block). Do not remove anything that's already there.

```ts
/* ---------- Universal reactive feedback (§4.3) ---------- */

/** Correct: surface pulses green (1.0 → 1.04 → 1.0, 240ms). */
export const correctPulse: Variants = {
  rest: { scale: 1 },
  pulse: {
    scale: [1, 1.04, 1],
    transition: { duration: 0.24, times: [0, 0.5, 1], ease: easing.easeOut },
  },
};

/** Wrong: horizontal shake (8px × 4, 320ms). */
export const wrongShake: Variants = {
  rest: { x: 0 },
  shake: {
    x: [0, -8, 8, -8, 8, 0],
    transition: { duration: 0.32, times: [0, 0.2, 0.4, 0.6, 0.8, 1], ease: 'easeInOut' },
  },
};

/** Streak chip pop: scale 0 → 1.15 → 1.0 back-out, 1.2s linger handled by parent. */
export const streakChipPop: Variants = {
  hidden:  { scale: 0, opacity: 0 },
  visible: {
    scale: [0, 1.15, 1],
    opacity: 1,
    transition: { duration: 0.45, times: [0, 0.6, 1], ease: easing.backOut },
  },
};

/** Slide-down banner (e.g. "Correct!" callout). */
export const bannerSlideDown: Variants = {
  hidden:  { y: -20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.22, ease: easing.easeOut } },
  exit:    { y: -20, opacity: 0, transition: { duration: 0.18, ease: easing.easeOut } },
};

/* ---------- Reduced-motion helper ---------- */

/** Returns true when the user has requested reduced motion. SSR-safe. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
```

- [ ] **Step 2: Apply the identical addition to `packages/host/src/lib/motion.ts`**

Open the host's `motion.ts`. The file is the same as the client's per the foundation plan — duplicate the block from Step 1 verbatim.

- [ ] **Step 3: Verify both packages build**

```bash
cd packages/client && npm run build
cd ../host && npm run build
```

Expected: both builds succeed.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/lib/motion.ts packages/host/src/lib/motion.ts
git commit -m "feat(ui): add correct/wrong/streak motion variants and reduced-motion helper"
```

---

### Task 2: Create the AnswerFeedback wrapper primitive

**Files:**
- Create: `packages/client/src/ui/AnswerFeedback.tsx`
- Create: `packages/host/src/ui/AnswerFeedback.tsx`
- Modify: `packages/client/src/ui/index.ts`
- Modify: `packages/host/src/ui/index.ts`

A tiny wrapper that takes a `feedback` prop (`'idle' | 'correct' | 'wrong'`) and applies the variants from Task 1. Keeps Quiz and TrueFalse free of motion plumbing.

- [ ] **Step 1: Create `packages/client/src/ui/AnswerFeedback.tsx`**

```tsx
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { correctPulse, wrongShake, prefersReducedMotion } from '../lib/motion';

export type AnswerFeedbackState = 'idle' | 'correct' | 'wrong';

interface AnswerFeedbackProps {
  state: AnswerFeedbackState;
  children: ReactNode;
  className?: string;
}

/**
 * Wraps a clickable answer (or group of answers) and runs the universal
 * §4.3 correct/wrong feedback animation when `state` flips away from 'idle'.
 *
 * Composes both variants into a single `animate` prop so the same wrapper
 * can play either reaction without re-mounting children.
 */
export function AnswerFeedback({ state, children, className = '' }: AnswerFeedbackProps) {
  const reduced = prefersReducedMotion();

  if (reduced) {
    // Reduced motion: skip transforms, lean on color (children already show it).
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={state === 'wrong' ? wrongShake : correctPulse}
      initial="rest"
      animate={state === 'wrong' ? 'shake' : state === 'correct' ? 'pulse' : 'rest'}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 2: Mirror to `packages/host/src/ui/AnswerFeedback.tsx`**

Duplicate the file from Step 1 verbatim under the host package.

- [ ] **Step 3: Add the export to `packages/client/src/ui/index.ts`**

Add this line next to the other primitive exports:

```ts
export { AnswerFeedback } from './AnswerFeedback';
export type { AnswerFeedbackState } from './AnswerFeedback';
```

- [ ] **Step 4: Add the same export to `packages/host/src/ui/index.ts`**

Identical line.

- [ ] **Step 5: Verify both packages build**

```bash
cd packages/client && npm run build
cd ../host && npm run build
```

Expected: both builds succeed.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/ui/AnswerFeedback.tsx packages/host/src/ui/AnswerFeedback.tsx packages/client/src/ui/index.ts packages/host/src/ui/index.ts
git commit -m "feat(ui): add AnswerFeedback wrapper for universal correct/wrong animation"
```

---

### Task 3: Rebuild GamePromptHeader internals using primitives

**Files:**
- Modify: `packages/client/src/components/GamePromptHeader.tsx`

The prop signature stays identical so the existing callers (Quiz, TrueFalse, Pointless) keep compiling. Only the internal JSX and Tailwind classes change. Pointless still uses this component until Phase 6, so its rendering must continue to look acceptable — the redesigned header degrades gracefully when `eyebrow`/`meta`/`title`/`details` are provided in the existing shape.

- [ ] **Step 1: Replace the contents of `packages/client/src/components/GamePromptHeader.tsx`**

```tsx
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface GamePromptHeaderProps {
  eyebrow: string;
  meta: string;
  title: ReactNode;
  details?: ReactNode;
  timerMs?: number;
  totalMs?: number;
  /** @deprecated kept for prop-shape compatibility; the redesigned bar picks its own color. */
  timerBarClassName?: string;
  /** @deprecated kept for prop-shape compatibility; the redesigned text picks its own color. */
  timerTextClassName?: string;
}

export const GamePromptHeader = ({
  eyebrow,
  meta,
  title,
  details,
  timerMs,
  totalMs,
}: GamePromptHeaderProps) => {
  const hasTimer = typeof timerMs === 'number' && typeof totalMs === 'number' && totalMs > 0;
  const progress = hasTimer ? Math.max(0, Math.min(100, (timerMs! / totalMs!) * 100)) : 0;

  // Tone of the timer reacts to time remaining, replacing the old caller-supplied class.
  const timerTone =
    progress > 50 ? 'bg-action' :
    progress > 25 ? 'bg-warn' :
                    'bg-danger';
  const timerTextTone =
    progress > 50 ? 'text-action' :
    progress > 25 ? 'text-warn' :
                    'text-danger';

  return (
    <div className="mb-6 text-center sm:mb-8">
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak sm:text-sm">
        {eyebrow}
      </p>
      <p className="mt-2 text-[0.72rem] font-bold uppercase tracking-[0.2em] text-ink-muted sm:text-sm sm:tracking-[0.24em]">
        {meta}
      </p>
      <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight text-ink sm:mt-4 sm:text-5xl">
        {title}
      </h1>

      {details ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          {details}
        </div>
      ) : null}

      {hasTimer && (
        <div className="mx-auto mt-6 max-w-2xl">
          <div className="h-3 overflow-hidden rounded-full border-2 border-ink bg-bg-sunken shadow-ink-sm">
            <motion.div
              className={`h-full ${timerTone}`}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.1, ease: 'linear' }}
            />
          </div>
          <div className={`mt-2 text-right font-display text-sm font-extrabold sm:text-base ${timerTextTone}`}>
            {Math.ceil(timerMs! / 1000)}s
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify the build passes**

```bash
cd packages/client && npm run build
```

Expected: build succeeds. Pointless still imports `GamePromptHeader` and passes `timerBarClassName` / `timerTextClassName` — those props now exist but are ignored. No type error, no runtime change in behavior for non-migrated screens.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/GamePromptHeader.tsx
git commit -m "feat(client): rebuild GamePromptHeader internals with redesign primitives"
```

---

### Task 4: Rebuild GameStatusBar internals using primitives

**Files:**
- Modify: `packages/client/src/components/GameStatusBar.tsx`

Same approach: keep the prop signature intact (no current player-side caller imports it today, but the file exists and is exported, so we keep it ready for use). Internals get rebuilt with `Pill` and `Chip`.

- [ ] **Step 1: Replace the contents of `packages/client/src/components/GameStatusBar.tsx`**

```tsx
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Chip } from '../ui/Chip';

interface GameStatusBarProps {
  gameLabel: string;
  progressLabel: string;
  score: number | string;
  scoreUnit?: string;
  placement?: number | null;
  placementContext?: string;
  /** @deprecated kept for prop-shape compatibility; redesigned bar picks its own color. */
  accentClassName?: string;
  extra?: ReactNode;
}

const getOrdinalSuffix = (num: number) => {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
};

export const GameStatusBar = ({
  gameLabel,
  progressLabel,
  score,
  scoreUnit = 'pts',
  placement,
  placementContext,
  extra,
}: GameStatusBarProps) => (
  <motion.div
    initial={{ y: -48, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    className="fixed inset-x-0 top-0 z-20 border-b-2 border-ink bg-bg-surface px-3 py-3 shadow-ink-sm sm:px-4"
  >
    <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak">{gameLabel}</p>
        <p className="truncate text-xs font-semibold text-ink-muted sm:text-sm">{progressLabel}</p>
      </div>

      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end sm:gap-3">
        <Chip variant="info">
          <span className="font-display text-base font-black">{score}</span>
          <span className="text-[0.65rem] tracking-[0.18em]">{scoreUnit.toUpperCase()}</span>
        </Chip>

        {extra}

        {placement !== null && placement !== undefined && placement > 0 && (
          <Chip>
            <span className="font-display text-base font-black">
              {placement}{getOrdinalSuffix(placement)}
            </span>
            {placementContext && <span className="text-[0.65rem] tracking-[0.18em] uppercase">{placementContext}</span>}
          </Chip>
        )}
      </div>
    </div>
  </motion.div>
);
```

- [ ] **Step 2: Verify the build passes**

```bash
cd packages/client && npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/GameStatusBar.tsx
git commit -m "feat(client): rebuild GameStatusBar internals with Chip primitive"
```

---

### Task 5: Migrate Quiz intro phase

**Files:**
- Modify: `packages/client/src/screens/Quiz.tsx`

The `intro` phase shows a briefing splash with a progress bar counting down to the first question. Rebuild using `Card` and the new color tokens.

- [ ] **Step 1: Replace the `// Intro Phase` block (currently at roughly lines 251–294)**

Find the `if (phase === 'intro' && introData) {` block and replace its return JSX with:

```tsx
  if (phase === 'intro' && introData) {
    const progress = ((introData.duration - timeRemaining) / introData.duration) * 100;

    return (
      <div className="min-h-screen bg-bg-base px-4 py-8 text-ink">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-6 text-center"
        >
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak sm:text-sm">
            Quiz Briefing
          </p>
          <h1 className="font-serif text-5xl font-extrabold leading-tight tracking-tight text-ink sm:text-6xl">
            {introData.title}
          </h1>
          <p className="text-xl font-semibold text-ink-muted sm:text-2xl">Starting shortly</p>

          <div className="w-full max-w-md">
            <div className="h-3 overflow-hidden rounded-full border-2 border-ink bg-bg-sunken shadow-ink-sm">
              <motion.div
                className="h-full bg-action"
                style={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <p className="mt-2 text-sm font-bold text-ink-muted">
              Starting in {Math.ceil(timeRemaining / 1000)}s…
            </p>
          </div>
        </motion.div>
      </div>
    );
  }
```

- [ ] **Step 2: Verify the build passes**

```bash
cd packages/client && npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Boot the dev server and visually check (optional manual check)**

```bash
cd packages/client && npm run dev
```

The intro phase only shows when the server fires a `quiz:intro` event — you can't trigger it from the URL. Skip manual verification if the server isn't running; the next phases will be reached via the host launching Quiz.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/screens/Quiz.tsx
git commit -m "feat(client/quiz): migrate intro phase to redesign primitives"
```

---

### Task 6: Migrate Quiz voting and votingResults phases

**Files:**
- Modify: `packages/client/src/screens/Quiz.tsx`

Two related phases. Voting shows four category buttons (kept in the server-supplied `category.color` since these are arbitrary themes, not the universal answer-letter colors). `votingResults` shows the same buttons with vote counts and a winner highlight.

- [ ] **Step 1: Replace the `// Voting Phase` block**

Find `if (phase === 'voting') {` and replace its return with:

```tsx
  if (phase === 'voting') {
    return (
      <div className="min-h-screen bg-bg-base px-4 py-8 text-ink">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="mx-auto max-w-4xl"
        >
          <p className="mb-3 text-center text-xs font-extrabold uppercase tracking-[0.2em] text-streak sm:text-sm">
            Round Vote
          </p>
          <h1 className="text-center text-4xl font-extrabold tracking-tight text-ink">
            Vote for Category
          </h1>
          <p className="mt-2 text-center text-base font-semibold text-ink-muted">
            The leader's vote counts 2×.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {categories.map((category) => {
              const isPicked = selectedCategory === category.id;
              const dimmed = selectedCategory && !isPicked;
              return (
                <motion.button
                  key={category.id}
                  onClick={() => handleVote(category.id)}
                  disabled={!!selectedCategory}
                  whileHover={!selectedCategory ? { x: -1, y: -1 } : undefined}
                  whileTap={!selectedCategory ? { x: 4, y: 4 } : undefined}
                  transition={{ duration: 0.08, ease: [0, 0, 0.2, 1] }}
                  className={[
                    'rounded-2xl border-2 border-ink p-6 text-xl font-extrabold text-white shadow-ink sm:p-8 sm:text-2xl',
                    isPicked ? 'ring-4 ring-now' : '',
                    dimmed ? 'opacity-40' : '',
                  ].join(' ')}
                  style={{ backgroundColor: category.color }}
                >
                  {(category as any).label || category.name}
                </motion.button>
              );
            })}
          </div>

          {selectedCategory && (
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="mt-6 text-center text-base font-extrabold text-action"
            >
              ✓ Vote submitted!
            </motion.p>
          )}
        </motion.div>
      </div>
    );
  }
```

- [ ] **Step 2: Replace the `// Voting Results Phase` block**

Find `if (phase === 'votingResults' && votingResults) {` and replace its return with:

```tsx
  if (phase === 'votingResults' && votingResults) {
    return (
      <div className="min-h-screen bg-bg-base px-4 py-8 text-ink">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="mx-auto max-w-4xl"
        >
          <p className="mb-3 text-center text-xs font-extrabold uppercase tracking-[0.2em] text-streak sm:text-sm">
            Vote Locked
          </p>
          <h1 className="text-center text-4xl font-extrabold tracking-tight text-ink">
            Voting Results
          </h1>
          <p className="mt-2 text-center text-base font-semibold text-ink-muted">
            The votes are in!
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {categories.map((category) => {
              const voteCount = votingResults.voteCounts[category.id] || 0;
              const isWinner = votingResults.winningOptionId === category.id;
              return (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className={[
                    'rounded-2xl border-2 border-ink p-5 text-center text-white shadow-ink sm:p-6',
                    isWinner ? 'ring-4 ring-now scale-[1.03]' : '',
                  ].join(' ')}
                  style={{ backgroundColor: category.color }}
                >
                  <div className="text-xl font-extrabold sm:text-2xl">{(category as any).label || category.name}</div>
                  <div className="mt-2 font-display text-3xl font-black leading-none sm:text-4xl">{voteCount}</div>
                  <div className="mt-1 text-xs font-bold uppercase tracking-[0.18em] opacity-80">
                    vote{voteCount !== 1 ? 's' : ''}
                  </div>
                  {isWinner && (
                    <div className="mt-2 text-base font-extrabold uppercase tracking-[0.18em]">Winner!</div>
                  )}
                </motion.div>
              );
            })}
          </div>

          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="mt-6 text-center text-base font-bold text-ink-muted"
          >
            Next question coming up…
          </motion.p>
        </motion.div>
      </div>
    );
  }
```

- [ ] **Step 3: Verify the build passes**

```bash
cd packages/client && npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/screens/Quiz.tsx
git commit -m "feat(client/quiz): migrate voting + votingResults phases to redesign"
```

---

### Task 7: Migrate Quiz question phase (answer buttons + tactile press + correct/wrong feedback)

**Files:**
- Modify: `packages/client/src/screens/Quiz.tsx`

This is the heart of the migration. Replace the `QUIZ_ANSWER_COLORS` hex map with semantic Tailwind classes. Add letter squares to each button. Wrap each button in `AnswerFeedback` so it pulses or shakes once results are revealed (note: results are shown in the *results* phase, not here — but the player only learns "submitted" here; the actual feedback animation runs when we transition to results in Task 8. So in this task we only add the tactile press behavior + answer-letter color migration).

- [ ] **Step 1: Delete the `QUIZ_ANSWER_COLORS` constant (currently near the top of the file)**

Find:

```tsx
const QUIZ_ANSWER_COLORS: Record<string, string> = {
  A: '#7186be',
  B: '#6f9a79',
  C: '#d7a348',
  D: '#8b5f6b'
};
```

…and delete it.

- [ ] **Step 2: Add a small helper near the top of the file (after the imports, before the component)**

```tsx
const ANSWER_BG_CLASS: Record<string, string> = {
  A: 'bg-answer-a',
  B: 'bg-answer-b',
  C: 'bg-answer-c',
  D: 'bg-answer-d',
};
```

- [ ] **Step 3: Replace the `// Question Phase` block**

Find `if (phase === 'question' && currentQuestion) {` and replace its return with:

```tsx
  if (phase === 'question' && currentQuestion) {
    const timeSeconds = Math.ceil(timeRemaining / 1000);

    return (
      <div className="min-h-screen bg-bg-base px-4 py-8 text-ink">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="mx-auto max-w-5xl"
        >
          <GamePromptHeader
            eyebrow="Quiz"
            meta={`${currentQuestion.category} • ${currentQuestion.difficulty}`}
            title={currentQuestion.question}
            details={(
              <>
                <Chip variant="info">
                  <span className="font-display text-base font-black">{currentScore}</span>
                  <span className="text-[0.65rem] tracking-[0.18em] uppercase">pts</span>
                </Chip>
                {currentPlacement ? (
                  <Chip>
                    <span className="font-display text-base font-black">
                      {currentPlacement}{getOrdinalSuffix(currentPlacement)}
                    </span>
                    <span className="text-[0.65rem] tracking-[0.18em] uppercase">in Quiz</span>
                  </Chip>
                ) : null}
              </>
            )}
            timerMs={timeRemaining}
            totalMs={currentQuestion.duration}
          />

          <div className="mx-auto max-w-4xl">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {Object.entries(currentQuestion.answers).map(([key, value]) => {
                const isPicked = selectedAnswer === key;
                const dimmed = !!selectedAnswer && !isPicked;
                return (
                  <motion.button
                    key={key}
                    onClick={() => handleAnswer(key)}
                    disabled={!!selectedAnswer}
                    whileHover={!selectedAnswer ? { x: -1, y: -1 } : undefined}
                    whileTap={!selectedAnswer ? { x: 4, y: 4 } : undefined}
                    transition={{ duration: 0.08, ease: [0, 0, 0.2, 1] }}
                    className={[
                      'flex min-h-[100px] w-full items-center gap-4 rounded-2xl border-2 border-ink p-4 text-left text-white shadow-ink touch-manipulation sm:min-h-[88px] sm:p-5',
                      ANSWER_BG_CLASS[key] || 'bg-bg-surface',
                      isPicked ? 'ring-4 ring-now' : '',
                      dimmed ? 'opacity-40' : '',
                    ].join(' ')}
                  >
                    <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-bg-surface font-display text-2xl font-black text-ink shadow-ink-sm">
                      {key}
                    </span>
                    <span className="flex-1 text-xl font-extrabold leading-tight sm:text-2xl">
                      {value}
                    </span>
                  </motion.button>
                );
              })}
            </div>

            {selectedAnswer && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="mt-6 text-center text-base font-extrabold text-action"
              >
                Answer submitted. Locked in with {submittedTimeSeconds ?? timeSeconds}s remaining.
              </motion.p>
            )}
          </div>
        </motion.div>
      </div>
    );
  }
```

- [ ] **Step 4: Add the `Chip` import**

At the top of `Quiz.tsx`, add:

```tsx
import { Chip } from '../ui/Chip';
```

- [ ] **Step 5: Verify the build passes**

```bash
cd packages/client && npm run build
```

Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/screens/Quiz.tsx
git commit -m "feat(client/quiz): migrate question phase to answer-letter colors + tactile press"
```

---

### Task 8: Migrate Quiz results phase with correct/wrong feedback and Correct! banner

**Files:**
- Modify: `packages/client/src/screens/Quiz.tsx`

The results phase is where the universal correct/wrong feedback fires. The player's pick gets either a green pulse (correct) or red shake (wrong); the correct answer is highlighted; a "Correct!" / "Wrong" banner slides down from the top.

- [ ] **Step 1: Replace the `// Results Phase` block**

Find `if (phase === 'results' && results && currentQuestion) {` and replace its return with:

```tsx
  if (phase === 'results' && results && currentQuestion) {
    const myResult = results.results.find((r: any) => r.playerId === playerId);
    const myRank = results.leaderboard?.findIndex((p: any) => p.id === playerId) + 1 || 0;
    const correctAnswerKey = results.correctAnswer;
    const correctAnswerText = currentQuestion.answers[correctAnswerKey];
    const wasCorrect = !!myResult?.isCorrect;
    const hadAnswer = !!selectedAnswer;

    return (
      <div className="min-h-screen bg-bg-base px-4 py-8 text-ink">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="mx-auto max-w-5xl"
        >
          {/* Banner: Correct! / Wrong / No answer */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="mx-auto mb-6 max-w-2xl"
          >
            <div
              className={[
                'rounded-2xl border-2 border-ink px-6 py-4 text-center font-display text-3xl font-black shadow-ink',
                wasCorrect ? 'bg-action text-on-action' : hadAnswer ? 'bg-danger text-on-danger' : 'bg-bg-sunken text-ink',
              ].join(' ')}
            >
              {wasCorrect ? 'Correct!' : hadAnswer ? 'Wrong' : 'No answer'}
              <div className="mt-1 font-sans text-sm font-bold uppercase tracking-[0.18em] opacity-90">
                {myResult ? `+${myResult.points} points` : '0 points'}
              </div>
            </div>
          </motion.div>

          <GamePromptHeader
            eyebrow="Quiz"
            meta={`${currentQuestion.category} • ${currentQuestion.difficulty}`}
            title={currentQuestion.question}
            details={(
              <>
                <Chip variant="info">
                  <span className="font-display text-base font-black">{myResult?.newScore ?? currentScore}</span>
                  <span className="text-[0.65rem] tracking-[0.18em] uppercase">pts</span>
                </Chip>
                {myRank > 0 ? (
                  <Chip>
                    <span className="font-display text-base font-black">
                      {myRank}{getOrdinalSuffix(myRank)}
                    </span>
                    <span className="text-[0.65rem] tracking-[0.18em] uppercase">in Quiz</span>
                  </Chip>
                ) : null}
              </>
            )}
          />

          <div className="mx-auto max-w-4xl">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {Object.entries(currentQuestion.answers).map(([key, value]) => {
                const isCorrectAnswer = key === correctAnswerKey;
                const isPlayerPick = selectedAnswer === key;
                const playerPickedThis = isPlayerPick;
                // Feedback animation: only on the player's pick.
                const feedbackState: 'idle' | 'correct' | 'wrong' =
                  playerPickedThis ? (wasCorrect ? 'correct' : 'wrong') : 'idle';

                return (
                  <AnswerFeedback key={key} state={feedbackState}>
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 * ['A', 'B', 'C', 'D'].indexOf(key), duration: 0.22, ease: 'easeOut' }}
                      className={[
                        'flex min-h-[100px] w-full items-center gap-4 rounded-2xl border-2 border-ink p-4 text-left text-white shadow-ink sm:p-5',
                        ANSWER_BG_CLASS[key] || 'bg-bg-surface',
                        isCorrectAnswer ? 'ring-4 ring-action' : '',
                        !isCorrectAnswer && !isPlayerPick ? 'opacity-40' : '',
                        isPlayerPick && !wasCorrect ? 'ring-4 ring-danger' : '',
                      ].join(' ')}
                    >
                      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-bg-surface font-display text-2xl font-black text-ink shadow-ink-sm">
                        {key}
                      </span>
                      <div className="flex-1">
                        <div className="text-xl font-extrabold leading-tight sm:text-2xl">{value}</div>
                        {isPlayerPick && (
                          <div className="mt-1 text-xs font-extrabold uppercase tracking-[0.18em] opacity-90">
                            Your pick
                          </div>
                        )}
                      </div>
                      {isCorrectAnswer && (
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 border-ink bg-action text-on-action font-black shadow-ink-sm">
                          ✓
                        </span>
                      )}
                    </motion.div>
                  </AnswerFeedback>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }
```

- [ ] **Step 2: Add the `AnswerFeedback` import at the top of `Quiz.tsx`**

```tsx
import { AnswerFeedback } from '../ui/AnswerFeedback';
```

- [ ] **Step 3: Also replace the loading-state fallback at the bottom of the file**

Find:

```tsx
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="card">
        <h2 className="text-2xl font-bold text-center">Loading Quiz...</h2>
      </div>
    </div>
  );
```

Replace with:

```tsx
  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center px-4">
      <div className="rounded-2xl border-2 border-ink bg-bg-surface p-8 shadow-ink-lg">
        <h2 className="text-center text-2xl font-extrabold text-ink">Loading Quiz…</h2>
      </div>
    </div>
  );
```

- [ ] **Step 4: Verify the build passes**

```bash
cd packages/client && npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/screens/Quiz.tsx
git commit -m "feat(client/quiz): migrate results phase with correct/wrong feedback + banner"
```

---

### Task 9: Migrate TrueFalse intro phase

**Files:**
- Modify: `packages/client/src/screens/TrueFalse.tsx`

Same approach as Quiz intro, but with the action-green title.

- [ ] **Step 1: Replace the `// Intro Phase` block**

Find `if (phase === 'intro' && introData) {` and replace its return with:

```tsx
  if (phase === 'intro' && introData) {
    const progress = introData.duration ? ((introData.duration - timeRemaining) / introData.duration) * 100 : 0;

    return (
      <div className="min-h-screen bg-bg-base px-4 py-8 text-ink">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-6 text-center"
        >
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak sm:text-sm">
            True or False
          </p>
          <h1 className="font-serif text-5xl font-extrabold leading-tight tracking-tight text-action sm:text-6xl">
            {introData.title}
          </h1>
          <p className="text-xl font-semibold text-ink-muted sm:text-2xl">Starting shortly</p>

          <div className="w-full max-w-md">
            <div className="h-3 overflow-hidden rounded-full border-2 border-ink bg-bg-sunken shadow-ink-sm">
              <motion.div
                className="h-full bg-action"
                style={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <p className="mt-2 text-sm font-bold text-ink-muted">
              Starting in {Math.ceil(timeRemaining / 1000)}s…
            </p>
          </div>
        </motion.div>
      </div>
    );
  }
```

- [ ] **Step 2: Verify the build passes**

```bash
cd packages/client && npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/screens/TrueFalse.tsx
git commit -m "feat(client/truefalse): migrate intro phase to redesign primitives"
```

---

### Task 10: Migrate TrueFalse playing phase (TRUE/FALSE buttons + streak chip + correct/wrong feedback)

**Files:**
- Modify: `packages/client/src/screens/TrueFalse.tsx`

The TrueFalse player screen has both the live answering UI and the post-answer reveal in one phase (controlled by `showingAnswer`). Migrate both halves: two large buttons (true=action, false=danger) with tactile press, and the reveal card with universal correct/wrong feedback. Also: when streak ≥ 2, show the terracotta `🔥 Nx streak` chip.

- [ ] **Step 1: Replace the `// Playing Phase` block**

Find `if (phase === 'playing' && currentStatement) {` and replace its return with:

```tsx
  if (phase === 'playing' && currentStatement) {
    const showingAnswer = correctAnswer !== null;
    const wasCorrect = correctAnswer === selectedAnswer;
    const hadAnswer = selectedAnswer !== null;

    return (
      <div className="min-h-screen bg-bg-base px-4 py-8 text-ink">
        <motion.div
          key={currentStatement.statementId}
          initial={{ opacity: 0, x: 80 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="mx-auto max-w-5xl"
        >
          <GamePromptHeader
            eyebrow="True or False"
            meta={`Statement ${currentStatement.statementNumber} of ${currentStatement.totalStatements}`}
            title={currentStatement.statement}
            details={(
              <>
                <Chip variant="info">
                  <span className="font-display text-base font-black">{currentScore}</span>
                  <span className="text-[0.65rem] tracking-[0.18em] uppercase">pts</span>
                </Chip>
                {currentPlacement ? (
                  <Chip>
                    <span className="font-display text-base font-black">
                      {currentPlacement}{getOrdinalSuffix(currentPlacement)}
                    </span>
                    <span className="text-[0.65rem] tracking-[0.18em] uppercase">in True/False</span>
                  </Chip>
                ) : null}
                {currentStreak >= 2 ? (
                  <motion.div
                    key={currentStreak}
                    variants={streakChipPop}
                    initial="hidden"
                    animate="visible"
                  >
                    <Chip variant="streak">
                      <span aria-hidden="true">🔥</span>
                      <span className="font-display text-base font-black">{currentStreak}×</span>
                      <span className="text-[0.65rem] tracking-[0.18em] uppercase">streak</span>
                    </Chip>
                  </motion.div>
                ) : null}
              </>
            )}
            timerMs={!showingAnswer ? timeRemaining : undefined}
            totalMs={!showingAnswer ? currentStatement.duration : undefined}
          />

          <div className="mx-auto max-w-4xl">
            {showingAnswer ? (
              <AnswerFeedback state={wasCorrect ? 'correct' : hadAnswer ? 'wrong' : 'idle'}>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className={[
                    'mb-6 rounded-2xl border-2 border-ink p-6 text-center shadow-ink',
                    wasCorrect ? 'bg-action text-on-action' : hadAnswer ? 'bg-danger text-on-danger' : 'bg-bg-sunken text-ink',
                  ].join(' ')}
                >
                  <p className="font-display text-3xl font-black">
                    {wasCorrect ? 'Correct!' : hadAnswer ? 'Wrong' : 'No answer'}
                  </p>
                  <p className="mt-2 text-base font-bold uppercase tracking-[0.18em] opacity-90">
                    Answer: {correctAnswer ? 'TRUE' : 'FALSE'}
                  </p>

                  {explanation && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25, duration: 0.22, ease: 'easeOut' }}
                      className="mt-6 rounded-xl border-2 border-ink bg-bg-surface p-5 text-left text-ink shadow-ink-sm"
                    >
                      <h3 className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-streak">
                        Did you know?
                      </h3>
                      <p className="text-base font-semibold text-ink-muted">{explanation}</p>
                    </motion.div>
                  )}
                </motion.div>
              </AnswerFeedback>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                <motion.button
                  onClick={() => handleAnswer(false)}
                  disabled={selectedAnswer !== null}
                  whileHover={selectedAnswer === null ? { x: -1, y: -1 } : undefined}
                  whileTap={selectedAnswer === null ? { x: 4, y: 4 } : undefined}
                  transition={{ duration: 0.08, ease: [0, 0, 0.2, 1] }}
                  className={[
                    'min-h-[120px] rounded-2xl border-2 border-ink bg-danger text-on-danger font-display text-4xl font-black tracking-tight shadow-ink touch-manipulation sm:text-5xl',
                    selectedAnswer === false ? 'ring-4 ring-now' : '',
                    selectedAnswer === true ? 'opacity-40' : '',
                  ].join(' ')}
                >
                  FALSE
                </motion.button>

                <motion.button
                  onClick={() => handleAnswer(true)}
                  disabled={selectedAnswer !== null}
                  whileHover={selectedAnswer === null ? { x: -1, y: -1 } : undefined}
                  whileTap={selectedAnswer === null ? { x: 4, y: 4 } : undefined}
                  transition={{ duration: 0.08, ease: [0, 0, 0.2, 1] }}
                  className={[
                    'min-h-[120px] rounded-2xl border-2 border-ink bg-action text-on-action font-display text-4xl font-black tracking-tight shadow-ink touch-manipulation sm:text-5xl',
                    selectedAnswer === true ? 'ring-4 ring-now' : '',
                    selectedAnswer === false ? 'opacity-40' : '',
                  ].join(' ')}
                >
                  TRUE
                </motion.button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    );
  }
```

- [ ] **Step 2: Add the imports at the top of `TrueFalse.tsx`**

```tsx
import { Chip } from '../ui/Chip';
import { AnswerFeedback } from '../ui/AnswerFeedback';
import { streakChipPop } from '../lib/motion';
```

- [ ] **Step 3: Verify the build passes**

```bash
cd packages/client && npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/screens/TrueFalse.tsx
git commit -m "feat(client/truefalse): migrate playing phase with TRUE/FALSE buttons + streak chip"
```

---

### Task 11: Migrate TrueFalse results phase and loading fallback

**Files:**
- Modify: `packages/client/src/screens/TrueFalse.tsx`

The results phase shows the game's final accuracy in a single card. Quick migration.

- [ ] **Step 1: Replace the `// Results Phase` block**

Find `if (phase === 'results' && results) {` and replace its return with:

```tsx
  if (phase === 'results' && results) {
    const myResult = results.results.find((r: any) => r.playerId === playerId);

    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center px-4 py-8 text-ink">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="w-full max-w-3xl rounded-3xl border-2 border-ink bg-bg-surface p-8 shadow-ink-lg sm:p-10"
        >
          <p className="mb-2 text-center text-xs font-extrabold uppercase tracking-[0.2em] text-streak sm:text-sm">
            True or False
          </p>
          <h2 className="mb-6 text-center font-serif text-3xl font-extrabold tracking-tight sm:text-4xl">
            Game Over
          </h2>

          {myResult && (
            <div className="text-center">
              <p className="font-display text-6xl font-black leading-none text-action sm:text-7xl">
                {myResult.accuracy}%
              </p>
              <p className="mt-3 text-xl font-bold text-ink-muted sm:text-2xl">
                {myResult.correct} / {myResult.total} correct
              </p>
              <p className="mt-6 text-lg font-semibold text-ink">
                You earned <span className="font-display text-2xl font-black text-streak">{myResult.points}</span> points
              </p>
              <p className="mt-2 text-sm font-bold text-ink-muted">
                Total score: <span className="font-display text-base text-ink">{myResult.newScore}</span>
              </p>
            </div>
          )}
        </motion.div>
      </div>
    );
  }
```

- [ ] **Step 2: Replace the loading-state fallback at the bottom of the file**

Find:

```tsx
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="card">
        <h2 className="text-2xl font-bold text-center">Loading...</h2>
      </div>
    </div>
  );
```

Replace with:

```tsx
  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center px-4">
      <div className="rounded-2xl border-2 border-ink bg-bg-surface p-8 shadow-ink-lg">
        <h2 className="text-center text-2xl font-extrabold text-ink">Loading…</h2>
      </div>
    </div>
  );
```

- [ ] **Step 3: Verify the build passes**

```bash
cd packages/client && npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/screens/TrueFalse.tsx
git commit -m "feat(client/truefalse): migrate results phase + loading fallback to redesign"
```

---

### Task 12: Migrate the host Display Quiz branches (intro, voting, votingResults, question)

**Files:**
- Modify: `packages/host/src/screens/Display.tsx`

The host display is a giant phase-switch. ONLY the Quiz branches change in this task. Every other branch (`pokedle/hpdle/numbers/wordle/travel/countdown/pointless/trueFalse/lobby/leaderboard/roundLeaderboard/default`) MUST remain exactly as-is.

Host-screen skeleton (§7.3): location top-left, time-left top-right, content centre, player tracker bottom. The Quiz Question view gets that skeleton; the other Quiz branches (intro, voting, votingResults) sit in the same centred frame but with `—:—` in the time-left slot when no live timer applies.

This is the biggest task in the plan. Bite-sized: only edit the Quiz branches. Read the file before each edit to avoid touching neighbors.

- [ ] **Step 1: Migrate the `renderIntroView` helper to use redesign primitives**

`renderIntroView` is shared by Quiz, TrueFalse, AND Pointless. Pointless is still in old-style mode (Phase 6). To avoid breaking Pointless, **do not** rebuild `renderIntroView` itself — instead, add a new helper `renderRedesignedIntroView` and call IT from the Quiz and TrueFalse branches only. Pointless keeps calling the original.

Add this helper just below the existing `renderIntroView`:

```tsx
  const renderRedesignedIntroView = (eyebrow: string, intro: IntroState | null) => {
    if (!intro) return null;
    const countdown = getCountdownSeconds(intro.endsAt);

    return (
      <>
        <div className="min-h-screen bg-bg-base text-ink overflow-y-auto py-8 px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="mx-auto max-w-6xl"
          >
            {/* Skeleton header */}
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak sm:text-sm">
                  {eyebrow}
                </p>
                <p className="mt-1 text-base font-bold text-ink-muted">Get ready</p>
              </div>
              <div className="rounded-xl border-2 border-ink bg-bg-surface px-4 py-2 font-display text-2xl font-black text-ink shadow-ink-sm">
                {countdown !== null ? `${countdown}s` : '—:—'}
              </div>
            </div>

            <div className="rounded-3xl border-2 border-ink bg-bg-surface p-8 shadow-ink-lg sm:p-10">
              <h1 className="font-serif text-5xl font-extrabold leading-tight tracking-tight text-ink sm:text-6xl">
                {intro.title}
              </h1>
              <p className="mt-4 text-xl font-semibold leading-relaxed text-ink-muted sm:text-2xl">
                {intro.description}
              </p>

              <div className="mt-8 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border-2 border-ink bg-bg-sunken p-6 shadow-ink-sm">
                  <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.18em] text-streak">
                    How this game works
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(intro.scoringRules || []).slice(0, 6).map((rule) => (
                      <div
                        key={rule}
                        className="rounded-xl border-2 border-ink bg-bg-surface px-4 py-3 text-base font-semibold text-ink shadow-ink-sm"
                      >
                        {rule}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-ink bg-bg-sunken p-6 shadow-ink-sm">
                  <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-streak">
                    Placement
                  </p>
                  <p className="text-xl font-bold leading-relaxed text-ink">
                    {intro.placementInfo || 'Results on the house display determine the standings.'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
        {displayControl}
      </>
    );
  };
```

- [ ] **Step 2: Switch the Quiz and TrueFalse intro branches to call the new helper**

Find:

```tsx
  if (currentGame === 'quiz' && quizIntro) {
    return renderIntroView('Quiz Briefing', 'text-primary-blue', quizIntro);
  }

  if (currentGame === 'trueFalse' && trueFalseIntro) {
    return renderIntroView('True or False', 'text-game-correct', trueFalseIntro);
  }
```

Replace with:

```tsx
  if (currentGame === 'quiz' && quizIntro) {
    return renderRedesignedIntroView('Quiz Briefing', quizIntro);
  }

  if (currentGame === 'trueFalse' && trueFalseIntro) {
    return renderRedesignedIntroView('True or False', trueFalseIntro);
  }
```

Leave the Pointless line `return renderIntroView('Pointless Briefing', 'text-primary-teal', pointlessIntro);` untouched.

- [ ] **Step 3: Verify the build**

```bash
cd packages/host && npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/host/src/screens/Display.tsx
git commit -m "feat(host): migrate Quiz + TrueFalse intro branches in Display"
```

---

### Task 13: Migrate the host Quiz voting + votingResults + question branches

**Files:**
- Modify: `packages/host/src/screens/Display.tsx`

- [ ] **Step 1: Replace the `// Quiz Voting View` block (the `if (currentGame === 'quiz' && quizVoting && !quizVotingResults) {` branch)**

```tsx
  if (currentGame === 'quiz' && quizVoting && !quizVotingResults) {
    return (
      <>
        <div className="min-h-screen bg-bg-base text-ink overflow-y-auto py-8 px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="mx-auto max-w-6xl"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak sm:text-sm">
                  Quiz Round · Question {quizVoting.questionNumber} of {quizVoting.totalQuestions}
                </p>
                <p className="mt-1 text-base font-bold text-ink-muted">Players are voting</p>
              </div>
              <div className="rounded-xl border-2 border-ink bg-bg-surface px-4 py-2 font-display text-2xl font-black text-ink shadow-ink-sm">
                —:—
              </div>
            </div>

            <div className="rounded-3xl border-2 border-ink bg-bg-surface p-8 text-center shadow-ink-lg sm:p-10">
              <h1 className="font-serif text-5xl font-extrabold tracking-tight text-ink sm:text-6xl">
                Choose the next category
              </h1>
              <p className="mt-3 text-lg font-bold text-ink-muted sm:text-2xl">
                The leader's vote counts 2×
              </p>

              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
                {quizVoting.options.map((category: any) => (
                  <motion.div
                    key={category.id}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="rounded-2xl border-2 border-ink p-6 text-center text-white shadow-ink sm:p-8"
                    style={{ backgroundColor: category.color }}
                  >
                    <p className="text-2xl font-extrabold sm:text-3xl">{category.label}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
        {displayControl}
      </>
    );
  }
```

- [ ] **Step 2: Replace the votingResults branch (`if (currentGame === 'quiz' && quizVoting && quizVotingResults) {`)**

```tsx
  if (currentGame === 'quiz' && quizVoting && quizVotingResults) {
    return (
      <>
        <div className="min-h-screen bg-bg-base text-ink overflow-y-auto py-8 px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="mx-auto max-w-6xl"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak sm:text-sm">
                  Quiz Round · Question {quizVoting.questionNumber} of {quizVoting.totalQuestions}
                </p>
                <p className="mt-1 text-base font-bold text-ink-muted">Votes are in</p>
              </div>
              <div className="rounded-xl border-2 border-ink bg-bg-surface px-4 py-2 font-display text-2xl font-black text-ink shadow-ink-sm">
                —:—
              </div>
            </div>

            <div className="rounded-3xl border-2 border-ink bg-bg-surface p-8 text-center shadow-ink-lg sm:p-10">
              <h1 className="font-serif text-5xl font-extrabold tracking-tight text-ink sm:text-6xl">
                Voting Results
              </h1>

              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
                {quizVoting.options.map((category: any) => {
                  const voteCount = quizVotingResults.voteCounts?.[category.id] || 0;
                  const isWinner = quizVotingResults.winningOptionId === category.id;
                  return (
                    <motion.div
                      key={category.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                      className={[
                        'rounded-2xl border-2 border-ink p-6 text-center text-white shadow-ink sm:p-8',
                        isWinner ? 'ring-4 ring-now' : '',
                      ].join(' ')}
                      style={{ backgroundColor: category.color }}
                    >
                      <p className="text-2xl font-extrabold sm:text-3xl">{category.label}</p>
                      <p className="mt-4 font-display text-4xl font-black sm:text-5xl">{voteCount}</p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] opacity-90">
                        vote{voteCount === 1 ? '' : 's'}
                      </p>
                      {isWinner && (
                        <p className="mt-4 text-base font-extrabold uppercase tracking-[0.18em]">
                          Selected
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
        {displayControl}
      </>
    );
  }
```

- [ ] **Step 3: Replace the Quiz Question branch (`if (currentGame === 'quiz' && quizQuestion) {`)**

Delete the local `quizAnswerPalette` constant and replace the entire branch with:

```tsx
  if (currentGame === 'quiz' && quizQuestion) {
    const ANSWER_BG_CLASS: Record<string, string> = {
      A: 'bg-answer-a',
      B: 'bg-answer-b',
      C: 'bg-answer-c',
      D: 'bg-answer-d',
    };
    const submittedCount = players.filter((p) => p.connected).length; // best-effort; server tally not available here
    const totalConnected = players.filter((p) => p.connected).length;

    return (
      <>
        <div className="min-h-screen bg-bg-base text-ink overflow-y-auto py-8 px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="mx-auto max-w-6xl"
          >
            {/* Skeleton header: location top-left, time-left top-right */}
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak sm:text-sm">
                  Quiz Round · Question {quizQuestion.questionNumber} of {quizQuestion.totalQuestions}
                </p>
                <p className="mt-1 text-base font-bold text-ink-muted">
                  {quizQuestion.category} · {quizQuestion.difficulty}
                </p>
              </div>
              <div className="rounded-xl border-2 border-ink bg-bg-surface px-4 py-2 font-display text-2xl font-black text-ink shadow-ink-sm">
                {quizResults ? '—:—' : `${Math.ceil(((quizQuestion.endsAt ?? 0) - now) / 1000)}s`}
              </div>
            </div>

            {/* Centre: question and answers */}
            <div className="rounded-3xl border-2 border-ink bg-bg-surface p-8 shadow-ink-lg sm:p-10">
              <h2 className="text-center font-serif text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
                {quizQuestion.question}
              </h2>

              {quizResults ? (
                <div className="mx-auto mt-6 max-w-3xl rounded-2xl border-2 border-ink bg-action px-6 py-5 text-center text-on-action shadow-ink">
                  <p className="text-xs font-extrabold uppercase tracking-[0.2em] opacity-90">Correct answer</p>
                  <p className="mt-2 font-display text-3xl font-black sm:text-4xl">
                    {quizResults.correctAnswer} · {quizResults.correctAnswerText}
                  </p>
                </div>
              ) : null}

              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                {Object.entries(quizQuestion.answers).map(([key, value]: [string, any]) => {
                  const isCorrect = quizResults && key === quizResults.correctAnswer;
                  const dimmed = quizResults && key !== quizResults.correctAnswer;
                  return (
                    <motion.div
                      key={key}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 * ['A', 'B', 'C', 'D'].indexOf(key), duration: 0.22, ease: 'easeOut' }}
                      className={[
                        'flex items-center gap-4 rounded-2xl border-2 border-ink p-5 text-left text-white shadow-ink sm:p-6',
                        ANSWER_BG_CLASS[key] || 'bg-bg-surface',
                        isCorrect ? 'ring-4 ring-now' : '',
                        dimmed ? 'opacity-40' : '',
                      ].join(' ')}
                    >
                      <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-bg-surface font-display text-3xl font-black text-ink shadow-ink-sm">
                        {key}
                      </span>
                      <span className="flex-1 text-2xl font-extrabold leading-tight sm:text-3xl">{value}</span>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Bottom: player tracker */}
            <div className="mt-6 rounded-2xl border-2 border-ink bg-bg-surface p-5 shadow-ink">
              <div className="mb-3 flex items-end justify-between">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak">Players</p>
                <p className="font-display text-base font-black text-ink-muted">
                  {submittedCount} of {totalConnected}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {players.filter((p) => p.connected).map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-2 rounded-lg border-2 border-ink bg-bg-sunken px-2.5 py-1 text-xs font-extrabold text-ink shadow-ink-sm"
                  >
                    <span className="h-2 w-2 rounded-full bg-action" aria-hidden="true" />
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
        {displayControl}
      </>
    );
  }
```

Note: the player tracker's `submittedCount` falls back to the connected-player count because the host doesn't currently receive a per-player submission tally for Quiz. That's spec-acceptable for this phase — the tracker box and "X of Y" framing land; richer per-player status can come in a future tweak.

- [ ] **Step 4: Verify the build passes**

```bash
cd packages/host && npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/host/src/screens/Display.tsx
git commit -m "feat(host): migrate Quiz voting, votingResults, and question branches"
```

---

### Task 14: Migrate the host TrueFalse statement and reveal branches

**Files:**
- Modify: `packages/host/src/screens/Display.tsx`

Two branches: `tfReveal` (results) and `tfStatement` (during play). Keep the same skeleton (location top-left, countdown top-right, content centre, player tracker bottom).

- [ ] **Step 1: Replace the `// True/False View` reveal branch (`if (currentGame === 'trueFalse' && tfReveal) {`)**

```tsx
  if (currentGame === 'trueFalse' && tfReveal) {
    const totalConnected = players.filter((p) => p.connected).length;

    return (
      <>
        <div className="min-h-screen bg-bg-base text-ink overflow-y-auto py-8 px-6">
          <motion.div
            key={tfReveal.statementId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="mx-auto max-w-6xl"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak sm:text-sm">
                  True or False · Statement {tfReveal.statementNumber} of {tfReveal.totalStatements}
                </p>
                <p className="mt-1 text-base font-bold text-ink-muted">Reveal</p>
              </div>
              <div className="rounded-xl border-2 border-ink bg-bg-surface px-4 py-2 font-display text-2xl font-black text-ink shadow-ink-sm">
                —:—
              </div>
            </div>

            <div className="rounded-3xl border-2 border-ink bg-bg-surface p-8 shadow-ink-lg sm:p-10">
              <h2 className="text-center font-serif text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
                {tfReveal.statement}
              </h2>

              <div className="mt-8 grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
                <div
                  className={[
                    'rounded-2xl border-2 border-ink p-8 shadow-ink sm:p-10',
                    tfReveal.correctAnswer ? 'bg-action text-on-action' : 'bg-danger text-on-danger',
                  ].join(' ')}
                >
                  <p className="text-base font-extrabold uppercase tracking-[0.22em] opacity-90">Answer</p>
                  <p className="mt-3 font-display text-5xl font-black sm:text-6xl">
                    {tfReveal.correctAnswer ? 'TRUE' : 'FALSE'}
                  </p>
                </div>

                <div className="rounded-2xl border-2 border-ink bg-bg-sunken p-8 text-ink shadow-ink sm:p-10">
                  <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-streak">
                    Did You Know?
                  </p>
                  <p className="text-xl font-semibold leading-relaxed sm:text-2xl">
                    {tfReveal.explanation || 'No extra note for this statement.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Player tracker */}
            <div className="mt-6 rounded-2xl border-2 border-ink bg-bg-surface p-5 shadow-ink">
              <div className="mb-3 flex items-end justify-between">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak">Players</p>
                <p className="font-display text-base font-black text-ink-muted">
                  {totalConnected} of {totalConnected}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {players.filter((p) => p.connected).map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-2 rounded-lg border-2 border-ink bg-bg-sunken px-2.5 py-1 text-xs font-extrabold text-ink shadow-ink-sm"
                  >
                    <span className="h-2 w-2 rounded-full bg-action" aria-hidden="true" />
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
        {displayControl}
      </>
    );
  }
```

- [ ] **Step 2: Replace the `tfStatement` branch (`if (currentGame === 'trueFalse' && tfStatement) {`)**

```tsx
  if (currentGame === 'trueFalse' && tfStatement) {
    const totalConnected = players.filter((p) => p.connected).length;

    return (
      <>
        <div className="min-h-screen bg-bg-base text-ink overflow-y-auto py-8 px-6">
          <motion.div
            key={tfStatement.statementId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="mx-auto max-w-6xl"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak sm:text-sm">
                  True or False · Statement {tfStatement.statementNumber} of {tfStatement.totalStatements}
                </p>
                <p className="mt-1 text-base font-bold text-ink-muted">Players are answering</p>
              </div>
              <div className="rounded-xl border-2 border-ink bg-bg-surface px-4 py-2 font-display text-2xl font-black text-ink shadow-ink-sm">
                {tfStatement.endsAt ? `${Math.max(0, Math.ceil((tfStatement.endsAt - now) / 1000))}s` : '—:—'}
              </div>
            </div>

            <div className="rounded-3xl border-2 border-ink bg-bg-surface p-8 shadow-ink-lg sm:p-10">
              <h2 className="text-center font-serif text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
                {tfStatement.statement}
              </h2>

              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                <div className="rounded-2xl border-2 border-ink bg-danger p-8 text-on-danger shadow-ink sm:p-10">
                  <p className="font-display text-5xl font-black sm:text-6xl">FALSE</p>
                </div>
                <div className="rounded-2xl border-2 border-ink bg-action p-8 text-on-action shadow-ink sm:p-10">
                  <p className="font-display text-5xl font-black sm:text-6xl">TRUE</p>
                </div>
              </div>
            </div>

            {/* Player tracker */}
            <div className="mt-6 rounded-2xl border-2 border-ink bg-bg-surface p-5 shadow-ink">
              <div className="mb-3 flex items-end justify-between">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak">Players</p>
                <p className="font-display text-base font-black text-ink-muted">
                  {totalConnected} of {totalConnected}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {players.filter((p) => p.connected).map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-2 rounded-lg border-2 border-ink bg-bg-sunken px-2.5 py-1 text-xs font-extrabold text-ink shadow-ink-sm"
                  >
                    <span className="h-2 w-2 rounded-full bg-action" aria-hidden="true" />
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
        {displayControl}
      </>
    );
  }
```

- [ ] **Step 3: Verify the build passes**

```bash
cd packages/host && npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/host/src/screens/Display.tsx
git commit -m "feat(host): migrate TrueFalse statement + reveal branches in Display"
```

---

## Done criteria

Phase 5 is complete when:

1. **Both builds pass:** `npm run build` succeeds for `packages/client` and `packages/host` after every task and at the end.
2. **The dev servers boot cleanly:** `npm run dev` boots for `server`, `client`, and `host` with no console errors at load time.
3. **A Quiz playthrough lands every phase in the redesign:** intro splash uses Fraunces title and action progress bar; voting buttons use category colors with tactile press; voting results highlight the winner; question phase shows answer-letter colored buttons (A=cobalt, B=grass, C=sun, D=plum) with the letter in a small white square and a green/red ring + pulse/shake on the player's pick after reveal; results banner slides down from the top.
4. **A TrueFalse playthrough lands every phase:** intro splash; TRUE (action-green) / FALSE (danger-red) buttons with tactile press; correct/wrong banner with explanation card; `🔥 N× streak` chip in terracotta pops in once the player hits 2+ in a row.
5. **The host Display Quiz/TrueFalse branches** show the skeleton (location top-left, countdown top-right, content centre, player tracker bottom) with full-text labels — no `Q 7/15` or `T/F` abbreviations.
6. **Pointless still works unchanged** — it shares `GamePromptHeader` but only consumes the redesigned internals; verify the Pointless player screen still renders.
7. **Wordle, ThemedDle, Numbers, Travel** host branches in `Display.tsx` are byte-identical to before this PR — diff against `main`'s `Display.tsx` and confirm only the Quiz / TrueFalse branches and the new `renderRedesignedIntroView` helper changed.
8. **Light and dark mode** look right on every migrated screen (toggle via the `ThemeToggle` in the showcase or the host dashboard from Phase 3).
9. **`prefers-reduced-motion`** disables the correct/wrong transform animations on Quiz/TrueFalse (color and banner still land) — confirmed via DevTools rendering tab.
10. **Old utility classes survive** for non-migrated screens: `.btn-answer`, `.eyebrow`, `.status-pill`, `.card`, `.screen-shell`, `.screen-frame`, `.section-label` still exist in `packages/client/src/index.css`. Final cleanup is Phase 11.

---

## Out of scope

- Pointless redesign (Phase 6)
- Wordle / ThemedDle / Numbers / Travel screens or their host branches (Phases 7–10)
- Lobby / Countdown / FinalLeaderboard / RoundLeaderboard (Phases 3 and 4 — separate plans)
- Removing `QUIZ_ANSWER_COLORS`-style hex maps that may still exist elsewhere
- Removing or renaming the deprecated `timerBarClassName` / `timerTextClassName` / `accentClassName` props on `GamePromptHeader` and `GameStatusBar` — those go in Phase 11's final cleanup so non-migrated callers don't break
- Audio, server-side, new game logic, accessibility audit (Phase 11)
- Per-player Quiz submission tracking on the host (the tracker currently falls back to connected-count; richer telemetry is a future tweak)
