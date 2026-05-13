# PHoG UI Redesign — Phase 10: Travel + TravelDisplay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the player Travel screen and the host TravelDisplay onto the new design system (primitives, tokens, motion utilities). Map remains powered by `react-simple-maps` — only the skin (fills, strokes, shadow, container chrome) changes. Game/server logic, socket events, chain math, and country-overrides are all unchanged.

**Architecture:** Two screens, two map components, three small co-located helpers:

- **Player Travel (`packages/client/src/screens/Travel.tsx`)** — three phases: `intro`, `playing`, `results`.
  - **Intro** — Card with eyebrow, Fraunces title, description, scoring rules as chips.
  - **Playing** — **map is HIDDEN**. Show only: a "challenge banner" Card with `Start → ??? → End`, the front + back chain pills, an `Input`-based country autocomplete, a Countdown ring, and an `invalidToast` Pill.
  - **Results** — full reveal: `TravelMap` renders with the player's guess pins dropping (380ms bounce) and arcs drawing from each guess to its correct location (500ms stroke-dashoffset).
- **Host TravelDisplay (`packages/host/src/screens/TravelDisplay.tsx`)** — three phases:
  - **Intro** — same Card pattern as player intro, scaled up for the TV.
  - **Playing** — map hidden, large challenge banner ("Start: France → End: Egypt" in full text — never abbreviated), big countdown, player tracker grid at bottom.
  - **Results** — full `HostTravelMap` with every player's chain rendered as filled regions + animated arcs/pins, start/end pins labelled in full ("Start: France", "End: Egypt"), top-scorer panel on the right, player tracker bottom.

**New co-located components (player side):**
- `components/travel/ChainPill.tsx` — small reskin of the per-country pill (green/orange/red). Replaces the bulk of `ChainList`.
- `components/travel/ChainStrip.tsx` — horizontal flow of `ChainPill`s with start/end caps and a "meet in the middle" dotted separator. Replaces `ChainList` entirely.
- `components/travel/GuessPin.tsx` — SVG circle pin that drops from above using the new `pinDrop` motion variant.
- `components/travel/GuessArc.tsx` — SVG `<path>` arc with `stroke-dasharray`/`stroke-dashoffset` animation (500ms).

**Map skinning approach:** `TravelMap.tsx` and `HostTravelMap.tsx` keep their existing `react-simple-maps` plumbing and projection math. The only changes are:
1. Container chrome — replace `rounded-2xl border border-white/10 bg-black/40` with the new `Card`-flavored chrome (`border-2 border-ink bg-bg-sunken shadow-ink rounded-2xl`).
2. The `FILL`/`STROKE` constants change from hex literals to functions that return `var(--…)` CSS variables, so light/dark themes flip with the rest of the app:
   - `unvisited` (in-viewport but un-guessed) → `var(--bg-sunken)`
   - hidden (out-of-viewport) → `transparent` (unchanged)
   - `start` / `end` → `var(--now)` (sun yellow)
   - `green` → `var(--action)` (grass)
   - `orange` → `var(--warn)` (amber)
   - `red` → `var(--danger)` — used only for non-map history rendering; reds stay hidden on the map by existing logic
   - `optimal` (host only) → `var(--streak)` (terracotta heritage — this IS a celebration moment)
   - stroke `chain` → `var(--ink)`
3. The map "water" background is the container itself (`bg-bg-sunken`), so unvisited and outside-viewport regions blend with it.
4. Pin-drop overlay + arc-draw overlay are new `<g>` siblings of `<Geographies>`, rendered only when the reveal flag is set.

**New motion variants:** add `pinDrop` (translateY -40 → 0 with back-out bounce, 380ms) and `arcDraw` helper for the stroke-dashoffset animation to `lib/motion.ts` in both packages.

**Tech stack:** React 18 · TypeScript 5.3 · Tailwind 3.4 · framer-motion 10 · `react-simple-maps` (unchanged) · `d3-geo` + `topojson-client` + `world-atlas` (unchanged).

**Spec reference:** [docs/superpowers/specs/2026-05-13-ui-redesign-design.md](../specs/2026-05-13-ui-redesign-design.md) — §3 (primitives), §4.4 (pin drop + arc draw), §7.1 (Travel), §7.3 (TravelDisplay).

**Out of scope for this plan:**
- Server-side changes (socket event shapes, scoring, country data — all unchanged)
- The `world-atlas/countries-110m.json` data file and the `NAME_OVERRIDES` table — unchanged
- Removing old `index.css` rules (`.screen-frame`, `.eyebrow`, etc.) or legacy Tailwind tokens (`game.leader`, `ui.textMuted`) — Phase 11 sweeps those after every screen has migrated
- Touching any other game (Quiz, Wordle, Numbers, etc.)
- Migrating `packages/host/src/components/travel/HostChainCard.tsx` — TravelDisplay never renders it in the current code (the playing phase shows a simple player tracker, results shows the map + top-scorers panel). If a future change brings it back, that's a separate task.

---

## File map

**Client (`packages/client/`):**
- `src/lib/motion.ts` — add `pinDrop` variant + `arcDrawTransition` helper
- `src/components/travel/ChainPill.tsx` — *create*
- `src/components/travel/ChainStrip.tsx` — *create*
- `src/components/travel/GuessPin.tsx` — *create*
- `src/components/travel/GuessArc.tsx` — *create*
- `src/components/travel/CountryAutocomplete.tsx` — rewrite to consume `Input` + `Chip`
- `src/components/travel/ChainList.tsx` — DELETE after migration (replaced by `ChainStrip`)
- `src/components/travel/TravelMap.tsx` — reskin (token-based fills/strokes, new container chrome, pin/arc overlay)
- `src/screens/Travel.tsx` — rewrite layout against `Card` / `Button` / `Chip` / `Countdown` / `Pill`; hide map during play

**Host (`packages/host/`):**
- `src/lib/motion.ts` — add `pinDrop` variant + `arcDrawTransition` helper (mirror of client)
- `src/components/travel/GuessPin.tsx` — *create* (mirror)
- `src/components/travel/GuessArc.tsx` — *create* (mirror)
- `src/components/travel/HostTravelMap.tsx` — reskin (token-based fills/strokes, new chrome, pin/arc overlay, start/end labels in full text)
- `src/screens/TravelDisplay.tsx` — rewrite layout against `Card` / `Chip` / `Pill`; hide map during play; full-text "Start: …" / "End: …" labels on results

---

## Tasks

### Task 1: Add `pinDrop` + `arcDrawTransition` to motion.ts (both packages)

**Files:**
- Modify: `packages/client/src/lib/motion.ts`
- Modify: `packages/host/src/lib/motion.ts`

- [ ] **Step 1: Append the new variant + helper to `packages/client/src/lib/motion.ts`**

Add immediately below the `letterDrop` variant:

```ts
/* Travel — pin drop (§4.4): SVG circle drops from above with a small bounce.
 * Used for every guess pin on the results map. */
export const pinDrop: Variants = {
  hidden:  { y: -40, opacity: 0 },
  visible: { y: 0,  opacity: 1, transition: { duration: 0.38, ease: easing.backOut } },
};

/* Travel — arc draw (§4.4): used as the `transition` for an SVG <path>'s
 * strokeDashoffset animation. Caller sets initial={ strokeDashoffset: L }
 * and animate={ strokeDashoffset: 0 } where L = path.getTotalLength(). */
export const arcDrawTransition: Transition = {
  duration: 0.5,
  ease: easing.easeOut,
};
```

- [ ] **Step 2: Mirror the same change in `packages/host/src/lib/motion.ts`**

Identical block. Both packages diverge if anyone tunes them later; we keep them in sync now.

- [ ] **Step 3: Verify both builds still pass**

```bash
cd packages/client && npm run build
cd ../host && npm run build
```

Expected: both succeed; no consumers yet, just the new exports.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/lib/motion.ts packages/host/src/lib/motion.ts
git commit -m "feat(motion): add pinDrop variant + arcDrawTransition helper for Travel"
```

---

### Task 2: Create `ChainPill` co-located component (client)

**Files:**
- Create: `packages/client/src/components/travel/ChainPill.tsx`

- [ ] **Step 1: Create `packages/client/src/components/travel/ChainPill.tsx`**

A small leaf wrapper. NOT exported from `ui/` — it's game-specific.

```tsx
import { motion } from 'framer-motion';
import { popIn } from '../../lib/motion';

export type ChainColor = 'green' | 'orange' | 'red';

interface ChainPillProps {
  name: string;
  color?: ChainColor;
  role?: 'start' | 'end' | 'mid';
}

/* Map color → token-based Tailwind classes.
 * green = on optimal path (valid border + reaches goal)
 * orange = "stretch" — reaches the goal but not optimal
 * red = invalid / dead end (still consumes a guess; shown for history) */
const TONE: Record<ChainColor, string> = {
  green:  'border-ink bg-action text-on-action',
  orange: 'border-ink bg-warn text-ink',
  red:    'border-ink bg-danger text-on-danger',
};

const ROLE_TONE = {
  start: 'border-ink bg-now text-on-now',
  end:   'border-ink bg-now text-on-now',
  mid:   'border-ink bg-bg-surface text-ink',
} as const;

export function ChainPill({ name, color, role = 'mid' }: ChainPillProps) {
  const cls =
    role === 'start' || role === 'end'
      ? ROLE_TONE[role]
      : color
        ? TONE[color]
        : ROLE_TONE.mid;

  return (
    <motion.span
      variants={popIn}
      initial="hidden"
      animate="visible"
      className={[
        'inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5',
        'text-sm font-extrabold shadow-ink-sm whitespace-nowrap',
        cls,
      ].join(' ')}
    >
      {role === 'start' && (
        <span className="text-[10px] font-black uppercase tracking-[0.14em] opacity-70">Start</span>
      )}
      {role === 'end' && (
        <span className="text-[10px] font-black uppercase tracking-[0.14em] opacity-70">End</span>
      )}
      <span>{name}</span>
    </motion.span>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd packages/client && npm run build
```

Expected: success (no consumers yet).

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/travel/ChainPill.tsx
git commit -m "feat(client/travel): add ChainPill primitive (green/orange/red)"
```

---

### Task 3: Create `ChainStrip` co-located component (client)

**Files:**
- Create: `packages/client/src/components/travel/ChainStrip.tsx`

- [ ] **Step 1: Create `packages/client/src/components/travel/ChainStrip.tsx`**

Horizontal flow of `ChainPill`s representing front chain + dotted "meet in the middle" separator + back chain. The strip wraps to multiple lines on narrow screens.

```tsx
import { ChainPill, ChainColor } from './ChainPill';

export interface ChainEntry { name: string; color?: ChainColor; }

interface ChainStripProps {
  frontChain: ChainEntry[];   // [{name:start}, …]
  backChain: ChainEntry[];    // […, {name:end}]
  solved: boolean;
}

/* The two chains meet in the middle. Layout left-to-right:
 *   [Start] → [front1] → [front2] … … [back1] → [End]
 * with a dashed "meet" pill between them while unsolved. */
export function ChainStrip({ frontChain, backChain, solved }: ChainStripProps) {
  const [startEntry, ...frontRest] = frontChain;
  const backRest = backChain.slice(0, -1);
  const endEntry = backChain[backChain.length - 1];

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {startEntry && <ChainPill name={startEntry.name} role="start" />}
      {frontRest.map((e, i) => (
        <span key={`f-${i}`} className="flex items-center gap-2">
          <Arrow />
          <ChainPill name={e.name} color={e.color} role="mid" />
        </span>
      ))}
      {!solved && (
        <span className="flex items-center gap-2">
          <Arrow />
          <span className="rounded-xl border-2 border-dashed border-ink/40 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-ink-muted">
            keep going
          </span>
          <Arrow />
        </span>
      )}
      {solved && backRest.length > 0 && <Arrow />}
      {backRest.map((e, i) => (
        <span key={`b-${i}`} className="flex items-center gap-2">
          <ChainPill name={e.name} color={e.color} role="mid" />
          <Arrow />
        </span>
      ))}
      {endEntry && <ChainPill name={endEntry.name} role="end" />}
    </div>
  );
}

function Arrow() {
  return <span aria-hidden className="font-black text-ink-muted">→</span>;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd packages/client && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/travel/ChainStrip.tsx
git commit -m "feat(client/travel): add ChainStrip (front + back chain layout)"
```

---

### Task 4: Rewrite `CountryAutocomplete` to consume `Input` + `Chip`-style dropdown

**Files:**
- Modify: `packages/client/src/components/travel/CountryAutocomplete.tsx`

- [ ] **Step 1: Replace the contents of `packages/client/src/components/travel/CountryAutocomplete.tsx`**

Keep the public API identical (`countries`, `onSubmit`, `disabled`, `placeholder`, `maxResults`). The two changes are:
1. The input is now the new `Input` primitive (ink border, hard shadow, focus cobalt).
2. The dropdown renders items as `Chip`-styled rows inside a `Card`-like surface (border-ink, bg-bg-surface, shadow-ink).

```tsx
import { useMemo, useState } from 'react';
import { Input } from '../../ui/Input';

export interface Country { name: string; aliases?: string[]; }

interface CountryAutocompleteProps {
  countries: Country[];
  onSubmit: (name: string) => void;
  disabled?: boolean;
  placeholder?: string;
  maxResults?: number;
}

export const CountryAutocomplete = ({
  countries, onSubmit, disabled, placeholder = 'Type a country…', maxResults = 5,
}: CountryAutocompleteProps) => {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return countries
      .filter((c) => {
        if (c.name.toLowerCase().includes(q)) return true;
        return (c.aliases || []).some((a) => a.toLowerCase().includes(q));
      })
      .slice(0, maxResults);
  }, [query, countries, maxResults]);

  const submit = (name: string) => {
    if (disabled || !name) return;
    onSubmit(name);
    setQuery('');
    setActive(0);
  };

  return (
    <div className="relative w-full">
      <Input
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => { setQuery(e.target.value); setActive(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && suggestions.length > 0) {
            e.preventDefault();
            setActive((i) => Math.min(suggestions.length - 1, i + 1));
          }
          if (e.key === 'ArrowUp' && suggestions.length > 0) {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          }
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (suggestions[active]) submit(suggestions[active].name);
            else if (query.trim()) submit(query.trim());
          }
          if (e.key === 'Escape') { setQuery(''); setActive(0); }
        }}
      />
      {suggestions.length > 0 && !disabled && (
        <ul
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border-2 border-ink bg-bg-surface shadow-ink"
          role="listbox"
        >
          {suggestions.map((c, idx) => (
            <li
              key={c.name}
              onMouseDown={(e) => { e.preventDefault(); submit(c.name); }}
              onMouseEnter={() => setActive(idx)}
              className={[
                'cursor-pointer px-4 py-2.5 text-base font-bold',
                idx === active ? 'bg-info text-on-info' : 'bg-bg-surface text-ink hover:bg-bg-sunken',
              ].join(' ')}
              role="option"
              aria-selected={idx === active}
            >
              {c.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify build (existing `Travel.tsx` still imports it)**

```bash
cd packages/client && npm run build
```

Expected: success. The screen still uses the old layout — Travel.tsx imports haven't changed yet, just the autocomplete internals.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/travel/CountryAutocomplete.tsx
git commit -m "refactor(client/travel): autocomplete on Input + token-based dropdown"
```

---

### Task 5: Create `GuessPin` + `GuessArc` SVG components (client)

**Files:**
- Create: `packages/client/src/components/travel/GuessPin.tsx`
- Create: `packages/client/src/components/travel/GuessArc.tsx`

These are SVG-only — they render inside `<svg>` (a sibling of `<Geographies>` in `TravelMap`). They never render at top-level DOM.

- [ ] **Step 1: Create `packages/client/src/components/travel/GuessPin.tsx`**

```tsx
import { motion } from 'framer-motion';
import { pinDrop } from '../../lib/motion';

interface GuessPinProps {
  cx: number;
  cy: number;
  color: 'green' | 'orange' | 'red';
  delaySec?: number;
}

const FILL = {
  green:  'var(--action)',
  orange: 'var(--warn)',
  red:    'var(--danger)',
} as const;

export function GuessPin({ cx, cy, color, delaySec = 0 }: GuessPinProps) {
  return (
    <motion.g
      variants={pinDrop}
      initial="hidden"
      animate="visible"
      transition={{ delay: delaySec }}
      style={{ transformOrigin: `${cx}px ${cy}px` }}
    >
      {/* Hard offset shadow drop — matches the ink-shadow language of the rest of the kit. */}
      <circle cx={cx + 1.5} cy={cy + 1.5} r={7} fill="var(--shadow)" />
      <circle cx={cx} cy={cy} r={7} fill={FILL[color]} stroke="var(--ink)" strokeWidth={2} />
    </motion.g>
  );
}
```

- [ ] **Step 2: Create `packages/client/src/components/travel/GuessArc.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { arcDrawTransition } from '../../lib/motion';

interface GuessArcProps {
  x1: number; y1: number;
  x2: number; y2: number;
  color: 'green' | 'orange' | 'red';
  delaySec?: number;
}

const STROKE = {
  green:  'var(--action)',
  orange: 'var(--warn)',
  red:    'var(--danger)',
} as const;

/* A quadratic-bezier arc between two screen-space points. The control point
 * is lifted perpendicular to the chord (~20% of chord length) so arcs visibly
 * curve over the map rather than passing under pins. */
function arcPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const lift = len * 0.2;
  // perpendicular unit vector pointing "up" (negative y)
  const px = -dy / (len || 1);
  const py = dx / (len || 1);
  const cx = (x1 + x2) / 2 + px * lift * Math.sign(-py || 1);
  const cy = (y1 + y2) / 2 + py * lift * Math.sign(-py || 1);
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

export function GuessArc({ x1, y1, x2, y2, color, delaySec = 0 }: GuessArcProps) {
  const ref = useRef<SVGPathElement | null>(null);
  const [len, setLen] = useState<number | null>(null);
  const d = arcPath(x1, y1, x2, y2);

  useEffect(() => {
    if (ref.current) setLen(ref.current.getTotalLength());
  }, [d]);

  return (
    <motion.path
      ref={ref}
      d={d}
      fill="none"
      stroke={STROKE[color]}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeDasharray={len ?? undefined}
      initial={{ strokeDashoffset: len ?? 0 }}
      animate={{ strokeDashoffset: 0 }}
      transition={{ ...arcDrawTransition, delay: delaySec }}
    />
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd packages/client && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/travel/GuessPin.tsx packages/client/src/components/travel/GuessArc.tsx
git commit -m "feat(client/travel): add GuessPin + GuessArc SVG components"
```

---

### Task 6: Reskin `TravelMap` (player) — tokens, chrome, pin/arc overlay

**Files:**
- Modify: `packages/client/src/components/travel/TravelMap.tsx`

This is the bulk of the player-map work. Keep `projection`, `featureCollection`, `canonicalName`, `relevantSet`, `chainNames`, `nameToColor` exactly as they are — only fills/strokes and the wrapper change. Add a pin/arc overlay that renders when `solved`/results are passed in.

- [ ] **Step 1: Replace `FILL` and `STROKE` constants with CSS-var references**

```ts
const FILL = {
  unvisited: 'var(--bg-sunken)',   // in-viewport but un-guessed
  outside:   'transparent',        // hidden entirely (out-of-viewport)
  start:     'var(--now)',         // sun yellow
  end:       'var(--now)',
  green:     'var(--action)',
  orange:    'var(--warn)',
  red:       'var(--danger)',      // unused on map (reds are excluded) but kept for completeness
} as const;

const STROKE = {
  chain: 'var(--ink)',
  none:  'transparent',
} as const;
```

- [ ] **Step 2: Replace the wrapping `<div>` chrome**

Change from:

```tsx
<div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
```

to:

```tsx
<div className="overflow-hidden rounded-2xl border-2 border-ink bg-bg-sunken shadow-ink">
```

- [ ] **Step 3: Add a `guesses` prop + pin/arc overlay (results only)**

Extend the `TravelMapProps` interface with an optional `guesses` array:

```ts
export interface MapGuess {
  guess: string;          // country name the player typed
  answer: string;         // the correct country (for arcs)
  color: 'green' | 'orange' | 'red';
}

interface TravelMapProps {
  /* …existing… */
  guesses?: MapGuess[];
}
```

Inside the component, after `projection` is built, compute screen-space points for each guess and answer:

```tsx
const guessPoints = useMemo(() => {
  if (!guesses || guesses.length === 0) return [];
  const featureByName = new Map<string, any>();
  for (const f of featureCollection.features) featureByName.set(canonicalName(f), f);

  const project = (name: string) => {
    const f = featureByName.get(name);
    if (!f) return null;
    const centroid = geoCentroid(f);
    const p = projection(centroid);
    return p ? { x: p[0], y: p[1] } : null;
  };

  return guesses
    .map((g, i) => {
      const from = project(g.guess);
      const to = project(g.answer);
      if (!from || !to) return null;
      return { ...g, from, to, idx: i };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}, [guesses, featureCollection, projection]);
```

Then in the JSX, add a sibling `<g>` after `<Geographies>` (inside `<ComposableMap>`) that renders the arcs first (so pins layer on top) and pins second:

```tsx
{guessPoints.length > 0 && (
  <>
    <g>
      {guessPoints.map((p) => (
        <GuessArc
          key={`arc-${p.idx}`}
          x1={p.from.x} y1={p.from.y}
          x2={p.to.x}   y2={p.to.y}
          color={p.color}
          delaySec={p.idx * 0.12}
        />
      ))}
    </g>
    <g>
      {guessPoints.map((p) => (
        <GuessPin
          key={`pin-${p.idx}`}
          cx={p.from.x} cy={p.from.y}
          color={p.color}
          delaySec={p.idx * 0.12}
        />
      ))}
    </g>
  </>
)}
```

Note: `geoCentroid` is already imported. `GuessPin` and `GuessArc` need to be imported from the new files.

- [ ] **Step 4: Verify build**

```bash
cd packages/client && npm run build
```

Expected: success. The screen still uses the old layout but the map will already render with the new chrome when shown.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/travel/TravelMap.tsx
git commit -m "feat(client/travel): reskin TravelMap to tokens + pin/arc reveal overlay"
```

---

### Task 7: Rewrite player `Travel.tsx` — hide map during play, use primitives

**Files:**
- Modify: `packages/client/src/screens/Travel.tsx`
- Delete: `packages/client/src/components/travel/ChainList.tsx`

The screen logic (sockets, phases, chain state) is unchanged. Only the layout / chrome / map-visibility rules change.

- [ ] **Step 1: Rewrite `packages/client/src/screens/Travel.tsx`**

Key changes:

1. **Imports**: drop `ChainList`, add `Card`, `Chip`, `Pill`, `Countdown`, `Button` (from `../ui`), and `ChainStrip` (from `../components/travel/ChainStrip`).
2. **Intro phase**: wrap in a `Card`, use eyebrow + Fraunces title (`font-serif`) + ink-muted description + Chip strip of scoring rules.
3. **Playing phase**:
   - `Card`-based challenge banner — `Start → ??? → End`.
   - `Countdown` ring + a `Pill` showing `${guessesLeft} guesses left`.
   - **`TravelMap` is NOT rendered.** Only the chain strip and autocomplete are visible.
   - `ChainStrip` replaces `ChainList`.
   - Autocomplete unchanged in usage (already reskinned in Task 4).
   - `invalidToast` rendered as a `Pill` with `danger` styling.
4. **Results phase**:
   - `Card`-based summary at top.
   - `TravelMap` IS rendered, with `guesses` derived from `me.history` (mapping each `{name, color, side}` → `{guess: name, answer: <the country that was its correct neighbour>, color}`). **Implementation note:** the server only sends `history` with `{name, color, side}`, not the "answer" coordinate for each guess. For the reveal animation we instead draw arcs from each guess to the *closest endpoint on its side* — i.e. front-side guesses arc toward `start`, back-side guesses arc toward `end`. This is the same heuristic the original `TravelMap` already implicitly conveys via color fills; we make it explicit with arcs. (If the server later sends per-guess "intended next-hop", we can drop this heuristic.)
   - Chain strip showing the full path.
   - `optimalChain` rendered as a `streak`-tinted Card ("shortest path").
   - Per-guess history as a list of `ChainPill`s in their color, ordered chronologically.
   - Score block at the bottom as a `Card`.

Full rewrite:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import { CountryAutocomplete, Country } from '../components/travel/CountryAutocomplete';
import { ChainStrip } from '../components/travel/ChainStrip';
import { ChainPill } from '../components/travel/ChainPill';
import { TravelMap, MapGuess } from '../components/travel/TravelMap';
import { Card, Chip, Pill, Countdown } from '../ui';
import { screenEnter } from '../lib/motion';

type Phase = 'intro' | 'playing' | 'results';

interface TravelProps { socket: Socket | null; }

export const Travel = ({ socket }: TravelProps) => {
  const { playerId } = useGameStore();
  const [phase, setPhase] = useState<Phase>('intro');
  const [introData, setIntroData] = useState<any>(null);
  const [roundData, setRoundData] = useState<any>(null);
  const [resultsData, setResultsData] = useState<any>(null);
  const [frontChain, setFrontChain] = useState<Array<{ name: string; color?: 'green'|'orange'|'red' }>>([]);
  const [backChain, setBackChain] = useState<Array<{ name: string; color?: 'green'|'orange'|'red' }>>([]);
  const [solved, setSolved] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [invalidToast, setInvalidToast] = useState<string | null>(null);
  const [timerMs, setTimerMs] = useState(0);

  // Timer effect — unchanged
  useEffect(() => {
    if (phase !== 'playing' || !roundData?.endsAt) return;
    const tick = () => setTimerMs(Math.max(0, roundData.endsAt - Date.now()));
    tick();
    const i = setInterval(tick, 100);
    return () => clearInterval(i);
  }, [phase, roundData]);

  // Socket effect — unchanged
  useEffect(() => {
    if (!socket) return;
    const onIntro = (d: any) => {
      setPhase('intro');
      setIntroData(d);
      setCountries(d.countries || []);
      setFrontChain([]); setBackChain([]); setSolved(false);
    };
    const onStart = (d: any) => {
      setPhase('playing'); setRoundData(d);
      setFrontChain([{ name: d.start }]); setBackChain([{ name: d.end }]);
      setSolved(false);
    };
    const onResult = (d: any) => {
      if (Array.isArray(d.frontChain)) setFrontChain(d.frontChain);
      if (Array.isArray(d.backChain)) setBackChain(d.backChain);
      if (d.solved) setSolved(true);
    };
    const onInvalid = (d: any) => {
      setInvalidToast(d.reason || 'invalid');
      setTimeout(() => setInvalidToast(null), 2400);
    };
    const onResults = (d: any) => { setPhase('results'); setResultsData(d); };
    socket.on('travel:intro', onIntro);
    socket.on('travel:round:start', onStart);
    socket.on('travel:guess:result', onResult);
    socket.on('travel:guess:invalid', onInvalid);
    socket.on('travel:round:results', onResults);
    return () => {
      socket.off('travel:intro', onIntro);
      socket.off('travel:round:start', onStart);
      socket.off('travel:guess:result', onResult);
      socket.off('travel:guess:invalid', onInvalid);
      socket.off('travel:round:results', onResults);
    };
  }, [socket, playerId]);

  const submit = (name: string) => {
    if (!socket || solved) return;
    socket.emit('travel:submit', { name });
  };

  // ── INTRO ──────────────────────────────────────────────────────────────
  if (phase === 'intro' && introData) {
    return (
      <div className="screen-shell flex flex-col items-center justify-center px-4">
        <motion.div variants={screenEnter} initial="hidden" animate="visible" className="w-full max-w-2xl">
          <Card>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-streak">Game starting</p>
            <h1 className="mt-2 font-serif text-5xl font-extrabold text-ink">{introData.title}</h1>
            <p className="mt-3 text-lg text-ink-muted">{introData.description}</p>
            {Array.isArray(introData.scoringRules) && introData.scoringRules.length > 0 && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {introData.scoringRules.map((r: string) => (
                  <Chip key={r}>{r}</Chip>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    );
  }

  // ── RESULTS ────────────────────────────────────────────────────────────
  if (phase === 'results' && resultsData) {
    const me = resultsData.results.find((r: any) => r.playerId === playerId);
    type Color = 'green' | 'orange' | 'red';
    const history: Array<{ name: string; color: Color; side: 'front' | 'back' }> = me?.history || [];

    // Map history → MapGuess[] for the reveal animation. See Task 7 step-1 note
    // re: arcs going from each guess to its side's endpoint.
    const guesses: MapGuess[] = history
      .filter((h) => h.color !== 'red')  // reds are deliberately hidden on the map
      .map((h) => ({
        guess: h.name,
        answer: h.side === 'front' ? resultsData.start : resultsData.end,
        color: h.color,
      }));

    return (
      <div className="screen-shell flex flex-col items-center overflow-y-auto px-4 py-4">
        <motion.div variants={screenEnter} initial="hidden" animate="visible" className="w-full max-w-2xl space-y-4">
          <Card>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-streak">Travel — Reveal</p>
            <p className="mt-2 text-2xl font-extrabold text-ink">
              {resultsData.start} <span className="text-ink-muted">→</span> {resultsData.end}
            </p>
          </Card>

          <TravelMap
            startName={resultsData.start}
            endName={resultsData.end}
            relevantNames={resultsData.relevantNames || resultsData.optimalChain || []}
            frontChain={frontChain}
            backChain={backChain}
            solved={true}
            guesses={guesses}
          />

          <Card variant="streak">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-on-streak/80">Shortest path</p>
            <p className="mt-1 break-words text-xl font-extrabold text-on-streak">
              {(resultsData.optimalChain || []).join(' → ')}
            </p>
            <p className="mt-1 text-sm text-on-streak/80">
              {resultsData.optimalDistance} hops · your budget was {resultsData.optimalDistance + 2}
            </p>
          </Card>

          <Card>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink-muted">Your guesses</p>
            {history.length === 0 ? (
              <p className="mt-2 text-center text-sm italic text-ink-muted">No submissions this round.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {history.map((h, i) => (
                  <ChainPill key={i} name={h.name} color={h.color} />
                ))}
              </div>
            )}
          </Card>

          <Card>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink-muted">Your result</p>
            {me ? (
              <div className="mt-2 text-center">
                <p className="text-lg text-ink">{me.solved ? 'Solved' : 'Not solved'}</p>
                <p className="mt-1 font-display text-4xl font-black text-action">+{me.score} pts</p>
                {me.firstSolver && (
                  <Chip variant="streak" className="mt-2">First solver</Chip>
                )}
              </div>
            ) : (
              <p className="mt-2 text-ink-muted">No result.</p>
            )}
          </Card>
        </motion.div>
      </div>
    );
  }

  // ── LOADING ────────────────────────────────────────────────────────────
  if (phase !== 'playing' || !roundData) {
    return (
      <div className="screen-shell flex flex-col items-center justify-center px-4">
        <Card>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink-muted">Travel</p>
          <h1 className="mt-2 text-3xl font-extrabold text-ink">Loading…</h1>
        </Card>
      </div>
    );
  }

  // ── PLAYING (map hidden!) ──────────────────────────────────────────────
  const guessesUsed = Math.max(0, (frontChain.length - 1) + (backChain.length - 1));
  const guessesLeft = Math.max(0, roundData.maxGuesses - guessesUsed);
  const noBudget = guessesLeft <= 0;
  const seconds = Math.ceil(timerMs / 1000);
  const totalSec = Math.max(1, Math.ceil((roundData.duration || 90000) / 1000));

  return (
    <div className="screen-shell flex flex-col items-center px-4 py-4">
      <motion.div variants={screenEnter} initial="hidden" animate="visible" className="w-full max-w-2xl space-y-4">
        {/* Challenge banner */}
        <Card>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-streak">Travel</p>
          <p className="mt-2 break-words text-3xl font-extrabold text-ink">
            {roundData.start}{' '}
            <span className="text-ink-muted">→ ??? →</span>{' '}
            {roundData.end}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Chip variant="info">Optimal {roundData.optimalDistance} hops</Chip>
            <Chip variant="muted">Budget {roundData.maxGuesses}</Chip>
            <Pill>{guessesLeft} guesses left</Pill>
          </div>
        </Card>

        {/* Countdown */}
        <div className="flex justify-center">
          <Countdown secondsLeft={seconds} totalSeconds={totalSec} />
        </div>

        {/* Chain strip (replaces ChainList; meets in the middle) */}
        <Card>
          <ChainStrip frontChain={frontChain} backChain={backChain} solved={solved} />
        </Card>

        {/* Invalid toast */}
        {invalidToast && (
          <div className="flex justify-center">
            <Pill tone="danger">{invalidToast}</Pill>
          </div>
        )}

        {/* Autocomplete OR end-of-round message */}
        {!solved && !noBudget && (
          <CountryAutocomplete
            countries={countries}
            onSubmit={submit}
            placeholder={`Border of ${frontChain[frontChain.length - 1]?.name ?? roundData.start} or ${backChain[0]?.name ?? roundData.end}…`}
          />
        )}
        {solved && (
          <p className="text-center font-display text-2xl font-black text-action">
            Reached {roundData.end}!
          </p>
        )}
        {!solved && noBudget && (
          <p className="text-center font-display text-2xl font-black text-danger">
            Budget exhausted — waiting for round to end…
          </p>
        )}
      </motion.div>
    </div>
  );
};
```

**Note on `Pill` usage:** the existing `Pill` primitive may not accept a `tone="danger"` prop directly; if its API only has `variant`, swap to `<Pill variant="danger">` or use a manual inline `<span>` with `border-ink bg-danger text-on-danger` and `shadow-ink-sm`. Use whichever matches the current `Pill` signature (check `packages/client/src/ui/Pill.tsx`) — do **not** invent props.

**Note on `Card` `variant="streak"`:** likewise, check whether `Card` accepts a variant. If not, achieve the streak-tinted look with `className="border-streak bg-streak text-on-streak shadow-[4px_4px_0_var(--ink)]"` instead.

**Note on `Countdown` props:** check `packages/client/src/ui/Countdown.tsx` for its actual prop names. The names `secondsLeft` / `totalSeconds` above are placeholders — replace them with whatever the component actually exports.

- [ ] **Step 2: Delete `packages/client/src/components/travel/ChainList.tsx`**

```bash
rm packages/client/src/components/travel/ChainList.tsx
```

Then search the codebase to ensure no other file imports it:

```bash
cd packages/client && grep -rn "ChainList" src/ || echo "no remaining references"
```

Expected: only the removed file itself (already gone) — no other imports.

- [ ] **Step 3: Verify build + dev**

```bash
cd packages/client && npm run build
```

Expected: success. Boot the dev stack (server + client + host) and smoke-test:
1. Start a Travel round from the host.
2. Confirm on the player: intro renders the Card; playing phase shows the banner + countdown + chain strip + autocomplete — **no map visible**.
3. Submit a few guesses, confirm chain pills appear in the right color and the strip wraps cleanly.
4. End the round, confirm results phase shows the map with pins dropping and arcs drawing in sequence.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/screens/Travel.tsx
git rm packages/client/src/components/travel/ChainList.tsx
git commit -m "feat(client/travel): rewrite Travel screen on new primitives, hide map during play"
```

---

### Task 8: Mirror `GuessPin` + `GuessArc` to host package

**Files:**
- Create: `packages/host/src/components/travel/GuessPin.tsx`
- Create: `packages/host/src/components/travel/GuessArc.tsx`

- [ ] **Step 1: Copy the two files from Task 5 into `packages/host/src/components/travel/`**

Identical contents — only the relative import path to `motion.ts` differs (it's `../../lib/motion` in both packages, so the file is literally identical).

- [ ] **Step 2: Verify build**

```bash
cd packages/host && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add packages/host/src/components/travel/GuessPin.tsx packages/host/src/components/travel/GuessArc.tsx
git commit -m "feat(host/travel): mirror GuessPin + GuessArc SVG components"
```

---

### Task 9: Reskin `HostTravelMap` — tokens, chrome, pin/arc overlay, full-text endpoint labels

**Files:**
- Modify: `packages/host/src/components/travel/HostTravelMap.tsx`

This is the host-side equivalent of Task 6, plus two extras:
- The map renders **labels** for start and end pins, in full text ("Start: France", "End: Egypt") — never abbreviated.
- The map accepts a `playerGuesses` prop: an array of `MapGuess`-shape entries from every player, drawn together so the results map shows the swarm of attempts.

- [ ] **Step 1: Replace `FILL` constants with CSS-var references**

```ts
const FILL = {
  unvisited: 'var(--bg-sunken)',
  start:     'var(--now)',
  end:       'var(--now)',
  green:     'var(--action)',
  orange:    'var(--warn)',
  red:       'var(--danger)',
  optimal:   'var(--streak)',   // heritage terracotta — celebration only
} as const;

const STROKE_BRIGHT = 'var(--ink)';
```

- [ ] **Step 2: Replace the wrapping `<div>` chrome**

Change from:

```tsx
<div className="overflow-hidden rounded-3xl border border-white/10 bg-black/40">
```

to:

```tsx
<div className="overflow-hidden rounded-3xl border-2 border-ink bg-bg-sunken shadow-ink-lg">
```

- [ ] **Step 3: Add `playerGuesses` prop + pin/arc overlay**

Extend `HostTravelMapProps`:

```ts
export interface HostMapGuess {
  guess: string;
  answer: string;            // start or end, per the heuristic in Task 7
  color: 'green' | 'orange' | 'red';
  playerId: string;          // for unique React keys
}

interface HostTravelMapProps {
  /* …existing… */
  playerGuesses?: HostMapGuess[];
}
```

Compute screen-space points the same way as in Task 6 (project centroid via `projection(geoCentroid(feature))`).

Inside the `<ComposableMap>`, after `<Geographies>`:

```tsx
{points.length > 0 && (
  <>
    <g>
      {points.map((p, i) => (
        <GuessArc
          key={`arc-${p.playerId}-${i}`}
          x1={p.from.x} y1={p.from.y}
          x2={p.to.x}   y2={p.to.y}
          color={p.color}
          delaySec={Math.min(i * 0.04, 1.2)}
        />
      ))}
    </g>
    <g>
      {points.map((p, i) => (
        <GuessPin
          key={`pin-${p.playerId}-${i}`}
          cx={p.from.x} cy={p.from.y}
          color={p.color}
          delaySec={Math.min(i * 0.04, 1.2)}
        />
      ))}
    </g>
  </>
)}
```

The shorter stagger + the `Math.min(..., 1.2)` cap keep the whole reveal under ~1.5s even for 30+ guesses (it would feel laggy otherwise).

- [ ] **Step 4: Add start/end full-text labels**

After the overlay `<g>`s, render a final overlay `<g>` with two `<text>` elements positioned just below the start/end centroids:

```tsx
{startPoint && (
  <g>
    <rect x={startPoint.x - 60} y={startPoint.y + 12} width={120} height={24}
          rx={6} fill="var(--bg-surface)" stroke="var(--ink)" strokeWidth={2} />
    <text x={startPoint.x} y={startPoint.y + 28}
          textAnchor="middle" fontSize={12} fontWeight={800} fill="var(--ink)">
      Start: {startName}
    </text>
  </g>
)}
{endPoint && (
  <g>
    <rect x={endPoint.x - 60} y={endPoint.y + 12} width={120} height={24}
          rx={6} fill="var(--bg-surface)" stroke="var(--ink)" strokeWidth={2} />
    <text x={endPoint.x} y={endPoint.y + 28}
          textAnchor="middle" fontSize={12} fontWeight={800} fill="var(--ink)">
      End: {endName}
    </text>
  </g>
)}
```

(Width `120` is tight for long names like "Democratic Republic of the Congo" — accept that those overflow visually for now; Phase 11 cleanup can switch to dynamic width via a `<foreignObject>` if needed.)

- [ ] **Step 5: Verify build**

```bash
cd packages/host && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add packages/host/src/components/travel/HostTravelMap.tsx
git commit -m "feat(host/travel): reskin HostTravelMap + pin/arc reveal + full-text labels"
```

---

### Task 10: Rewrite `TravelDisplay` — hide map during play, use primitives, consistent host skeleton

**Files:**
- Modify: `packages/host/src/screens/TravelDisplay.tsx`

The host skeleton (per spec §7.3) is: top-left location label, top-right time-panel, centre game content, bottom player tracker. Current `TravelDisplay` partially conforms; this rewrite tightens it.

- [ ] **Step 1: Rewrite `packages/host/src/screens/TravelDisplay.tsx`**

Three phases:

1. **Intro** — same Card/Fraunces treatment as the player intro, scaled up.
2. **Playing** — map hidden. Top-left "Travel · Round in progress" eyebrow + big challenge title ("France → ??? → Egypt"). Top-right big countdown. Centre: large optimal-hops/budget Chips. Bottom: player tracker grid (existing logic — guess counts, solved/out-of-budget status — using new tones via `Card`/`Chip`).
3. **Results** — full `HostTravelMap` with `playerGuesses` aggregated from every player's history. Start/end pins are labelled in full text by the map itself (Task 9). Right side: top-scorers panel built from `Card` + `LeaderboardRow`. Bottom: solved-count summary.

Highlights of the rewrite (NOT a full re-paste; the changes are mechanical):

```tsx
import { Card, Chip, Pill, LeaderboardRow } from '../ui';
import { HostTravelMap, HostMapGuess } from '../components/travel/HostTravelMap';

// Inside the results-phase render:
const playerGuesses: HostMapGuess[] = (resultsData.results || []).flatMap((r: any) =>
  (r.history || [])
    .filter((h: any) => h.color !== 'red')
    .map((h: any) => ({
      playerId: r.playerId,
      guess: h.name,
      answer: h.side === 'front' ? resultsData.start : resultsData.end,
      color: h.color,
    }))
);

// …then pass `playerGuesses={playerGuesses}` to <HostTravelMap />.
```

For the playing phase, the tracker tile palette flips from raw hex (`bg-game-correct/10` etc.) to tokens:

```tsx
const tone = isSolved
  ? 'border-action bg-action/15 text-action'
  : outOfBudget
    ? 'border-danger bg-danger/15 text-danger'
    : 'border-ink bg-bg-surface text-ink';
```

The bottom "X of Y solved" line uses a `Pill`. The challenge banner uses `Card` chrome only if the host skeleton wants a card here; otherwise a plain header block on top of `bg-bg-base` is fine. **Match what other host display screens already do** for consistency (check `packages/host/src/screens/WordleDisplay.tsx` and `NumbersDisplay.tsx` — they are the closest precedents, both migrated in Phases 7 and 9).

**Sanity checks against the spec §7.3 skeleton:**
- ✓ Top-left "Travel · Round in progress" (full text, no abbreviation)
- ✓ Top-right timer panel — same position as every other host screen, dimmed on results
- ✓ Centre: game content only (challenge banner during play, map on results)
- ✓ Bottom: player tracker with explicit "X of Y" count
- ✗ No category chips, no auxiliary player-count badges, no extra pills competing with the tracker

- [ ] **Step 2: Smoke-test in the dev stack**

Boot server + client + host, log host in, join two phones to the lobby, start a Travel round.

1. **Player intro / Host intro** — both render Card layouts in matching tone.
2. **Playing**: host shows challenge banner + big countdown + tracker — **no map**. Player phones show no map either. Submit a few guesses on each phone. Host tracker updates to "2/8 guesses" / "✓ solved in 3" / etc.
3. **Results**: host shows the full map with pins dropping (380ms each, ~40ms stagger between players), arcs drawing in (~500ms each), start/end labels in full text. Right-side top-scorer panel is legible. Player phones show the per-player map with their own pins.
4. **Theme flip** during the results screen — confirm map fills/strokes transition smoothly (no transform jank; just color crossfade) per spec §5.5.

- [ ] **Step 3: Commit**

```bash
git add packages/host/src/screens/TravelDisplay.tsx
git commit -m "feat(host/travel): rewrite TravelDisplay on new primitives, hide map during play"
```

---

### Task 11: Cross-package build + visual QA in both themes

**Files:** none (verification only).

- [ ] **Step 1: Both builds clean**

```bash
cd packages/client && npm run build
cd ../host && npm run build
```

Expected: zero TypeScript errors, zero Tailwind warnings.

- [ ] **Step 2: Run client unit tests (theme provider should still pass)**

```bash
cd packages/client && npm run test:run
```

Expected: same green count as before this plan (no new tests in this phase; no existing tests broken).

- [ ] **Step 3: End-to-end smoke**

Three terminals (server / client / host), play through one full Travel round at light + dark themes:

**Light theme checklist:**
- Intro Card readable on `bg-base` cream
- Challenge banner during play: `Start → ??? → End` legible at glance
- Chain pills: green/orange/red distinguishable; ink borders crisp
- Autocomplete dropdown: ink border, info-cobalt active item
- Countdown ring fills clockwise; number beats on each tick
- Results map: pins drop with bounce, arcs draw, start/end yellow, optimal path terracotta
- Score `+N pts` displayed in display-weight black

**Dark theme checklist:**
- Same five screens flip cleanly when toggling theme mid-results (no flash, no transform jank)
- Cream borders + terracotta drop-shadow under cards as defined in spec §2.1
- Map fills remain legible against dark `--bg-sunken`

- [ ] **Step 4: `prefers-reduced-motion` check**

In Chrome DevTools → Rendering → Emulate CSS prefers-reduced-motion: `reduce`. Replay a Travel round to results:

- Pins should appear (no drop) — opacity crossfade only via `reducedFade` fallback (acceptable: the `pinDrop` variant still transforms; if jarring, the executor can add a `useReducedMotion()` guard in `GuessPin` later — flag as known follow-up, do NOT block this phase on it)
- Arcs should appear (no draw) — full-opacity at start

If the executor decides reduced-motion compliance is required immediately, see Task 11 step-5 below.

- [ ] **Step 5 (optional, judgement call): reduced-motion variants**

If reduced-motion playback is jarring (pins teleporting visibly), wrap `GuessPin` and `GuessArc` with a `useReducedMotion()` guard from `framer-motion` that:
- For `GuessPin`: skips the `variants` and renders the circle at full opacity.
- For `GuessArc`: skips the `strokeDashoffset` animation and renders the full path immediately.

This is a small addition and uniform across both packages. Commit as a separate step if added.

- [ ] **Step 6: Commit (if step 5 was taken)**

```bash
git add packages/client/src/components/travel/GuessPin.tsx \
        packages/client/src/components/travel/GuessArc.tsx \
        packages/host/src/components/travel/GuessPin.tsx \
        packages/host/src/components/travel/GuessArc.tsx
git commit -m "fix(travel): respect prefers-reduced-motion in GuessPin + GuessArc"
```

Otherwise nothing to commit — verify clean working tree with `git status`.

---

## Done criteria

All of the following must be true before the plan is considered complete:

- [ ] `npm run build` succeeds in both `packages/client` and `packages/host`
- [ ] `npm run test:run` in `packages/client` still shows the foundation-phase tests passing (no regressions)
- [ ] Player Travel intro renders on the new Card / Fraunces / Chip language
- [ ] During play, the player Travel screen does **not** render `TravelMap` — only the challenge banner, countdown, chain strip, and autocomplete
- [ ] Chain pills render in green (`--action`), orange (`--warn`), red (`--danger`) tones with ink borders + hard shadow
- [ ] On player results, the map renders with pins dropping (380ms bounce) and arcs drawing (500ms stroke-dashoffset), staggered ~120ms per guess
- [ ] Host TravelDisplay intro mirrors the player intro in tone
- [ ] During play, the host display does **not** render `HostTravelMap` — only the challenge banner, large countdown, and player tracker
- [ ] On host results, `HostTravelMap` renders with all players' pins and arcs (capped stagger so the full reveal completes in <1.5s)
- [ ] Start/end pins on host results are labelled "Start: X" / "End: Y" in full text (no abbreviations)
- [ ] All map fills/strokes are CSS-variable references — theme toggle flips them smoothly
- [ ] `ChainList.tsx` is deleted; no remaining imports
- [ ] No other game has regressed (smoke-test Quiz or one previously-migrated game to confirm)
- [ ] No `index.css` rules or legacy Tailwind tokens were removed (those are Phase 11)

---

## What this plan does NOT do (next plans)

- **Phase 11** — Final-cleanup pass: remove deprecated `index.css` rules (`.screen-frame`, `.eyebrow`, `.card`, …) and old Tailwind tokens (`game.leader`, `ui.textMuted`, etc.); WCAG AA contrast audit; full `prefers-reduced-motion` substitution sweep; mobile QA across every game.
