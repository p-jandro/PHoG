# PHoG UI Redesign — Phase 6: Pointless Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Pointless game — both the player screen (`packages/client/src/screens/Pointless.tsx` and its `Pointless/ColumnReveal.tsx`) and the host Display's Pointless branches (intro is handled by the existing `renderIntroView`; the round prompt and reveal branches are migrated here) — to the new PHoG design system primitives (`Button`, `Input`, `Card`, `Chip`, `Pill`, `Avatar`) and the **already-built `ScoreDrop` primitive** for the 100→target drop animation. The custom `ColumnReveal` component is retired in favour of `ScoreDrop`. Round logic (waiting/intro/playing/submitted/reveal phase machine, server events, score accumulation, placement calculation) is preserved verbatim.

**Architecture:** This plan only touches Pointless surfaces. No new primitives are added; the foundation's `ScoreDrop` (4000ms base + 90ms/pt, ease-out cubic, "POINTLESS" callout at 0, `onLanded` callback, `targetScore`/`autoStart` props) is consumed as-is on both client and host. The player reveal swaps `ColumnReveal` for `<ScoreDrop targetScore={revealData.score} autoStart onLanded={…} />` inside a redesigned `Card`. The host Display's `pointlessRound` branch becomes a chunky question card with status chips; the `pointlessReveal` branch keeps its top-3 obscure / top-3 frequent split but uses `Card` + `Chip` primitives and the new tokens. The host's per-player synchronized `ScoreDrop` reveal mentioned in the spec is **not driven by `pointlessReveal:display`** (that event delivers aggregate top-3 lists, not per-player scores) — see "Specifics" below — so the host reveal is reskinned as cards-with-chips rather than a sequence of `ScoreDrop` columns. If/when the server is extended to emit per-player reveal payloads, the placeholder noted in Task 8 can be filled in.

**Tech stack:** React 18 · TypeScript 5.3 · Tailwind 3.4 (consuming the CSS-variable tokens from Phase 1) · framer-motion 10 (already in both packages) · `ScoreDrop` primitive (built in Phase 1, Task 18).

**Spec reference:** [docs/superpowers/specs/2026-05-13-ui-redesign-design.md](../specs/2026-05-13-ui-redesign-design.md) — §3.9 (ScoreDrop), §4.4 (Pointless animation), §7.1 (player), §7.3 (host).

**Foundation reference:** [docs/superpowers/plans/2026-05-13-ui-redesign-foundation.md](2026-05-13-ui-redesign-foundation.md) — `ScoreDrop` lives at `packages/client/src/ui/ScoreDrop.tsx` and `packages/host/src/ui/ScoreDrop.tsx`, exported via the `ui/index.ts` barrels.

**Out of scope:**
- Any non-Pointless screen (Lobby, Quiz, TrueFalse, Wordle, Numbers, Travel, Themed-DLE, leaderboards, intro renderer)
- The shared `renderIntroView()` in `Display.tsx` (used by Quiz, TrueFalse, **and** Pointless — migrating it would touch the other two games and breaks the "Pointless only" constraint; the Pointless intro keeps the existing look until Phases 5/7+ land)
- Server-side Pointless logic (`packages/server/src/games/pointless/`) — scores, reveal data shape, timing all untouched
- The `ScoreDrop` primitive itself — already built; do not modify
- Round leaderboard / placement leaderboard rendering (`roundLeaderboard` branch in `Display.tsx`) — those are Phase 4
- The "Reveal Pointless Results" host-control floating button (`displayControl`) — kept as-is; only its colour token is touched in the polish task (Task 9)

---

## File map

**Client (`packages/client/`):**
- `src/screens/Pointless.tsx` — *modify* (waiting card, sticky status bar, playing form, submitted card, reveal card all rebuilt with primitives; `ColumnReveal` import replaced with `ScoreDrop`)
- `src/screens/Pointless/ColumnReveal.tsx` — *delete* (retired in favour of `ScoreDrop`)

**Host (`packages/host/`):**
- `src/screens/Display.tsx` — *modify* (only the `pointlessRound` and `pointlessReveal` branches, plus the `displayControl` button colour; everything else untouched)

No new files. No primitives added. No server, no shared components.

---

## Tasks

### Task 1: Delete the legacy `ColumnReveal` component

**Files:**
- Delete: `packages/client/src/screens/Pointless/ColumnReveal.tsx`

The Phase 1 `ScoreDrop` primitive supersedes this. The next task removes the import in `Pointless.tsx`; this task removes the file so the build will fail loudly if anything else references it.

- [ ] **Step 1: Confirm no other importers**

```bash
cd packages/client
grep -rn "ColumnReveal" src/
```

Expected: only `src/screens/Pointless.tsx` imports it. If anything else shows up, STOP and report — the spec assumes Pointless is the sole consumer.

- [ ] **Step 2: Delete the file**

```bash
git rm packages/client/src/screens/Pointless/ColumnReveal.tsx
```

- [ ] **Step 3: Verify the build now fails at the expected spot**

```bash
cd packages/client
npm run build
```

Expected: build fails with a "Cannot find module './Pointless/ColumnReveal'" error originating from `Pointless.tsx`. That is the broken state Task 2 fixes — do **not** commit yet. Proceed directly to Task 2.

---

### Task 2: Swap `ColumnReveal` for `ScoreDrop` in `Pointless.tsx`

**Files:**
- Modify: `packages/client/src/screens/Pointless.tsx`

This is the minimum-diff swap that gets the build green again. Visual chrome stays as-is for now; Tasks 3–6 reskin it. We do this swap first so each subsequent task is small and independently buildable.

- [ ] **Step 1: Update imports**

Replace the existing `ColumnReveal` import at the top of `Pointless.tsx`:

```tsx
// OLD
import { ColumnReveal } from './Pointless/ColumnReveal';

// NEW
import { ScoreDrop } from '../ui';
```

- [ ] **Step 2: Replace the `ColumnReveal` JSX inside the `reveal` phase**

Inside `{phase === 'reveal' && revealData && (...)}` block (around line 367), replace the `<ColumnReveal …/>` element with `<ScoreDrop …/>`:

```tsx
// OLD
<ColumnReveal
  key={revealData.triggerTime}
  score={revealData.score}
  triggerTime={revealData.triggerTime}
  isCorrect={revealData.isCorrect}
  className="h-[320px] sm:h-[400px]"
  onSequenceComplete={() => setRevealDetailsVisible(true)}
/>

// NEW
<div className="mx-auto flex justify-center py-4 sm:py-6">
  <ScoreDrop
    key={revealData.triggerTime}
    targetScore={revealData.score}
    autoStart
    onLanded={() => setRevealDetailsVisible(true)}
  />
</div>
```

Notes on the swap:
- `ScoreDrop` has no `isCorrect` / `triggerTime` parameters — it animates from 100 to `targetScore` regardless. For an incorrect submission the server already sets `score = 100`, so `<ScoreDrop targetScore={100} />` renders the bar full and lands immediately (the `useEffect` fires with `fullDrop = 0`, duration = 4000ms base, lands at 100). The "XXX" overlay from `ColumnReveal` is intentionally dropped — incorrect answers read as "your bar didn't move" which is the canonical Pointless visual.
- `key={revealData.triggerTime}` is still used to force `ScoreDrop` to remount whenever a new reveal arrives.
- `onLanded` replaces `onSequenceComplete` — same contract: fires after the drop + landing pause (1800ms or 2800ms at zero).
- The wrapper `<div>` keeps the bar centred inside the card; `ScoreDrop` itself is 96px wide × 240px tall plus the right-hand legend column.

- [ ] **Step 3: Verify the build is green**

```bash
cd packages/client
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit (Tasks 1 + 2 together — the deletion alone is broken)**

```bash
git add packages/client/src/screens/Pointless.tsx
git commit -m "feat(client/pointless): swap ColumnReveal for ScoreDrop primitive"
```

Note: `git rm` from Task 1 is already staged.

---

### Task 3: Migrate the Pointless "waiting" screen

**Files:**
- Modify: `packages/client/src/screens/Pointless.tsx`

The `waiting` branch is a tiny card that says "Waiting for the round to open". Swap its legacy `card` / `eyebrow` classes for the new `Card` primitive.

- [ ] **Step 1: Add primitive imports**

At the top of `Pointless.tsx`, extend the existing `from '../ui'` import:

```tsx
import { ScoreDrop, Card, Chip } from '../ui';
```

(`Card` is needed here; `Chip` is needed by Task 4 — adding both now avoids a redundant edit.)

- [ ] **Step 2: Replace the waiting JSX**

Find the block:

```tsx
if (!roundData && phase === 'waiting') {
  return (
    <div className="screen-shell flex items-center justify-center">
      <div className="card max-w-2xl text-center">
        <p className="eyebrow mb-3">Pointless</p>
        <h1 className="text-3xl font-bold">Waiting for the round to open</h1>
      </div>
    </div>
  );
}
```

Replace with:

```tsx
if (!roundData && phase === 'waiting') {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base p-6">
      <Card eyebrow="Pointless" className="max-w-xl text-center">
        <h1 className="font-display text-3xl font-extrabold text-ink sm:text-4xl">
          Waiting for the round to open
        </h1>
        <p className="mt-3 text-base text-ink-muted">
          Sit tight — the host will start the round any moment.
        </p>
      </Card>
    </div>
  );
}
```

Notes:
- `screen-shell` (legacy dark gradient) is replaced with a flat `bg-bg-base` panel so the new tokens drive light/dark.
- `Card` already provides border, hard shadow, padding, and the eyebrow chip strip.

- [ ] **Step 3: Verify the build**

```bash
cd packages/client
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/screens/Pointless.tsx
git commit -m "feat(client/pointless): migrate waiting screen to Card primitive"
```

---

### Task 4: Migrate the Pointless "intro" screen (player)

**Files:**
- Modify: `packages/client/src/screens/Pointless.tsx`

The `intro` phase shows the game splash with a teal title and a progress bar. Reskin using a `Card` with a Fraunces serif title (spec §2.2 reserves Fraunces for game-mode splashes).

- [ ] **Step 1: Replace the intro branch**

Find the `if (phase === 'intro' && introData) { … }` block (around line 191) and replace its return JSX:

```tsx
if (phase === 'intro' && introData) {
  const progress = introData.duration ? ((introData.duration - timeRemaining) / introData.duration) * 100 : 0;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-base p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-3xl"
      >
        <Card eyebrow="Pointless" className="text-center">
          <motion.h1
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
            className="font-serif text-5xl font-extrabold text-streak sm:text-6xl"
          >
            {introData.title}
          </motion.h1>

          <p className="mt-4 text-xl text-ink-muted sm:text-2xl">Starting shortly</p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-8 w-full max-w-md"
          >
            <div className="h-2 overflow-hidden rounded-full border-2 border-ink bg-bg-sunken">
              <motion.div
                className="h-full bg-action"
                style={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-ink-muted">
              Starting in {Math.ceil(timeRemaining / 1000)}s
            </p>
          </motion.div>
        </Card>
      </motion.div>
    </div>
  );
}
```

Notes:
- `font-serif` is Fraunces (per the foundation Tailwind config) — Pointless title gets the heritage serif moment per spec §2.2.
- `text-streak` (terracotta) is used for the title to lean into the "hero moment" tone; if your `Card` already injects an eyebrow chip, this stays harmonised.
- Progress bar uses `bg-action` (grass) on a `bg-bg-sunken` (well) track with a 2px ink border, matching the chunky aesthetic.

- [ ] **Step 2: Verify the build**

```bash
cd packages/client
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/screens/Pointless.tsx
git commit -m "feat(client/pointless): migrate intro splash to Card + Fraunces title"
```

---

### Task 5: Migrate the Pointless "playing" form (player)

**Files:**
- Modify: `packages/client/src/screens/Pointless.tsx`

The `playing` phase shows a sticky status bar (round meta, current score chip, placement chip, time chip + thin progress bar) and the answer form (label, input, submit button). Reskin both using `Card`, `Chip`, `Input`, and `Button`.

- [ ] **Step 1: Extend the primitives import**

```tsx
import { ScoreDrop, Card, Chip, Input, Button } from '../ui';
```

- [ ] **Step 2: Replace the sticky status bar (`isAnsweringPhase` branch)**

Find the `{isAnsweringPhase ? ( … sticky header … ) : ( … <GamePromptHeader …/> … )}` block (around line 239).

Replace the sticky-header JSX (the `<div className="sticky top-3 z-10 mb-4 …">` block) with:

```tsx
<div className="sticky top-3 z-10 mb-4 rounded-2xl border-2 border-ink bg-bg-surface p-4 shadow-ink sm:mb-6 sm:p-5">
  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0">
      <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-streak">
        Pointless
      </p>
      <p className="mt-1 text-sm font-semibold uppercase tracking-[0.16em] text-ink-muted">
        Round {roundData ? roundData.roundIndex + 1 : '-'} of {roundData ? roundData.totalRounds : '-'} · {roundData?.category || 'Category'}
      </p>
    </div>
    <div className="flex flex-wrap gap-2">
      <Chip variant="default">
        <span className="font-display text-lg font-extrabold text-ink">{myCurrentScore}</span>
        <span className="ml-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-muted">pts</span>
      </Chip>
      {myCurrentPlacement ? (
        <Chip variant="info">
          {myCurrentPlacement}{getOrdinalSuffix(myCurrentPlacement)} in Pointless
        </Chip>
      ) : null}
      {phase === 'playing' ? (
        <Chip variant="now">
          {Math.ceil(timeRemaining / 1000)}s
        </Chip>
      ) : null}
    </div>
  </div>
  {phase === 'playing' ? (
    <div className="mt-4">
      <div className="h-2 overflow-hidden rounded-full border-2 border-ink bg-bg-sunken">
        <motion.div
          className="h-full bg-action"
          animate={{ width: `${Math.max(0, Math.min(100, (timeRemaining / (roundData?.duration || 30000)) * 100))}%` }}
          transition={{ duration: 0.1, ease: 'linear' }}
        />
      </div>
    </div>
  ) : null}
</div>
```

Leave the `else` branch (the `GamePromptHeader` call for the reveal phase) alone for now — Task 6 handles the reveal card; `GamePromptHeader` is shared with other games and is out of scope for Pointless-only migration.

- [ ] **Step 3: Replace the playing form**

Find the `{phase === 'playing' && ( … <form>…</form> … )}` block (around line 306) and replace its inner JSX:

```tsx
{phase === 'playing' && (
  <motion.div
    key="input"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="w-full"
  >
    <Card className="space-y-5">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Your Answer"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your obscure answer..."
          autoFocus
          autoComplete="off"
          enterKeyHint="done"
          error={error || undefined}
        />
        <Button type="submit" variant="action" size="lg" className="w-full">
          Submit Answer
        </Button>
      </form>
    </Card>
  </motion.div>
)}
```

Notes:
- `Input` accepts `label`, `error`, and the standard HTML input props per the foundation primitive contract. If your local `Input` signature differs, adapt the prop names — but do not introduce raw `<input>` JSX, that defeats the point of the migration.
- `Button` variant `action` is grass-green per spec §2.1 — the canonical "submit / go" colour.

- [ ] **Step 4: Replace the "submitted" card**

Find the `{phase === 'submitted' && ( … )}` block and replace it:

```tsx
{phase === 'submitted' && (
  <motion.div
    key="submitted"
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 1.1 }}
    className="w-full"
  >
    <Card className="py-12 text-center">
      <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-ink bg-action shadow-ink">
        <span className="font-display text-3xl font-black text-white">OK</span>
      </div>
      <h3 className="font-display text-2xl font-extrabold text-ink">Answer Locked!</h3>
      <p className="mt-2 text-base text-ink-muted">Waiting for the reveal...</p>
    </Card>
  </motion.div>
)}
```

- [ ] **Step 5: Update the outer screen-shell wrapper**

The outermost `<div className="screen-shell py-8 text-white">` (around line 237) hardcodes white text on the legacy dark shell. Replace with the new token surface:

```tsx
// OLD
<div className="screen-shell py-8 text-white">
  <div className="screen-frame max-w-5xl">

// NEW
<div className="min-h-screen bg-bg-base py-8 text-ink">
  <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
```

(Keep the inner JSX untouched.)

- [ ] **Step 6: Verify the build**

```bash
cd packages/client
npm run build
```

Expected: build succeeds. If `Input` errors on `error={undefined}`, change to `{error ? <Input … error={error} /> : <Input … />}` or omit the prop conditionally — adapt to whatever signature `packages/client/src/ui/Input.tsx` exports.

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/screens/Pointless.tsx
git commit -m "feat(client/pointless): migrate playing/submitted phases to new primitives"
```

---

### Task 6: Migrate the Pointless "reveal" card (player)

**Files:**
- Modify: `packages/client/src/screens/Pointless.tsx`

The reveal phase wraps `<ScoreDrop />` (swapped in Task 2) in a `card` with an eyebrow, then animates in a details panel after `onLanded` fires (original input, correct answer, score chip, current standing + running total). Reskin the wrapper and the details panel.

- [ ] **Step 1: Replace the reveal block**

Find the `{phase === 'reveal' && revealData && ( … )}` block (around line 357) and replace its body:

```tsx
{phase === 'reveal' && revealData && (
  <motion.div
    key="reveal"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="mx-auto w-full max-w-3xl"
  >
    <Card eyebrow="Score Reveal">
      <div className="flex justify-center py-2 sm:py-4">
        <ScoreDrop
          key={revealData.triggerTime}
          targetScore={revealData.score}
          autoStart
          onLanded={() => setRevealDetailsVisible(true)}
        />
      </div>

      <AnimatePresence>
        {revealDetailsVisible && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
            className="mt-6 rounded-2xl border-2 border-ink bg-bg-sunken p-5 shadow-ink"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-ink-muted">
                  {revealData.isCorrect ? 'Official Match' : 'Submitted Answer'}
                </p>
                <h3 className="mt-2 font-display text-2xl font-extrabold text-ink sm:text-3xl">
                  {revealData.correctAnswer || revealData.originalInput}
                </h3>
                {revealData.originalInput.toLowerCase() !== revealData.correctAnswer?.toLowerCase() && revealData.isCorrect && (
                  <p className="mt-2 text-sm text-ink-muted">
                    Corrected from "{revealData.originalInput}"
                  </p>
                )}
                {!revealData.isCorrect && revealData.originalInput && (
                  <p className="mt-2 text-sm text-ink-muted">
                    Submitted as "{revealData.originalInput}"
                  </p>
                )}
              </div>

              <Chip variant={revealData.isCorrect ? 'default' : 'streak'}>
                <span className="font-display text-lg font-extrabold">
                  {revealData.score}
                </span>
                <span className="ml-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em]">
                  pts
                </span>
              </Chip>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border-2 border-ink bg-bg-surface p-4 shadow-ink-sm">
                <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-ink-muted">
                  Current Standing
                </p>
                <p className="mt-2 font-display text-2xl font-extrabold text-ink">
                  {myCurrentPlacement ? `#${myCurrentPlacement}` : '-'}
                </p>
              </div>
              <div className="rounded-xl border-2 border-ink bg-bg-surface p-4 shadow-ink-sm">
                <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-ink-muted">
                  Running Total
                </p>
                <p className="mt-2 font-display text-2xl font-extrabold text-ink">
                  {myCurrentScore}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  </motion.div>
)}
```

Notes:
- The score chip swaps tone: `default` (neutral) for correct answers (good outcome), `streak` (terracotta) for incorrect (heritage warm hero moment for a high-score). The "danger red for incorrect" choice from the old UI is intentionally replaced — terracotta reads as "ouch, that was a common answer" without screaming `--danger`.
- The two small "Current Standing" / "Running Total" tiles use `shadow-ink-sm` (2px hard shadow) so they nest inside the larger card without competing.

- [ ] **Step 2: Verify the build**

```bash
cd packages/client
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/screens/Pointless.tsx
git commit -m "feat(client/pointless): migrate reveal card to new primitives"
```

---

### Task 7: Migrate the host Display's Pointless round-prompt branch

**Files:**
- Modify: `packages/host/src/screens/Display.tsx`

The host's `pointlessRound` branch shows the question while players are answering. Reskin with `Card` + `Chip`. Touch nothing else in `Display.tsx`.

- [ ] **Step 1: Extend the host primitives import**

At the top of `Display.tsx`, add (or extend if a `from '../ui'` import already exists):

```tsx
import { Card, Chip } from '../ui';
```

(If `ScoreDrop` is later wired up — see "Specifics" — add it to this import.)

- [ ] **Step 2: Replace the `pointlessRound` branch**

Find the `if (currentGame === 'pointless' && pointlessRound) { … }` block (around line 1144) and replace its return JSX:

```tsx
if (currentGame === 'pointless' && pointlessRound) {
  return (
    <>
      <div className="min-h-screen overflow-y-auto bg-bg-base py-8 text-ink">
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="mx-auto w-full max-w-6xl px-4 text-center sm:px-6"
        >
          <div className="mb-6 flex flex-wrap justify-center gap-2">
            <Chip variant="info">
              Round {pointlessRound.roundIndex + 1} of {pointlessRound.totalRounds}
            </Chip>
            <Chip variant="default">{pointlessRound.category}</Chip>
          </div>

          <Card eyebrow="Pointless" className="text-center">
            <h2 className="font-display text-3xl font-extrabold text-ink sm:text-5xl">
              {pointlessRound.question}
            </h2>
          </Card>

          <p className="mt-6 text-lg font-semibold uppercase tracking-[0.18em] text-ink-muted sm:text-xl">
            Players have {Math.ceil((pointlessRound.duration || 30000) / 1000)} seconds · Lowest valid answer wins
          </p>
        </motion.div>
      </div>
      {displayControl}
    </>
  );
}
```

- [ ] **Step 3: Verify the host build**

```bash
cd packages/host
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/host/src/screens/Display.tsx
git commit -m "feat(host/pointless): migrate round-prompt branch to new primitives"
```

---

### Task 8: Migrate the host Display's Pointless reveal branch

**Files:**
- Modify: `packages/host/src/screens/Display.tsx`

The host reveal branch (`pointlessReveal`) shows two columns: "Top 3 Most Obscure" (lowest scores) and "Top 3 Most Frequent" (highest scores). The server's `pointless:reveal:display` event carries `obscureAnswers` and `frequentAnswers` arrays — **not** per-player scores — so this branch is reskinned as primitive-based cards rather than a sequence of per-player `ScoreDrop` columns. See the "Specifics" section for why.

- [ ] **Step 1: Replace the `pointlessReveal` branch**

Find the `if (currentGame === 'pointless' && pointlessReveal) { … }` block (around line 1176) and replace its return JSX:

```tsx
if (currentGame === 'pointless' && pointlessReveal) {
  return (
    <>
      <div className="min-h-screen bg-bg-base py-8 text-ink">
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="mx-auto w-full max-w-6xl px-4 sm:px-6"
        >
          <Card eyebrow="Pointless Reveal">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="font-display text-4xl font-extrabold text-ink sm:text-6xl">
                  {pointlessReveal.category}
                </h1>
                <p className="mt-3 max-w-4xl text-xl text-ink-muted sm:text-2xl">
                  {pointlessReveal.question}
                </p>
              </div>
              <Chip variant="info">
                Round {pointlessReveal.roundIndex + 1} of {pointlessReveal.totalRounds}
              </Chip>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <div className="rounded-2xl border-2 border-ink bg-bg-sunken p-6 shadow-ink">
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-ink-muted">
                      Most Obscure
                    </p>
                    <h2 className="mt-2 font-display text-2xl font-extrabold text-ink sm:text-3xl">
                      Top 3 Lowest Answers
                    </h2>
                  </div>
                  <Chip variant="default">Lower is better</Chip>
                </div>
                <div className="space-y-3">
                  {pointlessReveal.obscureAnswers.map((answer, index) => (
                    <div
                      key={`${answer.answer}-${answer.score}-obscure`}
                      className="grid grid-cols-[3rem_minmax(0,1fr)_5rem] items-center gap-4 rounded-xl border-2 border-ink bg-bg-surface px-4 py-3 shadow-ink-sm"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink bg-action font-display text-lg font-extrabold text-white shadow-ink-sm">
                        {index + 1}
                      </div>
                      <p className="truncate font-display text-xl font-extrabold text-ink">
                        {answer.answer}
                      </p>
                      <p className="text-right font-display text-2xl font-extrabold text-action">
                        {answer.score}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border-2 border-ink bg-bg-sunken p-6 shadow-ink">
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-ink-muted">
                      Most Frequent
                    </p>
                    <h2 className="mt-2 font-display text-2xl font-extrabold text-ink sm:text-3xl">
                      Top 3 Highest Answers
                    </h2>
                  </div>
                  <Chip variant="streak">Higher is common</Chip>
                </div>
                <div className="space-y-3">
                  {pointlessReveal.frequentAnswers.map((answer, index) => (
                    <div
                      key={`${answer.answer}-${answer.score}-frequent`}
                      className="grid grid-cols-[3rem_minmax(0,1fr)_5rem] items-center gap-4 rounded-xl border-2 border-ink bg-bg-surface px-4 py-3 shadow-ink-sm"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink bg-streak font-display text-lg font-extrabold text-white shadow-ink-sm">
                        {index + 1}
                      </div>
                      <p className="truncate font-display text-xl font-extrabold text-ink">
                        {answer.answer}
                      </p>
                      <p className="text-right font-display text-2xl font-extrabold text-streak">
                        {answer.score}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
      {displayControl}
    </>
  );
}
```

Notes:
- Left column uses `--action` (grass) accents because low scores are the "win" in Pointless.
- Right column uses `--streak` (terracotta heritage) for high-score answers — heritage warm tones are reserved for hero/celebration moments per spec §2.1, and "the most common wrong-direction answer" is a heritage-callout moment.
- **No `ScoreDrop` here.** The server event doesn't deliver per-player target scores; it delivers aggregate top-3 answer lists. If a future plan adds a per-player reveal event, the natural place to consume it with `<ScoreDrop>` is between this branch and the `roundLeaderboard` branch (a new `pointlessPlayerReveal` state, set on a hypothetical `pointless:player:reveal` event, mapping over `players` and rendering one `ScoreDrop` per player with `autoStart={false}` and `onLanded` chained to advance to the next). Flagged for follow-up.

- [ ] **Step 2: Verify the host build**

```bash
cd packages/host
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/host/src/screens/Display.tsx
git commit -m "feat(host/pointless): migrate reveal branch (top-3 obscure/frequent) to new primitives"
```

---

### Task 9: Re-skin the "Reveal Pointless Results" host-control button

**Files:**
- Modify: `packages/host/src/screens/Display.tsx`

The floating `displayControl` button (around line 404) currently uses legacy `bg-primary-teal`. Swap to the new `Button` primitive.

- [ ] **Step 1: Add `Button` to the host primitives import**

```tsx
import { Button, Card, Chip } from '../ui';
```

- [ ] **Step 2: Replace the `displayControl` JSX**

Find:

```tsx
const displayControl = authenticated && pointlessReadyToReveal ? (
  <div className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
    <button
      onClick={revealResults}
      className="rounded-full bg-primary-teal px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_30px_rgba(0,0,0,0.28)] transition-transform hover:bg-primary-teal/90 active:scale-95 sm:text-base"
    >
      Reveal Pointless Results
    </button>
  </div>
) : null;
```

Replace with:

```tsx
const displayControl = authenticated && pointlessReadyToReveal ? (
  <div className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
    <Button variant="action" size="lg" onClick={revealResults}>
      Reveal Pointless Results
    </Button>
  </div>
) : null;
```

This is the only legacy `primary-teal` reference inside any Pointless-touched code path; all other `primary-teal` usages in `Display.tsx` live in other-game branches (Quiz, TrueFalse, leaderboard) and are out of scope.

- [ ] **Step 3: Verify the host build**

```bash
cd packages/host
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/host/src/screens/Display.tsx
git commit -m "feat(host/pointless): re-skin reveal-results control with Button primitive"
```

---

### Task 10: End-to-end Pointless playthrough verification

**Files:** none modified

Boots all three packages and walks a full Pointless round to confirm the migration didn't break the phase machine or the score animation.

- [ ] **Step 1: Build all three packages**

```bash
cd packages/server && npm run build && cd ../client && npm run build && cd ../host && npm run build && cd ../..
```

Expected: all three succeed.

- [ ] **Step 2: Boot dev servers in three terminals**

Terminal A:
```bash
cd packages/server && npm run dev
```

Terminal B:
```bash
cd packages/client && npm run dev
```

Terminal C:
```bash
cd packages/host && npm run dev
```

- [ ] **Step 3: Walk a playthrough**

1. Open the host display (http://localhost:5174). Authenticate.
2. Open 2 player tabs (http://localhost:5173). Join the room.
3. From the host dashboard, start a Pointless game.
4. **Verify the player intro:** Fraunces title, terracotta colour, action-green progress bar, "Starting in Xs" copy. Card has 2px ink border and hard shadow.
5. **Verify the player playing phase:**
   - Sticky status bar at top with terracotta "Pointless" eyebrow, ink-muted round meta, three chips (pts / placement / time).
   - Action-green progress bar under the chip strip ticks down smoothly.
   - Input has 2px ink border, sunken background, cobalt focus ring.
   - Submit button is grass-green with hard ink shadow; pressing it lifts/squishes.
6. Submit answers on both player tabs. **Verify the submitted card** appears with the green "OK" badge and "Answer Locked!" heading.
7. **Verify the player reveal:**
   - `ScoreDrop` bar appears centred in the card; the panel drops smoothly from 100 → score over the expected timing (4s base + 90ms/pt).
   - For `score === 0`: the "POINTLESS" callout fires.
   - After landing (1800ms / 2800ms at zero), the details panel slides up showing answer, score chip, current standing, running total.
8. **Verify the host display during play:** "Pointless" eyebrow, round/category chips, big chunky question card, "Players have Ns" footer.
9. After the round timer expires, click "Reveal Pointless Results" (the new green `Button`). **Verify the host reveal:** two stacked panels — left (Most Obscure, grass accents), right (Most Frequent, terracotta accents). Numbered rank badges have hard shadows. Round chip in the header.
10. Toggle the theme on each surface (player and host independently) — colours should flip without layout jank, `ScoreDrop` gradient stays the same (it's the score-meter colour scheme, not theme-driven).
11. **Reduced motion:** in DevTools → Rendering → Emulate CSS prefers-reduced-motion: reduce, replay the reveal. `ScoreDrop` is built to honour this (foundation Task 18); confirm the panel still renders the final score even if the drop animation crossfades.

- [ ] **Step 4: Smoke check — no console errors**

Player console: no errors or warnings during the playthrough. Host console: same.

- [ ] **Step 5: If any verification fails**

Open the matching task's file and re-check the diff. The most likely failure modes:
- Missing primitive import → "X is not defined"
- Stale `card`/`eyebrow` class reference → silently ugly but builds
- `Input` prop name mismatch (`error` vs `errorText`) → fix per local primitive signature

Re-run `npm run build` for the package and re-verify. **No commit on this task** — it's verification only.

---

## Done criteria

- [ ] `packages/client/src/screens/Pointless/ColumnReveal.tsx` is deleted
- [ ] `packages/client/src/screens/Pointless.tsx` imports `ScoreDrop` (and other primitives) from `../ui`, contains no `ColumnReveal` references, contains no `screen-shell`/`screen-frame`/`card`/`eyebrow`/`status-pill`/`section-label` legacy class references, and no `bg-primary-teal`/`text-primary-teal` references
- [ ] `packages/host/src/screens/Display.tsx` — only the `pointlessRound`, `pointlessReveal`, and `displayControl` regions touched; Quiz/TF/Countdown/Numbers/Wordle/Travel/Lobby/Leaderboard branches byte-identical to before
- [ ] `npm run build` succeeds in `packages/server`, `packages/client`, and `packages/host`
- [ ] `npm run dev` boots cleanly for all three packages
- [ ] A full Pointless playthrough completes: intro → 3+ rounds with mixed correct/incorrect/zero answers → host reveals top-3 panels → round leaderboard appears
- [ ] Player `ScoreDrop` animates with the spec timing (4000ms + 90ms/pt, ease-out cubic) and fires the "POINTLESS" callout on score 0
- [ ] Theme toggle works on both surfaces (player and host independently persist)
- [ ] `prefers-reduced-motion` does not break the reveal (final state is reachable)
- [ ] No console errors during the playthrough

## Out of scope (deferred to later phases / follow-up tickets)

- **Per-player synchronized host reveal** (spec §7.3): the current `pointless:reveal:display` server event ships aggregate top-3 lists, not per-player target scores. A future server change can introduce `pointless:player:reveal` carrying `{ playerId, score, triggerTime }`; the host would then render a sequence of `<ScoreDrop autoStart={false} />` columns, advancing via `onLanded`. Flagged in Task 8 notes.
- The shared `renderIntroView()` (used by Quiz/TF/Pointless intros) — migrating it requires touching Quiz and TF, which are Phase 5 territory
- `GamePromptHeader` — shared with other games, not Pointless-only
- `roundLeaderboard` rendering — Phase 4
- Removing the legacy `primary-teal`, `screen-shell`, `card`, `eyebrow` tokens/classes from Tailwind config and `index.css` — Phase 11 (final cleanup pass) once all games are migrated
- Audio / haptics — Pointless's `navigator.vibrate(…)` call in the old `ColumnReveal` is dropped; if haptic feedback is wanted on a 0 score, add it as a follow-up

## Specifics flagged (for reviewers)

1. **ColumnReveal replacement chosen: option (a) — full replacement.** Reasoning: `ScoreDrop` already implements the §3.9 spec contract (panel drop, gradient track, 100→target, "POINTLESS" callout, landing pause, `onLanded`). The legacy `ColumnReveal` had a custom shake animation for incorrect answers ("XXX" overlay + horizontal shake). The new design language treats incorrect-on-Pointless as "your bar stayed at 100, terracotta chip" — a cleaner, less punitive read. If product wants the shake back, it can be added to `ScoreDrop` as a `variant="incorrect"` follow-up — no need to wrap.

2. **Host per-player `ScoreDrop` reveal is deferred.** Spec §7.3 describes "players are revealed one at a time (player A, then B, etc.), each getting their own `ScoreDrop`". The current server's `pointless:reveal:display` event carries `obscureAnswers` and `frequentAnswers` aggregate arrays — **no per-player score breakdown**. Implementing the spec's sequential per-player reveal requires a server-side change (new event payload), which is explicitly out of scope ("server-side Pointless data is OUT of scope"). Task 8 reskins the existing aggregate reveal; the per-player sequence is a follow-up once the server emits the necessary data. The natural shape of that follow-up: a new `pointlessPlayerReveal` state, sequential rendering with `<ScoreDrop autoStart={false} />` columns advancing via `onLanded`, and an "X of Y" player-tracker chip (per spec §7.3 host-screen skeleton).

3. **`ScoreDrop` size is not modified.** Spec hint considered ("might need to be smaller/inline for host TV view"). For the current host reveal (aggregate top-3 panels, no per-player columns), no `ScoreDrop` is rendered, so no sizing question arises. When the per-player reveal lands as follow-up, the primitive's 96×240 dimensions read at TV distance because there's only one bar on screen at a time. If a future design requires N bars side-by-side, that's the point to add a `size="sm" | "md"` prop — not now.

4. **Reduced motion handling lives in the primitive.** `ScoreDrop` (foundation Task 18) is expected to honour `prefers-reduced-motion` internally per spec §4.5 (transform animation swapped for a 180ms crossfade to the final score). This plan does not add a second layer of reduced-motion logic in the Pointless screens — the wrapper motion blocks already use modest `opacity`/`y` transforms which the foundation's global motion utilities should down-rate.

5. **`getOrdinalSuffix` and the placement-tracking effect are preserved verbatim.** They live entirely inside `Pointless.tsx` and are pure logic over the `players` store. The migration only touches the JSX.

6. **No changes to `request:state` emission, socket event names, or the phase state machine.** Server contract is untouched; only the rendering layer changes.
