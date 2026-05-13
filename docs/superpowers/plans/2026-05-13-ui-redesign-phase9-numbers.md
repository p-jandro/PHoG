# PHoG UI Redesign — Phase 9: Numbers + NumbersDisplay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the player-side Numbers screen and host-side NumbersDisplay to the new design system. Replace the existing dark-on-cream tokens with the new primitive library (`Button`, `Card`, `Chip`, `Pill`, `LeaderboardRow`, motion utilities) and apply the spec's digit-roll animation to the per-round score reveal. Bring the host screen onto the canonical host skeleton (location top-left, time-left top-right, content centre, player tracker bottom).

**Scope:**
- Player: `packages/client/src/screens/Numbers.tsx` plus the five `packages/client/src/components/numbers/*` siblings.
- Host: `packages/host/src/screens/NumbersDisplay.tsx` plus the three `packages/host/src/components/numbers/*` siblings.
- A new co-located `DigitRoll` component (one per surface — client + host) that drives the spec's "each digit cycles 0–9 then lands with overshoot, 300ms ease-out" reveal. Lives in `components/numbers/`, not in the foundation primitives (it's Numbers-specific).
- A new co-located `NumberTile` (client) / `HostNumberTile` (host) that wraps the foundation visual language for the Numbers tile pool. The foundation `Tile` primitive is letter-shaped (uppercase, `idle/correct/partial/wrong`) and not a good drop-in here, so we build a small chunky-button sibling that matches the same shadow/border vocabulary.

**Architecture:** No server changes. The server already emits `numbers:progress` with `{ solved, operations }` per player — that's enough to drive three of the four spec labels (`solved`, `in progress`, `no submission`). The fourth — "closest so far (475)" — would require the server to track per-player best value, which is **out of scope** for this UI plan. We render "in progress · N operation(s)" as a faithful proxy until a later (server-side) plan extends the progress payload. The spec text is treated as the future target, and the plan note flags this gap.

**Tech stack:** React 18 · TypeScript 5.3 · Tailwind 3.4 · framer-motion 10 · existing redesign primitives in `src/ui/*` and `src/lib/motion.ts`.

**Spec references:**
- [docs/superpowers/specs/2026-05-13-ui-redesign-design.md §3](../specs/2026-05-13-ui-redesign-design.md) — primitives
- §4.4 — Numbers: "digit roll — each digit cycles 0–9 then lands with small overshoot, 300ms ease-out"
- §7.1 — Numbers player screen
- §7.3 — Host skeleton + NumbersDisplay

**Foundation plan:** `docs/superpowers/plans/2026-05-13-ui-redesign-foundation.md` — already shipped. All primitives + motion tokens listed below are available on both surfaces.

**Out of scope:**
- Any change to `packages/server/src/games/numbers.js` or its helpers.
- Migrating any other game's screens (those are their own phases).
- A new "closest so far" server-emitted distance value — needs its own server-side plan.
- Removing the legacy `screen-shell` / `eyebrow` / `screen-frame` utility classes from `index.css` (kept alive for screens still on the old design; final removal is the polish PR).
- `prefers-reduced-motion` substitutions — also the polish PR (the components consume motion tokens that already respect it).

---

## File map

**Client (`packages/client/`):**

| Path | Action | Why |
|---|---|---|
| `src/screens/Numbers.tsx` | Modify | Rebuild intro / playing / results phases using `Card`, `Button`, `Pill`, `Chip`, new `DigitRoll` |
| `src/components/numbers/TargetDisplay.tsx` | Modify | Replace bordered-dark card with sun-yellow (`bg-now`) chunky card per §7.1 |
| `src/components/numbers/TilePool.tsx` | Modify | Replace inline styling with `NumberTile`; preserve A-selection contract |
| `src/components/numbers/NumberTile.tsx` | Create | Co-located tile component (chunky borders, ink shadow, `idle`/`selected`/`used` states) |
| `src/components/numbers/OperationBuilder.tsx` | Modify | Use foundation `Button` for operators + actions; use `Card` for the expression slot strip |
| `src/components/numbers/HistoryList.tsx` | Modify | Use `Card` + new tokens; keep AnimatePresence reveals |
| `src/components/numbers/RoundResults.tsx` | Modify | Use `Card` for the layout panels; drive the cumulative-score number through `DigitRoll`; use `LeaderboardRow`-like styling for "your round" highlight |
| `src/components/numbers/DigitRoll.tsx` | Create | Reusable spec-compliant digit-roll reveal (300ms ease-out with overshoot) |

**Host (`packages/host/`):**

| Path | Action | Why |
|---|---|---|
| `src/screens/NumbersDisplay.tsx` | Modify | Apply the canonical host skeleton (location top-left, time-left top-right, content centre, player tracker bottom); replace ad-hoc panels with primitives |
| `src/components/numbers/HostTarget.tsx` | Modify | Use sun-yellow (`bg-now`) chunky card; Inter Tight display digits |
| `src/components/numbers/HostTilePool.tsx` | Modify | Use shared chunky-tile styling; TV-sized |
| `src/components/numbers/HostNumberTile.tsx` | Create | TV-scale tile (host's `NumberTile` analog) |
| `src/components/numbers/NumbersProgressPanel.tsx` | Modify | Rebuild as the bottom-of-screen player tracker per §7.3 (status labels: "solved", "in progress · N op(s)", "no submission"); use `Pill` per row |
| `src/components/numbers/DigitRoll.tsx` | Create | Mirror of the client one (host duplicates the kit per foundation §6.1) |

No other client/host files are touched. App.tsx, gameStore, RoundLeaderboardOverlay — all unchanged.

---

## Conventions

- **Worktree:** `C:/FutureCode/PHoG/.claude/worktrees/eager-villani-da47cb`. Branch: `claude/eager-villani-da47cb`.
- **Builds:** `npm run build` must pass in `packages/client` and `packages/host` after every commit. Server build is untouched.
- **Commit style:** short imperative — `feat(client): …`, `feat(host): …`, `refactor(client): …`.
- **No tests added.** No client/host test framework outside the foundation's theme tests; we verify by smoke-test (dev server + a Numbers playthrough).
- **Token discipline:** every new className references redesign tokens (`bg-now`, `bg-action`, `text-ink`, `border-ink`, `shadow-ink`, etc.). No raw hex, no old `text-game-*` / `bg-ui-*` tokens in touched files. (Legacy tokens remain defined for *other* screens that are not yet migrated.)
- **Player-side Numbers does not currently have a `theme-toggle` slot.** Per spec §5.6 the toggle is "tucked into a `⋯` menu during active gameplay." Adding that menu is a Lobby/shared-component concern, not Numbers-specific — leave it for a later phase.

---

## Tasks

### Task 1: Create the `DigitRoll` reveal component (client)

**Files:**
- Create: `packages/client/src/components/numbers/DigitRoll.tsx`

The component animates each digit position independently — left-to-right reading order, each digit cycles 0–9, lands with overshoot. Spec: 300ms ease-out (back-out for the overshoot bounce). Driven by framer-motion `animate` on a `y` translate inside an `overflow-hidden` mask, so digit faces stack vertically and slide.

- [ ] **Step 1: Create `packages/client/src/components/numbers/DigitRoll.tsx`**

```tsx
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { easing } from '../../lib/motion';

/**
 * DigitRoll — animates each digit independently from 0 → final digit.
 * Spec §4.4: each digit cycles 0–9 and lands with a small overshoot, 300ms ease-out.
 * We use `easing.backOut` (cubic-bezier .34, 1.56, .64, 1) to get the overshoot.
 *
 * Reading order: left → right (later digits land later, 80ms stagger).
 */
interface DigitRollProps {
  value: number;
  /** Optional className for the wrapping flex container (digits + sign). */
  className?: string;
  /** How tall is one digit. Match this to the surrounding text size in px. */
  digitHeightPx?: number;
  /** Extra stagger per digit position (ms). */
  staggerMs?: number;
}

export function DigitRoll({
  value,
  className = '',
  digitHeightPx = 64,
  staggerMs = 80,
}: DigitRollProps) {
  // Render only the digits — sign is handled separately so negatives still roll.
  const display = useMemo(() => Math.abs(Math.round(value)).toString(), [value]);
  const negative = value < 0;
  const digits = display.split('').map((c) => parseInt(c, 10));

  return (
    <span className={['inline-flex items-baseline tabular-nums', className].join(' ')}>
      {negative && <span aria-hidden="true">−</span>}
      <span className="sr-only">{value}</span>
      {digits.map((d, i) => (
        <span
          key={`${i}-${d}`}
          aria-hidden="true"
          className="inline-block overflow-hidden"
          style={{ height: digitHeightPx, lineHeight: `${digitHeightPx}px` }}
        >
          <motion.span
            className="block"
            initial={{ y: 0 }}
            animate={{ y: -d * digitHeightPx }}
            transition={{
              duration: 0.3,
              ease: easing.backOut,
              delay: (i * staggerMs) / 1000,
            }}
          >
            {Array.from({ length: 10 }, (_, n) => (
              <span key={n} className="block" style={{ height: digitHeightPx }}>{n}</span>
            ))}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
```

Notes:
- We render the full 0–9 stack and translate by `-d * digitHeightPx`. Each digit position runs the full reveal (so a `476` shows `0→4`, `0→7`, `0→6` simultaneously, with 0/80/160ms delays).
- `easing.backOut = [0.34, 1.56, 0.64, 1]` from `lib/motion.ts` gives the spec's "small overshoot."
- `tabular-nums` keeps the digit columns aligned even mid-roll.
- We pass the literal `value` to an `sr-only` span so screen readers announce it instantly without sitting through the roll.
- `key={`${i}-${d}`}` re-mounts the digit if it changes, retriggering the roll — desirable when the score updates from round to round.

- [ ] **Step 2: Build**

```bash
cd packages/client && npm run build
```

Expected: build succeeds. Component isn't used yet, but TypeScript must compile.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/numbers/DigitRoll.tsx
git commit -m "feat(client): add DigitRoll reveal component for Numbers score animation"
```

---

### Task 2: Create the `NumberTile` co-located component (client)

**Files:**
- Create: `packages/client/src/components/numbers/NumberTile.tsx`

A chunky button tile sharing the foundation visual vocabulary (2px ink border, hard shadow, sun/cream/ink palette). Not a foundation primitive because it's specific to the Numbers tile pool's selection/used semantics.

- [ ] **Step 1: Create `packages/client/src/components/numbers/NumberTile.tsx`**

```tsx
import { motion } from 'framer-motion';

export type NumberTileState = 'idle' | 'selected' | 'used';

interface NumberTileProps {
  value: number;
  state?: NumberTileState;
  disabled?: boolean;
  onClick?: () => void;
}

const STATE_CLS: Record<NumberTileState, string> = {
  // Idle: cream surface, ink ink-shadow — chunky and tappable.
  idle:     'bg-bg-surface text-ink hover:-translate-y-px',
  // Selected: sun-yellow, indicates it's the A-operand awaiting an operator.
  selected: 'bg-now text-on-now ring-4 ring-info/40',
  // Used: dimmed sunken background — visible but clearly out of the pool.
  used:     'bg-bg-sunken text-ink-muted opacity-40 pointer-events-none',
};

export function NumberTile({
  value, state = 'idle', disabled = false, onClick,
}: NumberTileProps) {
  return (
    <motion.button
      type="button"
      whileTap={!disabled && state !== 'used' ? { x: 4, y: 4 } : undefined}
      transition={{ duration: 0.08, ease: [0, 0, 0.2, 1] }}
      disabled={disabled || state === 'used'}
      onClick={onClick}
      className={[
        'inline-flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center',
        'rounded-2xl border-2 border-ink shadow-ink',
        'font-display text-3xl sm:text-4xl font-extrabold tabular-nums',
        'focus-visible:outline-2 focus-visible:outline-info focus-visible:outline-offset-[3px]',
        'disabled:cursor-not-allowed',
        STATE_CLS[state],
      ].join(' ')}
    >
      {value}
    </motion.button>
  );
}
```

Notes:
- Same shadow/border vocabulary as foundation `Button` — chunky and consistent.
- Three states cover the spec: idle (available), selected ("possibly selected"), used.
- `font-display` = Inter Tight, per the spec's "big Inter Tight digits".

- [ ] **Step 2: Build**

```bash
cd packages/client && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/numbers/NumberTile.tsx
git commit -m "feat(client): add NumberTile co-located component for Numbers tile pool"
```

---

### Task 3: Migrate `TilePool.tsx` to use `NumberTile`

**Files:**
- Modify: `packages/client/src/components/numbers/TilePool.tsx`

- [ ] **Step 1: Replace `packages/client/src/components/numbers/TilePool.tsx`**

```tsx
import { motion, AnimatePresence } from 'framer-motion';
import { NumberTile } from './NumberTile';

export interface Tile { id: string; value: number; }

interface TilePoolProps {
  tiles: Tile[];
  /** Full original pool — anything in `tiles` is "available", anything missing is "used". */
  originalTiles?: Tile[];
  selectedId: string | null;
  pendingBId?: string | null;
  onTileClick: (id: string) => void;
  disabled?: boolean;
}

export const TilePool = ({
  tiles, originalTiles, selectedId, onTileClick, disabled,
}: TilePoolProps) => {
  // If we don't have the original pool, just render whatever is here.
  const slots = originalTiles ?? tiles;
  const aliveIds = new Set(tiles.map((t) => t.id));

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      <AnimatePresence>
        {slots.map((t) => {
          const isAlive = aliveIds.has(t.id);
          const state = !isAlive ? 'used' : selectedId === t.id ? 'selected' : 'idle';
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.4 }}
              transition={{ duration: 0.25 }}
            >
              <NumberTile
                value={t.value}
                state={state}
                disabled={disabled}
                onClick={() => onTileClick(t.id)}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
```

Notes:
- The component now optionally takes `originalTiles` so we can render the full 6-slot strip with greyed-out "used" tiles per the spec. If callers don't pass it, behavior matches the old `tiles`-only path (back-compat).
- A "used" tile is shown but disabled. (Server-driven: any tile present in `originalTiles` but absent from `tiles` has been consumed.)

- [ ] **Step 2: Build**

```bash
cd packages/client && npm run build
```

Build must pass. The screen still compiles because the new `originalTiles` prop is optional.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/numbers/TilePool.tsx
git commit -m "refactor(client): TilePool uses NumberTile and supports used/idle/selected states"
```

---

### Task 4: Migrate `TargetDisplay.tsx` to the sun-yellow card

**Files:**
- Modify: `packages/client/src/components/numbers/TargetDisplay.tsx`

- [ ] **Step 1: Replace `packages/client/src/components/numbers/TargetDisplay.tsx`**

```tsx
interface TargetDisplayProps {
  target: number;
}

/**
 * Chunky sun-yellow target card. Spec §7.1: "target shown as a chunky sun-yellow
 * card (bg-now), big Inter Tight digits."
 *
 * We intentionally DO NOT digit-roll the target on initial reveal — the target
 * is a fixed value for the round, not a score reveal. DigitRoll is reserved
 * for the score-reveal moment (RoundResults).
 */
export const TargetDisplay = ({ target }: TargetDisplayProps) => (
  <div className="rounded-3xl border-2 border-ink bg-now px-6 py-4 text-center shadow-ink-lg">
    <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-on-now/80">Target</p>
    <p className="mt-1 font-display text-7xl font-extrabold leading-none tabular-nums text-on-now sm:text-8xl">
      {target}
    </p>
  </div>
);
```

- [ ] **Step 2: Build**

```bash
cd packages/client && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/numbers/TargetDisplay.tsx
git commit -m "feat(client): TargetDisplay uses sun-yellow chunky card with Inter Tight digits"
```

---

### Task 5: Migrate `OperationBuilder.tsx` to foundation primitives

**Files:**
- Modify: `packages/client/src/components/numbers/OperationBuilder.tsx`

The slots become an Input-like strip; the operator and action buttons become foundation `Button`s.

- [ ] **Step 1: Replace `packages/client/src/components/numbers/OperationBuilder.tsx`**

```tsx
import { Button } from '../../ui/Button';

interface OperationBuilderProps {
  aValue: number | null;
  op: string | null;
  bValue: number | null;
  onOperator: (op: string) => void;
  onCancel: () => void;
  onReset: () => void;
  disabled?: boolean;
  errorToast?: string | null;
}

const OP_BUTTONS: Array<{ value: string; label: string }> = [
  { value: '+', label: '+' },
  { value: '-', label: '−' },
  { value: '*', label: '×' },
  { value: '/', label: '÷' },
];

const Slot = ({ value, highlight }: { value: number | null | string; highlight?: boolean }) => {
  const filled = value !== null && value !== '';
  return (
    <div
      className={[
        'flex h-16 flex-1 items-center justify-center rounded-xl border-2 font-display text-2xl font-extrabold tabular-nums',
        filled
          ? highlight
            ? 'border-ink bg-now text-on-now shadow-ink'
            : 'border-ink bg-bg-surface text-ink shadow-ink'
          : 'border-dashed border-ink/30 bg-bg-sunken text-ink-muted',
      ].join(' ')}
    >
      {filled ? value : '…'}
    </div>
  );
};

export const OperationBuilder = ({
  aValue, op, bValue, onOperator, onCancel, onReset, disabled, errorToast,
}: OperationBuilderProps) => {
  const aSet = aValue !== null;
  const opSet = op !== null;
  const opLabel = op === '*' ? '×' : op === '/' ? '÷' : op === '-' ? '−' : op;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Slot value={aValue} highlight={aSet && !opSet} />
        <Slot value={opLabel ?? null} />
        <Slot value={bValue} />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {OP_BUTTONS.map((o) => (
          <Button
            key={o.value}
            variant={op === o.value ? 'now' : 'ghost'}
            size="md"
            disabled={disabled || !aSet}
            onClick={() => onOperator(o.value)}
            className="border-2 border-ink"
          >
            {o.label}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="ghost"
          size="md"
          onClick={onCancel}
          disabled={disabled || !aSet}
          className="border-2 border-ink"
        >
          Deselect
        </Button>
        <Button
          variant="danger"
          size="md"
          onClick={onReset}
          disabled={disabled}
        >
          Reset tiles
        </Button>
      </div>
      {errorToast && (
        <div className="rounded-xl border-2 border-ink bg-danger px-3 py-2 text-center text-sm font-bold text-on-danger shadow-ink-sm">
          {errorToast}
        </div>
      )}
    </div>
  );
};
```

Notes:
- `variant="ghost"` for operator buttons in their inactive state — foundation ghost is `bg-transparent text-ink`; we add `border-2 border-ink` so they still have a visible chunky outline.
- Operator's active state uses `variant="now"` to match the sun-yellow "this is your choice" feedback.
- `Reset tiles` keeps the destructive variant; `Deselect` is ghost.

- [ ] **Step 2: Build**

```bash
cd packages/client && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/numbers/OperationBuilder.tsx
git commit -m "refactor(client): OperationBuilder uses foundation Button + ink tokens"
```

---

### Task 6: Migrate `HistoryList.tsx` to foundation tokens

**Files:**
- Modify: `packages/client/src/components/numbers/HistoryList.tsx`

- [ ] **Step 1: Replace `packages/client/src/components/numbers/HistoryList.tsx`**

```tsx
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../../ui/Card';

export interface OperationEntry {
  aValue: number;
  bValue: number;
  op: string;
  result: number;
}

interface HistoryListProps {
  history: OperationEntry[];
}

const symbol = (op: string) =>
  op === '*' ? '×' : op === '/' ? '÷' : op === '-' ? '−' : op;

export const HistoryList = ({ history }: HistoryListProps) => (
  <Card eyebrow="History" className="p-3">
    {history.length === 0 ? (
      <p className="py-2 text-center text-sm italic text-ink-muted">Your history will appear here…</p>
    ) : (
      <ol className="space-y-1">
        <AnimatePresence initial={false}>
          {history.map((h, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-baseline justify-between gap-3 rounded-lg border-2 border-ink bg-bg-surface px-3 py-1.5 text-base tabular-nums shadow-ink-sm"
            >
              <span className="text-ink">
                <span className="font-extrabold">{h.aValue}</span>
                <span className="mx-2 text-ink-muted">{symbol(h.op)}</span>
                <span className="font-extrabold">{h.bValue}</span>
              </span>
              <span className="text-action">= <span className="font-extrabold">{h.result}</span></span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    )}
  </Card>
);
```

- [ ] **Step 2: Build**

```bash
cd packages/client && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/numbers/HistoryList.tsx
git commit -m "refactor(client): HistoryList uses Card + ink tokens"
```

---

### Task 7: Migrate `RoundResults.tsx` with digit-roll score reveal

**Files:**
- Modify: `packages/client/src/components/numbers/RoundResults.tsx`

The cumulative score is rendered via `DigitRoll` — its `key` re-mount on round transitions retriggers the spec's 300ms ease-out reveal.

- [ ] **Step 1: Replace `packages/client/src/components/numbers/RoundResults.tsx`**

```tsx
import { motion } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';
import { Card } from '../../ui/Card';
import { Chip } from '../../ui/Chip';
import { DigitRoll } from './DigitRoll';

interface RoundResultsProps {
  data: {
    roundNumber: number;
    totalRounds: number;
    difficulty: string;
    target: number;
    tiles: number[];
    optimal: { found: boolean; distance: number; value: number | null; expression: string | null };
    results: Array<{
      playerId: string;
      playerName: string;
      roundScore: number;
      cumulativeScore: number;
      solved: boolean;
      operations: number;
      firstSolver: boolean;
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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-2xl space-y-5"
    >
      <div className="flex items-center justify-center gap-2">
        <Chip variant="muted">Round {data.roundNumber} / {data.totalRounds}</Chip>
        <Chip variant="streak">{data.difficulty}</Chip>
      </div>

      <Card className="text-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">Target was</p>
        <p className="mt-1 font-display text-7xl font-extrabold leading-none tabular-nums text-ink">
          {data.target}
        </p>
      </Card>

      <Card eyebrow="One optimal solution" className="text-center">
        <p className="mt-1 font-display text-3xl font-extrabold text-action">
          {data.optimal.expression ?? '—'} = {data.optimal.value ?? '—'}
        </p>
      </Card>

      <Card eyebrow="Your round" className="text-center">
        {me ? (
          <>
            <p className="text-lg text-ink">
              {me.solved ? `✓ solved in ${me.operations} operation${me.operations === 1 ? '' : 's'}` : '✗ not solved'}
            </p>
            <p className="mt-2 font-display text-4xl font-extrabold text-ink">
              +<DigitRoll value={me.roundScore} digitHeightPx={40} />
              {me.firstSolver && <span className="ml-2 text-xl text-streak">first!</span>}
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              cumulative: <DigitRoll value={me.cumulativeScore} digitHeightPx={16} />
            </p>
          </>
        ) : (
          <p className="text-ink-muted">No round result.</p>
        )}
      </Card>

      <p className="text-center text-sm text-ink-muted">
        {data.isLastRound ? 'Game wrapping up…' : 'Next round coming…'}
      </p>
    </motion.div>
  );
};
```

Notes:
- Two `DigitRoll` calls: one for `roundScore`, one for `cumulativeScore`. Reading order is enforced left-to-right by `DigitRoll`'s internal stagger.
- `digitHeightPx` is matched to surrounding text size: 40px for the big `text-4xl` line, 16px for the small `text-sm` cumulative line. (Tailwind's text-4xl is ~36px and text-sm is ~14px — we round up for clean integer math; visually the roll fits snugly.)
- We didn't render every player's result panel — the old screen only showed "your round", and the spec doesn't add a public leaderboard here (that's `RoundLeaderboardOverlay`'s job, untouched).

- [ ] **Step 2: Build**

```bash
cd packages/client && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/numbers/RoundResults.tsx
git commit -m "feat(client): RoundResults uses Card primitives and DigitRoll score reveal"
```

---

### Task 8: Migrate `screens/Numbers.tsx` to new tokens and primitives

**Files:**
- Modify: `packages/client/src/screens/Numbers.tsx`

Rebuild the intro splash and playing phase against the new tokens. Pass `originalTiles` to `TilePool` so used tiles render as ghosted slots.

- [ ] **Step 1: Replace `packages/client/src/screens/Numbers.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import { TilePool, Tile } from '../components/numbers/TilePool';
import { TargetDisplay } from '../components/numbers/TargetDisplay';
import { OperationBuilder } from '../components/numbers/OperationBuilder';
import { RoundResults } from '../components/numbers/RoundResults';
import { HistoryList, OperationEntry } from '../components/numbers/HistoryList';
import { Card } from '../ui/Card';
import { Chip } from '../ui/Chip';

type Phase = 'intro' | 'playing' | 'results';

interface NumbersProps {
  socket: Socket | null;
}

export const Numbers = ({ socket }: NumbersProps) => {
  useGameStore();
  const [phase, setPhase] = useState<Phase>('intro');
  const [introData, setIntroData] = useState<any>(null);
  const [roundData, setRoundData] = useState<any>(null);
  const [resultsData, setResultsData] = useState<any>(null);
  const [pool, setPool] = useState<Tile[]>([]);
  const [originalTiles, setOriginalTiles] = useState<Tile[]>([]);
  const [history, setHistory] = useState<OperationEntry[]>([]);
  const [selectedAId, setSelectedAId] = useState<string | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [timerMs, setTimerMs] = useState(0);

  useEffect(() => {
    if (phase !== 'playing' || !roundData?.endsAt) return;
    const tick = () => setTimerMs(Math.max(0, roundData.endsAt - Date.now()));
    tick();
    const i = setInterval(tick, 100);
    return () => clearInterval(i);
  }, [phase, roundData]);

  useEffect(() => {
    if (!socket) return;
    const onIntro = (d: any) => {
      setPhase('intro');
      setIntroData(d);
      setPool([]);
      setOriginalTiles([]);
      setHistory([]);
      setSelectedAId(null);
      setOp(null);
      setSolved(false);
    };
    const onStart = (d: any) => {
      setPhase('playing');
      setRoundData(d);
      const tiles = d.tiles || [];
      setPool(tiles);
      setOriginalTiles(tiles);
      setHistory([]);
      setSelectedAId(null);
      setOp(null);
      setSolved(false);
    };
    const onAck = (d: any) => {
      if (!d.accepted) {
        setErrorToast(d.error || 'invalid');
        setTimeout(() => setErrorToast(null), 2200);
        return;
      }
      if (Array.isArray(d.pool)) setPool(d.pool);
      // Reset event from server: restore original tile pool.
      if (d.reset && Array.isArray(d.pool)) setOriginalTiles(d.pool);
      if (Array.isArray(d.history)) {
        setHistory(d.history.map((h: any) => ({
          aValue: h.aValue, bValue: h.bValue, op: h.op, result: h.result,
        })));
      }
      setSelectedAId(null);
      setOp(null);
      if (d.solved) setSolved(true);
    };
    const onResults = (d: any) => {
      setPhase('results');
      setResultsData(d);
    };
    socket.on('numbers:intro', onIntro);
    socket.on('numbers:round:start', onStart);
    socket.on('numbers:operation:ack', onAck);
    socket.on('numbers:round:results', onResults);
    return () => {
      socket.off('numbers:intro', onIntro);
      socket.off('numbers:round:start', onStart);
      socket.off('numbers:operation:ack', onAck);
      socket.off('numbers:round:results', onResults);
    };
  }, [socket]);

  const target = roundData?.target;
  const totalMs = roundData?.duration || 60000;
  const progress = totalMs > 0 ? Math.max(0, Math.min(100, (timerMs / totalMs) * 100)) : 0;
  const aTile = pool.find((t) => t.id === selectedAId) || null;

  const handleTileClick = (id: string) => {
    if (solved) return;
    if (!selectedAId) { setSelectedAId(id); setOp(null); return; }
    if (selectedAId === id) { setSelectedAId(null); setOp(null); return; }
    if (!op) { setSelectedAId(id); return; }
    socket?.emit('numbers:operation', { aId: selectedAId, op, bId: id });
  };

  const handleOperator = (newOp: string) => {
    if (!selectedAId || solved) return;
    setOp(newOp);
  };

  const handleCancel = () => { setSelectedAId(null); setOp(null); };
  const handleReset = () => {
    socket?.emit('numbers:reset', {});
    setSelectedAId(null);
    setOp(null);
    setSolved(false);
  };

  // Intro splash
  if (phase === 'intro' && introData) {
    return (
      <div className="min-h-screen bg-bg-base px-4 py-6 flex flex-col items-center justify-center sm:px-6 sm:py-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mx-auto w-full max-w-2xl space-y-4 text-center"
        >
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-streak">Game starting</p>
          <h1 className="font-serif text-5xl font-extrabold text-ink">{introData.title}</h1>
          <p className="text-xl text-ink-muted">{introData.description}</p>
          {Array.isArray(introData.scoringRules) && (
            <ul className="mx-auto max-w-md space-y-1 text-left text-base">
              {introData.scoringRules.map((r: string) => (
                <li key={r} className="rounded-xl border-2 border-ink bg-bg-surface px-3 py-2 text-ink shadow-ink-sm">
                  {r}
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm text-ink-muted">{introData.totalRounds} rounds · easy → medium → difficult</p>
        </motion.div>
      </div>
    );
  }

  // Results splash
  if (phase === 'results' && resultsData) {
    return (
      <div className="min-h-screen bg-bg-base px-4 py-6 flex flex-col items-center justify-center sm:px-6 sm:py-8">
        <RoundResults data={resultsData} />
      </div>
    );
  }

  // Playing
  if (phase === 'playing' && roundData) {
    return (
      <div className="min-h-screen bg-bg-base px-4 py-4 sm:px-6">
        <div className="mx-auto w-full max-w-2xl space-y-4">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Chip variant="muted">Numbers · Round {roundData.roundNumber}/{roundData.totalRounds}</Chip>
              <Chip variant="streak">{roundData.difficulty}</Chip>
            </div>
            <p className="font-display text-3xl font-extrabold tabular-nums text-ink">
              {Math.ceil(timerMs / 1000)}s
            </p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full border-2 border-ink bg-bg-sunken">
            <div className="h-full bg-action transition-[width] duration-100" style={{ width: `${progress}%` }} />
          </div>

          <TargetDisplay target={target} />

          <Card eyebrow="Tiles" className="p-4">
            <TilePool
              tiles={pool}
              originalTiles={originalTiles}
              selectedId={selectedAId}
              onTileClick={handleTileClick}
              disabled={solved}
            />
          </Card>

          <OperationBuilder
            aValue={aTile?.value ?? null}
            op={op}
            bValue={null}
            onOperator={handleOperator}
            onCancel={handleCancel}
            onReset={handleReset}
            disabled={solved}
            errorToast={errorToast}
          />

          <HistoryList history={history} />

          {solved && (
            <p className="text-center font-display text-3xl font-extrabold text-action">
              reached {target}!
            </p>
          )}
        </div>
      </div>
    );
  }

  // Loading fallback
  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center">
      <Card className="max-w-md text-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-streak">Numbers Round</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold text-ink">Loading…</h1>
      </Card>
    </div>
  );
};
```

Notes:
- `bg-bg-base` is the new base (sun-cream in light, ink in dark). Old screens still on the old design use `bg-ui-background`; we leave them alone.
- The progress bar is now a chunky ink-bordered track filling with `bg-action` (grass green) — fits the bold-and-playful aesthetic.
- Operations are unchanged (selection contract preserved).
- We now thread `originalTiles` into `TilePool` so used tiles render as ghosted slots.

- [ ] **Step 2: Build + dev smoke**

```bash
cd packages/client && npm run build
```

Then `npm run dev` from the repo root (or per the existing setup), launch a 2-player Numbers round, verify:
1. Intro splash renders with serif heading and ink-bordered list items.
2. Playing screen: target is a sun-yellow chunky card; tiles are cream chunky buttons; used tiles fade and become unclickable; operator buttons land in sun-yellow when selected.
3. Submit valid operation: tile vanishes, history grows.
4. Submit invalid: red toast appears, vanishes after ~2s.
5. Solve: "reached N!" line appears in grass green.
6. End of round: results card stack appears; `roundScore` and `cumulativeScore` digit-roll in (each digit cycles 0–9, lands with overshoot).

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/screens/Numbers.tsx
git commit -m "feat(client): migrate Numbers screen to redesign tokens and primitives"
```

---

### Task 9: Create the host-side `DigitRoll` and `HostNumberTile`

**Files:**
- Create: `packages/host/src/components/numbers/DigitRoll.tsx`
- Create: `packages/host/src/components/numbers/HostNumberTile.tsx`

Mirror of the client artifacts, scaled for TV. Foundation §6.1 mandates duplication: the host owns its copy.

- [ ] **Step 1: Create `packages/host/src/components/numbers/DigitRoll.tsx`**

Identical content to the client version, but the `easing` import points at the host's `lib/motion`:

```tsx
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { easing } from '../../lib/motion';

interface DigitRollProps {
  value: number;
  className?: string;
  digitHeightPx?: number;
  staggerMs?: number;
}

export function DigitRoll({
  value,
  className = '',
  digitHeightPx = 128,
  staggerMs = 80,
}: DigitRollProps) {
  const display = useMemo(() => Math.abs(Math.round(value)).toString(), [value]);
  const negative = value < 0;
  const digits = display.split('').map((c) => parseInt(c, 10));

  return (
    <span className={['inline-flex items-baseline tabular-nums', className].join(' ')}>
      {negative && <span aria-hidden="true">−</span>}
      <span className="sr-only">{value}</span>
      {digits.map((d, i) => (
        <span
          key={`${i}-${d}`}
          aria-hidden="true"
          className="inline-block overflow-hidden"
          style={{ height: digitHeightPx, lineHeight: `${digitHeightPx}px` }}
        >
          <motion.span
            className="block"
            initial={{ y: 0 }}
            animate={{ y: -d * digitHeightPx }}
            transition={{
              duration: 0.3,
              ease: easing.backOut,
              delay: (i * staggerMs) / 1000,
            }}
          >
            {Array.from({ length: 10 }, (_, n) => (
              <span key={n} className="block" style={{ height: digitHeightPx }}>{n}</span>
            ))}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
```

Default `digitHeightPx` is 128 — TV-scaled.

- [ ] **Step 2: Create `packages/host/src/components/numbers/HostNumberTile.tsx`**

```tsx
interface HostNumberTileProps {
  value: number;
}

/**
 * TV-scale chunky tile for the host's pool display.
 * Big-number tiles (≥25) get a sun-yellow accent so the player sees them clearly across the room.
 */
export const HostNumberTile = ({ value }: HostNumberTileProps) => {
  const big = value >= 25;
  return (
    <div
      className={[
        'flex h-32 w-32 items-center justify-center rounded-3xl border-4 border-ink shadow-ink-lg',
        'font-display text-6xl font-extrabold tabular-nums',
        big ? 'bg-now text-on-now' : 'bg-bg-surface text-ink',
      ].join(' ')}
    >
      {value}
    </div>
  );
};
```

- [ ] **Step 3: Build**

```bash
cd packages/host && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add packages/host/src/components/numbers/DigitRoll.tsx packages/host/src/components/numbers/HostNumberTile.tsx
git commit -m "feat(host): add DigitRoll and HostNumberTile co-located components for Numbers"
```

---

### Task 10: Migrate `HostTarget.tsx` and `HostTilePool.tsx`

**Files:**
- Modify: `packages/host/src/components/numbers/HostTarget.tsx`
- Modify: `packages/host/src/components/numbers/HostTilePool.tsx`

- [ ] **Step 1: Replace `packages/host/src/components/numbers/HostTarget.tsx`**

```tsx
interface HostTargetProps { target: number; }

/**
 * TV-scale sun-yellow target card. Spec §7.3 keeps the player-facing tone:
 * big bold target front and centre.
 */
export const HostTarget = ({ target }: HostTargetProps) => (
  <div className="flex flex-col items-center gap-3 rounded-[2.5rem] border-4 border-ink bg-now px-12 py-8 shadow-ink-lg">
    <p className="text-2xl font-extrabold uppercase tracking-[0.18em] text-on-now/80">Target</p>
    <p className="font-display text-[12rem] font-extrabold leading-none tabular-nums text-on-now">{target}</p>
  </div>
);
```

- [ ] **Step 2: Replace `packages/host/src/components/numbers/HostTilePool.tsx`**

```tsx
import { HostNumberTile } from './HostNumberTile';

interface HostTilePoolProps {
  tiles: number[];
}

export const HostTilePool = ({ tiles }: HostTilePoolProps) => (
  <div className="flex flex-wrap items-center justify-center gap-5">
    {tiles.map((value, idx) => (
      <HostNumberTile key={idx} value={value} />
    ))}
  </div>
);
```

- [ ] **Step 3: Build**

```bash
cd packages/host && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add packages/host/src/components/numbers/HostTarget.tsx packages/host/src/components/numbers/HostTilePool.tsx
git commit -m "feat(host): HostTarget + HostTilePool use redesign tokens"
```

---

### Task 11: Rebuild `NumbersProgressPanel.tsx` as the bottom player tracker

**Files:**
- Modify: `packages/host/src/components/numbers/NumbersProgressPanel.tsx`

Per spec §7.3 the player tracker sits at the bottom of the host screen and includes an explicit "X of Y" count. We render one `Pill` per player with their status. The four status labels in the spec text ("exact", "closest so far (475)", "in progress", "no submission") map onto current server payload as follows:

| Spec label | Current server signal | Notes |
|---|---|---|
| `exact (476)` | `solved === true` | We render "solved" — the actual target is shown centrally, no need to repeat |
| `in progress` | `operations > 0 && !solved` | Render "in progress · N op(s)" |
| `no submission` | `operations === 0 && !solved` | Render "no submission" |
| `closest so far (475)` | *(not emitted today)* | Out of scope; flagged in plan comment |

The `closest so far` case requires the server to track per-player best value — a future plan owns it.

- [ ] **Step 1: Replace `packages/host/src/components/numbers/NumbersProgressPanel.tsx`**

```tsx
import { Pill } from '../../ui/Pill';

interface PlayerProgressEntry { solved?: boolean; operations?: number; }
interface PlayerLite { id: string; name: string; connected: boolean; }

interface NumbersProgressPanelProps {
  players: PlayerLite[];
  progress: Record<string, PlayerProgressEntry>;
}

/**
 * Bottom-of-screen player tracker for the host's Numbers display.
 * Spec §7.3: "exact / closest so far / in progress / no submission".
 *
 * `closest so far` is currently un-renderable — the server doesn't yet emit
 * per-player best value. A later (server-side) plan can extend the payload;
 * this component is structured so that adding a `bestValue` field per row
 * is a single `if` clause inside `statusFor`.
 */
function statusFor(entry: PlayerProgressEntry | undefined): { label: string; tone: 'on' | 'off' | 'done' } {
  if (!entry) return { label: 'no submission', tone: 'off' };
  if (entry.solved) return { label: 'solved', tone: 'done' };
  if (entry.operations && entry.operations > 0) return { label: `in progress · ${entry.operations} op${entry.operations === 1 ? '' : 's'}`, tone: 'on' };
  return { label: 'no submission', tone: 'off' };
}

export const NumbersProgressPanel = ({ players, progress }: NumbersProgressPanelProps) => {
  const connected = players.filter((p) => p.connected);
  const total = connected.length;
  const solvedCount = connected.filter((p) => progress[p.id]?.solved).length;

  return (
    <div className="w-full">
      <p className="mb-3 text-center text-xl font-extrabold uppercase tracking-[0.18em] text-ink-muted">
        Players · {solvedCount} of {total} solved
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {connected.length === 0 && (
          <p className="text-lg text-ink-muted">No players connected.</p>
        )}
        {connected.map((p) => {
          const { label, tone } = statusFor(progress[p.id]);
          const dotColor =
            tone === 'done' ? 'bg-action' :
            tone === 'on'   ? 'bg-info' :
            'bg-ink-muted/50';
          return (
            <Pill key={p.id} className="text-base">
              <span className={['inline-block h-2 w-2 rounded-full', dotColor].join(' ')} aria-hidden="true" />
              <span className="font-extrabold">{p.name}</span>
              <span className="text-ink-muted">— {label}</span>
            </Pill>
          );
        })}
      </div>
    </div>
  );
};
```

Notes:
- `Pill` accepts arbitrary children via the foundation primitive — we put the live dot, name, and label inline.
- The "X of Y solved" line replaces the previous left-side sidebar header. Spec §7.3 mandates an explicit count.

- [ ] **Step 2: Verify `Pill` accepts a `className` prop**

Quick check before committing — `packages/host/src/ui/Pill.tsx` should expose a className passthrough. If it doesn't, drop the `className="text-base"` in the JSX above (the Pill's default sizing is fine).

- [ ] **Step 3: Build**

```bash
cd packages/host && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add packages/host/src/components/numbers/NumbersProgressPanel.tsx
git commit -m "feat(host): NumbersProgressPanel rebuilt as bottom player tracker with status pills"
```

---

### Task 12: Migrate `NumbersDisplay.tsx` to the canonical host skeleton

**Files:**
- Modify: `packages/host/src/screens/NumbersDisplay.tsx`

Spec §7.3 mandates the same skeleton on every host game screen:
- **Top-left:** location label (one line, full text). For Numbers: `"Numbers Round · Round {N} of {M}"`.
- **Top-right:** time-left panel, same component, same place, every screen.
- **Centre:** the actual game content (target card + tile pool).
- **Bottom:** player tracker.

No category chips, no extra player-count badges. Full-text labels.

- [ ] **Step 1: Replace `packages/host/src/screens/NumbersDisplay.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { HostTarget } from '../components/numbers/HostTarget';
import { HostTilePool } from '../components/numbers/HostTilePool';
import { NumbersProgressPanel } from '../components/numbers/NumbersProgressPanel';
import { DigitRoll } from '../components/numbers/DigitRoll';
import { Card } from '../ui/Card';
import { Chip } from '../ui/Chip';

interface Player { id: string; name: string; connected: boolean; }

interface NumbersDisplayProps {
  socket: Socket | null;
  players: Player[];
}

type Phase = 'intro' | 'playing' | 'results';

const TimeLeft = ({ ms, dim = false }: { ms: number; dim?: boolean }) => (
  <div className="flex flex-col items-end">
    <span className="text-base font-extrabold uppercase tracking-[0.18em] text-ink-muted">Time left</span>
    <span
      className={[
        'font-display text-6xl font-extrabold tabular-nums leading-none',
        dim ? 'text-ink-muted/50' : 'text-ink',
      ].join(' ')}
    >
      {dim ? '—:—' : `${Math.ceil(ms / 1000)}s`}
    </span>
  </div>
);

export const NumbersDisplay = ({ socket, players }: NumbersDisplayProps) => {
  const [phase, setPhase] = useState<Phase>('intro');
  const [introData, setIntroData] = useState<any>(null);
  const [roundData, setRoundData] = useState<any>(null);
  const [resultsData, setResultsData] = useState<any>(null);
  const [progress, setProgress] = useState<Record<string, any>>({});
  const [timerMs, setTimerMs] = useState(0);

  useEffect(() => {
    if (!socket) return;
    const onIntro = (d: any) => { setPhase('intro'); setIntroData(d); setProgress({}); };
    const onStart = (d: any) => { setPhase('playing'); setRoundData(d); setProgress({}); };
    const onProgress = (d: any) => setProgress(d.playerProgress || {});
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

  /** Shared skeleton. Centre + bottom slots are filled per-phase. */
  const Skeleton = ({
    location,
    timeLeftDim = false,
    centre,
    bottom,
  }: {
    location: string;
    timeLeftDim?: boolean;
    centre: React.ReactNode;
    bottom: React.ReactNode;
  }) => (
    <div className="flex h-screen w-screen flex-col bg-bg-base px-10 py-10">
      <header className="flex items-start justify-between">
        <h1 className="font-display text-2xl font-extrabold uppercase tracking-[0.14em] text-ink">{location}</h1>
        <TimeLeft ms={timerMs} dim={timeLeftDim} />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-10">
        {centre}
      </main>
      <footer className="mt-8">{bottom}</footer>
    </div>
  );

  // Intro splash — keep it simple, no need for the full skeleton on the briefing.
  if (phase === 'intro' && introData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg-base px-16 py-20 text-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto w-full max-w-4xl space-y-6">
          <p className="text-2xl font-extrabold uppercase tracking-[0.18em] text-streak">Numbers Round</p>
          <h1 className="font-serif text-8xl font-extrabold text-ink">{introData.title}</h1>
          <p className="text-3xl text-ink-muted">{introData.description}</p>
          <p className="text-xl text-ink-muted">
            {introData.totalRounds} rounds · {Math.round((introData.duration || 8000) / 1000)}s briefing
          </p>
        </motion.div>
      </div>
    );
  }

  // Results — apply the skeleton; time-left dimmed per spec.
  if (phase === 'results' && resultsData) {
    const sorted = [...(resultsData.results || [])].sort((a: any, b: any) => b.cumulativeScore - a.cumulativeScore);
    const top = sorted.slice(0, 5);
    return (
      <Skeleton
        location={`Numbers Round · Round ${resultsData.roundNumber} of ${resultsData.totalRounds} — Reveal`}
        timeLeftDim
        centre={
          <div className="flex w-full max-w-3xl flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <p className="text-2xl font-extrabold uppercase tracking-[0.18em] text-ink-muted">Target was</p>
              <p className="font-display text-[10rem] font-extrabold leading-none tabular-nums text-ink">
                {resultsData.target}
              </p>
            </div>
            <Card eyebrow="One optimal solution" className="w-full text-center">
              <p className="font-display text-5xl font-extrabold text-action">
                {resultsData.optimal?.expression ?? '—'}
              </p>
              <p className="mt-1 text-xl text-ink-muted">
                = {resultsData.optimal?.value ?? '—'} (distance {resultsData.optimal?.distance})
              </p>
            </Card>
            <Card eyebrow="Top of the standings" className="w-full">
              <ul className="space-y-2 text-2xl">
                {top.map((r: any, i: number) => (
                  <li key={r.playerId} className="flex items-baseline justify-between gap-4">
                    <span className="font-extrabold text-ink">#{i + 1} · {r.playerName}</span>
                    <span className="font-display font-extrabold text-action">
                      <DigitRoll value={r.cumulativeScore} digitHeightPx={32} /> pts
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        }
        bottom={
          <p className="text-center text-lg text-ink-muted">
            {resultsData.isLastRound ? 'Wrapping up…' : 'Next round coming…'}
          </p>
        }
      />
    );
  }

  if (phase !== 'playing' || !roundData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg-base text-2xl text-ink">
        Loading…
      </div>
    );
  }

  return (
    <Skeleton
      location={`Numbers Round · Round ${roundData.roundNumber} of ${roundData.totalRounds}`}
      centre={
        <>
          <Chip variant="streak" className="text-base">{roundData.difficulty}</Chip>
          <HostTarget target={roundData.target} />
          <HostTilePool tiles={(roundData.tiles || []).map((t: any) => t.value)} />
        </>
      }
      bottom={<NumbersProgressPanel players={players} progress={progress} />}
    />
  );
};
```

Notes:
- `Skeleton` is a local helper component, not exported. Reused across `playing` and `results` to enforce the spec's "same place, every screen" rule.
- Time-left panel always renders in the same slot; on `results` it dims to `—:—` per §7.3 ("dimmed to '—:—' on Dashboard and results screens so the layout never shifts").
- Centre stack: difficulty chip → target card → tile pool. No category chips, no per-player count badge above the player tracker — those are forbidden by §7.3.
- The full host roundboard (top-5) on the results phase digit-rolls each cumulative score — second appearance of the spec's score-reveal animation, this time on the TV.

- [ ] **Step 2: Build + dev smoke**

```bash
cd packages/host && npm run build
```

Boot dev environment, run a Numbers round:
1. Host top-left shows `"Numbers Round · Round 1 of 3"`.
2. Host top-right shows live timer.
3. Centre: difficulty chip, big sun-yellow target card, six chunky tiles.
4. Bottom: player tracker pills with live dots + status text. Count line reads `"Players · 0 of 2 solved"` etc.
5. On round end: time-left dims to `—:—`; centre shows target → optimal card → top-5 with rolling scores.

- [ ] **Step 3: Commit**

```bash
git add packages/host/src/screens/NumbersDisplay.tsx
git commit -m "feat(host): NumbersDisplay rebuilt on canonical host skeleton with new primitives"
```

---

## Verification checklist (end of plan)

- [ ] `cd packages/client && npm run build` — passes.
- [ ] `cd packages/host && npm run build` — passes.
- [ ] `cd packages/server && npm run build 2>/dev/null || echo "(server unchanged)"` — server build untouched and still working.
- [ ] Full 3-round Numbers playthrough on client + host:
  - Player intro splash uses Fraunces serif title, ink-bordered list of scoring rules.
  - Player playing screen: sun-yellow target card, chunky tile pool with used-tile fading, foundation Buttons for operators, ink-bordered slot strip.
  - Player results: digit-roll fires for both `roundScore` and `cumulativeScore` (each digit cycles 0–9, lands with overshoot, left-to-right reading order).
  - Host intro splash: Fraunces title.
  - Host playing screen: skeleton layout — location top-left, time-left top-right, target + tiles centre, player tracker bottom.
  - Host results: time-left dims to `—:—`; top-5 cumulative scores digit-roll.
- [ ] Light/dark theme toggle (via the existing foundation toggle on the showcase) flips both surfaces cleanly — every text/border/shadow uses tokens that switch on `[data-theme]`.
- [ ] No regression: invalid operation still produces red toast; reset tiles still restores the original pool; round timer still ticks.

## Notes & concerns

- **Server gap — "closest so far" status:** the spec's player-tracker example includes `"Ben — closest so far (475)"`. Today the server emits only `{ solved, operations }`. We render `"in progress · N op(s)"` as a faithful proxy. A follow-up plan should extend `_broadcastProgress` to include each player's current best computed value (closest to target so far) — the client/host components are structured to absorb that field with a one-line change in `statusFor()`.
- **DigitRoll alignment:** the spec doesn't pin the exact digit-height-to-text-size ratio. Using integer px values keeps the masked overflow clean; if the visual lands slightly off, tune `digitHeightPx` (smaller is tighter, larger is looser) without touching the timing.
- **`Pill className` passthrough:** the host's `Pill` primitive may not currently accept a className prop. Task 11 step 2 explicitly checks; if missing, either drop the className arg in the JSX or add the passthrough in `packages/host/src/ui/Pill.tsx` as a one-line tweak.
- **`prefers-reduced-motion`:** DigitRoll currently always animates. The polish PR (Phase 11) is responsible for adding the reduced-motion substitute (drop animation, snap to final value). The component's design — a single `motion.span` per digit — makes that a five-line change behind a `useReducedMotion()` hook from framer-motion.
- **Old utility classes (`.screen-shell`, `.eyebrow`, `.screen-frame`) on `index.css`:** still loaded for unmigrated screens; we stopped using them in Numbers. Final removal is the polish PR.
