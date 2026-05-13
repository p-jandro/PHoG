# PHoG UI Redesign — Phase 11: Final Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close out the UI redesign by sweeping the migration scaffolding the foundation plan deliberately left in place. Remove legacy `index.css` rules and legacy Tailwind color tokens; delete the unused `PlacementLeaderboard.tsx`; perform a full `prefers-reduced-motion` audit; perform a WCAG AA contrast audit on every text/background pairing in the new token set; perform a mobile QA pass across all redesigned screens at narrow viewport widths; decide on the fate of the `?showcase` dev route; and finish with a build + test + manual playthrough of every game in both themes.

**Architecture:** This phase is **strictly subtractive and corrective** — it removes dead code paths, verifies the new system, and adds reduced-motion guards only where missing. No new primitives, no new screens, no new motion variants. Every removal step is gated by a grep that proves zero remaining usages. If a grep finds residual usage, that means an earlier-phase screen is unmigrated → the task must STOP and report which screen still depends on the legacy class/token, rather than silently break it.

**Migration safety reminder** (from foundation plan §"Out of scope" and design spec §6.3):
- The foundation plan added new primitives without removing old styles so existing screens kept rendering during the migration.
- Phases 3–10 then migrated each screen onto the new system, but per spec §6.3 left the legacy `index.css` rules (`.card`, `.btn-primary`, `.input-field`, `.status-pill`, `.eyebrow`, `.section-label`, `.screen-shell`, `.screen-frame`, `.btn-secondary`, `.btn-answer`) and the legacy Tailwind tokens (`primary.*`, `game.*`, `difficulty.*`, `answer.*`, `medal.*`, `ui.*`) alive.
- This phase removes them. The legacy `answer.A/B/C/D` keys conflict semantically with the new `answer-a/b/c/d` keys; the new lowercase form is what migrated code uses. Likewise `medal.gold/silver/bronze` is superseded by `medal-gold/silver/bronze`.

**Tech stack:** No new dependencies. Existing Tailwind 3.4 · React 18 · TypeScript 5.3 · framer-motion 10 · Vitest. The only tool we lean on heavily here is `grep` (use the `Grep` tool / ripgrep, not `git grep`) for verification gates before each removal.

**Spec reference:** [docs/superpowers/specs/2026-05-13-ui-redesign-design.md](../specs/2026-05-13-ui-redesign-design.md) — §4.5 (accessibility & performance, reduced motion), §6.3 (migration safety), §7.4 row 11 (this phase), §7.6 (per-PR verification gate).

**Out of scope for this plan:**
- New visual changes — anything that requires a fresh design decision is a follow-up
- Server-side gaps flagged in spec §9 (Pointless reveal payload, Wordle target broadcast, Numbers best-so-far, Travel next-hop intent) — those are explicitly deferred to future tickets
- Audio, new games, i18n
- Replacing the map library

---

## File map

**Client (`packages/client/`):**
- `src/index.css` — remove legacy `@layer components` rules (`.screen-shell`, `.screen-frame`, `.eyebrow`, `.section-label`, `.status-pill`, `.btn-primary`, `.btn-secondary`, `.btn-answer`, `.card`, `.input-field`) and the trailing `.card::before` rule
- `tailwind.config.js` — remove legacy color groups (`primary`, `game`, `difficulty`, `answer`, `medal`, `ui`)
- `src/components/PlacementLeaderboard.tsx` — DELETE (verified unused)
- `src/App.tsx` — decide on `?showcase` route gate (see Task 7); modify if removed
- `src/ui/UiShowcase.tsx` — DELETE if Task 7 removes the gate
- Any primitive or screen identified in the reduced-motion audit (Task 4) that needs a `useReducedMotion()` guard added

**Host (`packages/host/`):**
- `src/index.css` — remove the same legacy `@layer components` rules (host's variant; note host has `.btn` instead of `.btn-primary/secondary/answer`, but the rest match)
- `tailwind.config.js` — remove legacy color groups (mirror of client)
- `src/App.tsx` — same `?showcase` decision as client
- `src/ui/UiShowcase.tsx` — same fate as client
- Any primitive or screen identified in the reduced-motion audit

**Docs:**
- This plan does NOT modify the spec — discovered architecture notes from earlier phases are handled in a separate spec-amendment commit (sibling to this plan).

---

## Tasks

### Task 1: Remove legacy CSS classes from `index.css` (both packages)

**Files:**
- Modify: `packages/client/src/index.css`
- Modify: `packages/host/src/index.css`

The grep gate is the most important part of this task. If any non-deleted screen still references one of these classes, that screen was not properly migrated in its phase and must be fixed first.

- [ ] **Step 1: Grep for residual usage of each legacy class (client + host)**

Run these greps from the repo root. Each MUST return zero matches under `packages/*/src/` (matches under `docs/`, the plans themselves, or `index.css` itself are expected and fine).

```bash
# Client side
grep -rn "screen-shell"   packages/client/src --include='*.tsx' --include='*.ts' --include='*.jsx' --include='*.js'
grep -rn "screen-frame"   packages/client/src --include='*.tsx' --include='*.ts' --include='*.jsx' --include='*.js'
grep -rn "\beyebrow\b"    packages/client/src --include='*.tsx' --include='*.ts' --include='*.jsx' --include='*.js'
grep -rn "section-label"  packages/client/src --include='*.tsx' --include='*.ts' --include='*.jsx' --include='*.js'
grep -rn "status-pill"    packages/client/src --include='*.tsx' --include='*.ts' --include='*.jsx' --include='*.js'
grep -rn "btn-primary"    packages/client/src --include='*.tsx' --include='*.ts' --include='*.jsx' --include='*.js'
grep -rn "btn-secondary"  packages/client/src --include='*.tsx' --include='*.ts' --include='*.jsx' --include='*.js'
grep -rn "btn-answer"     packages/client/src --include='*.tsx' --include='*.ts' --include='*.jsx' --include='*.js'
grep -rn "\bcard\b"       packages/client/src --include='*.tsx' --include='*.ts' --include='*.jsx' --include='*.js'   # review hits — many will be unrelated identifiers ("Card", "scoreCard"); only legacy `.card` classes are blocking
grep -rn "input-field"    packages/client/src --include='*.tsx' --include='*.ts' --include='*.jsx' --include='*.js'

# Host side (note: host's button class is just `.btn`, not `.btn-primary` — check both)
grep -rn "screen-shell"   packages/host/src   --include='*.tsx' --include='*.ts' --include='*.jsx' --include='*.js'
grep -rn "screen-frame"   packages/host/src   --include='*.tsx' --include='*.ts' --include='*.jsx' --include='*.js'
grep -rn "\beyebrow\b"    packages/host/src   --include='*.tsx' --include='*.ts' --include='*.jsx' --include='*.js'
grep -rn "section-label"  packages/host/src   --include='*.tsx' --include='*.ts' --include='*.jsx' --include='*.js'
grep -rn "status-pill"    packages/host/src   --include='*.tsx' --include='*.ts' --include='*.jsx' --include='*.js'
grep -rn '"btn"\|'\'btn\'\|className="[^"]*\bbtn\b'  packages/host/src --include='*.tsx' --include='*.ts'
grep -rn "\bcard\b"       packages/host/src   --include='*.tsx' --include='*.ts' --include='*.jsx' --include='*.js'   # same caveat as above
grep -rn "input-field"    packages/host/src   --include='*.tsx' --include='*.ts' --include='*.jsx' --include='*.js'
```

Expected: zero usages of `screen-shell`, `screen-frame`, `eyebrow`, `section-label`, `status-pill`, `btn-primary`, `btn-secondary`, `btn-answer`, `.btn` (host), `input-field`, and zero CSS-style `.card` usages (uppercase `Card` React-component imports are fine and expected).

If **any** of these still appear in `*.tsx` / `*.ts` JSX `className` attributes, **STOP**. Record the file + line(s) and report which legacy class is still in use. The owning phase (3–10) should have migrated it; do not silently swap the legacy class to a new primitive in this phase — that is migration work, not cleanup.

- [ ] **Step 2: Remove the legacy `@layer components` block from `packages/client/src/index.css`**

Replace the entire `@layer components { … }` block (currently containing `.screen-shell`, `.screen-frame`, `.eyebrow`, `.section-label`, `.status-pill`, `.btn-primary`, `.btn-secondary`, `.btn-answer`, `.card`, `.input-field`) and the trailing `.card::before { … }` rule with **nothing** — delete those lines outright.

Verify the file still imports `./ui/tokens.css`, the Google-fonts `@import`, and still has the `@tailwind base/components/utilities` directives, the universal `* { box-sizing }`, the `:root` font-variable defaults, the `body { … }` rule, the `#root` rule, the `h1..h4` rule, the form-element `font: inherit` rule, and the `::selection` rule. **Those non-legacy rules stay.**

- [ ] **Step 3: Remove the same block from `packages/host/src/index.css`**

Mirror of step 2. Host's block contains `.screen-shell`, `.screen-frame`, `.eyebrow`, `.section-label`, `.status-pill`, `.btn` (not `.btn-primary`), `.card`, `.input-field`, plus the trailing `.card::before`. Delete the entire `@layer components { … }` block and the trailing rule.

- [ ] **Step 4: Build both packages and confirm no Tailwind warnings about unknown classes**

```bash
cd packages/client && npm run build
cd ../host && npm run build
```

Expected: both succeed. If Tailwind emits warnings about unresolved classes, those are the residual usages step 1 failed to catch — return to step 1 and tighten the grep.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/index.css packages/host/src/index.css
git commit -m "refactor(ui): remove legacy index.css component classes (Phase 11)"
```

---

### Task 2: Remove legacy color tokens from `tailwind.config.js` (both packages)

**Files:**
- Modify: `packages/client/tailwind.config.js`
- Modify: `packages/host/tailwind.config.js`

Same grep-gate pattern: prove zero usage before deletion. The legacy `answer.A/B/C/D` (uppercase) conflicts in semantics with the new `answer-a/b/c/d` (lowercase, kebab) — the migrated screens use the new form, so finding `bg-answer-A` (uppercase) in `*.tsx` means a screen was not properly migrated.

- [ ] **Step 1: Grep for residual usage of each legacy Tailwind class group**

Tailwind class names are derived from the keys: `primary.blue` → `bg-primary-blue` / `text-primary-blue` / `border-primary-blue`, etc. The greps below cover the bg/text/border/ring prefixes.

```bash
# primary.*
grep -rEn "\b(bg|text|border|ring|from|to|via|fill|stroke)-primary-(navy|blue|teal|purple)\b" packages/client/src packages/host/src --include='*.tsx' --include='*.ts'

# game.*
grep -rEn "\b(bg|text|border|ring|fill|stroke)-game-(correct|incorrect|warning|leader)\b"    packages/client/src packages/host/src --include='*.tsx' --include='*.ts'

# difficulty.*
grep -rEn "\b(bg|text|border|ring|fill|stroke)-difficulty-(easy|medium|hard|impossible)\b"   packages/client/src packages/host/src --include='*.tsx' --include='*.ts'

# answer.* (uppercase legacy keys A/B/C/D — distinct from new lowercase answer-a/b/c/d)
grep -rEn "\b(bg|text|border|ring|fill|stroke)-answer-[ABCD]\b"                              packages/client/src packages/host/src --include='*.tsx' --include='*.ts'

# medal.* (legacy lower-tier keys gold/silver/bronze rendered as bg-medal-gold etc. — same Tailwind class name as the new tokens, but Tailwind resolves to the legacy hex first when both exist; once legacy is removed the new var-backed tokens take over. Grep is informational only.)
grep -rEn "\b(bg|text|border|ring|fill|stroke)-medal-(gold|silver|bronze)\b"                 packages/client/src packages/host/src --include='*.tsx' --include='*.ts'

# ui.*
grep -rEn "\b(bg|text|border|ring|fill|stroke)-ui-(background|card|border|text|textMuted)\b" packages/client/src packages/host/src --include='*.tsx' --include='*.ts'
```

Expected behavior per token group:

| Token group | Expected grep result | If non-zero → action |
|---|---|---|
| `primary.navy/blue/teal/purple` | **zero** matches | STOP — owning screen is unmigrated. Report. |
| `game.correct/incorrect/warning/leader` | **zero** matches | STOP. Report. |
| `difficulty.easy/medium/hard/impossible` | **zero** matches | STOP. Report. |
| `answer.A/B/C/D` (uppercase) | **zero** matches | STOP. Report. |
| `medal.gold/silver/bronze` | matches **expected and fine** | These hits resolve to the new `medal-gold/silver/bronze` var-backed token after the legacy group is removed — verified by the build step below. |
| `ui.background/card/border/text/textMuted` | **zero** matches | STOP — likely `text-ui-textMuted` or `border-ui-border` still in older screens; report which file. |

Note: spec §6.3 expected the legacy `ui.*` tokens to be retired; if Phase 3 (Lobby/Dashboard) or later phases still consume them, that's the migration debt that needs addressing before this task can proceed.

- [ ] **Step 2: Delete legacy color groups from `packages/client/tailwind.config.js`**

In `theme.extend.colors`, delete the entire "EXISTING (kept so old screens keep working until they're migrated)" block — every key from `primary` through `ui`. The "NEW: redesign tokens" block (`bg-base`, `bg-surface`, `ink`, `action`, `now`, `info`, `streak`, `premium`, `danger`, `warn`, `on-*`, `answer-a..d`, `medal-gold/silver/bronze`) stays. The `fontFamily`, `boxShadow`, and `animation` blocks stay unchanged.

- [ ] **Step 3: Delete legacy color groups from `packages/host/tailwind.config.js`**

Mirror of step 2.

- [ ] **Step 4: Build both packages**

```bash
cd packages/client && npm run build
cd ../host && npm run build
```

Expected: both succeed cleanly. The previously-conflicting `bg-medal-gold` references now resolve to `var(--medal-gold)` and inherit theme-flipping for free. If any class fails to resolve, Tailwind emits a build warning — that surfaces a missed usage; return to step 1 and widen the grep (e.g. concatenated class names with template literals can dodge plain regex).

- [ ] **Step 5: Visual spot-check both apps in dev**

```bash
# Terminal 1
cd packages/server && npm run dev
# Terminal 2
cd packages/client && npm run dev
# Terminal 3
cd packages/host && npm run dev
```

In a browser open the Lobby on the client and the Dashboard on the host. Confirm:
- No "missing color" rendering (white-on-white text, transparent borders).
- Theme toggle still flips both apps between light and dark cleanly.
- Medals on any leaderboard render in the correct gold/silver/bronze.

- [ ] **Step 6: Commit**

```bash
git add packages/client/tailwind.config.js packages/host/tailwind.config.js
git commit -m "refactor(ui): remove legacy Tailwind color tokens (Phase 11)"
```

---

### Task 3: Delete unused `PlacementLeaderboard.tsx`

**Files:**
- Delete: `packages/client/src/components/PlacementLeaderboard.tsx`

The Phase 4 plan flagged this file as unused. Confirm with grep before deleting. (The server-side function `generatePlacementLeaderboard()` in `packages/server/src/utils/scoring.js` is a different identifier and is not affected.)

- [ ] **Step 1: Confirm zero imports across all three packages**

```bash
grep -rn "PlacementLeaderboard" packages/client/src packages/host/src --include='*.tsx' --include='*.ts'
```

Expected: only `packages/client/src/components/PlacementLeaderboard.tsx` itself (the file we're about to delete). No `import { PlacementLeaderboard }` lines, no JSX `<PlacementLeaderboard …/>`.

If any importer turns up, STOP and report. (Server-side `generatePlacementLeaderboard` is fine — it's a different camelCase identifier and lives in `packages/server`.)

- [ ] **Step 2: Delete the file**

```bash
git rm packages/client/src/components/PlacementLeaderboard.tsx
```

- [ ] **Step 3: Build the client**

```bash
cd packages/client && npm run build
```

Expected: success — no consumers means no broken imports.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(client): delete unused PlacementLeaderboard component"
```

---

### Task 4: Reduced-motion audit pass

**Files:**
- Modify: any primitive or screen that fails the audit (expected: small list, only where missing)

Per spec §4.5: every transform-based reveal must fall back to a crossfade (or static) under `prefers-reduced-motion: reduce`. Many primitives already do this — the goal of this task is to find the gaps.

- [ ] **Step 1: Enumerate every animated surface**

Make a checklist of every place an animation is triggered. Cover:

**Primitives** (`packages/{client,host}/src/ui/`):
- `Button` — tap / hover (transform; OK to keep — input affordance, not a reveal)
- `Tile` — flip cascade (transform — needs guard)
- `Countdown` — number beat (transform; small, but still a transform — verify guard)
- `LeaderboardRow` — FLIP reorder (layout transform — needs guard)
- `Avatar` — pop-in (scale — needs guard)
- `ScoreDrop` — vertical drop (transform — needs guard)
- `ThemeToggle` — thumb slide (transform — small UI affordance, keep but check)
- `AnswerFeedback` — correct pulse / wrong shake (transform — confirm guard exists; per Phase 5 it should)
- `Confetti` — celebration burst (renders nothing under reduced motion per Phase 4 — confirm)

**Screens / components**:
- `Countdown` screen — ring fill + number beat
- `Quiz` / `TrueFalse` — answer feedback (covered by `AnswerFeedback`)
- `Wordle` — tile flip cascade + keyboard recolor
- `ThemedDle` — five modes: tile flip, cell scale-pop, silhouette reveal, emoji pop, letter drop
- `Numbers` — digit roll
- `Travel` — pin drop + arc draw (Phase 10 Task 11 step 5 flagged this as a known follow-up)
- `Pointless` — `ScoreDrop` (covered)
- `Lobby` — avatar pop-in (covered by `Avatar`)
- `FinalLeaderboard` — bottom-up rank reveal + Confetti (Confetti covered)
- `RoundLeaderboardOverlay` — FLIP reorder
- `PausedOverlay` — fade in (covered)

For each one, grep for `useReducedMotion` and read enough to know what the component does under reduce. The existing files using `useReducedMotion` are already known (the foundation phase identified them):

```bash
grep -rln "useReducedMotion\|prefersReducedMotion" packages/client/src packages/host/src
```

- [ ] **Step 2: For each surface NOT in that grep output, decide one of:**

  1. **No animation runs there** (e.g. pure layout) → no change.
  2. **Animation is a hover/tap affordance, not a reveal** (e.g. Button hover) → keep as-is; affordances are explicitly allowed (spec §4.5: "transforms get swapped for crossfades; colors and information still land" — affordances aren't reveals).
  3. **Animation is a reveal/state change with a transform** → ADD a `useReducedMotion()` guard. Pattern:

```tsx
import { useReducedMotion } from 'framer-motion';
// inside component:
const reduce = useReducedMotion();
const variants = reduce ? reducedFade : myTransformVariant;
```

Where `reducedFade` is a fade-only variant (opacity 0 → 1, ~180ms) that ships in `lib/motion.ts`. If `reducedFade` doesn't already exist in either `motion.ts`, ADD it as part of this task — both packages.

- [ ] **Step 3: Verify in Chrome DevTools → Rendering → Emulate CSS `prefers-reduced-motion: reduce`**

Playthrough checklist (one quick pass under reduce per game):

- [ ] Lobby — avatars appear; no pop animation
- [ ] Countdown — number changes; no beat scale
- [ ] Quiz — answer commits; correct pulse falls back to color flash, no scale; wrong shake falls back to color flash, no horizontal shake
- [ ] TrueFalse — same as Quiz
- [ ] Pointless — `ScoreDrop` panel reveals score with crossfade, not drop (or jumps directly to landed state)
- [ ] Wordle — tile colors appear without flip; keyboard recolors without crossfade
- [ ] ThemedDle (all 5 modes) — colors land; no scale-pop / silhouette transition / emoji pop / letter drop
- [ ] Numbers — score appears; no digit roll
- [ ] Travel — pins appear at final position; arcs render full-stroke (Phase 10 flagged this for THIS phase to resolve)
- [ ] FinalLeaderboard — ranks appear (5→1 sequencing can stay as a delay sequence; just no transform). Confetti renders nothing.

- [ ] **Step 4: Build, smoke-test, commit**

```bash
cd packages/client && npm run build
cd ../host && npm run build
```

```bash
git add -A
git commit -m "fix(ui): add useReducedMotion guards to remaining transform reveals (Phase 11)"
```

Note: the exact files touched will vary based on the audit findings; expect 2–6 files at most, since most phases already added their own guard. Include `lib/motion.ts` only if `reducedFade` had to be added.

---

### Task 5: WCAG AA contrast audit

**Files:** none modified by default. If a pairing fails, fixing it requires either a token value tweak in `ui/tokens.css` (and a sibling commit to the spec §2.1 table — out of scope, flag as a follow-up) OR a layout change. Most pairings should pass on first measurement.

The new palette was chosen with contrast in mind, but no formal measurement has happened end-to-end. WCAG AA requires 4.5:1 for normal text and 3:1 for large text (18pt+/14pt-bold+). Test every text/background pairing in BOTH themes.

- [ ] **Step 1: Build the contrast pairings table**

For each token, the relevant pairings to measure:

**Light theme (`[data-theme="light"]`):**

| Foreground | Background | Use case | Min ratio | Result |
|---|---|---|---|---|
| `--ink` `#181614` | `--bg-base` `#fdf6e8` | Body text on app background | 4.5:1 | _measure_ |
| `--ink` `#181614` | `--bg-surface` `#ffffff` | Body text on cards | 4.5:1 | _measure_ |
| `--ink` `#181614` | `--bg-sunken` `#f2e9d4` | Input text | 4.5:1 | _measure_ |
| `--ink-muted` `#4a3f33` | `--bg-base` `#fdf6e8` | Secondary text on bg | 4.5:1 | _measure_ |
| `--ink-muted` `#4a3f33` | `--bg-surface` `#ffffff` | Secondary text on cards | 4.5:1 | _measure_ |
| `--on-action` (white) | `--action` `#2ec27e` | Button label on green | 4.5:1 | _measure_ |
| `--on-now` `--ink` | `--now` `#ffd23f` | Label on sun-yellow chip | 4.5:1 | _measure_ |
| `--on-info` (white) | `--info` `#4a7adf` | Label on cobalt chip | 4.5:1 | _measure_ |
| `--on-streak` (white) | `--streak` `#d96a3a` | Hero chip | 4.5:1 | _measure_ |
| `--on-premium` (white) | `--premium` `#5b3a5b` | Final-round chip | 4.5:1 | _measure_ |
| `--on-danger` (white) | `--danger` `#e54848` | Error / wrong | 4.5:1 | _measure_ |
| `--ink` | `--warn` `#f59e0b` | Partial / amber label | 4.5:1 | _measure_ |
| `--ink` | `--answer-a` cobalt | A-button label | 4.5:1 | _measure_ |
| `--on-action` | `--answer-b` grass | B-button label | 4.5:1 | _measure_ |
| `--ink` | `--answer-c` sun | C-button label | 4.5:1 | _measure_ |
| `--on-premium` | `--answer-d` plum | D-button label | 4.5:1 | _measure_ |
| `--ink` | `--medal-gold` `#e0b94a` | Gold rank | 3:1 (decorative) | _measure_ |
| `--ink` | `--medal-silver` `#b9b0a3` | Silver rank | 3:1 | _measure_ |
| `--on-streak` | `--medal-bronze` `#b8714a` | Bronze rank | 3:1 | _measure_ |

**Dark theme (`[data-theme="dark"]`):**

Repeat every row with the dark-theme values: `--bg-base` `#131013`, `--bg-surface` `#1f1b1a`, `--bg-sunken` `#171313`, `--ink` `#fdf6e8`, `--ink-muted` `#b4a48b`, `--action` `#3ad286`, `--now` `#ffd23f`, `--info` `#6b95ee`, `--streak` `#e88557`, `--premium` `#7a4f7a`, `--danger` `#ff6b6b`, `--warn` `#ffb84d`. The "on-*" tokens may need verification — read `ui/tokens.css` for the exact dark-mode values used.

- [ ] **Step 2: Measure each pairing**

Use any of these tools (pick one and use it consistently):
- WebAIM Contrast Checker (paste hex into the form) — https://webaim.org/resources/contrastchecker/
- Chrome DevTools Inspector (hover the color swatch in the Styles panel — it shows the live contrast ratio against the resolved background)
- `npx wcag-contrast-checker` if installed locally

Fill in each "Result" cell with the measured ratio + PASS/FAIL.

- [ ] **Step 3: Resolve any FAIL rows**

If a pairing fails AA:
1. **Confirm it's a real-world pairing** — e.g. `--ink` on `--answer-a` only matters if a screen actually paints ink-color text on the cobalt button. If no such layout exists, mark "N/A" and move on.
2. If it IS a real-world pairing, the fix is a token tweak — propose the new hex in this plan's report and flag as a follow-up ticket. **Do not edit `ui/tokens.css` in this phase without a clear spec amendment** — that's a design decision.

- [ ] **Step 4: Capture results in a commit (optional)**

If the table is filled in and no fixes are needed, no code commit. If fixes were needed, commit them in a single commit:

```bash
git add packages/client/src/ui/tokens.css packages/host/src/ui/tokens.css
git commit -m "fix(ui): tighten token contrast to WCAG AA (Phase 11)"
```

Otherwise nothing to commit for this task. Add the filled-in pairings table to the plan's report so the audit is on-record.

---

### Task 6: Mobile QA pass

**Files:** none modified by default. Fixes are inline layout tweaks per screen if a break is found.

Test every player screen at 320 px (iPhone SE), 375 px (iPhone 12 mini / 13 mini), 414 px (iPhone Plus / Pro Max), and 768 px (iPad portrait). Host screens are TV-only and out of scope for this audit; verify Dashboard at 768 px only as the largest realistic phone landscape.

- [ ] **Step 1: Build the per-screen checklist**

| Screen | 320 | 375 | 414 | 768 | Notes |
|---|---|---|---|---|---|
| Lobby | _check_ | _check_ | _check_ | _check_ | Join card; status pill; avatar wall must wrap, not overflow |
| Countdown | _check_ | _check_ | _check_ | _check_ | Ring + number must fit; no horizontal scroll |
| Quiz | _check_ | _check_ | _check_ | _check_ | **Watch:** 4 answer buttons in answer-letter colors — must stack 1 col on 320, can 2-col on 414+ |
| TrueFalse | _check_ | _check_ | _check_ | _check_ | Two large buttons stack on narrow |
| Pointless | _check_ | _check_ | _check_ | _check_ | Input + ScoreDrop track must fit |
| ThemedDle (all 5) | _check_ | _check_ | _check_ | _check_ | Classic tiles, 3×3 grid, silhouette, emoji, spell — each mode |
| Wordle | _check_ | _check_ | _check_ | _check_ | **Watch:** keyboard at 320 — keys must not overlap; tile grid must center |
| Numbers | _check_ | _check_ | _check_ | _check_ | **Watch:** tile pool must wrap, op buttons reachable with thumbs |
| Travel | _check_ | _check_ | _check_ | _check_ | **Watch:** country autocomplete dropdown must not push viewport; chain pills wrap |
| FinalLeaderboard | _check_ | _check_ | _check_ | _check_ | Winner headline (Fraunces) must not overflow on 320 |
| RoundLeaderboard overlay | _check_ | _check_ | _check_ | _check_ | Overlay row count; FLIP reorder visible |

Bolded "Watch" items are the screens with the highest risk per the task brief — they have layouts most likely to break on narrow phones.

- [ ] **Step 2: Run the checklist**

Open Chrome DevTools → Device Toolbar. Set custom width via the dropdown for each viewport. Walk every screen.

For each cell:
- **OK** — readable; tappable targets ≥ 44 px; no horizontal scroll; no overlap
- **FIX** — one of the above fails; record the issue inline in the table

- [ ] **Step 3: Resolve FIX rows**

Most likely fixes are local layout changes in the screen that broke: switch a `flex-row` to `flex-row flex-wrap`, add `gap-y-` for wrap, reduce a padding step on narrow viewports via Tailwind `sm:` prefix, or `min-w-0 truncate` for long player names. Commit each fix in a focused commit:

```bash
git add packages/client/src/screens/<ScreenName>.tsx
git commit -m "fix(<screen>): wrap on narrow viewports (mobile QA Phase 11)"
```

- [ ] **Step 4: Re-verify after each fix**

Re-build and re-test the touched viewport to confirm the FIX cell is now OK.

---

### Task 7: Decide on the `?showcase` route gate

**Files:**
- Possibly modify: `packages/client/src/App.tsx`, `packages/host/src/App.tsx`
- Possibly delete: `packages/client/src/ui/UiShowcase.tsx`, `packages/host/src/ui/UiShowcase.tsx`

The foundation plan introduced `?showcase` as a query-param branch in `App.tsx` to render a visual QA page (`UiShowcase`) for primitives. That page was useful during phases 2–10; it is **not** part of the shipping app.

- [ ] **Step 1: Decide — keep or remove?**

**Recommendation: KEEP for now.** Rationale:
- It's gated behind a query param, so end users will never see it.
- It costs ~one small lazy-loaded chunk if dynamically imported, or a ~modest static page if not — verify by checking the bundle size of the showcase page (`vite build` then `npm run preview` and inspect Network).
- Future primitives (or theme reskins) benefit from having a live visual reference.
- Removing it now would lose the only end-to-end visual snapshot of every primitive.

**Counter-case to remove:**
- If the showcase ships in the production bundle (not lazy-loaded), it adds dead code to every player's download.
- If anyone has linked to the showcase from non-dev contexts.

- [ ] **Step 2: If KEEPING, verify it's not in the prod hot path**

Read `packages/client/src/App.tsx` and confirm the `?showcase` branch dynamically imports `UiShowcase` (e.g. `React.lazy(() => import('./ui/UiShowcase'))`) rather than statically imports it. If it's a static import, refactor to lazy-load:

```tsx
const UiShowcase = React.lazy(() => import('./ui/UiShowcase'));
// ...
if (params.get('showcase') !== null) {
  return (
    <React.Suspense fallback={null}>
      <UiShowcase />
    </React.Suspense>
  );
}
```

Mirror in host. Build, verify chunking split shows showcase as its own chunk (`npm run build`; check `dist/assets/` filenames).

Commit:
```bash
git add packages/client/src/App.tsx packages/host/src/App.tsx
git commit -m "perf(ui): lazy-load UiShowcase route to keep prod bundle slim"
```

- [ ] **Step 3: If REMOVING (alternative path), delete the showcase page and its route**

```bash
git rm packages/client/src/ui/UiShowcase.tsx packages/host/src/ui/UiShowcase.tsx
```

Edit `packages/client/src/App.tsx` and `packages/host/src/App.tsx` to remove the `?showcase` branch entirely. Build to confirm no orphan imports.

```bash
cd packages/client && npm run build
cd ../host && npm run build
```

Commit:
```bash
git add packages/client/src/App.tsx packages/host/src/App.tsx
git commit -m "chore(ui): remove dev-only ?showcase route (Phase 11)"
```

- [ ] **Step 4: Record the decision in the plan's report**

Note in the final report which option was taken and why.

---

### Task 8: Final build + test pass + manual playthrough of every game in both themes

**Files:** none — verification only.

This is the spec §7.6 "Per-PR verification gate" applied as a final sweep before declaring the redesign complete.

- [ ] **Step 1: Clean build all three packages**

```bash
cd packages/server && npm run build  # if applicable
cd ../client && npm run build
cd ../host && npm run build
```

Expected: all succeed with no warnings.

- [ ] **Step 2: Run the client test suite**

```bash
cd packages/client && npm run test:run
```

Expected: green. Same passing count as Phase 10 (no new tests introduced; no existing tests broken).

- [ ] **Step 3: Boot dev servers and run a full playthrough**

Three terminals (server / client / host). Two client tabs joined with two distinct names. Run the Championship Sequence end-to-end:

1. Lobby → join → countdown
2. Quiz round (≥3 questions, mix of correct/wrong, check streak chip)
3. TrueFalse round
4. Pointless round (full ScoreDrop reveal)
5. Wordle round (full 6 guesses, one player wins, one player runs out)
6. ThemedDle — all 5 modes (Classic, Grid 3×3, Silhouette, Emoji clue, Spell hint)
7. Numbers round
8. Travel round
9. Final leaderboard reveal (5→1 sequence + Confetti for rank 1)

For each round verify:
- Both player tabs show the same correct state
- Host display is consistent with both players
- Round leaderboard FLIP-reorders correctly
- Score totals match between client + host + server-emitted values

- [ ] **Step 4: Repeat the playthrough in dark mode**

Toggle theme on the player client + host. Replay the same sequence (or at least one round per game type if time-constrained). Verify:
- No flash on theme flip
- No transform jank during the 180ms color transition
- All map fills, tile colors, chip backgrounds flip cleanly
- Heritage terracotta/plum still show as celebration colors in both themes

- [ ] **Step 5: Smoke-test theme persistence**

- Toggle to dark on the player client. Reload. → Still dark.
- Toggle to light. Reload. → Still light.
- Clear `localStorage.phog-theme` in DevTools. Set OS to dark. Reload. → Renders dark.
- Toggle to light manually. Set OS to light, then dark. → App stays light (manual override sticks).
- Repeat all four checks on the host independently (separate localStorage).

- [ ] **Step 6: `prefers-reduced-motion` final pass**

DevTools → Rendering → Emulate `prefers-reduced-motion: reduce`. Replay any one round of Quiz, Wordle, and Travel. Confirm: state changes still land (colors, info), no transforms jar.

- [ ] **Step 7: No commit unless something needed fixing**

If steps 1–6 all pass with no fix needed, this task has no commit — verify clean working tree:

```bash
git status
```

If a fix was needed, commit it in the smallest possible commit with a clear `fix(<area>):` message.

---

## Done criteria

All of the following must be true before the plan is considered complete:

- [ ] `packages/client/src/index.css` no longer contains `.screen-shell`, `.screen-frame`, `.eyebrow`, `.section-label`, `.status-pill`, `.btn-primary`, `.btn-secondary`, `.btn-answer`, `.card`, `.input-field`, or `.card::before`
- [ ] `packages/host/src/index.css` no longer contains `.screen-shell`, `.screen-frame`, `.eyebrow`, `.section-label`, `.status-pill`, `.btn`, `.card`, `.input-field`, or `.card::before`
- [ ] `packages/client/tailwind.config.js` and `packages/host/tailwind.config.js` no longer declare `primary.*`, `game.*`, `difficulty.*`, `answer.{A,B,C,D}` (uppercase), `medal.{gold,silver,bronze}` (legacy non-var keys), or `ui.*` color groups
- [ ] `packages/client/src/components/PlacementLeaderboard.tsx` is deleted; no remaining imports anywhere under `packages/`
- [ ] `npm run build` succeeds in both `packages/client` and `packages/host` with no Tailwind warnings about unknown classes
- [ ] `npm run test:run` in `packages/client` green
- [ ] Every screen identified in the Task 4 reduced-motion audit either renders without transforms under `prefers-reduced-motion: reduce`, or is documented as an intentional affordance (not a reveal)
- [ ] Every WCAG AA pairing from Task 5 is measured and either passes or has a documented follow-up
- [ ] Every player screen renders cleanly at 320, 375, 414, and 768 px viewport widths
- [ ] The `?showcase` route is either lazy-loaded (kept) or removed (decision documented in the plan's report)
- [ ] Manual playthrough of every game completes successfully in both light and dark themes
- [ ] Theme persistence (localStorage + OS-prefers-color-scheme) behaves per spec §5
- [ ] No untracked files; clean working tree

---

## What this plan does NOT do

- Touch the design spec — spec amendments for newly-discovered architecture decisions (HostScreenShell, PlayerTracker, AnswerFeedback, Confetti primitives; motion variants added per phase; Dashboard panel removals; server-side gaps deferred) are handled in a sibling docs-only commit.
- Address the server-side gaps documented in the (newly added) spec §9 — those are future tickets:
  - Pointless: no per-player score breakdown event from server
  - Wordle: target word not in `wordle:round:start` event
  - Numbers: no `bestValue` field per player during play
  - Travel: no per-guess "next-hop intent" field
- Add new games, new modes, audio, or i18n.
- Replace the map library.
- Add new primitives or motion variants (except `reducedFade` if it was missing from `lib/motion.ts` — that's a small Phase 11 addition only if needed by the Task 4 audit).
