# PHoG UI Redesign — Automated QA Report

**Date:** 2026-05-13  
**Branch:** `claude/eager-villani-da47cb`  
**Snapshot time:** Post-10-min parallel-agent window  

---

## Summary

| Check | Result |
|---|---|
| Client build | PASS |
| Host build | FAIL |
| Client tests | PASS |
| Server game tests (5×) | PASS |
| Client TypeScript type-check | PASS |
| Host TypeScript type-check | FAIL |
| Legacy class scan (component classes) | PASS (0 found) |
| Legacy Tailwind color token scan | PASS (0 found) |
| Bundle size check | PASS (recorded) |
| Reduced-motion guard scan | PASS (21 usages) |
| Git tree state | PARTIAL (4 unstaged modified files) |
| Server smoke test | SKIPPED (node_modules not installed) |

**Overall verdict: 9 PASS, 2 FAIL, 1 SKIPPED**

Blockers preventing a clean green-light:
1. **Host build fails** — 5 unused-variable TS errors in `packages/host/src/screens/Display.tsx` and `WordleDisplay.tsx`
2. **Host TypeScript type-check fails** — same 4 unused-variable errors in `Display.tsx` (the `WordleDisplay.tsx` error from the build does not reproduce in `--noEmit` alone)

---

## Check Details

### 1. Client Build — PASS

```
> phog-client@1.0.0 build
> tsc && vite build

✓ 825 modules transformed.
dist/assets/index-C6lBEqzd.js   635.14 kB │ gzip: 206.23 kB
✓ built in 2.85s
```

Exit code: 0. Pre-existing chunk-size warning (>500 kB) noted; not a blocker.

---

### 2. Host Build — FAIL

```
src/screens/Display.tsx(1,31): error TS6133: 'useCallback' is declared but its value is never read.
src/screens/Display.tsx(4,30): error TS6133: 'ScoreDrop' is declared but its value is never read.
src/screens/Display.tsx(162,10): error TS6133: 'pointlessPlayerReveals' is declared but its value is never read.
src/screens/Display.tsx(163,10): error TS6133: 'pointlessRevealIndex' is declared but its value is never read.
src/screens/WordleDisplay.tsx(25,10): error TS6133: 'pendingTarget' is declared but its value is never read.
```

Exit code: 2. All errors are `noUnusedLocals` violations — likely leftover variables from in-progress refactor work by parallel agents.

---

### 3. Client Tests — PASS

```
✓ src/lib/theme.test.tsx (7 tests) 206ms
Test Files  1 passed (1)
Tests       7 passed (7)
Duration    1.79s
```

Exit code: 0. Non-fatal `act(...)` warnings in theme tests are pre-existing.

---

### 4. Server-Side Game Tests — PASS (all 5)

| Test file | Result |
|---|---|
| `tests/numbers/expression.test.mjs` | PASS — exit 0 |
| `tests/numbers/solver.test.mjs` | PASS — exit 0 |
| `tests/numbers/tiles.test.mjs` | PASS — exit 0 |
| `tests/travel/graph.test.mjs` | PASS — exit 0 |
| `tests/wordle/coloring.test.mjs` | PASS — exit 0 |

---

### 5. TypeScript Type-Check — Client PASS / Host FAIL

**Client (`packages/client`):**
```
(no output)
```
Exit code: 0. Zero errors.

**Host (`packages/host`):**
```
src/screens/Display.tsx(1,31): error TS6133: 'useCallback' is declared but its value is never read.
src/screens/Display.tsx(4,30): error TS6133: 'ScoreDrop' is declared but its value is never read.
src/screens/Display.tsx(162,10): error TS6133: 'pointlessPlayerReveals' is declared but its value is never read.
src/screens/Display.tsx(163,10): error TS6133: 'pointlessRevealIndex' is declared but its value is never read.
```
Exit code: 2. Four unused-variable errors.

Note: `WordleDisplay.tsx(25,10)` appeared only during the full build (tsc pre-vite), not in `--noEmit` alone — likely a quirk of `tsc` project reference resolution with composite builds.

---

### 6. Legacy Class Scan — PASS

**Component class names** (`screen-shell`, `btn-primary`, `btn-secondary`, `btn-answer`, `input-field`, `status-pill`, `section-label`):  
- `packages/client/src`: **0 matches**  
- `packages/host/src`: **0 matches**

**Legacy Tailwind color tokens** (`bg-primary-*`, `text-game-*`, `bg-ui-*`, etc.):  
- `packages/client/src`: **0 matches**  
- `packages/host/src`: **0 matches**

All legacy class cleanup is complete.

---

### 7. Bundle Size Check — PASS (recorded)

| Package | Main bundle (raw) | Lazy chunk |
|---|---|---|
| client | 635,343 bytes (635 kB) | 4,054 bytes (UiShowcase) |
| host | 619,442 bytes (619 kB) | 5,816 bytes (UiShowcase) |

CSS: `index.css` 27.39 kB (client), host similar. The UiShowcase route is correctly lazy-loaded per commit `88a70c0`. Chunk-size warning is pre-existing and expected.

---

### 8. Reduced-Motion Guard Scan — PASS

Total usages across `packages/client/src` + `packages/host/src`: **21**

Selected locations:
- `client/src/lib/motion.ts` — `prefersReducedMotion()` utility
- `client/src/ui/Tile.tsx`, `LeaderboardRow.tsx`, `ScoreDrop.tsx`, `AnswerFeedback.tsx`, `Countdown.tsx`
- `client/src/components/RoundLeaderboardOverlay.tsx`, `PausedOverlay.tsx`, `Confetti.tsx`
- `client/src/screens/Travel.tsx`, `Countdown.tsx`, `FinalLeaderboard.tsx`
- `client/src/components/themed-dle/Grid3x3.tsx`, `SpellHint.tsx`, `EmojiClue.tsx`, `ModeIntro.tsx`, `Silhouette.tsx`
- `host/src/lib/motion.ts` — `prefersReducedMotion()` utility
- `host/src/ui/LeaderboardRow.tsx`, `AnswerFeedback.tsx`

Exceeds the 5-usage threshold. Foundation and all major animated primitives covered.

---

### 9. Git Tree State — PARTIAL

```
On branch claude/eager-villani-da47cb
Changes not staged for commit:
  modified:   packages/client/src/ui/tokens.css
  modified:   packages/host/src/ui/tokens.css
  modified:   packages/server/src/games/numbers.js
  modified:   packages/server/src/games/pointless.js
```

4 files are modified but unstaged — likely work-in-progress from parallel WCAG/server-gaps agents. Not alarming in the parallel-agent context, but the tree is not fully clean.

**Commit count since base (`15b3b10`):** 115 commits  
**Files changed:** 126 files changed, 20,079 insertions(+), 3,421 deletions(-)

---

### 10. Server Smoke Test — SKIPPED

`packages/server/node_modules` is not present in this worktree. The server fails to start with `ERR_MODULE_NOT_FOUND: Cannot find package 'socket.io'`. This is a worktree setup issue (dependencies not installed), not a code defect.

---

## Blocker Detail

### BLOCKER 1 & 2 — Host TS errors in `Display.tsx` / `WordleDisplay.tsx`

File: `packages/host/src/screens/Display.tsx`  
- Line 1: `useCallback` imported but unused  
- Line 4: `ScoreDrop` imported but unused  
- Line 162: `pointlessPlayerReveals` declared but unused  
- Line 163: `pointlessRevealIndex` declared but unused  

File: `packages/host/src/screens/WordleDisplay.tsx`  
- Line 25: `pendingTarget` declared but unused  

These are likely stale variables left over from the Pointless/Wordle host refactor. Fix: remove the unused imports/variables. The client package has no such issues.

---

## Stats

- **Total commits on branch:** 115
- **Files touched:** 126 files, +20,079 / -3,421 lines
- **Legacy classes remaining:** 0
- **Legacy color tokens remaining:** 0
- **Reduced-motion usages:** 21
