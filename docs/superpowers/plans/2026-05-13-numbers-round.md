# Numbers Round Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Countdown Numbers Round to PHoG as a new multiplayer mini-game. Each game session runs 5 rounds; in each round, players have 45 seconds to combine 6 drawn tiles using `+ − × ÷` to reach a random 3-digit target. Cumulative score across rounds determines the player's placement in the championship.

**Architecture:** Pure-logic game — no curated content. Server generates tiles + target, verifies the puzzle is exact-solvable via a brute-force solver, accepts free-form expressions from players, validates them (tile usage, no-negatives, no-fractions, exact integer arithmetic), scores per-tier, then reveals the optimal solution. Reuses the existing PHoG round shape (intro → playing → results × N → leaderboard).

**Tech Stack:** Node.js (server), React + TypeScript + Vite + Zustand + Framer Motion + Tailwind (client and host), Socket.IO.

**Reference spec (locked design):** [docs/new-games-research.md](../../new-games-research.md), the "Numbers Round" subsection of "Locked design decisions" plus the original Game 2 research.

**Reference modules to mimic:**
- `packages/server/src/games/countdown.js` — multi-round game shape (intro → round × N → reveal → end), Timer usage
- `packages/server/src/games/themedDle.js` — recent multi-phase pattern
- `packages/server/src/games/quiz.js` — answer-collection pattern

**Conventions:**
- Worktree: `C:/FutureCode/PHoG/.claude/worktrees/elegant-hermann-2af09b`. Branch: `claude/elegant-hermann-2af09b`. All paths relative to that root.
- Game key in code: `numbers` (avoids collision with existing `countdown` letters game).
- Game display name: **"Numbers Round"** (host display, dashboard buttons, leaderboard labels).
- Tailwind utility classes used throughout (`screen-shell`, `screen-frame`, `eyebrow`, `status-pill`, `card`, `text-game-leader`, `text-game-correct`, `text-game-incorrect`, `text-ui-textMuted`, `bg-game-accent`, `bg-game-leader`) are already defined in `tailwind.config.js` and `index.css`. Do not redefine.
- Commit style: short imperative title (e.g. `"Add Numbers Round game module"`). No Conventional-Commits prefix. No Co-Authored-By.
- TypeScript: `npm run build` in `packages/client` and `packages/host` must pass at end of every phase.
- No client/host test framework — verify by smoke-test. Pure-function utilities on the server may get small Node assert tests if helpful (the solver in particular).

---

## Game rules (canonical)

These rules govern server validation logic. They are the source of truth — implementation must match these exactly.

**Tile draw:**
- 6 tiles per round.
- Pool: 4 *large* numbers `25, 50, 75, 100` (one each) and 20 *small* numbers (each of 1–10 appearing twice).
- Number of large picks per round: random 0–4. Remaining slots filled from small pool. Small pool is sampled without replacement *within a round* (so two 7s could appear; two more 7s could not).

**Target:** random integer in `[100, 999]`.

**Solvability:** server runs a brute-force solver on every generated puzzle. If no expression hits the target *exactly*, regenerate (cap at 100 attempts before falling back to "closest achievable" target).

**Player expression rules:**
- Operators: `+ − × ÷` (the client sends ASCII `+ - * /`).
- Literals: integers matching tiles drawn.
- Parentheses allowed.
- Each tile used at most once (multiset rule — two 7s on the board can be used twice).
- Every intermediate result must be a non-negative integer (no fractions at any step, no negative subtraction results).
- Final value must equal the player's claimed result (server re-evaluates; if claim mismatches, expression is invalid).

**Scoring (per round):**
- **Exact** target hit: **50 points**.
- **Within 5** (off by 1–5): **30 points**.
- **Within 10** (off by 6–10): **15 points**.
- **More than 10 away, invalid, no submission, or timeout:** **0 points**.
- **First-correct bonus** (first player in the round to submit an exact-target expression): **+10 points**.

**Game shape:**
- 1 session = 5 rounds.
- Each round: 8s intro splash → 45s playing → 8s results reveal (with optimal solution).
- Cumulative score across 5 rounds → one final leaderboard for the game → one placement in the championship.

---

## File Structure

**Server — to create:**

| Path | Responsibility |
|---|---|
| `packages/server/src/games/numbers.js` | `NumbersGame` class — round lifecycle, broadcasts, score accumulation |
| `packages/server/src/games/numbers/tiles.js` | Tile-pool generator (deterministic given a seed for testability) |
| `packages/server/src/games/numbers/expression.js` | Tokenizer + recursive-descent parser + safe evaluator with intermediate-step constraint checking |
| `packages/server/src/games/numbers/solver.js` | Brute-force "is this target exact-solvable" + "what's the optimal expression" — DP over tile subsets |
| `tests/numbers/solver.test.mjs` | Node `assert`-based smoke tests for solver + expression parser |

**Server — to modify:**

| Path | Change |
|---|---|
| `packages/server/src/gameEngine.js` | Add `'numbers'` to `validGames` set; add `numbers: null` to `reset()` placements struct |
| `packages/server/src/utils/scoring.js` | Add `numbers: null` to the placements default object and the `completedPlacements` aggregation list |
| `packages/server/src/index.js` | Import `NumbersGame`; add `else if (gameName === 'numbers')` branch in `startSpecificGame`; add `numbers: null` to new-Player `placements`; add `socket.on('numbers:submit', ...)` handler |

**Client — to create:**

| Path | Responsibility |
|---|---|
| `packages/client/src/screens/Numbers.tsx` | Outer shell — socket events, intro/playing/results phase dispatch |
| `packages/client/src/components/numbers/TilePool.tsx` | Render the 6 tiles + click-to-insert into expression |
| `packages/client/src/components/numbers/TargetDisplay.tsx` | Big target number readout |
| `packages/client/src/components/numbers/ExpressionInput.tsx` | The on-screen build pad: tile buttons + operator buttons + `( ) ⌫ Clear Submit`, plus live expression display |
| `packages/client/src/components/numbers/RoundResults.tsx` | Per-round reveal — your result, target, distance, optimal solution |

**Client — to modify:**

| Path | Change |
|---|---|
| `packages/client/src/App.tsx` | Add `case 'numbers'` returning `<Numbers socket={socket} />` |
| `packages/client/src/stores/gameStore.ts` | Add `'numbers'` to `currentGame` union, `Player.placements`/`gamePlacements`, `RoundLeaderboardState.game` |
| `packages/client/src/components/RoundLeaderboardOverlay.tsx` | Add `numbers: 'Numbers'` to `GAME_LABELS` |
| `packages/client/src/screens/FinalLeaderboard.tsx` | Add `'numbers'` to local `GameKey` + `GAME_LABELS`; add Numbers tile to `placementSummary` |

**Host — to create:**

| Path | Responsibility |
|---|---|
| `packages/host/src/screens/NumbersDisplay.tsx` | Big-screen view — tile/target reveal, live timer, per-player submission status, optimal solution on reveal |
| `packages/host/src/components/numbers/HostTilePool.tsx` | Massive tile grid for the room display |
| `packages/host/src/components/numbers/HostTarget.tsx` | Target callout (huge) |
| `packages/host/src/components/numbers/NumbersProgressPanel.tsx` | Sidebar of player names + their current claimed result (or "thinking…") |

**Host — to modify:**

| Path | Change |
|---|---|
| `packages/host/src/screens/Display.tsx` | Add `GameKey` widening for `'numbers'`; add label maps; add a `currentGame === 'numbers' && phase === 'playing'` branch routing to `<NumbersDisplay>`; add `numbers` column to championship standings table |
| `packages/host/src/screens/Dashboard.tsx` | Add `numbers` to `GameKey`, `Player.gamePlacements`, `GAME_LABELS`, `availableGames`; add "Start Numbers Round" button; add `numbers` to championship-standings render array |

---

## Phase 0 — Type widening across server, client, host

After this phase, the codebase compiles with the new `numbers` game key but no UI yet. Same pattern as the themed-dle Phase 0.

### Task 0.1: Server-side keys

**Files:**
- Modify: `packages/server/src/utils/scoring.js` (placements default + aggregation list)
- Modify: `packages/server/src/gameEngine.js` (`validGames` + `reset()` placements struct)
- Modify: `packages/server/src/index.js` (new-Player init `placements`)

- [ ] **Step 1: scoring.js — placements default**

Find the block at ~line 264-273:
```js
if (!player.placements) {
  player.placements = {
      quiz: null,
      trueFalse: null,
      countdown: null,
      pointless: null,
      pokedle: null,
      hpdle: null
  };
}
```

Replace with:
```js
if (!player.placements) {
  player.placements = {
      quiz: null,
      trueFalse: null,
      countdown: null,
      pointless: null,
      pokedle: null,
      hpdle: null,
      numbers: null
  };
}
```

- [ ] **Step 2: scoring.js — completedPlacements aggregation**

Find the block at ~line 279-286:
```js
const completedPlacements = [
  player.placements.quiz,
  player.placements.trueFalse,
  player.placements.countdown,
  player.placements.pointless,
  player.placements.pokedle,
  player.placements.hpdle
].filter(p => p !== null && p !== undefined);
```

Replace with:
```js
const completedPlacements = [
  player.placements.quiz,
  player.placements.trueFalse,
  player.placements.countdown,
  player.placements.pointless,
  player.placements.pokedle,
  player.placements.hpdle,
  player.placements.numbers
].filter(p => p !== null && p !== undefined);
```

- [ ] **Step 3: gameEngine.js — validGames**

Find:
```js
const validGames = ['quiz', 'trueFalse', 'countdown', 'pointless'];
```

This may appear twice (in `startGame` arg validation). Replace BOTH occurrences with:
```js
const validGames = ['quiz', 'trueFalse', 'countdown', 'pointless', 'pokedle', 'hpdle', 'numbers'];
```

- [ ] **Step 4: gameEngine.js — reset() state clearing**

Find the `reset()` method's per-player placement reset (around line 412). Make sure `numbers: null` is added alongside the existing keys. The shape should match the scoring.js default exactly.

Find:
```js
player.placements = {
  quiz: null,
  trueFalse: null,
  countdown: null,
  pointless: null
};
```

Replace with:
```js
player.placements = {
  quiz: null,
  trueFalse: null,
  countdown: null,
  pointless: null,
  pokedle: null,
  hpdle: null,
  numbers: null
};
```

Also check for `this.gameState.numbers = null;` near the bottom of `reset()` (after `this.gameState.pointless = null;`). Add it.

- [ ] **Step 5: index.js — Player initial placements**

Find the player-create block at ~line 215-230:
```js
placements: {
  quiz: null,
  trueFalse: null,
  countdown: null,
  pointless: null,
  pokedle: null,
  hpdle: null
},
```

Replace with:
```js
placements: {
  quiz: null,
  trueFalse: null,
  countdown: null,
  pointless: null,
  pokedle: null,
  hpdle: null,
  numbers: null
},
```

- [ ] **Step 6: Server boot probe**

```bash
cd C:/FutureCode/PHoG/.claude/worktrees/elegant-hermann-2af09b/packages/server
timeout 4 node src/index.js 2>&1 | head -15
```

Expected: server prints the `🎮 PHoG Server Running` banner. Any syntax error → fix and re-probe.

---

### Task 0.2: Client `gameStore` types

**Files:**
- Modify: `packages/client/src/stores/gameStore.ts`

- [ ] **Step 1: Widen `RoundLeaderboardState.game`**

Find:
```ts
game: 'quiz' | 'trueFalse' | 'countdown' | 'pointless' | 'pokedle' | 'hpdle';
```

Replace with:
```ts
game: 'quiz' | 'trueFalse' | 'countdown' | 'pointless' | 'pokedle' | 'hpdle' | 'numbers';
```

- [ ] **Step 2: Widen `Player.placements`**

Find:
```ts
placements?: {
  quiz: number | null;
  trueFalse: number | null;
  countdown: number | null;
  pointless: number | null;
  pokedle: number | null;
  hpdle: number | null;
};
```

Replace with:
```ts
placements?: {
  quiz: number | null;
  trueFalse: number | null;
  countdown: number | null;
  pointless: number | null;
  pokedle: number | null;
  hpdle: number | null;
  numbers: number | null;
};
```

- [ ] **Step 3: Widen `Player.gamePlacements`**

Same shape change as Step 2 for the `gamePlacements?` field.

- [ ] **Step 4: Widen `GameState.currentGame`**

Find:
```ts
currentGame: 'quiz' | 'trueFalse' | 'countdown' | 'pointless' | 'pokedle' | 'hpdle' | null;
```

Replace with:
```ts
currentGame: 'quiz' | 'trueFalse' | 'countdown' | 'pointless' | 'pokedle' | 'hpdle' | 'numbers' | null;
```

- [ ] **Step 5: Verify build**

```bash
cd packages/client && npm run build
```

---

### Task 0.3: Client label maps

**Files:**
- Modify: `packages/client/src/components/RoundLeaderboardOverlay.tsx` — add `numbers: 'Numbers'` to `GAME_LABELS`
- Modify: `packages/client/src/screens/FinalLeaderboard.tsx` — extend `GameKey`, `GAME_LABELS`, and `placementSummary`

- [ ] **Step 1: RoundLeaderboardOverlay GAME_LABELS**

Find:
```tsx
pokedle: 'Pokédle',
hpdle: 'HP-dle'
```

After `hpdle: 'HP-dle'` add:
```tsx
,
numbers: 'Numbers'
```

(Trailing comma placement matters — match existing style.)

- [ ] **Step 2: FinalLeaderboard.tsx GameKey + GAME_LABELS**

Find:
```ts
type GameKey = 'quiz' | 'trueFalse' | 'countdown' | 'pointless' | 'pokedle' | 'hpdle';
```

Replace with:
```ts
type GameKey = 'quiz' | 'trueFalse' | 'countdown' | 'pointless' | 'pokedle' | 'hpdle' | 'numbers';
```

Find `GAME_LABELS: Record<GameKey, string>` declaration and add:
```ts
numbers: 'Numbers'
```
as a new entry.

- [ ] **Step 3: FinalLeaderboard.tsx placementSummary**

Find the array `placementSummary = [...]` and add (immediately before `Overall`):
```ts
{ label: 'Numbers', value: currentPlayer?.gamePlacements?.numbers ?? null },
```

- [ ] **Step 4: Verify build**

```bash
cd packages/client && npm run build
```

---

### Task 0.4: Host `Display.tsx` types + label maps

**Files:**
- Modify: `packages/host/src/screens/Display.tsx`

- [ ] **Step 1: Widen `GameKey`**

Find at the top of the file:
```ts
type GameKey = 'quiz' | 'trueFalse' | 'countdown' | 'pointless' | 'pokedle' | 'hpdle';
```

Replace with:
```ts
type GameKey = 'quiz' | 'trueFalse' | 'countdown' | 'pointless' | 'pokedle' | 'hpdle' | 'numbers';
```

- [ ] **Step 2: Widen inline Player.gamePlacements interface**

Same as previous Phase 0 — add `numbers: number | null;` to the inline gamePlacements shape (near line 25-30 area).

- [ ] **Step 3: Widen RoundLeaderboardState.game**

Same union as Task 0.2 Step 1.

- [ ] **Step 4: Extend the two inline label-map objects**

There are two `{ quiz: '…', trueFalse: '…', … pokedle: 'Pokédle', hpdle: 'HP-dle' }` objects in Display.tsx (around lines 472 and 623). Add `numbers: 'Numbers'` to both.

- [ ] **Step 5: Extend the championship-standings table**

Currently the grid template + header + body have columns for Quiz / T/F / PTL / PKD / HP / Total. Add a "NUM" column after HP and update both grid templates from `grid-cols-[4rem_minmax(0,1.8fr)_1fr_1fr_1fr_1fr_1fr_1fr]` to `grid-cols-[4rem_minmax(0,1.8fr)_1fr_1fr_1fr_1fr_1fr_1fr_1fr]`. Add the corresponding `<span>NUM</span>` header and `<p className="text-right text-lg">{player.gamePlacements?.numbers || '-'}</p>` body cell.

- [ ] **Step 6: Verify build**

```bash
cd packages/host && npm run build
```

---

### Task 0.5: Host `Dashboard.tsx` types + championship array

**Files:**
- Modify: `packages/host/src/screens/Dashboard.tsx`

- [ ] **Step 1: Widen `GameKey`**

Find:
```ts
type GameKey = 'quiz' | 'trueFalse' | 'countdown' | 'pointless' | 'pokedle' | 'hpdle';
```

Replace with:
```ts
type GameKey = 'quiz' | 'trueFalse' | 'countdown' | 'pointless' | 'pokedle' | 'hpdle' | 'numbers';
```

- [ ] **Step 2: Widen Player.gamePlacements (inline interface near top)**

Add `numbers: number | null;`.

- [ ] **Step 3: Extend `GAME_LABELS`**

Add `numbers: 'Numbers'`.

- [ ] **Step 4: Extend the championship-standings render array (line ~768)**

Find:
```tsx
{(['quiz', 'trueFalse', 'pointless', 'pokedle', 'hpdle'] as GameKey[]).map((game) => (
```

Replace with:
```tsx
{(['quiz', 'trueFalse', 'pointless', 'pokedle', 'hpdle', 'numbers'] as GameKey[]).map((game) => (
```

- [ ] **Step 5: Verify build**

```bash
cd packages/host && npm run build
```

---

### Task 0.6: Commit Phase 0

- [ ] **Step 1: Commit**

```bash
git -C C:/FutureCode/PHoG/.claude/worktrees/elegant-hermann-2af09b add packages/server/src/utils/scoring.js packages/server/src/gameEngine.js packages/server/src/index.js packages/client/src/stores/gameStore.ts packages/client/src/components/RoundLeaderboardOverlay.tsx packages/client/src/screens/FinalLeaderboard.tsx packages/host/src/screens/Display.tsx packages/host/src/screens/Dashboard.tsx
git -C C:/FutureCode/PHoG/.claude/worktrees/elegant-hermann-2af09b commit -m "Add numbers game key to type system and leaderboard surfaces"
```

---

## Phase 1 — Server: tile generator + expression parser + solver

Pure-logic utilities first. Each gets a small Node-assert test. No game module yet.

### Task 1.1: Tile generator

**Files:**
- Create: `packages/server/src/games/numbers/tiles.js`

- [ ] **Step 1: Create the file**

```js
/**
 * Tile draw for Numbers Round.
 *
 * Pool: 4 large tiles (25, 50, 75, 100, one of each) + 20 small tiles
 *       (each integer 1..10 appears twice).
 *
 * A round consists of exactly 6 tiles. The number of large tiles is randomized
 * 0..4; the remainder are drawn from smalls without replacement *within a round*.
 *
 * Target: uniform integer in [100, 999].
 */

const LARGE = [25, 50, 75, 100];

function buildSmallPool() {
  const pool = [];
  for (let n = 1; n <= 10; n++) {
    pool.push(n, n);
  }
  return pool;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function drawTiles() {
  const numLarge = Math.floor(Math.random() * 5); // 0..4
  const largeChosen = shuffle([...LARGE]).slice(0, numLarge);
  const smallPool = shuffle(buildSmallPool());
  const smallChosen = smallPool.slice(0, 6 - numLarge);
  return shuffle([...largeChosen, ...smallChosen]);
}

export function drawTarget() {
  return 100 + Math.floor(Math.random() * 900); // 100..999
}
```

- [ ] **Step 2: Add a sanity-check test**

Create `tests/numbers/tiles.test.mjs`:

```js
import assert from 'node:assert/strict';
import { drawTiles, drawTarget } from '../../packages/server/src/games/numbers/tiles.js';

// 100 draws should always produce exactly 6 tiles, all in the legal pool.
const POOL = new Set([25, 50, 75, 100, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
for (let i = 0; i < 100; i++) {
  const t = drawTiles();
  assert.equal(t.length, 6, `draw produced ${t.length} tiles`);
  for (const v of t) assert.ok(POOL.has(v), `unexpected tile ${v}`);
  // No more than one of each large
  for (const L of [25, 50, 75, 100]) {
    assert.ok(t.filter((x) => x === L).length <= 1, `>1 of large tile ${L}`);
  }
  // No more than two of each small
  for (let s = 1; s <= 10; s++) {
    assert.ok(t.filter((x) => x === s).length <= 2, `>2 of small tile ${s}`);
  }
}

// Targets are in range
for (let i = 0; i < 100; i++) {
  const t = drawTarget();
  assert.ok(t >= 100 && t <= 999, `target ${t} out of range`);
  assert.equal(Number.isInteger(t), true);
}

console.log('tiles.test.mjs PASS');
```

- [ ] **Step 3: Run the test**

```bash
cd C:/FutureCode/PHoG/.claude/worktrees/elegant-hermann-2af09b
node tests/numbers/tiles.test.mjs
```

Expected output: `tiles.test.mjs PASS`. Any assertion failure → fix the generator and re-run.

---

### Task 1.2: Expression parser + evaluator

**Files:**
- Create: `packages/server/src/games/numbers/expression.js`

Recursive-descent parser. **Operator precedence:** standard — `*` and `/` bind tighter than `+` and `-`. Left-associative. Parentheses override.

- [ ] **Step 1: Create the file**

```js
/**
 * Tokenize + parse + evaluate a Numbers-Round expression with the locked rules:
 *   - Operators: + - * /
 *   - Literals: non-negative integers
 *   - Parentheses allowed
 *   - Every intermediate value must be a non-negative integer
 *   - Final result must be a non-negative integer
 *
 * Returns:
 *   { ok: true, value: number, literals: number[] }
 *   { ok: false, error: string }
 *
 * `literals` is the multiset of integer tiles referenced by the AST,
 * suitable for checking against the drawn tile multiset.
 */

function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === ' ' || ch === '\t') { i++; continue; }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '(' || ch === ')') {
      tokens.push({ kind: ch });
      i++;
      continue;
    }
    if (ch >= '0' && ch <= '9') {
      let j = i;
      while (j < input.length && input[j] >= '0' && input[j] <= '9') j++;
      tokens.push({ kind: 'num', value: Number(input.slice(i, j)) });
      i = j;
      continue;
    }
    return { error: `unexpected character '${ch}' at position ${i}` };
  }
  return { tokens };
}

function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = () => tokens[pos++];

  // expr := term (('+'|'-') term)*
  // term := factor (('*'|'/') factor)*
  // factor := num | '(' expr ')'

  function parseFactor() {
    const t = peek();
    if (!t) return { error: 'unexpected end of expression' };
    if (t.kind === '(') {
      eat();
      const inner = parseExpr();
      if (inner.error) return inner;
      const close = eat();
      if (!close || close.kind !== ')') return { error: 'missing closing paren' };
      return inner;
    }
    if (t.kind === 'num') {
      eat();
      return { node: { kind: 'num', value: t.value } };
    }
    return { error: `unexpected token '${t.kind}'` };
  }
  function parseTerm() {
    let left = parseFactor();
    if (left.error) return left;
    while (peek() && (peek().kind === '*' || peek().kind === '/')) {
      const op = eat().kind;
      const right = parseFactor();
      if (right.error) return right;
      left = { node: { kind: 'op', op, left: left.node, right: right.node } };
    }
    return left;
  }
  function parseExpr() {
    let left = parseTerm();
    if (left.error) return left;
    while (peek() && (peek().kind === '+' || peek().kind === '-')) {
      const op = eat().kind;
      const right = parseTerm();
      if (right.error) return right;
      left = { node: { kind: 'op', op, left: left.node, right: right.node } };
    }
    return left;
  }

  const result = parseExpr();
  if (result.error) return result;
  if (pos < tokens.length) return { error: `trailing token '${tokens[pos].kind}'` };
  return result;
}

function evalNode(node, literals) {
  if (node.kind === 'num') {
    literals.push(node.value);
    return { value: node.value };
  }
  const L = evalNode(node.left, literals);
  if (L.error) return L;
  const R = evalNode(node.right, literals);
  if (R.error) return R;
  const a = L.value;
  const b = R.value;
  let v;
  if (node.op === '+') v = a + b;
  else if (node.op === '-') v = a - b;
  else if (node.op === '*') v = a * b;
  else if (node.op === '/') {
    if (b === 0) return { error: 'division by zero' };
    if (a % b !== 0) return { error: `non-integer division ${a}/${b}` };
    v = a / b;
  } else return { error: `unknown op ${node.op}` };

  if (v < 0) return { error: `negative intermediate ${v}` };
  if (!Number.isInteger(v)) return { error: `non-integer intermediate ${v}` };
  return { value: v };
}

export function evaluate(input) {
  const tk = tokenize(input);
  if (tk.error) return { ok: false, error: tk.error };
  if (tk.tokens.length === 0) return { ok: false, error: 'empty expression' };
  const parsed = parse(tk.tokens);
  if (parsed.error) return { ok: false, error: parsed.error };
  const literals = [];
  const result = evalNode(parsed.node, literals);
  if (result.error) return { ok: false, error: result.error };
  return { ok: true, value: result.value, literals };
}

/**
 * Check that a guess's literal multiset is a subset of the available-tile multiset.
 * Returns true if every literal in `used` is present in `pool` with sufficient
 * multiplicity (and is one of the legal tile values).
 */
export function literalsFitTiles(used, tiles) {
  const remaining = new Map();
  for (const t of tiles) remaining.set(t, (remaining.get(t) || 0) + 1);
  for (const v of used) {
    const count = remaining.get(v) || 0;
    if (count === 0) return false;
    remaining.set(v, count - 1);
  }
  return true;
}
```

- [ ] **Step 2: Add tests**

Create `tests/numbers/expression.test.mjs`:

```js
import assert from 'node:assert/strict';
import { evaluate, literalsFitTiles } from '../../packages/server/src/games/numbers/expression.js';

// Basic arithmetic
assert.deepEqual(evaluate('1+2'), { ok: true, value: 3, literals: [1, 2] });
assert.deepEqual(evaluate('100 - 1'), { ok: true, value: 99, literals: [100, 1] });
assert.deepEqual(evaluate('(75 + 25) * 7'), { ok: true, value: 700, literals: [75, 25, 7] });

// Precedence
assert.equal(evaluate('2 + 3 * 4').value, 14);

// Reject fractional intermediate
const fracResult = evaluate('10 / 3');
assert.equal(fracResult.ok, false);
assert.ok(/non-integer division/i.test(fracResult.error));

// Reject negative intermediate
const negResult = evaluate('3 - 5');
assert.equal(negResult.ok, false);
assert.ok(/negative/i.test(negResult.error));

// Reject negative even inside a paren
assert.equal(evaluate('10 * (3 - 5)').ok, false);

// Multiplied negative trick still rejected
assert.equal(evaluate('5 * (2 - 3)').ok, false);

// literals tracking
const r = evaluate('(75 + 25) * 7 - 4');
assert.equal(r.ok, true);
assert.equal(r.value, 696);
assert.deepEqual(r.literals.slice().sort(), [4, 7, 25, 75]);

// Tile-fit check
assert.equal(literalsFitTiles([7, 25, 75, 4], [75, 25, 7, 4, 50, 100]), true);
// Reusing a tile not in the pool
assert.equal(literalsFitTiles([7, 7], [75, 25, 7, 4, 50, 100]), false);
// Reusing a small twice when it appears twice in the pool — ok
assert.equal(literalsFitTiles([3, 3], [3, 3, 5, 5, 50, 75]), true);
// Tile not drawn at all
assert.equal(literalsFitTiles([9], [3, 3, 5, 5, 50, 75]), false);

console.log('expression.test.mjs PASS');
```

- [ ] **Step 3: Run the tests**

```bash
node tests/numbers/expression.test.mjs
```

Expected: `expression.test.mjs PASS`.

---

### Task 1.3: Solver

The solver does two jobs: (a) confirm a target is exact-solvable from a tile draw (used for puzzle gen validation), (b) on round end, return one optimal expression for the post-round reveal.

Approach: DP over tile subsets. For each non-empty subset of the 6 tiles, compute the set of all values reachable by some valid expression over that subset. Build up size 1 → 2 → … → 6 by combining disjoint sub-subsets. Track, for each (subset, value), one expression-string that achieves it.

- [ ] **Step 1: Create the file**

```js
/**
 * Exhaustive solver for Numbers Round.
 *
 * Approach: subset DP. For each non-empty subset of the 6 tiles, store a map
 * { value → expressionString } of reachable values using exactly those tiles.
 * Build up size 1, then size 2 by combining size-1 + size-1, etc.
 *
 * For 6 tiles there are 2^6 - 1 = 63 non-empty subsets; the partition count is
 * small enough that the whole computation finishes in low milliseconds.
 *
 * Constraint: every intermediate value must be a non-negative integer
 * (same as the player's evaluator).
 */

function disjointPairs(subset) {
  // yield (a, b) such that a | b == subset, a & b == 0, both nonzero, a < b
  // (ordering avoids double-counting symmetric pairs)
  const pairs = [];
  for (let a = (subset - 1) & subset; a > 0; a = (a - 1) & subset) {
    const b = subset & ~a;
    if (b > a) pairs.push([a, b]);
  }
  return pairs;
}

function combine(va, vb) {
  // returns array of [resultValue, opChar] tuples for legal binary ops between va and vb
  const out = [];
  // commutative ops: emit one direction only (a + b, a * b)
  out.push([va + vb, '+']);
  out.push([va * vb, '*']);
  // a - b (must be > 0; we allow non-negative but result 0 is allowed)
  if (va > vb) out.push([va - vb, '-']);
  else if (vb > va) out.push([vb - va, '-rev']);
  // (allow va === vb but va - vb = 0 — okay, but the result 0 isn't useful and breaks future divs)
  // division: a/b or b/a if divides evenly and result > 1 (result of 1 wastes a tile)
  if (vb !== 0 && va % vb === 0 && va / vb > 1) out.push([va / vb, '/']);
  if (va !== 0 && vb % va === 0 && vb / va > 1) out.push([vb / va, '/rev']);
  return out;
}

function expr(opCh, ea, eb) {
  if (opCh === '+') return `(${ea}+${eb})`;
  if (opCh === '*') return `(${ea}*${eb})`;
  if (opCh === '-') return `(${ea}-${eb})`;
  if (opCh === '-rev') return `(${eb}-${ea})`;
  if (opCh === '/') return `(${ea}/${eb})`;
  if (opCh === '/rev') return `(${eb}/${ea})`;
  throw new Error('bad op');
}

function build(tiles) {
  // table[subset] = Map<value, expressionString>
  const n = tiles.length;
  const total = 1 << n;
  const table = new Array(total);
  for (let s = 0; s < total; s++) table[s] = new Map();

  // size 1
  for (let i = 0; i < n; i++) {
    const subset = 1 << i;
    table[subset].set(tiles[i], String(tiles[i]));
  }
  // sizes 2..n
  for (let subset = 1; subset < total; subset++) {
    if (table[subset].size > 0) continue; // already filled (size 1)
    for (const [a, b] of disjointPairs(subset)) {
      const ma = table[a];
      const mb = table[b];
      if (!ma || !mb || ma.size === 0 || mb.size === 0) continue;
      for (const [va, ea] of ma) {
        for (const [vb, eb] of mb) {
          for (const [vr, opCh] of combine(va, vb)) {
            if (!table[subset].has(vr)) {
              table[subset].set(vr, expr(opCh, ea, eb));
            }
          }
        }
      }
    }
  }
  return table;
}

export function canHitTarget(tiles, target) {
  const table = build(tiles);
  for (let s = 1; s < table.length; s++) {
    if (table[s].has(target)) return true;
  }
  return false;
}

export function findOptimal(tiles, target) {
  // Return { found: boolean, distance: number, expression: string }
  // where 'optimal' means the smallest |reachable - target|.
  const table = build(tiles);
  let best = { distance: Infinity, value: null, expression: null };
  for (let s = 1; s < table.length; s++) {
    for (const [v, e] of table[s]) {
      const d = Math.abs(v - target);
      if (d < best.distance) best = { distance: d, value: v, expression: e };
      if (d === 0) return { found: true, distance: 0, value: v, expression: e };
    }
  }
  return { found: best.distance === 0, distance: best.distance, value: best.value, expression: best.expression };
}
```

- [ ] **Step 2: Add tests**

Create `tests/numbers/solver.test.mjs`:

```js
import assert from 'node:assert/strict';
import { canHitTarget, findOptimal } from '../../packages/server/src/games/numbers/solver.js';

// Trivial: target equals a tile
assert.equal(canHitTarget([7, 3, 1, 1, 50, 25], 50), true);

// Classic: 75, 25, 7, 4 → 696 = (75+25)*7 - 4
assert.equal(canHitTarget([75, 25, 7, 4, 50, 100], 696), true);

// Find optimal returns distance 0 for an exact case
const opt = findOptimal([75, 25, 7, 4, 50, 100], 696);
assert.equal(opt.distance, 0);
assert.equal(opt.value, 696);
assert.ok(typeof opt.expression === 'string');

// Find optimal returns small distance for an unreachable target
const opt2 = findOptimal([1, 2, 3, 4, 5, 6], 999);
assert.ok(opt2.distance > 0);

// Solver runs in reasonable time
const start = Date.now();
findOptimal([25, 50, 75, 100, 3, 9], 851);
const elapsed = Date.now() - start;
assert.ok(elapsed < 500, `solver too slow: ${elapsed}ms`);

console.log('solver.test.mjs PASS');
```

- [ ] **Step 3: Run the tests**

```bash
node tests/numbers/solver.test.mjs
```

Expected: `solver.test.mjs PASS` and the elapsed-time assertion passes (typically <100ms).

---

### Task 1.4: Commit Phase 1

- [ ] **Step 1: Commit**

```bash
git -C C:/FutureCode/PHoG/.claude/worktrees/elegant-hermann-2af09b add packages/server/src/games/numbers/ tests/numbers/
git -C C:/FutureCode/PHoG/.claude/worktrees/elegant-hermann-2af09b commit -m "Add Numbers Round tile generator, expression parser, and solver"
```

---

## Phase 2 — Server: Numbers game module + index.js wiring

### Task 2.1: `NumbersGame` class

**Files:**
- Create: `packages/server/src/games/numbers.js`

- [ ] **Step 1: Create the file**

```js
/**
 * Numbers Round game module — Countdown numbers, multiplayer.
 *
 * Session shape:
 *   1 game = 5 rounds.
 *   Each round: 8s intro splash → 45s playing → 8s reveal.
 *   Score accumulates across rounds.
 *
 * Per-round scoring (server-authoritative):
 *   exact target hit:     50 pts
 *   within 5 of target:   30 pts
 *   within 10 of target:  15 pts
 *   else:                  0 pts
 *   first-correct bonus: +10 pts (first player to submit an exact solve)
 */

import { Timer } from '../utils/timer.js';
import { drawTiles, drawTarget } from './numbers/tiles.js';
import { evaluate, literalsFitTiles } from './numbers/expression.js';
import { canHitTarget, findOptimal } from './numbers/solver.js';

const TOTAL_ROUNDS = 5;
const INTRO_DURATION = 8000;
const PLAY_DURATION = 45000;
const RESULTS_DURATION = 8000;
const MAX_PUZZLE_GEN_ATTEMPTS = 100;

function generateRound() {
  // Try to produce an exact-solvable puzzle; if we can't, fall back to the last
  // generated one (closest-achievable scoring still works).
  for (let i = 0; i < MAX_PUZZLE_GEN_ATTEMPTS; i++) {
    const tiles = drawTiles();
    const target = drawTarget();
    if (canHitTarget(tiles, target)) return { tiles, target };
  }
  // Fallback — unsolvable target, but the round still scores by closeness.
  return { tiles: drawTiles(), target: drawTarget() };
}

function scoreSubmission(claimedValue, target) {
  const dist = Math.abs(claimedValue - target);
  if (dist === 0) return 50;
  if (dist <= 5) return 30;
  if (dist <= 10) return 15;
  return 0;
}

export class NumbersGame {
  constructor(gameState, io, gameEngine) {
    this.gameState = gameState;
    this.io = io;
    this.gameEngine = gameEngine;
    this.timer = null;

    this.gameState.numbers = {
      phase: 'intro',
      roundNumber: 0,
      totalRounds: TOTAL_ROUNDS,
      tiles: [],
      target: null,
      submissions: {}, // playerId -> { expression, value, valid, distance, score, submittedAt }
      cumulativeScores: {} // playerId -> total across rounds
    };

    for (const [pid] of this.gameState.players) {
      this.gameState.numbers.cumulativeScores[pid] = 0;
    }
  }

  start() {
    console.log('[NUMBERS] Starting game');
    this._showIntro();
  }

  _showIntro() {
    this.gameState.numbers.phase = 'intro';
    const endsAt = Date.now() + INTRO_DURATION;

    this.io.emit('numbers:intro', {
      title: 'Numbers Round',
      description: 'Six tiles. One target. 45 seconds. Combine the tiles with + − × ÷ to hit the target.',
      scoringRules: [
        'Exact hit: 50 points',
        'Within 5: 30 points',
        'Within 10: 15 points',
        'First exact solver: +10 bonus'
      ],
      totalRounds: TOTAL_ROUNDS,
      duration: INTRO_DURATION,
      endsAt
    });

    this.timer = new Timer(INTRO_DURATION, null, () => this._startRound(1));
    this.timer.start();
  }

  _startRound(n) {
    this.gameState.numbers.roundNumber = n;
    this.gameState.numbers.phase = 'playing';
    this.gameState.numbers.submissions = {};

    const { tiles, target } = generateRound();
    this.gameState.numbers.tiles = tiles;
    this.gameState.numbers.target = target;
    this._firstExactPlayerId = null;

    const endsAt = Date.now() + PLAY_DURATION;
    this.gameState.numbers.endsAt = endsAt;

    this.io.emit('numbers:round:start', {
      roundNumber: n,
      totalRounds: TOTAL_ROUNDS,
      tiles,
      target,
      duration: PLAY_DURATION,
      endsAt
    });

    console.log(`[NUMBERS] Round ${n}/${TOTAL_ROUNDS} — tiles ${tiles.join(',')} target ${target}`);

    this.timer = new Timer(PLAY_DURATION, null, () => this._endRound());
    this.timer.start();
  }

  handleSubmit(playerId, { expression, claimedValue }) {
    if (this.gameState.numbers.phase !== 'playing') return;
    const tiles = this.gameState.numbers.tiles;
    const target = this.gameState.numbers.target;

    // If they already submitted this round, allow overwrite — last submission wins.
    const prev = this.gameState.numbers.submissions[playerId];

    const evalResult = evaluate(String(expression || ''));
    let entry;
    if (!evalResult.ok) {
      entry = {
        expression,
        value: null,
        valid: false,
        error: evalResult.error,
        distance: null,
        score: 0,
        submittedAt: Date.now()
      };
    } else if (!literalsFitTiles(evalResult.literals, tiles)) {
      entry = {
        expression,
        value: evalResult.value,
        valid: false,
        error: 'tile multiset mismatch',
        distance: null,
        score: 0,
        submittedAt: Date.now()
      };
    } else if (typeof claimedValue === 'number' && claimedValue !== evalResult.value) {
      entry = {
        expression,
        value: evalResult.value,
        claimedValue,
        valid: false,
        error: 'claimed value does not match evaluation',
        distance: null,
        score: 0,
        submittedAt: Date.now()
      };
    } else {
      const distance = Math.abs(evalResult.value - target);
      const baseScore = scoreSubmission(evalResult.value, target);
      let bonus = 0;
      if (distance === 0 && this._firstExactPlayerId === null) {
        this._firstExactPlayerId = playerId;
        bonus = 10;
      }
      entry = {
        expression,
        value: evalResult.value,
        valid: true,
        distance,
        score: baseScore + bonus,
        firstExactBonus: bonus > 0,
        submittedAt: Date.now()
      };
    }

    this.gameState.numbers.submissions[playerId] = entry;

    const socket = this._socketFor(playerId);
    if (socket) {
      socket.emit('numbers:submit:ack', {
        accepted: entry.valid,
        expression,
        value: entry.value,
        distance: entry.distance,
        error: entry.error || null
      });
    }

    // Broadcast progress (no expressions, just who-has-submitted)
    this._broadcastProgress();

    // Early-end if every connected player has submitted at least one valid solution
    const connectedIds = Array.from(this.gameState.players.entries())
      .filter(([, p]) => p.connected)
      .map(([id]) => id);
    const allValid = connectedIds.length > 0 && connectedIds.every((id) => this.gameState.numbers.submissions[id]?.valid);
    if (allValid && this._firstExactPlayerId !== null) {
      // Everyone's got a valid answer and someone has solved exactly — short-circuit.
      if (this.timer) { this.timer.stop(); this.timer = null; }
      this._endRound();
    }
  }

  _broadcastProgress() {
    const submitted = Object.fromEntries(
      Object.entries(this.gameState.numbers.submissions).map(([pid, s]) => [pid, { hasSubmitted: true, valid: s.valid }])
    );
    this.io.emit('numbers:progress', { submitted });
  }

  _endRound() {
    this.gameState.numbers.phase = 'results';
    const { tiles, target, roundNumber, submissions } = this.gameState.numbers;
    const optimal = findOptimal(tiles, target);

    // Update cumulative scores
    const roundResults = [];
    for (const [pid, p] of this.gameState.players) {
      const s = submissions[pid];
      const score = s?.score || 0;
      this.gameState.numbers.cumulativeScores[pid] = (this.gameState.numbers.cumulativeScores[pid] || 0) + score;
      p.score = this.gameState.numbers.cumulativeScores[pid]; // engine uses player.score for placement
      roundResults.push({
        playerId: pid,
        playerName: p.name,
        expression: s?.expression ?? null,
        value: s?.value ?? null,
        distance: s?.distance ?? null,
        roundScore: score,
        cumulativeScore: this.gameState.numbers.cumulativeScores[pid],
        valid: s?.valid ?? false,
        firstExactBonus: !!s?.firstExactBonus
      });
    }

    const isLastRound = roundNumber >= TOTAL_ROUNDS;
    const endsAt = Date.now() + RESULTS_DURATION;

    this.io.emit('numbers:round:results', {
      roundNumber,
      totalRounds: TOTAL_ROUNDS,
      tiles,
      target,
      optimal,
      results: roundResults,
      cumulativeScores: this.gameState.numbers.cumulativeScores,
      isLastRound,
      duration: RESULTS_DURATION,
      endsAt
    });

    this.gameEngine.broadcastPlayerList();

    console.log(`[NUMBERS] Round ${roundNumber} ended. Optimal: ${optimal.value} via ${optimal.expression} (dist ${optimal.distance})`);

    this.timer = new Timer(RESULTS_DURATION, null, () => {
      if (isLastRound) {
        console.log('[NUMBERS] All rounds complete. Ending game.');
        this.gameEngine.endGame();
      } else {
        this._startRound(roundNumber + 1);
      }
    });
    this.timer.start();
  }

  _socketFor(playerId) {
    const player = this.gameState.players.get(playerId);
    if (!player) return null;
    return this.io.sockets.sockets.get(player.socketId);
  }

  pause()  { if (this.timer) this.timer.pause(); }
  resume() { if (this.timer) this.timer.resume(); }
  skip()   {
    if (this.timer) {
      this.timer.stop();
      if (this.timer.onComplete) this.timer.onComplete();
    }
  }

  cleanup() {
    console.log('[NUMBERS] Cleaning up');
    if (this.timer) { this.timer.stop(); this.timer = null; }
  }

  getState() {
    return {
      phase: this.gameState.numbers?.phase || 'intro',
      roundNumber: this.gameState.numbers?.roundNumber || 0,
      totalRounds: TOTAL_ROUNDS,
      target: this.gameState.numbers?.target || null,
      tiles: this.gameState.numbers?.tiles || []
    };
  }
}
```

- [ ] **Step 2: Verify the module loads**

```bash
cd C:/FutureCode/PHoG/.claude/worktrees/elegant-hermann-2af09b
node -e "import('./packages/server/src/games/numbers.js').then(m => console.log('OK', Object.keys(m)))"
```

Expected: `OK [ 'NumbersGame' ]`. Any syntax error → fix.

---

### Task 2.2: Wire into `index.js`

**Files:**
- Modify: `packages/server/src/index.js`

- [ ] **Step 1: Add import**

Near the other game imports at the top (after `import { ThemedDleGame } from './games/themedDle.js';`):

```js
import { NumbersGame } from './games/numbers.js';
```

- [ ] **Step 2: Add factory branch**

In `startSpecificGame()`, after the pokedle/hpdle block:

```js
} else if (gameName === 'numbers') {
    const numbersGame = new NumbersGame(gameState, io, gameEngine);
    gameEngine.startGame('numbers', numbersGame);
    numbersGame.start();
}
```

- [ ] **Step 3: Add submit handler**

After the existing `socket.on('themedDle:guess', ...)` block:

```js
socket.on('numbers:submit', ({ expression, claimedValue }) => {
  const playerId = connectionManager.getPlayerId(socket.id);
  if (!playerId) {
    socket.emit('error', { message: 'Not registered' });
    return;
  }
  if (gameState.currentGame !== 'numbers') {
    socket.emit('error', { message: 'Numbers Round not running' });
    return;
  }
  if (gameState.numbers?.phase !== 'playing') {
    socket.emit('error', { message: 'Not in playing phase' });
    return;
  }
  const currentGame = gameEngine.currentGameModule;
  if (currentGame && typeof currentGame.handleSubmit === 'function') {
    currentGame.handleSubmit(playerId, { expression, claimedValue });
  }
});
```

- [ ] **Step 4: Verify the server boots**

```bash
cd packages/server
timeout 4 node src/index.js 2>&1 | head -15
```

Expected: PHoG banner. Stop the probe with `Ctrl+C` if it lingers.

---

### Task 2.3: Commit Phase 2

```bash
git -C C:/FutureCode/PHoG/.claude/worktrees/elegant-hermann-2af09b add packages/server/src/games/numbers.js packages/server/src/index.js
git -C C:/FutureCode/PHoG/.claude/worktrees/elegant-hermann-2af09b commit -m "Add Numbers Round game module and socket wiring"
```

---

## Phase 3 — Client: Numbers screen + components + routing

### Task 3.1: Shared components

**Files:**
- Create: `packages/client/src/components/numbers/TilePool.tsx`
- Create: `packages/client/src/components/numbers/TargetDisplay.tsx`
- Create: `packages/client/src/components/numbers/ExpressionInput.tsx`
- Create: `packages/client/src/components/numbers/RoundResults.tsx`

- [ ] **Step 1: Create `TilePool.tsx`**

```tsx
import { motion } from 'framer-motion';

interface TilePoolProps {
  tiles: number[];
  usedIndexes: Set<number>;   // which slots are currently consumed by the live expression
  onTileClick: (index: number, value: number) => void;
}

export const TilePool = ({ tiles, usedIndexes, onTileClick }: TilePoolProps) => (
  <div className="grid grid-cols-6 gap-2 sm:gap-3">
    {tiles.map((value, idx) => {
      const used = usedIndexes.has(idx);
      return (
        <motion.button
          key={idx}
          disabled={used}
          onClick={() => onTileClick(idx, value)}
          whileTap={{ scale: used ? 1 : 0.92 }}
          className={`aspect-square rounded-2xl border-2 text-2xl font-bold transition-all sm:text-3xl ${
            used
              ? 'border-white/10 bg-black/30 text-ui-textMuted opacity-40'
              : value >= 25
                ? 'border-game-leader bg-game-leader/15 text-white hover:brightness-110'
                : 'border-white/20 bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          {value}
        </motion.button>
      );
    })}
  </div>
);
```

- [ ] **Step 2: Create `TargetDisplay.tsx`**

```tsx
interface TargetDisplayProps {
  target: number;
}

export const TargetDisplay = ({ target }: TargetDisplayProps) => (
  <div className="rounded-3xl border-2 border-game-leader bg-game-leader/10 px-6 py-4 text-center">
    <p className="eyebrow">Target</p>
    <p className="text-6xl font-bold tabular-nums text-game-leader sm:text-7xl">{target}</p>
  </div>
);
```

- [ ] **Step 3: Create `ExpressionInput.tsx`**

This is the live expression display + operator/paren/control pad. Tile clicks come from `<TilePool>` above and need to feed into the same expression — the parent screen owns the expression state and passes append/backspace callbacks here.

```tsx
import { motion } from 'framer-motion';

interface ExpressionInputProps {
  expression: string;
  onOperator: (op: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onSubmit: () => void;
  canSubmit: boolean;
}

const OP_BUTTONS = ['+', '-', '*', '/', '(', ')'];

export const ExpressionInput = ({ expression, onOperator, onBackspace, onClear, onSubmit, canSubmit }: ExpressionInputProps) => (
  <div className="space-y-3">
    <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-right">
      <p className="eyebrow">Your expression</p>
      <p className="mt-1 min-h-[2.5rem] break-all text-3xl font-bold tabular-nums text-white sm:text-4xl">
        {expression || <span className="text-ui-textMuted">…</span>}
      </p>
    </div>
    <div className="grid grid-cols-6 gap-2">
      {OP_BUTTONS.map((op) => (
        <motion.button
          key={op}
          whileTap={{ scale: 0.92 }}
          onClick={() => onOperator(op)}
          className="aspect-square rounded-2xl border border-white/15 bg-white/5 text-2xl font-bold text-white hover:bg-white/15 sm:text-3xl"
        >
          {op === '*' ? '×' : op === '/' ? '÷' : op}
        </motion.button>
      ))}
    </div>
    <div className="grid grid-cols-3 gap-2">
      <motion.button whileTap={{ scale: 0.95 }} onClick={onBackspace} className="rounded-2xl border border-white/15 bg-white/5 py-3 text-lg font-medium text-white hover:bg-white/15">⌫ Back</motion.button>
      <motion.button whileTap={{ scale: 0.95 }} onClick={onClear} className="rounded-2xl border border-game-incorrect/40 bg-game-incorrect/10 py-3 text-lg font-medium text-game-incorrect hover:bg-game-incorrect/20">Clear</motion.button>
      <motion.button
        whileTap={{ scale: canSubmit ? 0.95 : 1 }}
        disabled={!canSubmit}
        onClick={onSubmit}
        className={`rounded-2xl py-3 text-lg font-bold ${canSubmit ? 'bg-game-correct text-black hover:brightness-110' : 'bg-game-correct/30 text-game-correct/60'}`}
      >
        Submit
      </motion.button>
    </div>
  </div>
);
```

- [ ] **Step 4: Create `RoundResults.tsx`**

```tsx
import { motion } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';

interface RoundResultsProps {
  data: {
    roundNumber: number;
    totalRounds: number;
    target: number;
    tiles: number[];
    optimal: { found: boolean; distance: number; value: number | null; expression: string | null };
    results: Array<{
      playerId: string;
      playerName: string;
      expression: string | null;
      value: number | null;
      distance: number | null;
      roundScore: number;
      cumulativeScore: number;
      valid: boolean;
      firstExactBonus: boolean;
    }>;
    isLastRound: boolean;
    duration: number;
    endsAt: number;
  };
}

export const RoundResults = ({ data }: RoundResultsProps) => {
  const { playerId } = useGameStore();
  const me = data.results.find((r) => r.playerId === playerId);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="screen-frame max-w-3xl space-y-5 text-center">
      <p className="eyebrow">Round {data.roundNumber} / {data.totalRounds} — Reveal</p>
      <p className="text-2xl text-ui-textMuted">Target was</p>
      <p className="text-6xl font-bold text-game-leader">{data.target}</p>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
        <p className="eyebrow">Optimal solution</p>
        <p className="mt-1 text-3xl font-bold text-game-correct">{data.optimal.expression ?? '—'}</p>
        <p className="text-sm text-ui-textMuted">= {data.optimal.value ?? '—'} (distance {data.optimal.distance})</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-left">
        <p className="eyebrow mb-3 text-center">Your round</p>
        {me ? (
          <>
            <p className="text-lg"><span className="font-bold">{me.expression || 'no submission'}</span></p>
            <p className="text-sm text-ui-textMuted">value: {me.value ?? '—'} · distance: {me.distance ?? '—'}</p>
            <p className="mt-2 text-center text-3xl font-bold text-game-leader">+{me.roundScore} pts{me.firstExactBonus && ' (first exact!)'}</p>
            <p className="text-center text-sm text-ui-textMuted">cumulative: {me.cumulativeScore}</p>
          </>
        ) : (
          <p className="text-center text-ui-textMuted">No submission this round.</p>
        )}
      </div>

      <p className="text-sm text-ui-textMuted">{data.isLastRound ? 'Game wrapping up…' : 'Next round coming…'}</p>
    </motion.div>
  );
};
```

- [ ] **Step 5: Verify build**

```bash
cd packages/client && npm run build
```

(Build will succeed even with the unused components, since they're not yet imported anywhere.)

---

### Task 3.2: `Numbers.tsx` screen

**Files:**
- Create: `packages/client/src/screens/Numbers.tsx`

The screen owns the live expression-building state. Tile clicks append `<value>` to the expression string. The list of "used indexes" is derived by walking the expression and consuming tiles greedily in order.

- [ ] **Step 1: Create the file**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import { TilePool } from '../components/numbers/TilePool';
import { TargetDisplay } from '../components/numbers/TargetDisplay';
import { ExpressionInput } from '../components/numbers/ExpressionInput';
import { RoundResults } from '../components/numbers/RoundResults';

type Phase = 'intro' | 'playing' | 'results';

interface NumbersProps {
  socket: Socket | null;
}

// Derive which tile slots are consumed by the current expression string.
// We tokenize the expression for numeric literals and greedy-match against tile values.
function deriveUsedIndexes(expression: string, tiles: number[]): Set<number> {
  const literals: number[] = [];
  let i = 0;
  while (i < expression.length) {
    const ch = expression[i];
    if (ch >= '0' && ch <= '9') {
      let j = i;
      while (j < expression.length && expression[j] >= '0' && expression[j] <= '9') j++;
      literals.push(Number(expression.slice(i, j)));
      i = j;
    } else {
      i++;
    }
  }
  const remaining = tiles.map((v, idx) => ({ v, idx }));
  const used = new Set<number>();
  for (const lit of literals) {
    const slot = remaining.findIndex((t) => t.v === lit && !used.has(t.idx));
    if (slot !== -1) used.add(remaining[slot].idx);
  }
  return used;
}

export const Numbers = ({ socket }: NumbersProps) => {
  const { playerId } = useGameStore();
  const [phase, setPhase] = useState<Phase>('intro');
  const [introData, setIntroData] = useState<any>(null);
  const [roundData, setRoundData] = useState<any>(null);
  const [resultsData, setResultsData] = useState<any>(null);
  const [expression, setExpression] = useState('');
  const [ackToast, setAckToast] = useState<string | null>(null);
  const [timerMs, setTimerMs] = useState(0);

  // Timer for the playing phase
  useEffect(() => {
    if (phase !== 'playing' || !roundData?.endsAt) return;
    const tick = () => setTimerMs(Math.max(0, roundData.endsAt - Date.now()));
    tick();
    const i = setInterval(tick, 100);
    return () => clearInterval(i);
  }, [phase, roundData]);

  useEffect(() => {
    if (!socket) return;
    const onIntro = (d: any) => { setPhase('intro'); setIntroData(d); setExpression(''); };
    const onStart = (d: any) => { setPhase('playing'); setRoundData(d); setExpression(''); };
    const onAck = (d: any) => {
      if (d.accepted) setAckToast(`✓ submitted: ${d.value}`);
      else setAckToast(`✗ ${d.error || 'invalid'}`);
      setTimeout(() => setAckToast(null), 2500);
    };
    const onResults = (d: any) => { setPhase('results'); setResultsData(d); };

    socket.on('numbers:intro', onIntro);
    socket.on('numbers:round:start', onStart);
    socket.on('numbers:submit:ack', onAck);
    socket.on('numbers:round:results', onResults);

    return () => {
      socket.off('numbers:intro', onIntro);
      socket.off('numbers:round:start', onStart);
      socket.off('numbers:submit:ack', onAck);
      socket.off('numbers:round:results', onResults);
    };
  }, [socket, playerId]);

  const tiles: number[] = roundData?.tiles || [];
  const usedIndexes = useMemo(() => deriveUsedIndexes(expression, tiles), [expression, tiles]);

  const appendTile = (_idx: number, value: number) => {
    setExpression((e) => e + String(value));
  };
  const appendOp = (op: string) => {
    setExpression((e) => e + op);
  };
  const backspace = () => {
    setExpression((e) => {
      if (!e) return e;
      // If the last char is a digit, peel off the whole literal in one step
      if (e.at(-1)! >= '0' && e.at(-1)! <= '9') {
        let i = e.length - 1;
        while (i > 0 && e[i - 1] >= '0' && e[i - 1] <= '9') i--;
        return e.slice(0, i);
      }
      return e.slice(0, -1);
    });
  };
  const clearExpr = () => setExpression('');
  const submit = () => {
    if (!socket || !expression) return;
    socket.emit('numbers:submit', { expression });
  };

  // Intro splash
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
          <p className="text-sm text-ui-textMuted">{introData.totalRounds} rounds total</p>
        </motion.div>
      </div>
    );
  }

  // Results
  if (phase === 'results' && resultsData) {
    return (
      <div className="screen-shell flex flex-col items-center justify-center">
        <RoundResults data={resultsData} />
      </div>
    );
  }

  // Playing — show the build pad
  if (phase === 'playing' && roundData) {
    const totalMs = roundData.duration || 45000;
    const progress = totalMs > 0 ? Math.max(0, Math.min(100, (timerMs / totalMs) * 100)) : 0;

    return (
      <div className="screen-shell py-4">
        <div className="screen-frame max-w-3xl space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow">Numbers · Round {roundData.roundNumber}/{roundData.totalRounds}</p>
            <p className="tabular-nums text-2xl font-bold text-white">{Math.ceil(timerMs / 1000)}s</p>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-game-leader" style={{ width: `${progress}%` }} />
          </div>

          <TargetDisplay target={roundData.target} />
          <TilePool tiles={tiles} usedIndexes={usedIndexes} onTileClick={appendTile} />
          <ExpressionInput
            expression={expression}
            onOperator={appendOp}
            onBackspace={backspace}
            onClear={clearExpr}
            onSubmit={submit}
            canSubmit={expression.length > 0}
          />
          {ackToast && (
            <div className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-center text-sm">{ackToast}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="screen-shell flex flex-col items-center justify-center">
      <div className="screen-frame max-w-md text-center">
        <p className="eyebrow">Numbers Round</p>
        <h1 className="text-3xl font-bold">Loading…</h1>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify build**

```bash
cd packages/client && npm run build
```

---

### Task 3.3: Wire routing in `App.tsx`

**Files:**
- Modify: `packages/client/src/App.tsx`

- [ ] **Step 1: Import + branch**

After `import { ThemedDle } from './screens/ThemedDle';` add:
```tsx
import { Numbers } from './screens/Numbers';
```

Inside the `case 'playing'` switch on `currentGame`, after the `pokedle`/`hpdle` branch, add:
```tsx
case 'numbers':
  return <Numbers socket={socket} />;
```

- [ ] **Step 2: Verify build**

```bash
cd packages/client && npm run build
```

- [ ] **Step 3: Commit Phase 3**

```bash
git -C C:/FutureCode/PHoG/.claude/worktrees/elegant-hermann-2af09b add packages/client/src/components/numbers/ packages/client/src/screens/Numbers.tsx packages/client/src/App.tsx
git -C C:/FutureCode/PHoG/.claude/worktrees/elegant-hermann-2af09b commit -m "Add client Numbers Round screen and components"
```

---

## Phase 4 — Host display

### Task 4.1: Host components

**Files:**
- Create: `packages/host/src/components/numbers/HostTilePool.tsx`
- Create: `packages/host/src/components/numbers/HostTarget.tsx`
- Create: `packages/host/src/components/numbers/NumbersProgressPanel.tsx`

- [ ] **Step 1: Create `HostTilePool.tsx`**

```tsx
interface HostTilePoolProps {
  tiles: number[];
}

export const HostTilePool = ({ tiles }: HostTilePoolProps) => (
  <div className="flex flex-wrap items-center justify-center gap-5">
    {tiles.map((value, idx) => (
      <div
        key={idx}
        className={`flex h-32 w-32 items-center justify-center rounded-3xl border-4 text-6xl font-bold ${
          value >= 25
            ? 'border-game-leader bg-game-leader/15 text-white'
            : 'border-white/30 bg-white/10 text-white'
        }`}
      >
        {value}
      </div>
    ))}
  </div>
);
```

- [ ] **Step 2: Create `HostTarget.tsx`**

```tsx
interface HostTargetProps { target: number; }

export const HostTarget = ({ target }: HostTargetProps) => (
  <div className="flex flex-col items-center gap-2">
    <p className="eyebrow text-2xl">Target</p>
    <p className="text-[12rem] font-bold leading-none tabular-nums text-game-leader">{target}</p>
  </div>
);
```

- [ ] **Step 3: Create `NumbersProgressPanel.tsx`**

```tsx
interface SubmittedEntry { hasSubmitted: boolean; valid: boolean; }
interface PlayerLite { id: string; name: string; connected: boolean; }

interface NumbersProgressPanelProps {
  players: PlayerLite[];
  submitted: Record<string, SubmittedEntry>;
}

export const NumbersProgressPanel = ({ players, submitted }: NumbersProgressPanelProps) => {
  const connected = players.filter((p) => p.connected);
  return (
    <aside className="w-80 rounded-3xl border border-white/10 bg-black/30 p-5">
      <p className="eyebrow mb-3">Players</p>
      <ul className="space-y-2">
        {connected.map((p) => {
          const s = submitted[p.id];
          let detail = '⏳ thinking…';
          if (s?.valid) detail = '✓ submitted';
          else if (s) detail = '✗ invalid';
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

- [ ] **Step 4: Verify build**

```bash
cd packages/host && npm run build
```

---

### Task 4.2: `NumbersDisplay.tsx`

**Files:**
- Create: `packages/host/src/screens/NumbersDisplay.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { HostTilePool } from '../components/numbers/HostTilePool';
import { HostTarget } from '../components/numbers/HostTarget';
import { NumbersProgressPanel } from '../components/numbers/NumbersProgressPanel';

interface Player { id: string; name: string; connected: boolean; }

interface NumbersDisplayProps {
  socket: Socket | null;
  players: Player[];
}

type Phase = 'intro' | 'playing' | 'results';

export const NumbersDisplay = ({ socket, players }: NumbersDisplayProps) => {
  const [phase, setPhase] = useState<Phase>('intro');
  const [introData, setIntroData] = useState<any>(null);
  const [roundData, setRoundData] = useState<any>(null);
  const [resultsData, setResultsData] = useState<any>(null);
  const [submitted, setSubmitted] = useState<Record<string, any>>({});
  const [timerMs, setTimerMs] = useState(0);

  useEffect(() => {
    if (!socket) return;
    const onIntro = (d: any) => { setPhase('intro'); setIntroData(d); setSubmitted({}); };
    const onStart = (d: any) => { setPhase('playing'); setRoundData(d); setSubmitted({}); };
    const onProgress = (d: any) => setSubmitted(d.submitted || {});
    const onResults = (d: any) => { setPhase('results'); setResultsData(d); };

    socket.on('numbers:intro', onIntro);
    socket.on('numbers:round:start', onStart);
    socket.on('numbers:progress', onProgress);
    socket.on('numbers:round:results', onResults);

    return () => {
      socket.off('numbers:intro', onIntro);
      socket.off('numbers:round:start', onStart);
      socket.off('numbers:progress', onProgress);
      socket.off('numbers:round:results', onResults);
    };
  }, [socket]);

  useEffect(() => {
    if (phase !== 'playing' || !roundData?.endsAt) return;
    const tick = () => setTimerMs(Math.max(0, roundData.endsAt - Date.now()));
    tick();
    const i = setInterval(tick, 100);
    return () => clearInterval(i);
  }, [phase, roundData]);

  if (phase === 'intro' && introData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center px-16 py-20 text-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl space-y-6">
          <p className="eyebrow text-2xl">Numbers Round</p>
          <h1 className="text-8xl font-bold text-game-leader">{introData.title}</h1>
          <p className="text-3xl text-white">{introData.description}</p>
          <p className="text-xl text-ui-textMuted">{introData.totalRounds} rounds · {Math.round((introData.duration || 8000) / 1000)}s briefing</p>
        </motion.div>
      </div>
    );
  }

  if (phase === 'results' && resultsData) {
    const sorted = [...(resultsData.results || [])].sort((a: any, b: any) => b.cumulativeScore - a.cumulativeScore);
    const top = sorted.slice(0, 5);
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-8 px-16 py-12 text-center">
        <p className="eyebrow text-2xl">Round {resultsData.roundNumber} / {resultsData.totalRounds} — Reveal</p>
        <div>
          <p className="text-2xl text-ui-textMuted">Target</p>
          <p className="text-8xl font-bold text-game-leader">{resultsData.target}</p>
        </div>
        <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-black/40 p-6">
          <p className="eyebrow">Optimal</p>
          <p className="mt-1 text-4xl font-bold text-game-correct">{resultsData.optimal?.expression ?? '—'}</p>
          <p className="text-lg text-ui-textMuted">= {resultsData.optimal?.value ?? '—'} (distance {resultsData.optimal?.distance})</p>
        </div>
        <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-black/40 p-6">
          <p className="eyebrow mb-3">Top of the standings</p>
          <ul className="space-y-2 text-2xl">
            {top.map((r: any, i: number) => (
              <li key={r.playerId} className="flex items-baseline justify-between gap-4">
                <span className="font-bold">#{i + 1} · {r.playerName}</span>
                <span className="text-game-leader">{r.cumulativeScore} pts</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-lg text-ui-textMuted">{resultsData.isLastRound ? 'Wrapping up…' : 'Next round coming…'}</p>
      </div>
    );
  }

  if (phase !== 'playing' || !roundData) {
    return <div className="flex h-screen w-screen items-center justify-center text-2xl">Loading…</div>;
  }

  return (
    <div className="flex h-screen w-screen gap-8 px-12 py-8">
      <main className="flex flex-1 flex-col items-center justify-center gap-10">
        <div className="flex w-full items-baseline justify-between">
          <p className="eyebrow text-xl">Numbers · Round {roundData.roundNumber}/{roundData.totalRounds}</p>
          <p className="tabular-nums text-4xl font-bold text-white">{Math.ceil(timerMs / 1000)}s</p>
        </div>
        <HostTarget target={roundData.target} />
        <HostTilePool tiles={roundData.tiles || []} />
      </main>
      <NumbersProgressPanel players={players} submitted={submitted} />
    </div>
  );
};
```

- [ ] **Step 2: Verify build**

```bash
cd packages/host && npm run build
```

---

### Task 4.3: Route in `Display.tsx`

**Files:**
- Modify: `packages/host/src/screens/Display.tsx`

- [ ] **Step 1: Import**

After the existing themed-dle display import:
```tsx
import { NumbersDisplay } from './NumbersDisplay';
```

- [ ] **Step 2: Add the branch**

After the existing themed-dle branch (the `if ((currentGame === 'pokedle' || currentGame === 'hpdle') && phase === 'playing')` block), add:

```tsx
if (currentGame === 'numbers' && phase === 'playing') {
  return (
    <>
      <NumbersDisplay socket={socket} players={players} />
      {displayControl}
    </>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd packages/host && npm run build
```

- [ ] **Step 4: Commit Phase 4**

```bash
git -C C:/FutureCode/PHoG/.claude/worktrees/elegant-hermann-2af09b add packages/host/src/components/numbers/ packages/host/src/screens/NumbersDisplay.tsx packages/host/src/screens/Display.tsx
git -C C:/FutureCode/PHoG/.claude/worktrees/elegant-hermann-2af09b commit -m "Add host Numbers Round display screen"
```

---

## Phase 5 — Host Dashboard

### Task 5.1: Add Numbers to Dashboard

**Files:**
- Modify: `packages/host/src/screens/Dashboard.tsx`

- [ ] **Step 1: Extend `availableGames`**

Find:
```tsx
const availableGames = [
  { id: 'quiz', name: 'Quiz' },
  { id: 'trueFalse', name: 'True or False' },
  { id: 'pointless', name: 'Pointless' },
  { id: 'pokedle', name: 'Pokédle' },
  { id: 'hpdle', name: 'HP-dle' }
];
```

Replace with:
```tsx
const availableGames = [
  { id: 'quiz', name: 'Quiz' },
  { id: 'trueFalse', name: 'True or False' },
  { id: 'pointless', name: 'Pointless' },
  { id: 'pokedle', name: 'Pokédle' },
  { id: 'hpdle', name: 'HP-dle' },
  { id: 'numbers', name: 'Numbers Round' }
];
```

- [ ] **Step 2: Add start button**

Find the `{!championshipMode && (` block, inside the `<div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">`. After the HP-dle button (`Start HP-dle`), add:

```tsx
<button
  onClick={() => startGame('numbers')}
  disabled={gameState?.phase !== 'lobby'}
  className="btn bg-emerald-600"
>
  Start Numbers Round
</button>
```

- [ ] **Step 3: Verify build**

```bash
cd packages/host && npm run build
```

- [ ] **Step 4: Commit Phase 5**

```bash
git -C C:/FutureCode/PHoG/.claude/worktrees/elegant-hermann-2af09b add packages/host/src/screens/Dashboard.tsx
git -C C:/FutureCode/PHoG/.claude/worktrees/elegant-hermann-2af09b commit -m "Add Numbers Round to host dashboard"
```

---

## Phase 6 — Smoke test

### Task 6.1: Manual end-to-end

This is for the human controller, not subagents. Subagents stop after Phase 5.

- [ ] **Step 1: Start the services**

```powershell
cd C:/FutureCode/PHoG/.claude/worktrees/elegant-hermann-2af09b/packages/server; npm run dev
cd C:/FutureCode/PHoG/.claude/worktrees/elegant-hermann-2af09b/packages/client; npm run dev
cd C:/FutureCode/PHoG/.claude/worktrees/elegant-hermann-2af09b/packages/host;   npm run dev
```

- [ ] **Step 2: Walk a session**

1. Join 1-2 player browsers at `localhost:5173`. Open host dashboard at `localhost:5174` (password from `.env.local`).
2. Click **Start Numbers Round**. Verify intro splash plays for ~8s on both displays.
3. Round 1 begins. Verify on the player phone:
   - 6 tiles visible
   - Target displayed prominently
   - Timer counting down
   - Tapping a tile appends its value to the expression
   - Operator buttons append `+ − × ÷ ( )`
   - Submitting an expression you know hits the target (e.g. tiles `75 25 7 4 …` target `696` → `(75+25)*7-4`) returns `✓ submitted`
   - Submitting an invalid expression returns `✗ <error>`
4. Wait for the round timer or auto-end (when all players submit valid). Verify reveal splash shows the optimal solution + your score.
5. Round 2 starts automatically. Repeat through all 5 rounds.
6. After round 5, `game:end` fires → final leaderboard shows. Verify Pokédle/HP-dle/Numbers all appear in the placement summary panel on the player phone.

- [ ] **Step 3: Edge cases**

- Submit an expression that uses a tile you don't have: should reject with "tile multiset mismatch"
- Submit `3 - 5`: should reject with "negative intermediate"
- Submit `10 / 3`: should reject with "non-integer division"
- Submit nothing in a round: shows "No submission this round" in the reveal, 0 points
- Return-to-lobby mid-game: works

---

## Self-Review Checklist

Run before declaring the plan ready for execution:

1. **Spec coverage:**
   - Tile draw rules (4 large + 20 small, 0–4 large per round) — Task 1.1 ✓
   - Target range 100–999 — Task 1.1 ✓
   - Exact-solvable validation — Task 1.3 (`canHitTarget`) used in Task 2.1 (`generateRound`) ✓
   - Expression rules (operators, tile multiset, no negatives, no fractions, claimed value matches) — Tasks 1.2 and 2.1 ✓
   - 5 rounds × 45s — Task 2.1 constants ✓
   - Scoring tiers 50 / 30 / 15 / 0 + first-exact bonus +10 — Task 2.1 `scoreSubmission` + `_firstExactPlayerId` ✓
   - One placement per game session (cumulative score → engine placement) — Task 2.1 `_endRound` sets `player.score = cumulative` ✓
   - Solver doubles as optimal reveal — Task 1.3 `findOptimal` used in Task 2.1 `_endRound` ✓
   - Client UI: tile pool, target, expression input — Phase 3 ✓
   - Host display: spectacle view + per-player progress — Phase 4 ✓
   - Dashboard button — Phase 5 ✓
2. **Placeholder scan:** searched for "TBD", "TODO", "implement later" — none.
3. **Type consistency:** `'numbers'` literal added consistently across server validGames, scoring placements, client gameStore, FinalLeaderboard, Display.tsx, Dashboard.tsx, RoundLeaderboardOverlay.
4. **Ambiguity check:** the "first-correct bonus" is awarded server-side at the moment of the first exact-distance submission — documented in Task 2.1.
