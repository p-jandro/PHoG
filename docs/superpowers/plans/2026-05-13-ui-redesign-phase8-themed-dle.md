# PHoG UI Redesign — Phase 8: ThemedDle + 5 Modes + ThemedDleDisplay

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate ThemedDle (the wrapper + all 5 modes: Classic Matrix, Grid 3×3, Silhouette, Emoji clue, Spell hint) on the player client AND ThemedDleDisplay on the host to the new design system (tokens, primitives, motion library). This is the largest migration phase — ~10 component files plus motion variant additions plus the host display.

**Architecture:** Player-side keeps the existing `ThemedDle.tsx` mode-router architecture (intro → playing → results, with the playing-phase body dispatching by `mode`). Each mode component is reskinned independently using `Card`/`Chip`/`Tile`/`Input` primitives and per-mode reactive animations as catalogued in spec §4.4. Where the `Tile` primitive's `flipping` + `flipDelaySec` props fit (Classic Matrix and Grid 3×3 cells), we use them. Where they don't (Silhouette brightness reveal, Emoji clue sequential pop, Spell hint letter drop), we add new framer-motion variants to `lib/motion.ts` and consume them with bespoke `motion.*` elements. Server protocol and socket event shapes are **unchanged** — this is purely a presentation migration. The host `ThemedDleDisplay.tsx` keeps its current player-tracker-centric layout (post the recent "simplify themed-dle to player tracker only" commit) and is reskinned with new host primitives + the Fraunces splash banner.

**Tech stack:** React 18 · TypeScript 5.3 · Tailwind 3.4 · framer-motion 10 — no new dependencies.

**Spec reference:** [docs/superpowers/specs/2026-05-13-ui-redesign-design.md](../specs/2026-05-13-ui-redesign-design.md) — §3 (primitives), §4.3 (universal reactive feedback), §4.4 (per-game animation catalog: Classic flip cascade · Grid 3×3 scale-pop · Silhouette brightness reveal · Emoji sequential pop · Spell letter drop), §7.1 (ThemedDle player screen), §7.3 (ThemedDleDisplay host screen — plum mode banner + player tracker).

**Foundation reference:** [docs/superpowers/plans/2026-05-13-ui-redesign-foundation.md](./2026-05-13-ui-redesign-foundation.md) — primitives available in both `packages/client/src/ui/` and `packages/host/src/ui/`: `Button`, `Input`, `Card`, `Chip`, `Pill`, `Tile` (with `flipping` + `flipDelaySec`), `Avatar`, `LeaderboardRow`, `Countdown`, `ScoreDrop`, `ThemeToggle`. Motion utilities in `lib/motion.ts`: `tap`, `hoverLift`, `popIn`, `tileFlip`, `letterDrop`, `screenEnter`, `reducedFade`, plus tokens `duration.*`, `easing.*`, `stagger.*`.

**Out of scope for this plan:**
- Server-side changes (game logic, socket event shapes, roster data)
- Audio / animations on results target reveal beyond the mode-specific in-play animations
- Any non-ThemedDle screen (Lobby, Quiz, Wordle, Numbers, Travel, Final Leaderboard) — those are separate phases
- Removing the legacy classes (`.eyebrow`, `.screen-shell`, `.screen-frame`, `.status-pill`, etc.) — those die in the Phase 11 cleanup
- Reintroducing the per-mode host views (`HostClassicView`, `HostGridView`, etc.) — they remain dormant per the simplification commit

**Per-task verification gate:** every task ends with a commit; after each commit `npm run build` succeeds in both `packages/client` and `packages/host`. Full end-to-end smoke (all 5 modes, both themes) is run once at the end in Task 16.

---

## File map

**Client (`packages/client/`):**

| Path | Change |
|---|---|
| `src/lib/motion.ts` | *Modify* — add `cellScalePop`, `emojiPop`, `silhouetteReveal`, `shake` variants + `stagger.cell` (80ms) and `stagger.emoji` (90ms) tokens |
| `src/components/themed-dle/AutocompletePicker.tsx` | *Rewrite* — `Input` primitive + chunky dropdown list with `Card` shell and `Chip`-style active row |
| `src/components/themed-dle/ModeIntro.tsx` | *Rewrite* — Fraunces splash, ink card, plum eyebrow, terracotta progress bar |
| `src/components/themed-dle/ModeResults.tsx` | *Rewrite* — `Card` shell, action/now/streak chips for score reveal, plum heritage for "It was…" |
| `src/components/themed-dle/CumulativeScoreBar.tsx` | *Rewrite* — surface card with cobalt info chip for mode label + premium chip for cumulative score + sun progress ring |
| `src/components/themed-dle/ClassicMatrix.tsx` | *Rewrite* — `Tile` primitive grid with flip cascade (180ms stagger via `flipDelaySec`) replacing the table |
| `src/components/themed-dle/Grid3x3.tsx` | *Rewrite* — full-text row + column header band; ink column headers (terracotta shadow); plum row headers (ink shadow); cells use `Tile` with `cellScalePop` variant; full character name + emoji icon in each placed cell; "tap to place" placeholder for empty cells |
| `src/components/themed-dle/EmojiClue.tsx` | *Rewrite* — `Card` shell with sequential `emojiPop` reveal (0 → 1.15 → 1.0, 140ms each, 90ms stagger); guess list as `Chip` rows |
| `src/components/themed-dle/Silhouette.tsx` | *Rewrite* — `Card` shell with `silhouetteReveal` brightness crossfade + scale pulse on correct; universal shake/flash on wrong |
| `src/components/themed-dle/SpellHint.tsx` | *Rewrite* — Fraunces incantation length banner; per-letter `letterDrop` cascade for revealed incantation skeleton; hint cards using `Card` + plum eyebrow |
| `src/screens/ThemedDle.tsx` | *Modify* — replace `screen-shell`/`screen-frame` shell with the new ink card frame; toast invalid-guess as a `Chip` (variant=`danger`-ish via inline class until danger chip lands); loading state uses `Card` |

**Host (`packages/host/`):**

| Path | Change |
|---|---|
| `src/lib/motion.ts` | *Modify* — mirror the four new variants added to the client (so host-side reskins of ModeIntroSplash / ModeResultsReveal can reuse them if needed) |
| `src/components/themed-dle/ModeIntroSplash.tsx` | *Rewrite* — Fraunces 8xl splash on plum (`--premium`) background panel; ink eyebrow; full-text chip strip for attributes |
| `src/components/themed-dle/ModeResultsReveal.tsx` | *Rewrite* — Fraunces "It was…" banner; target panel uses `Card`; top-3 standings use `LeaderboardRow` |
| `src/screens/ThemedDleDisplay.tsx` | *Rewrite* — top-left location label ("Pokédle · Classic" full text, no abbreviations); top-right timer panel using `Countdown` ring; centre plum mode banner (Fraunces); bottom player tracker grid using `Card` cells with `now`/`action`/`danger` tint per status; explicit "X of Y solved" full-text count |

**Total files touched:** 1 + 9 client + 1 + 3 host = **14 files**, plus the two `motion.ts` updates (so 16 file edits across 16 tasks).

---

## Motion variant additions (Task 1 reference)

Add to `packages/client/src/lib/motion.ts` AND `packages/host/src/lib/motion.ts` (identical):

```ts
/* Grid 3×3 cell scale-pop — §4.4 */
export const cellScalePop: Variants = {
  hidden:  { scale: 0.7, opacity: 0 },
  visible: { scale: [0.7, 1.05, 1.0], opacity: 1,
             transition: { duration: 0.22, times: [0, 0.6, 1], ease: easing.backOut } },
};

/* Emoji clue sequential pop — §4.4 */
export const emojiPop: Variants = {
  hidden:  { scale: 0, opacity: 0 },
  visible: { scale: [0, 1.15, 1.0], opacity: 1,
             transition: { duration: 0.14, times: [0, 0.65, 1], ease: easing.backOut } },
};

/* Silhouette correct reveal — §4.4
 * Brightness crossfade ink → color (handled by parent inline style) + scale 1.0 → 1.03 → 1.0 */
export const silhouetteReveal: Variants = {
  obscured: { scale: 1.0 },
  revealed: { scale: [1.0, 1.03, 1.0],
              transition: { duration: 0.35, times: [0, 0.55, 1], ease: easing.easeOut } },
};

/* Universal shake — §4.3 */
export const shake: Variants = {
  rest:    { x: 0 },
  shaking: { x: [0, -8, 8, -8, 8, 0],
             transition: { duration: 0.32, ease: 'linear' } },
};

/* New stagger tokens */
export const stagger = {
  short: 0.08,
  cell:  0.08,
  emoji: 0.09,
  tile:  0.18,
  rank:  0.6,
} as const;
```

(The existing `stagger` object is extended; `tile` and `short` keep their current values so other migrated screens don't drift.)

---

## Tasks

### Task 1: Extend `motion.ts` (client + host) with the four new variants

**Files:**
- Modify: `packages/client/src/lib/motion.ts`
- Modify: `packages/host/src/lib/motion.ts`

- [ ] **Step 1: Append the variants block above to both files**

After the existing `letterDrop` export, before the `screenEnter` export, paste the four new variant exports (`cellScalePop`, `emojiPop`, `silhouetteReveal`, `shake`). Replace the existing `stagger` constant export with the extended one (adding `cell: 0.08` and `emoji: 0.09`). Keep all existing exports untouched.

- [ ] **Step 2: Verify both packages still type-check**

```bash
cd packages/client && npm run build
cd ../host && npm run build
```

Expected: both builds succeed.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/lib/motion.ts packages/host/src/lib/motion.ts
git commit -m "feat(ui): add cellScalePop, emojiPop, silhouetteReveal, shake motion variants"
```

---

### Task 2: Reskin `AutocompletePicker`

**Files:**
- Modify: `packages/client/src/components/themed-dle/AutocompletePicker.tsx`

`AutocompletePicker` is used by ClassicMatrix, EmojiClue, Silhouette, SpellHint, and the Grid 3×3 placement modal — so reskinning it first means every consumer immediately benefits.

- [ ] **Step 1: Replace the inline `<input>` with the `Input` primitive**

Import `Input` from `../../ui`. Pass through `placeholder`, `value`, `onChange`, `onKeyDown`, `disabled`. Drop the inline `className` for the input — `Input` already supplies 2px ink border + ink shadow + sunken bg + focus cobalt. Keep the existing `useState`/`useMemo`/keyboard-nav logic verbatim.

- [ ] **Step 2: Rebuild the suggestions dropdown using primitives**

Replace the `<ul>` block with:

```tsx
{suggestions.length > 0 && !disabled && (
  <ul className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border-2 border-ink bg-bg-surface shadow-ink">
    {suggestions.map((entry, idx) => (
      <li
        key={entry.name}
        onMouseDown={(e) => { e.preventDefault(); submit(entry.name); }}
        onMouseEnter={() => setActive(idx)}
        className={[
          'cursor-pointer px-4 py-3 text-base font-semibold',
          idx === active
            ? 'bg-now text-on-now'
            : 'text-ink hover:bg-bg-sunken',
        ].join(' ')}
      >
        {entry.name}
      </li>
    ))}
  </ul>
)}
```

- [ ] **Step 3: Verify client builds**

```bash
cd packages/client && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/themed-dle/AutocompletePicker.tsx
git commit -m "ui(themed-dle): reskin AutocompletePicker with Input + chunky dropdown"
```

---

### Task 3: Reskin `ModeIntro` (player splash)

**Files:**
- Modify: `packages/client/src/components/themed-dle/ModeIntro.tsx`

- [ ] **Step 1: Rewrite the markup with primitives**

Replace `screen-shell` / `screen-frame` with a centred `Card` that:
- Drops a Fraunces title via `<h1 className="font-serif font-bold text-5xl md:text-6xl text-ink tracking-tight">{data.title}</h1>` (Fraunces is loaded by foundation — `font-serif` from Tailwind config maps to it).
- Eyebrow uses `<Chip variant="streak">…</Chip>` for the theme label ("Pokédle" / "HP-dle"). Full text, never abbreviated.
- Description paragraph: `text-xl text-ink-muted`.
- Attribute pills: replace `.status-pill` spans with `<Chip variant="info">` per attribute. Always spell out (e.g. "Type", not "T").
- `maxGuesses` line: `<Chip variant="muted">{data.maxGuesses} guesses</Chip>`.
- Progress bar: keep the 100% wide track, but use `bg-bg-sunken` for the track and `bg-streak` (terracotta) for the fill. Add a 2px ink border around the track and a 2px ink shadow.

- [ ] **Step 2: Use `screenEnter` for the mount animation**

Import `screenEnter` from `../../lib/motion`. Replace the manual `initial`/`animate` props on the wrapping `<motion.div>` with `variants={screenEnter} initial="hidden" animate="visible"`.

- [ ] **Step 3: Verify client builds**

```bash
cd packages/client && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/themed-dle/ModeIntro.tsx
git commit -m "ui(themed-dle): reskin ModeIntro with Fraunces splash + chip strip"
```

---

### Task 4: Reskin `ModeResults` (player)

**Files:**
- Modify: `packages/client/src/components/themed-dle/ModeResults.tsx`

- [ ] **Step 1: Rebuild with `Card` + `Chip`**

Wrap the body in a `Card` with `eyebrow="It was…"` (already terracotta via Card's own eyebrow styling).

Replace `renderTarget`:
- `grid` mode → `<p className="text-2xl font-extrabold text-ink">Grid revealed</p>` plus a `<Chip variant="muted">see grid below on host</Chip>` line.
- `spell` mode → `<p className="font-serif text-5xl font-bold text-premium">{target.incantation}</p>` plus `<p className="mt-2 text-base text-ink-muted">{target.effect}</p>`.
- `silhouette` mode → image with `<p className="font-serif text-4xl font-bold text-premium">{target.name}</p>`.
- default → `<p className="font-serif text-4xl font-bold text-premium">{target.name}</p>`.

Replace the inner "You scored" panel with a smaller `Card` (`className="mt-4"`, no eyebrow/title):
- Label: `<Chip variant="muted">You scored</Chip>`
- Score: `<p className="text-5xl font-extrabold text-action font-display">+{me?.modeScore ?? 0}</p>` (Inter Tight via `font-display`).
- Cumulative line: `<p>Cumulative: <span className="font-extrabold text-ink">{cumulative}</span> · Rank <Chip variant="now">#{myRank}</Chip></p>`.

Countdown line at bottom: keep as small `text-sm text-ink-muted`.

- [ ] **Step 2: Verify client builds**

```bash
cd packages/client && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/themed-dle/ModeResults.tsx
git commit -m "ui(themed-dle): reskin ModeResults with Card + heritage target reveal"
```

---

### Task 5: Reskin `CumulativeScoreBar`

**Files:**
- Modify: `packages/client/src/components/themed-dle/CumulativeScoreBar.tsx`

- [ ] **Step 1: Rebuild as an ink-bordered bar**

Replace the `rounded-2xl border-white/10 bg-black/30` shell with:

```tsx
<div className="mb-4 rounded-2xl border-2 border-ink bg-bg-surface px-4 py-3 shadow-ink-sm">
  <div className="flex flex-wrap items-baseline justify-between gap-3">
    <div className="flex items-baseline gap-2">
      <Chip variant="info">{THEME_LABEL[theme]}</Chip>
      <h2 className="text-2xl font-extrabold text-ink">{MODE_LABELS[mode]}</h2>
    </div>
    <div className="text-right">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">Score</p>
      <p className="font-display text-3xl font-extrabold text-premium">{cumulative}</p>
    </div>
  </div>
  {progress !== null && (
    <div className="mt-3 h-2 w-full overflow-hidden rounded-full border-2 border-ink bg-bg-sunken">
      <div className="h-full bg-now" style={{ width: `${progress}%` }} />
    </div>
  )}
</div>
```

- [ ] **Step 2: Replace mode labels with full-text — no abbreviations**

Update `MODE_LABELS` so `grid: '3×3 Grid'` becomes `grid: '3×3 Grid'` (already full text — keep it). Confirm none of the 5 mode strings has been abbreviated (Classic, Emoji, Silhouette, Spell, 3×3 Grid all ok).

- [ ] **Step 3: Verify client builds**

```bash
cd packages/client && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/themed-dle/CumulativeScoreBar.tsx
git commit -m "ui(themed-dle): reskin CumulativeScoreBar with chunky ink bar + premium score"
```

---

### Task 6: Reskin `ClassicMatrix` with `Tile` flip cascade

**Files:**
- Modify: `packages/client/src/components/themed-dle/ClassicMatrix.tsx`

- [ ] **Step 1: Replace the `<table>` with a CSS-grid layout of `Tile`s**

The current table maps each guess to a row of cells (one per attribute). Recreate as a `grid` where the column count is `1 + attributes`, with the first column showing the guess name and the rest showing cells.

For the header row (rendered once when `headerRow.length > 0`):
- First slot: empty `div` (no "Guess" label — the labels live with each guess row).
- Each attribute label: `<Chip variant="muted">{label}</Chip>` (full text — labels come from the server, do not shorten them).

For each guess row, map `g.feedback` to `<Tile>` instances. Pass:
- `state={c.color === 'green' ? 'correct' : c.color === 'yellow' ? 'partial' : 'wrong'}`
- `flipping` only when the row is the most-recent guess and is still within its initial flip window. Track this with a `useRef<Set<number>>` of already-flipped guess indices and a `useEffect` that adds the current `idx` after `(feedback.length * stagger.tile + duration.reveal) * 1000` ms.
- `flipDelaySec={cellIdx * stagger.tile}` (180ms cascade).
- Content: a `<span className="px-1 text-center text-[10px] leading-tight font-extrabold">{value}</span>` (small text so long attribute values fit). Don't truncate.

The guess-name slot for each row: `<Chip variant="default">{g.guess}</Chip>`, full name spelt out.

- [ ] **Step 2: Replace the inline solved / fail messages with `Chip`s in a result strip**

Solved: `<Chip variant="streak">Solved in {used} {used === 1 ? 'guess' : 'guesses'}</Chip>`.
Out of guesses: `<Chip variant="muted">Out of guesses — the answer was hidden</Chip>` (or keep generic — host reveals).
Remaining: `<Chip variant="info">{data.maxGuesses - used} guesses left</Chip>` (full text, not "n left" alone).

- [ ] **Step 3: Verify client builds**

```bash
cd packages/client && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/themed-dle/ClassicMatrix.tsx
git commit -m "ui(themed-dle): rebuild ClassicMatrix with Tile flip cascade"
```

---

### Task 7: Reskin `Grid3x3` — full row + column labels, cell scale-pop, full character names

**Files:**
- Modify: `packages/client/src/components/themed-dle/Grid3x3.tsx`

**Critical spec point (user-emphasised):** no abbreviations. Column headers are full attribute names ("Wand owner", "Favourite subject") with ink background + terracotta offset shadow. Row headers are full category names ("Gryffindor", "Hufflepuff", "Ravenclaw") with plum background + ink offset shadow. Each placed cell shows the **full character name** (e.g. "Harry Potter") — the emoji is a secondary icon. Empty cells show "tap to place" placeholder text.

- [ ] **Step 1: Replace the `<table>` with a 4×4 CSS grid**

The table layout must become an actual grid so headers can use distinct colors. Build:

```tsx
<div className="grid gap-2" style={{ gridTemplateColumns: 'minmax(7rem, 1fr) repeat(3, minmax(0, 1fr))' }}>
  {/* Row 0: corner + 3 column headers */}
  <div /> {/* empty corner */}
  {data.cols.map((c) => (
    <div
      key={c}
      className="rounded-2xl border-2 border-ink bg-ink px-2 py-2 text-center text-xs font-extrabold uppercase tracking-[0.12em] text-bg-surface shadow-[3px_3px_0_var(--streak)]"
    >
      {c}
    </div>
  ))}
  {/* Rows 1-3: row header + 3 cells */}
  {data.rows.map((rowLabel, r) => (
    <Fragment key={rowLabel}>
      <div
        className="flex items-center justify-end rounded-2xl border-2 border-ink bg-premium px-3 py-2 text-right text-sm font-extrabold uppercase tracking-[0.10em] text-on-premium shadow-ink-sm"
      >
        {rowLabel}
      </div>
      {data.cols.map((_, c) => {
        const cell = cellState[`${r},${c}`];
        const isPlaced = !!cell?.valid;
        const isInvalid = !!cell && !cell.valid;
        const tileState = isPlaced ? 'correct' : isInvalid ? 'wrong' : 'idle';
        const cellIndex = r * 3 + c;
        // ...
      })}
    </Fragment>
  ))}
</div>
```

Don't forget `import { Fragment } from 'react';`.

- [ ] **Step 2: Render each cell as a `<motion.button>` wrapping a `Tile`-style face**

Inside the cell loop:

```tsx
<motion.button
  key={c}
  onClick={() => setActiveCell({ row: r, col: c })}
  variants={cellScalePop}
  initial={isPlaced ? 'hidden' : false}
  animate={isPlaced ? 'visible' : false}
  custom={cellIndex}
  transition={isPlaced ? { delay: cellIndex * stagger.cell } : undefined}
  whileTap={{ scale: 0.96 }}
  className={[
    'aspect-square w-full rounded-2xl border-2 border-ink p-2 text-center shadow-ink-sm',
    isPlaced ? 'bg-action text-on-action' : isInvalid ? 'bg-danger text-on-danger' : 'bg-bg-surface text-ink',
  ].join(' ')}
>
  {isPlaced ? (
    <div className="flex h-full flex-col items-center justify-center gap-1">
      {/* Emoji as secondary icon — character icon lookup if the roster carries it; otherwise empty */}
      <span className="text-2xl leading-none">{cell.emoji ?? ''}</span>
      <span className="text-[11px] font-extrabold leading-tight">{cell.name}</span>
    </div>
  ) : isInvalid ? (
    <span className="text-[11px] font-extrabold leading-tight">{cell.name}</span>
  ) : (
    <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">tap to place</span>
  )}
</motion.button>
```

Note: the current `cellState` value is `{ name, valid }`. The roster does not currently carry an emoji per character. **Decision:** keep the cell rendering robust — if the roster entry has an emoji (e.g. server adds one in future), surface it; otherwise the secondary slot is blank. Update the `cellState` builder to look the name up in `data.roster` and pull `roster.find((e) => e.name === name)?.emoji` if present, typed as `(RosterEntry & { emoji?: string })`. **Do not add anything fake — full character name carries the cell on its own.**

- [ ] **Step 3: Rebuild the placement modal with `Card`**

Replace the modal inner `<motion.div>` shell with a `Card`:

```tsx
<motion.div ...overlay backdrop...>
  <Card eyebrow={`${data.rows[activeCell.row]} × ${data.cols[activeCell.col]}`} className="w-full max-w-md">
    <AutocompletePicker ... placeholder="Pick a character…" />
    <Button variant="ghost" size="sm" className="mt-4 w-full" onClick={() => setActiveCell(null)}>Cancel</Button>
  </Card>
</motion.div>
```

The eyebrow text uses the full row and column labels (per the user's "spell everything out" rule — `Gryffindor × Wand owner`, not `GRY × WAND`).

- [ ] **Step 4: Replace the "n/9 filled" header line**

```tsx
<div className="mb-2 flex justify-center"><Chip variant="muted">{filledCount} of 9 cells placed</Chip></div>
```

Full text — not "n/9".

- [ ] **Step 5: Verify client builds**

```bash
cd packages/client && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/components/themed-dle/Grid3x3.tsx
git commit -m "ui(themed-dle): rebuild Grid 3x3 with full-text labels, ink/plum headers, cell scale-pop"
```

---

### Task 8: Reskin `EmojiClue` with sequential pop

**Files:**
- Modify: `packages/client/src/components/themed-dle/EmojiClue.tsx`

- [ ] **Step 1: Wrap the emoji row in `Card` + per-emoji `motion.span` with `emojiPop`**

```tsx
<Card>
  <div className="flex justify-center gap-3 text-6xl sm:text-7xl">
    {revealed.map((e, i) => (
      <motion.span
        key={`${i}-${e}`}
        variants={emojiPop}
        initial="hidden"
        animate="visible"
        transition={{ delay: i * stagger.emoji, duration: 0.14, times: [0, 0.65, 1], ease: easing.backOut }}
      >
        {e}
      </motion.span>
    ))}
  </div>
  <p className="mt-4 text-center"><Chip variant="muted">{revealed.length} of 5 emojis revealed</Chip></p>
</Card>
```

Full text — "of 5", not "/5".

- [ ] **Step 2: Rebuild the guess list as chip rows**

```tsx
<ul className="space-y-2">
  {guesses.map((g, idx) => (
    <li key={idx} className="flex items-center gap-2 rounded-xl border-2 border-ink bg-bg-surface px-3 py-2 shadow-ink-sm">
      <Chip variant={g.correct ? 'streak' : 'muted'}>{g.correct ? 'Correct' : 'Wrong'}</Chip>
      <span className="font-semibold text-ink">{g.guess}</span>
    </li>
  ))}
</ul>
```

- [ ] **Step 3: Replace solved / failed messages with `Chip`s**

Solved: `<Chip variant="streak">Solved in {used} {used === 1 ? 'guess' : 'guesses'}</Chip>`.
Failed: `<Chip variant="muted">Out of guesses</Chip>`.

- [ ] **Step 4: Verify client builds**

```bash
cd packages/client && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/themed-dle/EmojiClue.tsx
git commit -m "ui(themed-dle): reskin EmojiClue with Card shell + sequential emoji pop"
```

---

### Task 9: Reskin `Silhouette` with brightness reveal + universal shake

**Files:**
- Modify: `packages/client/src/components/themed-dle/Silhouette.tsx`

- [ ] **Step 1: Wrap the image in `Card`, drive brightness with the existing math but animate scale via `silhouetteReveal`**

```tsx
const wasJustSolved = solved && guesses.length > 0 && guesses[guesses.length - 1].solved;
const wasJustWrong  = !solved && guesses.length > 0 && !guesses[guesses.length - 1].correct;
```

```tsx
<Card>
  <motion.div
    key={solved ? 'solved' : 'obscured'}
    variants={silhouetteReveal}
    initial={false}
    animate={wasJustSolved ? 'revealed' : 'obscured'}
    className="mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl border-2 border-ink bg-bg-sunken shadow-ink-sm"
  >
    <motion.img
      src={data.spriteUrl}
      alt="silhouette"
      animate={{ scale: zoom }}
      transition={{ duration: 0.6 }}
      style={{
        filter: brightness === 0
          ? 'brightness(0) invert(1)'
          : `brightness(${brightness}) saturate(${Math.min(1, brightness + 0.2)})`,
        width: '100%', height: '100%', objectFit: 'contain',
        transition: 'filter 350ms ease-out',
      }}
    />
  </motion.div>
</Card>
```

The `silhouetteReveal` variant handles the 1.0 → 1.03 → 1.0 pulse on correct. The `filter` change is animated via inline CSS transition (a one-shot 350ms crossfade as the spec requires, not on a framer-motion hot path).

- [ ] **Step 2: Add the universal shake on wrong**

Import `shake` from motion. Add a wrapper around the whole card that listens for `wasJustWrong` and shakes:

```tsx
const [shaking, setShaking] = useState(false);
useEffect(() => {
  if (!wasJustWrong) return;
  setShaking(true);
  const t = setTimeout(() => setShaking(false), 350);
  return () => clearTimeout(t);
}, [guesses.length, wasJustWrong]);

<motion.div variants={shake} animate={shaking ? 'shaking' : 'rest'}>
  <Card>…</Card>
</motion.div>
```

Also briefly flash a red border by toggling `border-danger` on the inner card while `shaking` is true (use a `className` interpolation).

- [ ] **Step 3: Rebuild the guess list with `Chip` rows (mirror Task 8)**

Same chip-row pattern as EmojiClue — `Chip variant="streak"` for correct, `variant="muted"` for wrong, with the guess text alongside.

- [ ] **Step 4: Replace placeholder text**

`AutocompletePicker placeholder="Guess the Pokémon…"` → keep theme-aware: if `theme === 'pokemon'` → "Guess the Pokémon…"; else "Guess the character…" (avoid theme leakage; the wrapper passes theme; if not present, keep "Guess the character…").

- [ ] **Step 5: Verify client builds**

```bash
cd packages/client && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/components/themed-dle/Silhouette.tsx
git commit -m "ui(themed-dle): reskin Silhouette with brightness reveal + shake on wrong"
```

---

### Task 10: Reskin `SpellHint` with letter drop

**Files:**
- Modify: `packages/client/src/components/themed-dle/SpellHint.tsx`

- [ ] **Step 1: Rebuild the prompt panel with `Card`**

```tsx
<Card eyebrow={data.category} title={data.effect}>
  <div className="flex justify-center gap-2">
    {Array.from({ length: data.incantationLength }).map((_, i) => (
      <motion.span
        key={i}
        variants={letterDrop}
        initial="hidden"
        animate="visible"
        transition={{ delay: i * 0.09, duration: 0.28, ease: easing.easeOut }}
        className="inline-flex h-10 w-7 items-center justify-center rounded-md border-2 border-ink bg-bg-sunken font-serif text-xl font-bold text-ink-muted shadow-ink-sm"
      >
        ·
      </motion.span>
    ))}
  </div>
  <p className="mt-3 text-center"><Chip variant="muted">{data.incantationLength} letters</Chip></p>
</Card>
```

The `·` placeholder uses the existing `letterDrop` variant from motion.ts (translateY -12 → 0 + fade), staggered at 90ms per spec §4.4. If the server later supplies an `initialLetter` / `lastLetter` from a hint, replace the dot in those positions — but that's a future change; for now we render dots and the hint card surfaces letter info instead.

- [ ] **Step 2: Rebuild the hint cards**

```tsx
{revealedHints.length > 0 && (
  <div className="space-y-2">
    {revealedHints.map((h, i) => (
      <motion.div
        key={i}
        variants={popIn}
        initial="hidden"
        animate="visible"
        transition={{ delay: i * 0.1 }}
      >
        <Card className="!p-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-premium">{HINT_TITLES[h.type] || 'Hint'}</p>
          <p className="mt-1 text-base text-ink">{h.text}</p>
        </Card>
      </motion.div>
    ))}
  </div>
)}
```

- [ ] **Step 3: Rebuild the guess list (chip rows, mirror Task 8)**

- [ ] **Step 4: Replace footer messages with chips**

`Solved` → `<Chip variant="streak">Spell cast in {used} {used === 1 ? 'attempt' : 'attempts'}</Chip>`.
`Out` → `<Chip variant="muted">Out of attempts</Chip>`.
`Remaining` → `<Chip variant="info">{data.maxGuesses - used} attempts left</Chip>`.

- [ ] **Step 5: Verify client builds**

```bash
cd packages/client && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/components/themed-dle/SpellHint.tsx
git commit -m "ui(themed-dle): reskin SpellHint with Card + letter drop + chip hint cards"
```

---

### Task 11: Reskin the `ThemedDle` wrapper screen

**Files:**
- Modify: `packages/client/src/screens/ThemedDle.tsx`

- [ ] **Step 1: Replace `screen-shell` / `screen-frame` with new shell classes**

```tsx
return (
  <div className="min-h-screen bg-bg-base px-4 py-6 text-ink">
    <div className="mx-auto max-w-3xl">
      <CumulativeScoreBar ... />
      {invalidToast && (
        <div className="mb-3 flex justify-center">
          <Chip variant="muted" className="!bg-danger !text-on-danger !border-ink">
            {invalidToast}
          </Chip>
        </div>
      )}
      {mode === 'classic'    && <ClassicMatrix ... />}
      {mode === 'emoji'      && <EmojiClue ... />}
      {mode === 'silhouette' && <Silhouette ... />}
      {mode === 'spell'      && <SpellHint ... />}
      {mode === 'grid'       && <Grid3x3 ... />}
    </div>
  </div>
);
```

The danger-styled chip uses Tailwind important-modifier overrides (`!bg-danger`, `!text-on-danger`) because `Chip` doesn't ship a `danger` variant in foundation. **If the foundation `Chip` already supports a `danger` variant by the time this plan runs, switch to `<Chip variant="danger">` and drop the overrides.**

Import `Chip` from `../ui`.

- [ ] **Step 2: Rebuild the loading state**

```tsx
return (
  <div className="flex min-h-screen items-center justify-center bg-bg-base px-4 text-ink">
    <Card className="w-full max-w-md text-center">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-streak">
        {theme === 'pokemon' ? 'Pokédle' : 'HP-dle'}
      </p>
      <h1 className="mt-2 text-3xl font-extrabold">Loading…</h1>
    </Card>
  </div>
);
```

- [ ] **Step 3: Verify client builds**

```bash
cd packages/client && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/screens/ThemedDle.tsx
git commit -m "ui(themed-dle): reskin ThemedDle wrapper shell with bg-base + Card loading"
```

---

### Task 12: Reskin host `ModeIntroSplash`

**Files:**
- Modify: `packages/host/src/components/themed-dle/ModeIntroSplash.tsx`

- [ ] **Step 1: Rebuild as a full-screen plum hero**

```tsx
import { motion } from 'framer-motion';
import { Chip } from '../../ui';

export const ModeIntroSplash = ({ data }: ModeIntroSplashProps) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
    className="flex h-full w-full flex-col items-center justify-center gap-6 rounded-3xl border-2 border-ink bg-premium px-12 py-16 text-center shadow-ink-lg"
  >
    <Chip variant="streak">{data.theme === 'pokemon' ? 'Pokédle' : 'HP-dle'}</Chip>
    <h1 className="font-serif text-8xl font-bold tracking-tight text-on-premium">{data.title}</h1>
    <p className="max-w-3xl text-3xl text-on-premium/85">{data.description}</p>
    {data.attributes && (
      <div className="flex flex-wrap justify-center gap-3">
        {data.attributes.map((a) => (
          <Chip key={a} variant="now">{a}</Chip>
        ))}
      </div>
    )}
    {data.maxGuesses !== undefined && (
      <Chip variant="muted">{data.maxGuesses} guesses each</Chip>
    )}
  </motion.div>
);
```

`on-premium` already exists in tokens (white). Use full-text attribute chips — never abbreviate.

- [ ] **Step 2: Verify host builds**

```bash
cd packages/host && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add packages/host/src/components/themed-dle/ModeIntroSplash.tsx
git commit -m "ui(host themed-dle): rebuild ModeIntroSplash as Fraunces plum hero"
```

---

### Task 13: Reskin host `ModeResultsReveal`

**Files:**
- Modify: `packages/host/src/components/themed-dle/ModeResultsReveal.tsx`

- [ ] **Step 1: Rebuild with `Card` + `LeaderboardRow`**

```tsx
import { motion } from 'framer-motion';
import { Card, LeaderboardRow, Chip } from '../../ui';

export const ModeResultsReveal = ({ data }: ModeResultsRevealProps) => {
  const sorted = [...data.results].sort((a, b) => b.cumulativeScore - a.cumulativeScore);
  const top = sorted.slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full flex-col items-center justify-center gap-10 px-12 text-center"
    >
      <Chip variant="streak">It was…</Chip>
      {renderTarget(data.mode, data.target)}

      <Card className="w-full max-w-3xl" eyebrow="Top of the standings">
        <ol className="space-y-2">
          {top.map((r, i) => (
            <LeaderboardRow
              key={r.playerId}
              rank={i + 1}
              name={r.playerName}
              score={r.cumulativeScore}
            />
          ))}
        </ol>
      </Card>

      {!data.isLastMode && <Chip variant="info">Next mode coming up</Chip>}
      {data.isLastMode  && <Chip variant="streak">Wrapping up</Chip>}
    </motion.div>
  );
};
```

Update `renderTarget`:
- `grid` mode → `<p className="text-3xl font-extrabold text-ink">Grid revealed below</p>` (full text).
- `spell` → `<p className="font-serif text-7xl font-bold text-premium">{target.incantation}</p>` + effect line.
- `silhouette` → image beside `<p className="font-serif text-7xl font-bold text-premium">{target.name}</p>`.
- default → `<p className="font-serif text-7xl font-bold text-premium">{target.name}</p>`.

`LeaderboardRow`'s API may take different prop names — confirm with `packages/host/src/ui/LeaderboardRow.tsx` and adapt as needed (it should expose at least `rank`, `name`, `score`). If the API differs (e.g. `place` instead of `rank`), use the actual names from the foundation primitive.

- [ ] **Step 2: Verify host builds**

```bash
cd packages/host && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add packages/host/src/components/themed-dle/ModeResultsReveal.tsx
git commit -m "ui(host themed-dle): rebuild ModeResultsReveal with Card + LeaderboardRow"
```

---

### Task 14: Reskin host `ThemedDleDisplay` chrome (header + timer + mode banner)

**Files:**
- Modify: `packages/host/src/screens/ThemedDleDisplay.tsx`

This task does the chrome (top-left location, top-right timer, centre plum banner). Task 15 does the player-tracker grid.

- [ ] **Step 1: Replace the playing-phase header with the new skeleton**

Per spec §7 host-screen skeleton: location top-left full-text, timer top-right, content centre, player tracker bottom.

```tsx
import { Card, Chip, Countdown } from '../ui';

// inside the playing-phase return:
return (
  <div className="flex h-screen w-screen flex-col bg-bg-base px-10 py-8 text-ink">
    <header className="flex items-baseline justify-between">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-streak">
          {themeName} · Mode {playData.modeIndex !== undefined ? playData.modeIndex + 1 : '—'} of {playData.totalModes ?? '—'}
        </p>
        <h1 className="font-serif text-5xl font-bold text-ink">{MODE_LABELS[mode]}</h1>
      </div>
      <Countdown remainingMs={timerMs} totalMs={playData.duration ?? 0} size={140} />
    </header>

    {/* ...centre + bottom in next steps */}
  </div>
);
```

`MODE_LABELS` already uses full text — verify and keep. If `Countdown` has different prop names, adapt (`packages/host/src/ui/Countdown.tsx` is the source of truth).

- [ ] **Step 2: Add a centre plum mode banner**

Between the header and the player tracker:

```tsx
<div className="my-6 flex flex-1 flex-col items-center justify-center">
  <div className="w-full max-w-3xl rounded-3xl border-2 border-ink bg-premium px-10 py-8 text-center shadow-ink-lg">
    <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-on-premium/80">Now playing</p>
    <h2 className="mt-2 font-serif text-6xl font-bold text-on-premium">{MODE_LABELS[mode]}</h2>
    {playData.maxGuesses && mode !== 'grid' && (
      <p className="mt-3 text-xl text-on-premium/85">
        {playData.maxGuesses} guesses each
      </p>
    )}
    {mode === 'grid' && (
      <p className="mt-3 text-xl text-on-premium/85">Fill all 9 cells before time runs out</p>
    )}
  </div>
</div>
```

Full text — no abbreviations.

- [ ] **Step 3: Verify host builds**

```bash
cd packages/host && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add packages/host/src/screens/ThemedDleDisplay.tsx
git commit -m "ui(host themed-dle): rebuild ThemedDleDisplay chrome with Countdown + plum mode banner"
```

---

### Task 15: Rebuild the host `ThemedDleDisplay` player tracker grid

**Files:**
- Modify: `packages/host/src/screens/ThemedDleDisplay.tsx`

- [ ] **Step 1: Replace the existing player grid with primitive-styled cards**

At the bottom of the playing-phase view:

```tsx
<footer className="w-full">
  <div className="mb-3 flex items-center justify-between">
    <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">Players</p>
    {mode !== 'grid' ? (
      <Chip variant="info">{solvedCount} of {connected.length} solved</Chip>
    ) : (
      <Chip variant="info">{connected.length} player{connected.length === 1 ? '' : 's'} placing</Chip>
    )}
  </div>

  {connected.length === 0 ? (
    <Card><p className="text-center text-ink-muted">No players connected.</p></Card>
  ) : (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {connected.map((p) => {
        const s = progress[p.id];
        let isSolved = false;
        let isFailed = false;
        let statusLabel: string;
        if (mode === 'grid') {
          const filled = s?.filledCells ?? 0;
          statusLabel = `${filled} of 9 cells placed`;
        } else {
          const guessCount = s?.guessCount ?? 0;
          isSolved = s?.solved ?? false;
          isFailed = !isSolved && guessCount >= maxGuesses;
          if (isSolved) statusLabel = `Solved in ${guessCount} ${guessCount === 1 ? 'guess' : 'guesses'}`;
          else if (isFailed) statusLabel = 'Out of guesses';
          else statusLabel = `${guessCount} of ${maxGuesses} guesses, in progress`;
        }
        const tone = isSolved
          ? 'border-ink bg-action text-on-action'
          : isFailed
            ? 'border-ink bg-danger text-on-danger'
            : 'border-ink bg-bg-surface text-ink';
        return (
          <motion.div
            key={p.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border-2 px-5 py-4 shadow-ink-sm ${tone}`}
          >
            <p className="truncate text-2xl font-extrabold">{p.name}</p>
            <p className="mt-1 text-sm font-semibold">{statusLabel}</p>
          </motion.div>
        );
      })}
    </div>
  )}
</footer>
```

The status label is spelt out per spec (§7.3 "Ana — solved in 3", "Dan — 4 guesses, in progress"). No `✓` / `✗` icons — colors carry the state, text spells it out.

- [ ] **Step 2: Replace the intro / results loading branches with `Card` shells (consistency)**

The early returns for intro and results stay (they render `ModeIntroSplash` / `ModeResultsReveal`), but wrap the outer `<div className="h-screen w-screen px-16 py-20">` with `bg-bg-base` so the page background matches the new design tokens.

The "Loading…" fallback becomes:

```tsx
return (
  <div className="flex h-screen w-screen items-center justify-center bg-bg-base text-2xl text-ink">
    <Card><p>Loading…</p></Card>
  </div>
);
```

- [ ] **Step 3: Verify host builds**

```bash
cd packages/host && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add packages/host/src/screens/ThemedDleDisplay.tsx
git commit -m "ui(host themed-dle): rebuild player tracker grid with full-text status + primitives"
```

---

### Task 16: End-to-end smoke test in both themes + final cleanup commit

**Files:** none modified — verification only.

- [ ] **Step 1: Build both packages cleanly**

```bash
cd packages/client && npm run build
cd ../host && npm run build
```

Expected: both succeed, no TypeScript or unresolved-class warnings.

- [ ] **Step 2: Run the three dev servers**

```bash
# Terminal 1
cd packages/server && npm run dev
# Terminal 2
cd packages/client && npm run dev
# Terminal 3
cd packages/host && npm run dev
```

- [ ] **Step 3: Smoke each of the 5 modes in light theme**

Host: log in, start Pokédle or HP-dle. Cycle through every mode (Classic → Emoji → Silhouette → Spell → Grid 3×3 if available for the theme). For each mode, on the player client confirm:
- Intro: Fraunces title splash, terracotta progress bar, attribute chips full-text
- Playing: the mode's specific animation plays (flip cascade / sequential pop / brightness reveal / letter drop / cell scale-pop)
- Results: heritage plum target reveal, score chip pop
- Host display: timer ring counts down, plum mode banner shows mode name, player cards update with full-text status

- [ ] **Step 4: Repeat in dark theme**

Toggle theme on both client and host via the `ThemeToggle` (`?showcase` or via the menu). Replay one full mode each side. Confirm:
- Borders, shadows, and accent colors swap cleanly with no flash
- Tile flip colors invert appropriately (action / now / danger stay vibrant)
- Plum banner stays legible (text contrast still passes)
- Silhouette brightness math still produces a visible silhouette on dark

- [ ] **Step 5: Smoke `prefers-reduced-motion`**

In Chrome DevTools → Rendering, force `prefers-reduced-motion: reduce`. Re-run one mode. Confirm:
- Tile flips do not happen as transforms — colors still change (the `Tile` primitive handles this internally from foundation)
- Emoji and letter-drop reveals fall back to fades (the variants degrade naturally; verify by inspecting that the visual end-state is reached without obvious transform jank)

If any reduced-motion fallback misbehaves badly, file a follow-up note in the Phase 11 cleanup plan — do NOT block this phase on it.

- [ ] **Step 6: Final clean-tree check + commit if anything trailing was missed**

```bash
git status
```

Expected: "nothing to commit, working tree clean." If anything is dangling (typically a forgotten `import` cleanup), fix and commit:

```bash
git add -A
git commit -m "ui(themed-dle): final cleanup after phase 8 smoke test"
```

(If nothing is dangling, skip this final commit.)

---

## Done criteria

All of the following must be true before the plan is considered complete:

- [ ] `npm run build` succeeds in both `packages/client` and `packages/host`
- [ ] Both packages' `lib/motion.ts` export `cellScalePop`, `emojiPop`, `silhouetteReveal`, `shake` and the extended `stagger` object
- [ ] `AutocompletePicker` uses the `Input` primitive and the dropdown matches the chunky ink-bordered style
- [ ] `ModeIntro` renders a Fraunces splash with full-text attribute chips
- [ ] `ModeResults` uses `Card` + heritage plum for the target reveal
- [ ] `CumulativeScoreBar` uses `Chip variant="info"` for the theme + premium-colored cumulative score
- [ ] `ClassicMatrix` uses `Tile` with `flipping` + `flipDelaySec` and a 180ms cascade
- [ ] `Grid3x3` shows full-text column headers (ink bg + terracotta shadow), full-text row headers (plum bg + ink shadow), an empty top-left corner, "tap to place" placeholders, full character names in placed cells, and 80ms-stagger `cellScalePop` reveal
- [ ] `EmojiClue` reveals emojis sequentially with `emojiPop` (90ms stagger)
- [ ] `Silhouette` brightness crossfades on correct, scales 1.0 → 1.03 → 1.0, and shakes on wrong with a red border flash
- [ ] `SpellHint` shows incantation-length letter-drop placeholders and Card-wrapped hint reveals
- [ ] `ThemedDle` wrapper uses `bg-bg-base`, `Card` for loading, and shows invalid-guess toast as a danger-styled chip
- [ ] Host `ModeIntroSplash` renders Fraunces 8xl title on a plum hero card with full-text attribute chips
- [ ] Host `ModeResultsReveal` uses `Card` + `LeaderboardRow` for the top-3 panel
- [ ] Host `ThemedDleDisplay` has: top-left full-text location label, top-right `Countdown` ring, centre plum mode banner (Fraunces), bottom player tracker grid with full-text status labels (e.g. "Solved in 3 guesses", "4 of 6 guesses, in progress")
- [ ] No abbreviations anywhere — "Gryffindor" not "GRY", "Wand owner" not "WAND", "4 of 9 cells placed" not "4/9"
- [ ] Both themes (light, dark) verified by smoke test on all 5 modes
- [ ] No server / data / socket-event change
- [ ] `git status` shows clean working tree

---

## What this plan does NOT do (next plans)

- **Phase 9** — Migrate Numbers + NumbersDisplay
- **Phase 10** — Migrate Travel + TravelDisplay
- **Phase 11** — Final-cleanup pass — remove deprecated `index.css` rules (`.screen-shell`, `.screen-frame`, `.eyebrow`, `.status-pill`, `.btn-primary`, etc.), old Tailwind tokens (`game.*`, `primary.*`, `ui.*`, `answer.*`, `medal.*`), and any leftover `bg-black/30` / `text-ui-textMuted` references in this codebase. WCAG AA contrast audit. `prefers-reduced-motion` regression sweep. Mobile QA.
