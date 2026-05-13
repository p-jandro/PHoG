# PHoG UI Redesign — Design Spec

**Date:** 2026-05-13
**Status:** Approved through Section 7; pending implementation plan
**Scope:** Both player (`packages/client`) and host (`packages/host`) apps, every screen

---

## 1. Design language

PHoG becomes a **bold, modern party game** with a touch of British pub-quiz class. The visual language is high-contrast and chunky — flat color blocks, 2px ink borders, soft hard-shadows — but executed with restraint: generous whitespace, careful type rhythm, and a single serif moment kept for show titles to nod to the original "House of Games" feel. Color does the heavy lifting: green is *go*, sun-yellow is *now*, cobalt is *info*, terracotta is *streak/celebration*, plum is *premium*. Light mode is the default; dark mode is a first-class toggle, not an afterthought.

**Personality dials:**
- **Chunkiness:** medium — 2px borders, 3–5px hard shadows
- **Saturation:** medium-high — fresh palette, heritage warm tones reserved for hero moments
- **Motion:** snappy with occasional bounce — playful but never blocking input
- **Typography:** one display sans for everything, plus a serif (Fraunces) kept *only* for game-mode title splashes and the final leaderboard headline

---

## 2. Color tokens & typography

### 2.1 Color tokens

Tokens are semantic. Components reference roles (`action`, `now`, `streak`), not raw hexes. Tokens are defined as CSS custom properties scoped by `[data-theme]`.

| Role | Light value | Dark value | Used for |
|---|---|---|---|
| `--bg-base` | `#fdf6e8` cream | `#131013` night | App background |
| `--bg-surface` | `#ffffff` | `#1f1b1a` charcoal | Cards, sheets |
| `--bg-sunken` | `#f2e9d4` | `#171313` | Inputs, wells |
| `--ink` | `#181614` | `#fdf6e8` | Borders + primary text |
| `--ink-muted` | `#4a3f33` | `#b4a48b` | Secondary text |
| `--shadow` | `#181614` | `#d96a3a` terracotta | Hard offset shadow color |
| `--action` | `#2ec27e` grass | `#3ad286` | Primary CTA, "Go", correct |
| `--now` | `#ffd23f` sun | `#ffd23f` | Current player, "you", in-progress highlight |
| `--info` | `#4a7adf` cobalt | `#6b95ee` | Info chips, round indicators, secondary action |
| `--streak` | `#d96a3a` terracotta *(heritage)* | `#e88557` | Hot streak, hero moments, celebrations |
| `--premium` | `#5b3a5b` plum *(heritage)* | `#7a4f7a` | Final round, leaderboard winners |
| `--danger` | `#e54848` | `#ff6b6b` | Wrong answer, errors |
| `--warn` | `#f59e0b` | `#ffb84d` | "Close" / partial / time-running-out |
| **Answer A/B/C/D** | cobalt / grass / sun / plum | (brighter variants) | Quiz / TrueFalse buttons |
| **Medals** | gold `#e0b94a` · silver `#b9b0a3` · bronze `#b8714a` | (same) | Leaderboard ranks |

**Notes:**
- The current `primary.blue` Tailwind token is misnamed (`#d06d45` terracotta). It is retired in favor of semantic roles.
- Tile / keyboard colors (Wordle, DLE Classic) map to: green = `--action`, yellow = `--now`, red = `--danger` — existing game logic doesn't change, only the colors underneath.
- Heritage `--streak` (terracotta) and `--premium` (plum) are *reserved* — they only appear on streaks/celebrations and finals/winners. They do not appear in default chrome.

### 2.2 Typography

| Role | Family | Where it shows up |
|---|---|---|
| **Body / UI** | **Inter** (400, 500, 600, 700, 800) | Default — buttons, inputs, body, scores, chips |
| **Display** | **Inter Tight** (700, 800, 900) | Big numbers, leaderboards, hero counts |
| **Heritage serif** | **Fraunces** (700, soft variant) | Game-mode splash titles + final leaderboard winner headline. Nowhere else. |

Loaded via Google Fonts with `font-display: swap`.

**Type scale** (rem, ~1.2 ratio): `xs 0.75 / sm 0.875 / base 1 / lg 1.125 / xl 1.25 / 2xl 1.5 / 3xl 1.875 / 4xl 2.25 / 5xl 3 / 6xl 4 / display 5.5`. Headings default to weight 800; display moments use 900 with letter-spacing `-0.03em`.

---

## 3. Component primitives

The kit every screen consumes. All variants have explicit states: default, hover, pressed, focused, disabled, loading (where applicable).

### 3.1 `Button`

- **Variants:** `action` · `info` · `streak` · `premium` · `danger` · `now` · `ghost`
- **Sizes:** `sm` · `md` (default) · `lg`
- **States:**
  - Default: 2px ink border, hard offset shadow (3/4/5px by size)
  - Hover: lifts 1px, shadow grows by 1px (`motion.hover`, 120ms ease-out)
  - Pressed: translates +4/+4, shadow shrinks to 1px (`motion.tap`, 80ms)
  - Focused: 3px cobalt outline, 3px offset
  - Disabled: 40% opacity, no transforms
  - Loading: trailing `● ● ●` indicator, blink

### 3.2 `Input`

- 2px ink border, hard shadow, sunken background
- Focus: cobalt border + cobalt shadow
- Error: danger border + danger shadow + error helper text below
- Always paired with an uppercase label

### 3.3 `Card`

- Surface block with optional eyebrow (terracotta heritage), title, and chip strip
- 2px border, 5–6px hard shadow

### 3.4 `Chip` / `Pill`

- Inline flat label, 2px border, 2px shadow
- Variants: default · `now` (sun bg) · `info` (cobalt bg) · `streak` (terracotta bg) · `muted` (sunken bg)
- `Pill` is the rounded version, used for connection/status indicators with a live dot

### 3.5 `Tile`

- Used for Wordle, DLE Classic, Themed-DLE Grid
- States: `idle` · `correct` (green) · `partial` (sun) · `wrong` (red)
- Supports flip animation via framer-motion `rotateX` variant

### 3.6 `LeaderboardRow`

- Grid: medal + name + score + delta
- "You" rows highlight `now` (sun) background
- Down-deltas flip to `danger` red
- Smooth reorder via framer-motion `layout` (FLIP)

### 3.7 `Avatar`

- 36px circle, colored fill, white initials, ink border, hard shadow
- Color assigned deterministically from player ID

### 3.8 `Countdown`

- Circular ring + big Inter Tight number
- Ring fills clockwise via `stroke-dashoffset`
- Number beats on each tick

### 3.9 `ScoreDrop` *(Pointless only)*

- Vertical 100→0 gradient track (red/orange/yellow/green)
- Ink panel drops from the top with the score on its bottom edge
- **Timing: 4000ms base + 90ms per point dropped, ease-out cubic, ~13s for a full drop to 0**
- "POINTLESS" callout (Fraunces) flashes when the panel lands at 0
- Pause at the landing: 2800ms for 0, 1800ms otherwise

### 3.10 `ThemeToggle`

- Pill-shaped track, draggable thumb with ☀ / ☾ icon
- 180ms spring transition

Dark-mode variants of every primitive use the same shapes; only the surface and shadow tokens flip (cream borders, terracotta offset shadow).

---

## 4. Motion

### 4.1 Three governing rules

1. **Animate state changes, not decoration.** Score reveals, guess results, players joining — yes. Background gradients pulsing for no reason — no.
2. **Reactive ≥ transition.** Cool screen-to-screen transitions are bonus; the priority is every in-mode action getting satisfying feedback.
3. **`prefers-reduced-motion` is respected.** Transforms get swapped for crossfades; colors and information still land.

### 4.2 Motion tokens

| Token | Duration | Easing | Used for |
|---|---|---|---|
| `motion.tap` | 80ms | ease-out | Button press |
| `motion.hover` | 120ms | ease-out | Button/card hover |
| `motion.toggle` | 180ms | spring (stiffness 280, damping 22) | Theme toggle, chip pop |
| `motion.enter` | 220ms | ease-out | Screen mount |
| `motion.reveal` | 280ms | back-out `cubic-bezier(.34, 1.56, .64, 1)` | Tile flip, score reveal |
| `motion.celebrate` | 600ms | various | Final winner, streak unlock |
| `stagger.short` | 80ms | — | Avatar row, chip row entry |
| `stagger.tile` | 180ms | — | Tile-by-tile reveal |
| `stagger.rank` | 600ms | — | Final leaderboard reveal |

All durations live in one file (`src/lib/motion.ts`) for easy global tuning.

### 4.3 Universal reactive feedback

- **Correct:** surface pulses green (1.0 → 1.04 → 1.0, 240ms) + tick icon pops in
- **Wrong:** horizontal shake (8px × 4, 320ms) + red border flash
- **Streak:** terracotta "🔥 N× streak" chip pops in on 2+ correct (1.2s linger, scale 0 → 1.15 → 1.0 back-out)

### 4.4 Per-game animation catalog

| Game | In-mode animations |
|---|---|
| **Themed-DLE Classic** | Tile flip cascade — 90° rotateX, 250ms each, 180ms stagger, color reveals at midpoint |
| **Themed-DLE Grid 3×3** | Cell scale-pop — 0.7 → 1.05 → 1.0, 220ms, 80ms stagger |
| **Themed-DLE Silhouette** | Correct: brightness crossfade ink → color, 350ms + scale 1.0 → 1.03 → 1.0. Wrong: universal shake/flash |
| **Themed-DLE Emoji clue** | Sequential pop — scale 0 → 1.15 → 1.0, 140ms each, 90ms stagger |
| **Themed-DLE Spell hint** | Letter drop — translateY -12 → 0 + fade, 90ms stagger |
| **Wordle** | Tile flip (as Classic) + keyboard recolor cascade (200ms crossfades) |
| **Numbers** | Digit roll — each digit cycles 0–9 then lands with small overshoot, 300ms ease-out |
| **Travel** | Pin drop (380ms bounce) + arc draw from guess to answer (500ms stroke-dashoffset) |
| **Pointless** | `ScoreDrop` component — see 3.9 for full timing |
| **Quiz** | Selected button: tactile press → correct pulse OR wrong shake/flash + "Correct!" banner slide |
| **TrueFalse** | Same as Quiz |
| **Lobby** | Avatar pop-in (scale 0 → 1.1 → 1.0) as joins arrive; connection dot pulses while connecting |
| **Countdown** | Number beats on each tick + ring fills clockwise |
| **Round leaderboard** | FLIP reorder via framer-motion `layout` |
| **Final leaderboard** | Bottom-up rank reveal (place 5 → 1, 600ms each); rank 1 confetti burst in heritage palette; Fraunces winner headline |

### 4.5 Accessibility & performance

- `prefers-reduced-motion`: all transform-based reveals replaced with 180ms crossfades; colors still change so information lands
- No animation blocks input — submit commits immediately, reveal plays after
- Only `transform`, `opacity`, and color properties on hot paths — never `width/height/box-shadow` animations

---

## 5. Theme mechanics

### 5.1 State model

| Stored value (`localStorage.phog-theme`) | Behavior |
|---|---|
| `"light"` | Force light, survives reloads |
| `"dark"` | Force dark, survives reloads |
| *(unset)* | Read `prefers-color-scheme` and follow it live until user toggles |

The toggle is two-state (light ↔ dark); the "auto/system" state is the default, not a third button.

### 5.2 Anti-flash

Inline script in `packages/client/index.html` and `packages/host/index.html` runs before React mounts:

```html
<script>
  (function () {
    var saved = null;
    try { saved = localStorage.getItem('phog-theme'); } catch (_) {}
    var theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  })();
</script>
```

### 5.3 ThemeProvider

`src/lib/theme.tsx` exports `{ theme, setTheme, toggle }`. Reads initial state from `data-theme`, persists changes, subscribes to `prefers-color-scheme` (only applies if user hasn't committed manually), updates `data-theme` on every change.

### 5.4 CSS shape

```css
:root[data-theme="light"] { --bg-base: #fdf6e8; /* ...full table */ }
:root[data-theme="dark"]  { --bg-base: #131013; /* ...full table */ }
```

Components consume tokens via Tailwind classes (e.g. `bg-action`) that map to `var(--action)`.

### 5.5 Transition on flip

180ms ease-out on `background-color`, `border-color`, `color`, `box-shadow`, `fill`, `stroke`. Not on `transform` or `opacity` — to avoid laggy mid-animation flips. This is a one-off transition on theme change only; the §4.5 rule against `box-shadow` animations on game hot paths still holds — game animations stay on `transform` + `opacity`.

### 5.6 Toggle placement

- **Player client:** top-right of the persistent header; tucked into a "⋯" menu during active gameplay (so it can't be hit while answering)
- **Host display:** top-right of the dashboard; hidden on game screens

### 5.7 Independence

Player and host each persist their own theme in their own `localStorage`. Host on a TV may want dark forever; players choose per-device.

### 5.8 Test plan

- OS dark → renders dark, no flash
- OS light → renders light, no flash
- Toggle to dark, reload → still dark
- After manual toggle, OS theme change → app does not follow
- Clear localStorage, OS theme change → app follows

---

## 6. Architecture

### 6.1 File layout

```
packages/client/src/
  ui/
    tokens.css           # CSS variables for both themes
    Button.tsx
    Input.tsx
    Card.tsx
    Chip.tsx
    Pill.tsx
    Tile.tsx
    LeaderboardRow.tsx
    Avatar.tsx
    Countdown.tsx
    ScoreDrop.tsx        # Pointless drop-bar
    ThemeToggle.tsx
    index.ts             # barrel
  lib/
    theme.tsx            # ThemeProvider
    motion.ts            # duration + easing + framer-motion variants
  index.css              # imports tokens.css + font @font-face + base styles
```

The same `ui/` + `lib/` tree is duplicated under `packages/host/src/`. Duplication is cheaper than introducing a workspace package for ~15 files; if the tree grows, factor later.

### 6.2 Tailwind config

`tailwind.config.js` is rewritten to consume CSS variables:

```js
theme: {
  extend: {
    colors: {
      'bg-base':    'var(--bg-base)',
      'bg-surface': 'var(--bg-surface)',
      'ink':        'var(--ink)',
      'action':     'var(--action)',
      'now':        'var(--now)',
      'info':       'var(--info)',
      'streak':     'var(--streak)',
      'premium':    'var(--premium)',
      'danger':     'var(--danger)',
      /* ... */
    },
    fontFamily: {
      sans:    ['Inter', 'system-ui', 'sans-serif'],
      display: ['"Inter Tight"', 'Inter', 'sans-serif'],
      serif:   ['Fraunces', 'Iowan Old Style', 'serif'],
    },
    boxShadow: {
      'ink-sm': '2px 2px 0 var(--shadow)',
      'ink':    '4px 4px 0 var(--shadow)',
      'ink-lg': '6px 6px 0 var(--shadow)',
    },
  },
},
```

### 6.3 Migration safety

- New `ui/` primitives are added without removing old styles. Existing screens keep working.
- Old `index.css` rules (`.card`, `.btn-primary`, etc.) stay in place until the screens using them are migrated.
- Each migration PR is independently shippable: `npm run build` and `npm run dev` succeed for every package.
- The old Tailwind tokens (`primary.blue`, `game.correct`, etc.) stay in `tailwind.config.js` until the final cleanup PR removes them.

---

## 7. Screen-by-screen plan

### 7.1 Player client (10 screens)

| Screen | Key changes |
|---|---|
| **Lobby** | New join card with chunky button, status pill, avatar wall pops in as players join |
| **Countdown** | Big circular timer (Inter Tight), ring fill, beat on each tick |
| **Quiz** | Answer buttons in answer-letter colors (A=cobalt, B=grass, C=sun, D=plum), tactile press, correct/wrong feedback |
| **TrueFalse** | Two large buttons (true=grass, false=danger); same feedback contract as Quiz |
| **Pointless** | Submission input → submitted state → `ScoreDrop` reveal (~13s drama) |
| **ThemedDle** | Mode intros use Fraunces splash; all 5 modes use new tile/grid/silhouette/emoji/spell components |
| **Wordle** | New Tile + Keyboard; flip cascade reveal; keyboard recolor cascade |
| **Numbers** | Digit-roll score reveals; new input strip |
| **Travel** | Map (existing library) skinned to new palette; pin drop + arc reveal |
| **FinalLeaderboard** | Fraunces winner headline; rank reveal 5→1; confetti burst (heritage palette) |

### 7.2 Player shared components

- `GamePromptHeader` — eyebrow + title + chip strip, rebuilt from primitives
- `GameStatusBar` — connection pill + score chip + theme toggle (hidden during active play)
- `PausedOverlay` — full-screen overlay using new Card
- `PlacementLeaderboard` / `RoundLeaderboardOverlay` — new LeaderboardRow + FLIP reorder

### 7.3 Host display (6 screens)

| Screen | Key changes |
|---|---|
| **Dashboard** | Chunky game-launch buttons, player tracker, theme toggle top-right |
| **Display** *(active game shell)* | TV-optimized chrome — bigger type, taller leaderboard, no toggle |
| **NumbersDisplay** | Big digit-roll reveals; player tracker chips |
| **ThemedDleDisplay** | Mode banner (Fraunces splash), live player tracker |
| **TravelDisplay** | Map skinned; results show all pins with arcs |
| **WordleDisplay** | TV-sized tiles; flip cascade synchronized across players |

### 7.4 Migration order

Each row is one shippable PR.

1. Foundation — tokens, fonts, ThemeProvider, ThemeToggle, motion utilities, anti-flash script
2. Primitives library — Button, Input, Card, Chip, Pill, Tile, LeaderboardRow, Avatar, Countdown
3. Lobby (player) + Dashboard (host)
4. Countdown + FinalLeaderboard + Round/Placement leaderboards
5. Quiz + TrueFalse
6. Pointless (incl. `ScoreDrop`)
7. Wordle + WordleDisplay
8. ThemedDle (all 5 modes) + ThemedDleDisplay
9. Numbers + NumbersDisplay
10. Travel + TravelDisplay
11. Polish pass — `prefers-reduced-motion` substitutions, WCAG AA contrast audit, mobile QA, removal of deprecated `index.css` rules and old Tailwind tokens

### 7.5 Out of scope

- Audio (existing `public/audio` stays as-is)
- Server-side / data-layer changes
- New games or new game modes
- New languages / i18n
- Replacing the map library (just reskinning)

### 7.6 Per-PR verification gate

- `npm run build` succeeds for `server`, `client`, `host`
- `npm run dev` boots cleanly for all three
- A playthrough of every game touched in the PR
- Light AND dark mode visually checked on each touched screen
- `prefers-reduced-motion` checked once at the end of the polish PR

---

## 8. Decisions recap

| Decision | Choice |
|---|---|
| Surfaces in scope | Both player and host |
| Design language | Bold & Playful (Duolingo / Cash App energy), classier execution |
| Default theme | Light, with dark toggle |
| Theme behavior | System-aware default + manual override + `localStorage` persistence |
| Scope | The whole thing — new tokens, new component library, every screen reskinned |
| Palette | Fresh & Punchy (grass/sun/cobalt) + heritage warmth (terracotta + plum) reserved for hero/final moments |
| Typography | Inter + Inter Tight + Fraunces (Google Fonts) |
| Heritage serif (Fraunces) usage | Only game-mode splashes + final winner headline |
| Chunkiness | Medium — 2px borders, 3–5px hard shadows |
| Motion personality | Playful but never blocking input; in-mode reactive animations are first-class |
| Pointless drop timing | 4000ms base + 90ms per point; ~13s for full drop to 0 |
