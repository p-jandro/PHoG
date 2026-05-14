# PHoG QA Bug Report — 2026-05-14

**Source:** manual visual playthrough on `claude/eager-villani-da47cb` after the redesign + 9-game championship stress test landed.
**Tester:** Peter
**Branch:** `claude/eager-villani-da47cb`

Each item below lists what was observed, the current (broken) behaviour, the expected behaviour, and where in the code the fix likely lives. Items marked **[BOTH]** apply equally to Pokédle and HPdle.

---

## A. Global / cross-cutting

### A1. Theme toggle should be visible during gameplay (player + host)
**Observed:** the ☀/☾ toggle is only visible on the lobby/dashboard. During an active game (Quiz, Pointless, etc.) and on the host display, the toggle is hidden.
**Expected:** toggle always visible on every screen for both player client and host display. Players and hosts must be able to switch theme at any time without leaving the round.
**Likely files:** `packages/client/src/components/GameStatusBar.tsx` (player), `packages/host/src/ui/HostScreenShell.tsx` (host).
**Origin:** intentional decision in spec §5.6 ("tucked into a ⋯ menu during active gameplay" / "Host display: hidden on game screens entirely"). That decision is being reversed by this report.

### A2. Remove the emoji from the streak counter
**Observed:** streak chip reads `🔥 3× streak` / `🔥 3 in a row correct`.
**Expected:** drop the 🔥 emoji entirely. Plain text only.
**Likely files:** wherever the `Chip` with `streak` variant is rendered (GamePromptHeader, Quiz/TF feedback components, motion `streakChipPop` users).

### A3. Big-number highlight on host screens should be off
**Observed:** large numeric displays on the host (round counters, target numbers, etc.) are highlighted in a strong colour.
**Expected:** big numbers render flat (just `text-ink`), no `bg-now`/`bg-streak` accent.
**Likely files:** `packages/host/src/ui/HostScreenShell.tsx` (time-left panel), `packages/host/src/components/numbers/HostTarget.tsx`, anywhere a chunky `bg-now` wraps a numeric display on host.

### A4. Round-leaderboard between every round is redundant
**Observed:** between every Quiz question and every T/F statement, a small in-round leaderboard pops up showing current placements. The big inter-game leaderboard already does this.
**Expected:** remove (or significantly shorten) the per-round leaderboard pop. Keep only the inter-game leaderboard. Reduces total round time.
**Likely files:** `packages/server/src/gameEngine.js` `showRoundLeaderboard()`, `packages/client/src/components/RoundLeaderboardOverlay.tsx`, `packages/host/src/screens/Display.tsx` `roundLeaderboard` branch.

### A5. Host display gets stuck on "Loading…" when navigating Dashboard ↔ Display mid-game
**Observed:** if the host clicks Dashboard during an active game and then returns to Display, the Display shows "Loading…" indefinitely. Must reset or fully reload to recover.
**Expected:** Display should re-render whatever game state currently exists on return — no stale "Loading…" state. Treat as a re-mount; pull current `gameState.currentGame` + phase from the store and route directly.
**Likely files:** `packages/host/src/screens/Display.tsx` (route-on-mount logic), state initialization in each `*Display.tsx`.

---

## B. Quiz

### B1. Last quiz question briefly re-appears before final leaderboard
**Observed:** at the end of the last quiz round, just before the final leaderboard, the last question pops up again for a couple of seconds.
**Expected:** smooth transition from last question's results → final leaderboard. No re-show of the question.
**Likely files:** `packages/client/src/screens/Quiz.tsx` (phase transition), `packages/server/src/games/quiz.js` (end-of-game timing).

### B2. Reduce inter-round placement/score dwell time between Quiz questions
**Observed:** the score/placement reveal between Quiz questions takes too long.
**Expected:** shorten the inter-round leaderboard duration (currently 5s? — see `showRoundLeaderboard(game, 5000, ...)`). Suggested target: 2.5–3s, OR removed entirely per A4.
**Likely files:** `packages/server/src/gameEngine.js` `showRoundLeaderboard` default duration.

---

## C. True / False

### C1. Reduce inter-round dwell time (same as B2 for TF)
**Observed:** same as B2 — the score/placement reveal between T/F statements is too long.
**Expected:** 2.5–3s, or removed per A4.
**Likely files:** same as B2.

---

## D. Pointless

### D1. Host display: player-status indicator missing (who's ready / locked in)
**Observed:** during the Pointless round, the host display shows nothing about which players have already submitted vs are still typing.
**Expected:** per-player tracker chips (using the `PlayerTracker` primitive) showing "Locked in" / "Still thinking" / "No submission" for each player.
**Likely files:** `packages/host/src/screens/Display.tsx` Pointless branch, with `PlayerTracker` populated from a server `pointless:progress` event.

### D2. Host display doesn't refresh — must toggle Dashboard ↔ Display to update
**Observed:** after a Pointless round ends, the host display freezes on the prior state. The submission count doesn't update; the next question doesn't appear after reveal. Only manually navigating Dashboard → Display → back forces a refresh.
**Expected:** the host display subscribes to all Pointless events and re-renders live — no manual refresh needed.
**Likely files:** `packages/host/src/screens/Display.tsx` Pointless branch — event subscriptions are likely missing or scoped wrong.

### D3. Drop the manual "reveal" step — auto-reveal after 30s submission window
**Observed:** after 30s, the round ends but bots/players have to wait for the host to click "reveal" to see the answer. The host trigger feels like an unnecessary extra step now.
**Expected:** after the 30s timer expires, the reveal animation auto-starts. No host action needed. (We can keep the host action as an OPTIONAL "reveal early" shortcut if needed, but the default should be automatic.)
**Likely files:** `packages/server/src/games/pointless.js` `endRound()` should call `revealResults()` directly instead of waiting for a host trigger; remove the `'reveal'` case in `host:control` handler in `packages/server/src/index.js` or repurpose it as "force early reveal".
**Knock-on:** simplifies the stress test (Pointless reveal trigger from auto-host becomes unnecessary).

### D4. ScoreDrop animation doesn't drop — it appears instantly
**Observed:** the Pointless score bar appears already at its final position. No drop animation visible.
**Expected:** the bar drops from 100 down to the player's score over ~13s (per spec §3.9: 4000ms base + 90ms per point dropped), ease-out cubic.
**Likely files:** `packages/client/src/ui/ScoreDrop.tsx`, `packages/host/src/ui/ScoreDrop.tsx`. Either the `dropPct` state isn't transitioning over time, or the `useEffect` RAF loop isn't firing, or CSS `height: ${dropPct}%` is being clobbered.

### D5. Top-3 most obscure / most frequent answers not displayed after the round
**Observed:** at the end of each Pointless round, the answers and top-3 "most pointless" / "most popular" results aren't shown.
**Expected:** after the reveal, show the answer + the obscure-3 + frequent-3 lists from the server's `pointless:reveal:display` payload (already emitted). Render in a `Card` below the per-player drop bars.
**Likely files:** `packages/host/src/screens/Display.tsx` Pointless reveal branch.

---

## E. Themed-DLE — Pokédle & HPdle **[BOTH]**

### E1. Classic mode: no animation on red/green attribute squares
**Observed:** after a guess, the 6 attribute cells just appear with their colour — no animation.
**Expected:** flip cascade (rotateX 0→90→0 over ~250ms each, staggered 180ms) per spec §4.4. Same as Wordle.
**Likely files:** `packages/client/src/components/themed-dle/ClassicMatrix.tsx`.

### E2. Classic mode: headers very squished
**Observed:** the 6 attribute column headers (Type, Gen, Height, etc.) are too narrow.
**Expected:** roomier headers — wrap to 2 lines if needed, increase per-column width.
**Likely files:** `ClassicMatrix.tsx` (grid template) — see E3 below for the layout change that resolves this.

### E3. Classic mode: change to 2×3 attribute layout (instead of 1×6)
**Observed:** 6 attributes shown as a single horizontal row of 6 cells → cramped.
**Expected:** 2 rows × 3 columns, more breathing room per attribute.
**Likely files:** `ClassicMatrix.tsx` (the grid CSS), and any host equivalent.

### E4. Guess limit should be 10, with 7-10 scoring 0
**Observed:** locked at 6 guesses; after the 6th wrong, the player can't keep playing.
**Expected:** 10 guesses total. Guess 1 = max points. Guesses 2-6 = scaled down. Guesses 7-10 = 0 points (still allowed, just no scoring).
**Likely files:** `packages/server/src/games/themedDle.js` `MAX_GUESSES` constant (currently 6) → 10, plus scoring function uses `min(guess_number, 6)` to cap the points-bearing window.

### E5. Silhouette mode: gradual zoom-out, not full image reveal at once
**Observed:** silhouette shows the entire silhouette from the start.
**Expected:** start ZOOMED IN to a small portion of the silhouette. After each wrong guess, zoom OUT by a step, revealing more of the silhouette. So early guessers see a tiny fragment; later guessers see most of it.
**Likely files:** `packages/client/src/components/themed-dle/Silhouette.tsx` — track a "zoom level" per attempt, apply `transform: scale(N)` to the silhouette image; server might also need to gate the zoom-out events.

### E6. Grid 3×3: character name dropdown gets cut off at the modal box edge
**Observed:** when typing a character name, the autocomplete dropdown extends below the visible modal box and gets clipped.
**Expected:** dropdown overflows the modal — either by allowing overflow visible, by repositioning above the input when near the bottom, or by making the modal scroll the dropdown into view.
**Likely files:** `packages/client/src/components/themed-dle/Grid3x3.tsx` + the autocomplete component — change `overflow: hidden` to `overflow: visible` on the modal body, or use a portal for the dropdown.

### E7. Grid 3×3: auto-advance round when everyone has 9 green placements
**Observed:** the round continues until the timer expires, even if all players have already placed all 9 correctly.
**Expected:** as soon as every connected player has 9 green cells filled, advance to the results phase immediately.
**Likely files:** `packages/server/src/games/themedDle.js` Grid-mode round logic — add an "all-solved" check after each successful placement to short-circuit the timer.

### E8. Host display during themed-dle: show players big; currently "Loading…" mid-game
**Observed:** during themed-dle play, the host display becomes "Loading…" partway through. Players (who's solved / how many guesses each) is the only useful info during play, but they're not displayed.
**Expected:** host display always shows the `PlayerTracker` prominently (large, full-width or majority of screen). The "Loading" should never appear once the round is past intro.
**Likely files:** `packages/host/src/screens/ThemedDleDisplay.tsx` — review the phase machine; mid-game state transitions are dropping back to a loading guard.

### E9. Both Pokédle and HPdle classic: 2×3 layout, applies as E3 to both themes

---

## F. Numbers (the "math-dle")

### F1. Created result tile disappears and can't be reused
**Observed:** when a player combines two tiles via an operation, the result number appears briefly then disappears. The player cannot use the new tile in subsequent operations. This makes most rounds **unsolvable**, since the canonical Numbers game requires chaining operations on results.
**Expected:** combining tiles a + b consumes a and b, ADDS a new tile with the result value to the pool. The new tile is usable as a normal pool tile for further operations. Original 6 tiles + N result tiles (cumulative as long as ops are valid).
**Likely files:**
- Server: `packages/server/src/games/numbers.js` `handleOperation()` — verify that the new tile is added to `ps.pool` and broadcast in the next `numbers:operation:ack` and `numbers:progress` payload.
- Client: `packages/client/src/components/numbers/TilePool.tsx` — confirm that new tiles from `numbers:operation:ack` are added to the visible pool state, not just shown transiently.
- Possible bug: client treats result as ephemeral / animation-only.

**Severity:** game-blocking. Must fix before any user-facing playtest.

---

## G. Wordle

### G1. No tile-flip animation on guess submission
**Observed:** the 5 tiles in a row just appear with their colour after submission — no flip cascade.
**Expected:** 90° rotateX flip per tile, staggered 180ms between tiles, color resolves at flip midpoint. Per spec §4.4 (canonical Wordle reveal).
**Likely files:** `packages/client/src/components/wordle/WordleBoard.tsx` — the `Tile` primitive supports a `flipping` + `flipDelaySec` prop; need to pass them on the resolving row (and clear after the animation duration).

---

## H. Travel

### H1. Map is missing from the player's Travel screen
**Observed:** the player sees only the chain and autocomplete input, no map.
**Expected:** the player sees the same map the host sees (or a simplified version), with their guess pins drawn as they submit. Per current spec design, the map appears at results — but the player must at least be able to see the map while they're solving.
**Likely files:** `packages/client/src/screens/Travel.tsx` — currently hides `<TravelMap />` during the playing phase. Decision needed: show map during play, or only at results. **If we keep map hidden during play (so chains don't crib), then we need a clear visual placeholder that's NOT just blank.** Per this report, the user wants the map visible.

### H2. Travel logic uses sea hops — should be LAND borders only
**Observed:** "France → Brazil" is accepted as a valid neighbour, but France and Brazil don't share a land border.
**Expected:** chain hops must be LAND neighbours only. Sea-only hops (e.g., France → USA, Spain → Algeria via Gibraltar, etc.) should be rejected.
**Likely files:**
- Server data: `packages/server/src/data/travel/` country adjacency graph — likely includes maritime adjacencies; must scrub to land-only.
- Possibly add a `landNeighbour` boolean flag to each edge and filter in the path-validation logic.
- `packages/server/src/games/travel.js` validation — apply the land-only filter.
- Reference: real "Travle" game uses land borders only (https://imois.in/games/travle/).

**Test cases that should now FAIL:**
- France → Brazil
- Spain → Morocco (Gibraltar strait)
- USA → Russia (Bering strait)
- Italy → Tunisia (Mediterranean)

**Test cases that should still PASS:**
- France → Spain → Portugal
- Spain → Andorra → France
- Italy → Switzerland → Austria

---

## Summary by severity

**Blockers** (game-breaking, must fix before playtest):
- F1 — Numbers result tiles disappear, rounds unsolvable
- D2 — Pointless host display doesn't refresh
- A5 — Host Display stuck on "Loading…" after Dashboard nav
- H2 — Travel accepts sea hops

**High** (clear visible bug, low fix risk):
- B1 — Last quiz question re-appears before final leaderboard
- D4 — Pointless drop animation doesn't run
- D5 — Top-3 / answers not shown after Pointless round
- E6 — Grid 3×3 dropdown clipped
- E8 — Host themed-dle "Loading" mid-game
- G1 — Wordle no flip animation
- E1 — Themed-DLE classic no flip animation

**Medium** (UX improvement, design alignment):
- A1 — Theme toggle always visible
- A2 — Remove streak emoji
- A3 — Don't highlight big numbers on host
- A4 — Cut redundant per-round leaderboard
- B2 / C1 — Reduce inter-round dwell
- D1 — Pointless host player status missing
- D3 — Auto-reveal Pointless (no host trigger)
- E2 / E3 / E9 — Classic mode 2×3 layout + roomier headers
- E4 — 10-guess limit
- E5 — Silhouette gradual zoom-out
- E7 — Grid 3×3 auto-advance on all-solved
- H1 — Travel map visible during play

---

## Suggested implementation order

1. **F1** (Numbers blocker) — single-PR fix, no design decisions.
2. **A5 + D2 + E8** ("Loading" state regressions) — likely a common root cause around Display.tsx phase handling; fix in one pass.
3. **D4 + G1 + E1** (missing animations) — verify the framer-motion variants are actually wired up, not just defined.
4. **H2 + H1** (Travel correctness + map) — needs data scrub + visual.
5. **D3 + D5 + D1** (Pointless flow) — simplify reveal sequencing.
6. **A1 + A2 + A3 + A4 + B1 + B2 + C1** (cross-cutting UX polish) — small commits each.
7. **E4 + E5 + E6 + E7 + E2/E3/E9** (themed-DLE depth) — larger touch surface, last.

Each item should land as its own commit / PR for easy review.
