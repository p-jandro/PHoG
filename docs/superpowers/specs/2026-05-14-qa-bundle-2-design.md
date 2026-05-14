# QA Bundle 2 — 2026-05-14

A second QA punch list from a manual playthrough of PHoG `main`, scoped as a single bundled fix. 14 items across Pokédle/HP-dle, Wordle, Pointless, Quiz, T/F, Travle, Numbers.

## Scope

| # | Area | Change |
|---|------|--------|
| 1 | Pokédle silhouette | Reveal curve broken — cap initial zoom much lower, never auto-reveal before solve. |
| 2 | DLE timers (both Pokédle and HP-dle) | All modes (Classic, Silhouette, Spell, 3x3 Grid) capped at 100s. |
| 3 | Round advancement | Pointless must early-advance when every connected player has submitted. (Wordle, DLEs, Travle already do; verify and document.) |
| 4 | Quiz & T/F | Show a leaderboard between rounds. |
| 5 | DLE autofill | Suggest only entries that start with the typed query (first letter onward), not substring matches anywhere. |
| 6 | HP-dle spell mode | Ensure the correct spell is reachable from the autocomplete (depends on #5). |
| 7 | DLE 3x3 grid | Row and column header labels must never overflow their box; centered; reduce font-size as needed. |
| 8 | DLE 3x3 grid host display | Show the revealed grid (host-side reveal phase currently blank). |
| 9 | Numbers game | Easy/Medium/Difficult must score differently. Apply 1.0× / 1.5× / 2.0× multiplier. |
| 10 | Wordle host display | Defer the answer reveal until all players have submitted. |
| 11 | Travle map | Pan and zoom on the player map (currently fixed). |
| 12 | Travle end-of-round | At reveal, fill in only the missing optimal-route countries — nothing else. |
| 13 | Travle wrong guesses | Count toward the guess budget. |
| 14 | Travle timer | Move countdown into the existing header next to guesses-remaining, format `Xs`. |

## Per-item design

### 1. Pokédle silhouette reveal curve

`packages/client/src/components/themed-dle/Silhouette.tsx` — replace the ZOOM/BRIGHTNESS arrays so:
- Initial zoom is `1.5` (down from `4.0`).
- Each wrong guess drops zoom by a small step, reaching `1.0` by guess 5 (half the budget) and staying there.
- Brightness ramps from `0` at start through guess-6 (`0.4`) up to `0.85` at guess 10; never `1.0` unless solved.
- Concrete arrays (length 11, stage 0..10):
  - `ZOOM = [1.5, 1.4, 1.3, 1.2, 1.1, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]`
  - `BRIGHTNESS = [0, 0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.55, 0.7, 0.8, 0.85]`
- The `solved` branch forces brightness `1.0` (unchanged) — full reveal only when solved.
- Out-of-guesses state: keep showing the partial silhouette + "Out of guesses" chip (do not auto-reveal).

Server-side `_targetReveal` is unchanged — full reveal still happens during the results phase (which is correct).

### 2. DLE timers → 100s

`packages/server/src/games/themedDle.js`:
- `CLASSIC_DURATION` → 100000
- `SILHOUETTE_DURATION` → 100000
- `SPELL_DURATION` → 100000
- `GRID_DURATION` → 100000
- (Leave `INTRO_DURATION`, `RESULTS_DURATION` unchanged.)

### 3. Pointless early-advance

`packages/server/src/games/pointless.js` `submitAnswer` already calls `broadcastProgress`. Add: after broadcasting, if every connected player has an entry in `this.gameState.pointless.answers`, stop the timer and call `endRound()`. Use the same `connectedIds` pattern as `wordle._checkEarlyEnd`.

Verify (no change needed if already true):
- `wordle._checkEarlyEnd` — present at `wordle.js:182`.
- `themedDle._checkRoundComplete` / `_checkGridAllSolved` — present at `themedDle.js:806` and `:789`.
- `travel._checkEarlyEnd` — present at `travel.js:276`.

### 4. Quiz & T/F inter-round leaderboard

Per `bug-report-2026-05-14.md` §A4, the inter-round leaderboard popover was previously removed because it caused a flicker between the question-results and final leaderboard. We re-introduce it cleanly:

- Server emits a `quiz:leaderboard:show` / `truefalse:leaderboard:show` event after the per-question results window, with the current leaderboard payload and a fixed `duration` of `5000`ms.
- After that event fires, transition to the next round's voting/start. The final-leaderboard handoff (`quiz:end`) is unchanged.
- Client (`packages/client/src/screens/Quiz.tsx`, `TrueFalse.tsx`) renders a dedicated leaderboard overlay between rounds.
- Host display (`packages/host/src/screens/Display.tsx`) renders the same.
- Skip the inter-round leaderboard before round 1 (no prior data) and after the final round (final leaderboard takes over).

### 5. DLE autofill — startsWith filter

`packages/client/src/components/themed-dle/AutocompletePicker.tsx` line 27–36:
- Filter to entries whose `name` (or any alias) **starts with** the query (`startsWith`, case-insensitive), not `includes`.
- Empty query → empty suggestion list (unchanged).

### 6. Spell autocomplete reachability

Once #5 is in place, the spell autocomplete in Spell mode must still find the answer. Check the path in `packages/client/src/screens/ThemedDle.tsx` (or `SpellHint.tsx` / spell-mode picker) that consumes `spellList`. If spell mode uses its own picker rather than `AutocompletePicker`, apply the same `startsWith` rule there. Confirm the round's `spell.incantation` is included in the `spellList` payload sent at round start (`themedDle.js:565` already maps every spell — verify the value isn't accidentally truncated to fewer than the full pack).

### 7. 3x3 grid header overflow

`packages/client/src/components/themed-dle/Grid3x3.tsx` and `packages/host/src/components/themed-dle/HostGridView.tsx`:
- Row and column header cells: apply `text-align: center`, `overflow: hidden`, `word-break: break-word`, and `font-size: clamp(...)` so labels shrink to fit instead of overflowing.
- Long labels (e.g. "Owned by an anime regular") must wrap inside the cell.
- Add a Storybook/Vitest snapshot or simple manual test reference in the plan.

### 8. Grid host display reveal

`packages/host/src/components/themed-dle/HostGridView.tsx` and/or `ModeResultsReveal.tsx`:
- During the `results` phase for grid mode, the host display currently renders blank. Replace with a populated grid that uses `revealedTarget.cellAnswers` (the server already provides this — `themedDle.js:585–593`) and shows up to 5 valid sample answers per cell.

### 9. Numbers game difficulty scoring

`packages/server/src/games/numbers.js` `scoreSolved`:
- Add a difficulty multiplier: `easy 1.0`, `medium 1.5`, `difficult 2.0`, applied to the full `base + speed + firstBonus` total.
- Pass the current round's `difficulty` into `scoreSolved` (currently called at `numbers.js:257` with only `remainingMs, totalMs, isFirstSolver`).
- Update the intro `scoringRules` text so players see the difficulty multipliers.
- Update tests in `tests/numbers/` if any assert exact score values.

### 10. Wordle host display answer hold

The host already receives `wordle:round:start:host` with the target word at round start (`wordle.js:113`). Host should keep it hidden in `WordleDisplay.tsx` until either:
- Every connected player has solved or used all 6 guesses, OR
- The 120s timer expires (i.e. `wordle:round:results` fires).

Client-side: in `packages/host/src/screens/WordleDisplay.tsx`, track per-player `solved` and `guessesUsed` from `wordle:progress`, and only render the answer (or reveal the master row) once the all-done predicate flips true.

### 11. Travle map pan/zoom

`packages/client/src/screens/Travel.tsx` (player view) — wrap the map in a pinch/scroll/pan-enabled container. Use `react-zoom-pan-pinch` (or equivalent already in deps) so:
- Mouse-wheel zoom on desktop; pinch zoom on touch.
- Click-and-drag to pan; touch-drag on mobile.
- A "reset view" button returns to the default fitted viewport.
- Default viewport still fits `relevantIsos` (the existing prop).

### 12. Travle end-of-round: fill missing optimal route only

`packages/client/src/screens/Travel.tsx` reveal/results view and `packages/host/src/screens/TravelDisplay.tsx`:
- At reveal, take the player's combined chain and the server's `optimalChain` (already broadcast in `travel:round:results`).
- For any country on the optimal chain not in the player's chain, render it lightly (e.g. dashed outline) to fill the missing route only.
- Do NOT render the player's wrong guesses, side branches, or other countries beyond the optimal path.

### 13. Travle wrong guesses count

`packages/server/src/games/travel.js handleSubmit` at line 165:
- Currently when a guess is "not adjacent" (`!adjFront && !adjBack`), it returns via `_ackInvalid` without incrementing `guessesUsed`. Treat this case as a wrong guess: increment `guessesUsed`, append a `red` history entry with no chain mutation, broadcast progress, run `_checkEarlyEnd`.
- The `not recognized` invalid case (line 172) stays uncounted — that's a typo, not a guess.

### 14. Travle countdown in header

`packages/client/src/screens/Travel.tsx`:
- Existing header shows guess counter; add a sibling element bound to the round's `endsAt` and tick every 250ms, formatted as `Xs` (e.g. `45s`).
- Reuse the existing countdown hook used elsewhere (`packages/client/src/hooks/`) if one exists; otherwise write a small `useCountdown(endsAt)` hook.

## Components and data flow (changes only)

```
themedDle.js     → SILHOUETTE_DURATION, CLASSIC_DURATION, SPELL_DURATION, GRID_DURATION = 100000
pointless.js     → submitAnswer now triggers _checkEarlyEnd
quiz.js          → emit quiz:leaderboard:show between rounds
trueFalse.js     → emit truefalse:leaderboard:show between rounds
numbers.js       → scoreSolved gains difficulty multiplier; intro text updated
travel.js        → handleSubmit increments guessesUsed on adjacency failure

AutocompletePicker.tsx → startsWith filter
Silhouette.tsx          → new ZOOM/BRIGHTNESS arrays; no auto-full-reveal
ThemedDle.tsx / SpellHint → confirm spell picker also uses startsWith
Grid3x3.tsx & HostGridView.tsx → header centering + text-clamp
HostGridView.tsx / ModeResultsReveal.tsx → grid reveal view
Quiz.tsx, TrueFalse.tsx, Display.tsx → inter-round leaderboard overlay
WordleDisplay.tsx → defer answer reveal until all done
Travel.tsx       → pan/zoom map; countdown in header; reveal fills missing optimal route
TravelDisplay.tsx → mirror reveal-fill behavior
```

## Testing strategy

For each change, run the relevant existing test suite under `tests/`. New tests for:
- `tests/numbers/scoring.test.mjs` — assert easy/medium/difficult multipliers.
- `tests/travel/early-end.test.mjs` — assert non-adjacent guesses count toward budget.
- `tests/pointless/early-end.test.mjs` — assert round ends early when all players submit.
- `tests/themed-dle/autocomplete.test.tsx` (client unit test) — startsWith behavior.

Manual checklist will be added to the implementation plan for UI-only items (zoom curve, map pan, grid header overflow, host displays).

## Out of scope

- Performance work, redesign of any game's core loop.
- New game modes.
- The dropped emoji mode.
- Migrations to a different map library if `react-zoom-pan-pinch` proves insufficient — fall back to a simpler scroll wrapper before introducing a new dep.

## Open follow-ups (track in implementation plan)

- Confirm whether the host display has been mirroring the dropped inter-round leaderboard or removed it entirely.
- If `react-zoom-pan-pinch` isn't already in `packages/client/package.json`, get user approval before adding it.
