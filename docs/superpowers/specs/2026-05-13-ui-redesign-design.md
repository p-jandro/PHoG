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

### 3.11 `HostScreenShell` *(host-only; created in Phase 3, consumed in Phases 4–10)*

The visual scaffold for every host TV screen — guarantees the §7.3 host-screen skeleton (location top-left · time-left top-right · content centre · footer bottom) is consistent across Dashboard, Display, NumbersDisplay, ThemedDleDisplay, TravelDisplay, WordleDisplay.

- **Layout slots:**
  - top-left: `location` (eyebrow + name strings, e.g. eyebrow "Quiz Round" + name "Question 7 of 15")
  - top-right: time-left panel — dimmed to "—:—" when `timeLeftSeconds` is `null` or `undefined`, so layout never shifts
  - centre: `children` (the game's actual content)
  - bottom: `footer` (typically a `PlayerTracker`)
- **Props:** `location` (`{ eyebrow: string; name: string }`), `timeLeftSeconds` (`number | null`), `children` (centre content), `footer` (typically a `PlayerTracker`)
- All host TV screens consume it for visual consistency

### 3.12 `PlayerTracker` *(host-only; created in Phase 3)*

A scrollable horizontal list of player chips showing connection state + score + per-game status (e.g. exact / closest / in-progress / no-submission for Numbers; per-player guess count for Wordle/ThemedDle).

- **Props:** `players` (`TrackedPlayer[]`), optional `label`, optional `count` string ("3 of 6")
- Consumed by every host screen's `HostScreenShell.footer`

### 3.13 `AnswerFeedback` *(created in Phase 5)*

Wraps any answer-affirming surface with the universal §4.3 reactive feedback contract — correct pulse / wrong shake / streak chip pop — so each game's answer-commit moment looks and feels the same.

- Used by Quiz and TrueFalse today; extensible to any other answer-commit surface (e.g. a future Pointless "submitted" confirmation)
- Respects `useReducedMotion()` — transforms swap for color flashes; chip still pops in as a fade

### 3.14 `Confetti` *(created in Phase 4)*

Heritage-palette confetti burst (terracotta + plum + gold) for rank-1 reveals on `FinalLeaderboard`. Pure presentational, no audio.

- Renders **nothing** under `useReducedMotion()` — the rank reveal still lands via color + headline; confetti is decorative.

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

**Motion variants added during migration** — `motion.ts` has been extended phase-by-phase with the following game-specific variants (all built on the tokens above):

- Phase 5 (Quiz / TrueFalse): `correctPulse`, `wrongShake`, `streakChipPop`, `bannerSlideDown`, plus the `prefersReducedMotion()` helper
- Phase 8 (ThemedDle): `cellScalePop`, `emojiPop`, `silhouetteReveal`, `shake`, plus stagger constants `stagger.cell` and `stagger.emoji`
- Phase 10 (Travel): `pinDrop`, `arcDrawTransition`

Each is documented inline in `lib/motion.ts`. Both `packages/client` and `packages/host` keep their `motion.ts` in sync (per spec §6.1 — file duplication over a workspace package).

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

- **Host control-panel composition:** §7.3 originally listed Dashboard panels as "game-launch buttons, player tracker, theme toggle". Three legacy panels (Live Game, Championship Table, Quick Guide) have been **removed** during Phase 3 migration because they duplicated the Display screen's responsibility or weren't in the original spec scope. Dashboard is leaner as a result (~440 lines vs 867 before).

**Host-screen skeleton — same on every screen.** Top-left: location, one line, full text (e.g. "Quiz Round · Question 7 of 15"). Top-right: time-left panel, same component, same place, every screen — dimmed to "—:—" on Dashboard and results screens so the layout never shifts. Centre: only the game's actual content. Bottom: the player tracker (with an explicit "X of Y" count) — and nothing competes with it above. No category chips, no extra player-count badges, no auxiliary pills.

**Full-text labels everywhere.** No three-letter abbreviations (no "GRY/HUF/RAV", no "Q 7/15"). Every header, chip, and label is spelled out.

| Screen | Key changes |
|---|---|
| **Dashboard** | 4 × 2 grid of game-launch buttons; secondary row for Championship Sequence + Reset; QR + URL card on the left for joins; scrollable connected-players list on the right; theme toggle in the top-right (replacing the time-left panel on this screen only) |
| **Display** *(active game shell)* | Quiz / True or False / Pointless. Prompt + answers centre, player tracker bottom |
| **NumbersDisplay** | Big target + tile pool centre; player tracker shows "exact / closest so far / in progress / no submission" |
| **ThemedDleDisplay** | Plum mode banner (Fraunces splash) centre; player tracker shows per-player guess counts |
| **TravelDisplay** | During play: map hidden, banner only. Results: full map with all chains drawn, start/end pins labelled in full |
| **WordleDisplay** | End-of-round target reveal centre (TV-sized tiles); player tracker shows per-player guess counts |

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
| Host-screen skeleton | location top-left · time-left top-right · content centre · player tracker bottom (consistent on every host screen) |
| Label discipline | Full-text everywhere; no abbreviations like "GRY" or "Q 7/15" |
| Dashboard launcher | 4 × 2 grid for the 8 games + secondary row for Championship + Reset |
| Dashboard panels | Live Game, Championship Table, Quick Guide removed (Phase 3) — duplicated Display responsibility or out of original scope |
| `PlacementLeaderboard.tsx` | Confirmed unused; deletion scheduled in Phase 11 |
| Server-side gaps | Pointless reveal / Wordle target / Numbers best / Travel arc — deferred to future tickets (see §9) |

---

## 9. Server-side gaps deferred to a future ticket

The redesign surfaced four places where the host display screens have to fall back to less-rich visuals because the server doesn't (yet) emit the data needed. These are deliberately out of scope for the UI redesign — they're server-event-shape changes, not visual changes — and are flagged here so they can be picked up as separate tickets later.

- **Pointless host — sequential reveal.** Spec §3.9 / §4.4 describe a per-player `ScoreDrop` reveal driven by the answer score. The server currently only emits an aggregate top-3 / round summary, not a `{ playerId, score, triggerTime }` event per player. The host display is reskinned to show the aggregate top-3 instead of a sequenced per-player drop. **Future change:** server emits `{ playerId, score, triggerTime }` per player on reveal so the host can sequence drops.
- **Wordle host — target word during play.** The host's `WordleDisplay` currently shows empty tiles during the round because the target word is only sent in the results payload, not `wordle:round:start`. **Future change:** send the target word in `wordle:round:start` so the host can render greyed-out target tiles during play (or accept current empty-tile behavior as intentional spoiler-prevention).
- **Numbers host — closest-so-far.** `NumbersDisplay`'s player tracker would like to show "closest so far · 475" per player to telegraph who's nearest the target. The server doesn't expose a `bestValue` field per player during the round. The tracker uses the fallback "in progress · N op(s)". **Future change:** server emits a per-player `bestValue` (closest absolute distance to target) so the tracker can show real "closest" telemetry.
- **Travel host — per-guess next-hop intent.** The map's arcs are drawn from each guess to the correct location at results-time. There's no per-guess "where was the player aiming next" data. Arcs are drawn to the chain's start or end based on which side the guess was on — acceptable, but not the richest possible visualisation. **Future change:** emit per-guess `intent` metadata (target country the player was aiming for) so arcs can show actual aim, not inferred direction.
