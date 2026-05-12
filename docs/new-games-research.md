# New Games — Design Research

Research document for four candidate mini-games to add to PHoG (host display + phone-controllers, Socket.io rooms, per-round scoring). Existing games for reference: Pointless, Quiz, True/False, Countdown (word/letters style — note name collision flagged in Game 2 below).

This document is research only. No code, no schema changes — just rules, data, and recommendations to feed into a later spec.

---

## Locked design decisions (post-research)

The sections below this one are the original research baseline. Where they conflict with anything in this summary, **this summary wins** — it captures decisions made during design review after the research was written.

### Session-level

- **Target headcount:** 10+ contestants in the same room.
- **Game cadence per session:** Wordle, Travel, Themed-dle each play **once**. Numbers Round plays **multiple times** as the cumulative/filler game.
- **Final-winner scoring: placement aggregation.** Each game produces its own leaderboard at the end. A player's placement (1st, 2nd, 3rd…) in each game is their score for that game. Sum placements across all games — **lowest total wins** (Eurovision / golf style).
- **Within-game leaderboard ties:** standard competition ranking (1, 1, 3, 4 — next rank skips after a tie). Final aggregate-score ties: break by count of better placements head-to-head.
- **Numbers across-rounds aggregation:** Numbers' internal rounds sum to one cumulative score → one final leaderboard → **one placement** (same weight as a one-shot game).
- **Per-game point math doesn't matter cross-game.** Internal scoring only needs to produce a defensible ranking; absolute points are discarded once placements are assigned.

### Wordle

- **Data already loaded.** `packages/server/src/data/wordle/answers.json` (2,315 words) + `valid-guesses.json` (10,657 extras). Original pre-NYT Josh Wardle lists, cross-referenced across two GitHub mirrors. SOURCES.md committed.
- **Multiplayer shape:** simultaneous same-puzzle, shared timer, partial credit for non-solvers based on letters discovered.
- **Sensitive-word filtering** (if needed): apply at runtime, don't mutate the JSON.

### Numbers Round (formerly "Mathdle")

- **Name:** rename in-app to **"Numbers Round"** or **"Maths Round"** to avoid collision with the existing `packages/server/src/games/countdown.js`.
- **Generation approach:** random tile draw + random target, **run solver to verify exact-solvable**, reject and re-roll if not. Empirically ~5–10% rejection rate. Solver is brute-force recursion over expression trees, runs in low milliseconds.
- **The solver doubles as the optimal-answer reveal** at the end of each round.
- **Difficulty tiers** derived from solver metadata: easy (≤4 tiles, no division), medium (any exact-solvable), hard (requires all 6 tiles, target ≥850, or requires division).
- **Generate-fresh per round is fine** at party-game cadence; pre-cached pool only needed if profiling shows lag.

### Travel — full locked spec

- **Distance cap:** shortest path between start and end must be **≤ 10 hops**. Pairs with longer paths are excluded at lobby setup.
- **Pre-enumeration:** at server startup, BFS every country pair (~19k), cache `validPairs.json` with `{ start, end, shortestPathSubgraph, hopCount }`. Lobby draws from difficulty buckets.
- **Per-round budget:** `maxGuesses = optimalDistance + 2`. Examples: 4-hop pair → 6 guesses; 10-hop pair → 12 guesses.
- **Player input:** pure text autocomplete (substring/prefix match on country names). **No dropdown of valid neighbors** — players must know geography. Aliases supported (USA, UK, Czechia/Czech Republic, etc.).
- **Hint progression** on a 30s idle clock per stuck-segment:
  - +30s → highlight the optimal next country's *shape* on the map (name hidden).
  - +60s → reveal its first letter.
  - +90s → reveal its last letter.
- **Hint penalty:** each tier subtracts a flat amount from the round's available score (e.g. −20 / −40 / −60). Solving hint-free preserves max score.
- **Per-step optimality** for color assignment. The shortest-path subgraph is recomputed from the player's current chain endpoint after each move, not statically from the original start. This lets players "recover" from a detour with subsequent green moves.
- **Color taxonomy:**
  - 🟢 **Green:** the move is adjacent to current endpoint AND lies on a shortest path from current endpoint to destination.
  - 🟠 **Orange:** adjacent AND reachable to destination, but not on a shortest path.
  - 🔴 **Red:** adjacent but reaches a dead end (cannot reach destination from there at all). Rare in practice — mostly relevant near peninsulas/islands.
- **Non-adjacent submissions:** rejected outright with toast ("X doesn't border Y"). Chain does not advance. **No guess consumed.**
- **Map view:**
  - Cropped to the bounding box of the optimal-path subgraph + padding. View is **fixed** — does not auto-expand.
  - Countries outside the view that are submitted are evaluated normally (color assignment runs) but don't render on the map. Reinforces "stay in the corridor."
  - **Host display** = spectacle: large map, all players' chains overlaid in distinct colors at the end-of-round reveal.
  - **Player phone** = workbench: compact map of *that player's own* chain only, live-mirrored as they go, autocomplete input beneath.
- **Budget exhaustion without reaching destination:** round ends, score is computed from chain quality (greens/oranges/reds) plus a closeness-to-destination bonus.
- **Tech stack for the map:** `react-simple-maps` + `world-atlas` TopoJSON (~100 KB) + `d3-geo` projection. ISO 3166 codes are the join key across map data, adjacency graph, and player input.

### Themed-dle

- **MVP scope:** 30 characters × 6 categorical attributes. No ordinal arrows in v1.
- **Brand de-risk:** ship with **two packs** at launch — HP plus a neutral pack (Pokemon recommended). Content depletion concern dissolves since each game plays once per session.
- **Privacy:** each player's board is private until end-of-round reveal (prevents information cascade across phones).

### Themed-dle final mode slates — locked specs

**Play order within one game (locked, no host pick): Classic → Emoji → Silhouette/Spell → 3×3 Grid.**

Each themed-dle game session plays **all 4 modes sequentially**. Score accumulates across the 4 modes; final cumulative score determines placement. The game session produces **one placement** in the championship leaderboard.

A full friend-night runs:
1. Pokédle game (Classic → Emoji → Silhouette → Grid) → Pokédle placement
2. HP-dle game (Classic → Emoji → Spell → Grid) → HP-dle placement
3. Final standings = sum of both placements (Eurovision-style aggregation)

All four modes share the same character/Pokémon database.

#### Mode 1: Classic Attribute Matrix — **Difficulty: Difficult**

**Mechanic** (both packs, Loldle-style):
- Player guesses a name from the full roster (151 Pokémon / ~135 HP characters).
- Each guess returns a row of colored cells, one per attribute.
- Green = exact match. Yellow = non-empty intersection for multi-value attributes. Red = no overlap.
- Numeric attributes have ↑/↓ arrows for off-target.

**Attributes shown (6 per pack):**
- Pokédle: Type 1, Type 2, Color, Habitat, Evolution stage, Height bucket
- HP-dle: Gender, House, Blood status, Species, Affiliations, Hair color

**Difficulty tuning for "fairly difficult":**
- Answer pool = full roster, including deep cuts (tier 2 + tier 3, not just iconic tier 1)
- 6 guesses max
- 6 attribute columns (not 8+ — fewer columns = harder triangulation)
- No "isStarter" / "iconicStatus" gimme columns

**Reveal mechanic:** self-balancing — every guess reveals info via the colored cells. No timer-driven reveals.

#### Mode 2: Emoji Puzzle — **Difficulty: Medium**

**Mechanic** (both packs):
- Player sees **1 emoji** at start — the **hardest / most cryptic** one.
- Wrong guess reveals 1 more emoji (the next-easiest), up to **5 total**.
- Each puzzle's emoji sequence is **ordered hardest → easiest** in the JSON: `emojis[0]` is the most cryptic, `emojis[4]` the most obvious.
- Solving on emoji 1 is the max efficiency bonus.

**Curation requirement:** ~30 hand-curated puzzles per pack, each with 5 ordered emojis. Sequence design rule: the first 2 emojis should be evocative but ambiguous; emojis 3–5 increasingly give away the answer.

Example sequences:
- *Pikachu*: ⚡ 🐭 → + 💛 → + 🎈 → + 🏆 (anime hero)
- *Voldemort*: 💀 🐍 → + 🪄 → + 🌑 → + ⚡ (Harry's scar)

**Difficulty tuning for "medium":** average puzzle solvable at 3–4 emojis revealed by someone familiar with the franchise. Mix the curated set: ~10 easy (solvable at 2–3), ~15 medium (4), ~5 hard (need all 5).

**Reveal mechanic:** **self-balancing via wrong guesses** (confirmed). Not timer-driven.

#### Mode 3a: Silhouette with guess-driven zoom-out (Pokédle only) — **Difficulty: Difficult**

**Mechanic:**
- Start: random ~5% crop of the Pokémon's official artwork, rendered as pure-black silhouette (CSS `filter: brightness(0)` on transparent-background PNG).
- Each wrong guess: **zoom out by ~20%** AND **brighten by ~10%** toward color reveal.
- Stage progression across 6 guesses:
  1. ~5% crop, full black silhouette
  2. ~25% crop, full black silhouette
  3. ~50% crop, slight color bleed
  4. ~75% crop, more color
  5. Full silhouette visible, partial color
  6. Full image revealed (final attempt fail = no more reveals, player auto-loses)

**Difficulty tuning for "difficult":** brightness reveal lags zoom reveal — even at 75% visible the player is still working with mostly-silhouette. Forces shape-recognition over color-recognition.

**Assets:** 151 Pokémon official artwork PNGs from PokeAPI, ~10 MB auto-fetched at server boot. Reveal computed client-side via canvas (single image fetch per round, no asset duplication).

#### Mode 3b: Spell — effect → incantation (HP-dle only) — **Difficulty: Mediocre**

**Mechanic:**
- Player sees the spell's **effect description** (e.g. "Causes the target to dance uncontrollably").
- Player types their guess at the incantation.
- Each wrong guess unlocks a progressive hint:
  1. **Wrong 1** → reveal **when the spell was used** (book + scene, e.g. "Book 2: Duelling Club at Hogwarts")
  2. **Wrong 2** → reveal **who used it** (e.g. "Draco Malfoy")
  3. **Wrong 3** → reveal **first letter and last letter** of the incantation (e.g. `T_____________A`)
  4. **Wrong 4** → no more hints; one final attempt
- 5 attempts max.

**Difficulty tuning for "mediocre":** the three hints (when/who/first+last letter) progressively narrow even casual fans toward the answer. The casing matters: famous spells (Avada Kedavra, Expecto Patronum) might be solved at hint 1; obscure spells (Confringo, Aguamenti) need all three hints.

**Curation requirement:** ~20 spells, each with: effect description, incantation, first canonical use (book + scene), notable caster. The HP characters database doesn't have spell metadata; needs a new file `packages/server/src/data/hpdle/spells.json`.

#### Mode 4: 3×3 Grid — **Difficulty: Locked / Given**

See dedicated section below. Already designed and validated.

#### Content curation cost summary

| Mode | Pokédle cost | HP-dle cost |
|---|---|---|
| Classic | Done | Done (135 chars in DB) |
| Emoji | ~3–4 hours (30 puzzles) | ~3–4 hours (30 puzzles) |
| Silhouette | Auto-fetch script (~30 min code) | n/a |
| Spell | n/a | ~2 hours (20 spells) |
| 3×3 Grid | Done | Done |

**Total v1 content work: ~8–10 hours** (split: 6–8h emoji + 2h spell + 0.5h silhouette script + 1h data field additions for `gymLeader` and HP roles split).


### Friend-night Immaculate Grid (3×3 trivia bingo mode)

The themed-dle pack will run an Immaculate-Grid-style mode: 3×3 grid, each cell requires a character/Pokémon satisfying the row AND column constraint. No-reuse rule per player (each name can only be used in one cell). Scoring: `100 / N` per cell where N = number of players who gave the same answer.

**Locked grids for the first friend-night session** (validated against the live data via [scripts/validate-grids.mjs](scripts/validate-grids.mjs)):

**HP grid:**

|  | **Order of the Phoenix** | **Hogwarts staff** | **Death Eater** |
|---|---|---|---|
| **Gryffindor** | 20 answers | 5 (Dumbledore, Lupin, Hagrid, McGonagall, Neville) | **1 — Peter Pettigrew** |
| **Slytherin** | **1 — Severus Snape** | 3 (Snape, Umbridge, Slughorn) | 9 (Voldemort, Draco, Bellatrix, Lucius…) |
| **Female** | 11 (Hermione, McGonagall, Ginny, Molly, Tonks, Lily…) | 6 strict (McGonagall, Umbridge, Sprout, Trelawney, Sinistra, Hooch) | 2 (Bellatrix, Nagini) |

*Adjudication note: Luna Lovegood and Olympe Maxime are over-tagged as Hogwarts staff in the JSON (Luna's DA tutoring + Maxime being Beauxbatons headmistress). Strict canon count for Female × Staff is 6.*

**Pokémon grid:**

|  | **Used by a Gym Leader** | **Final evolution** | **Owned by an anime regular** |
|---|---|---|---|
| **Fire-type** | 4 (Growlithe, Arcanine, Ponyta, Rapidash — Blaine) | 5 (Charizard, Ninetales, Arcanine, Rapidash, Flareon) | 4 (Charmander, Charmeleon, Charizard — Ash; Vulpix — Brock) |
| **Color: Pink** | **1 — Mr. Mime (Sabrina)** | 3 (Clefable, Wigglytuff, Slowbro) | **1 — Lickitung (Jessie)** |
| **Cave habitat** | 2 (Onix, Dugtrio — Brock, Giovanni) | 3 (Golbat, Dugtrio, Gengar) | 2 (Zubat, Onix — Brock) |

*"Anime regular" = Ash, Misty, Brock, Team Rocket (Jessie/James/Meowth) Gen 1 rosters.*

Both grids hit a 1–5 answer range per cell, two intentional 1-answer "rare" cells, and three different conceptual axes per grid (HP: house/role-types; Pokémon: type/color/habitat × lore/stage/lore).

**Data observations from the run:**
- HP `roles` field conflates jobs (Teacher), affiliations (Order member), and intrinsic traits (Ghost/Goblin) — should be split before powering a real generator.
- Pokémon `gymLeader` is currently a hardcoded list in the validator; needs to move into [pokemon.json](packages/server/src/data/pokedle/pokemon.json) as a per-Pokémon field for the generator to use.
- The validator script's pattern (`evalGrid(name, items, rows, cols)`) is reusable for the eventual grid-pool generator.

### Cross-cutting

- **Build order:** Numbers Round → Wordle → Travel → Themed-dle. (Numbers has zero static content; Wordle has its data done; Travel needs adjacency curation + map plumbing; Themed-dle needs content packs.)
- **Shared infrastructure to extract early:**
  - Generic `submitGuess → feedbackRow` socket envelope. All four games are structurally a guess-and-color-feedback loop.
  - Autocomplete input component (Travel and Themed-dle both need one).
  - JSON content-pack pattern under `packages/server/src/data/<game>/`, loaded at boot.

---

## Game 1: Wordle

### Origin / inspiration
The standard NYT Wordle (originally by Josh Wardle, acquired by The New York Times in 2022). Guess a 5-letter word in up to 6 attempts; each guess is colored per-letter to give feedback. [source: https://en.wikipedia.org/wiki/Wordle]

### Core rules
- A hidden answer word of length 5 is chosen from a curated answer list.
- Players have up to 6 guesses.
- Each guess must be a real word from a separate, larger "allowed guesses" dictionary (the NYT version uses ~10,657 valid guesses against a smaller pool of ~2,300 answers). [source: https://mitsloan.mit.edu/ideas-made-to-matter/how-algorithm-solves-wordle]
- Win: guess the word. Lose: 6 wrong guesses (reveal answer).

### Player input shape
A 5-letter A–Z string, case-insensitive. UI is typically an on-screen keyboard with letter state (green/yellow/grey) accumulated across guesses. Submit is enabled only when 5 letters are entered and the word is in the allowed-guess dictionary; otherwise show "not in word list".

### Validation logic — the exact two-pass coloring algorithm
The tricky part is duplicate letters. The canonical algorithm is **two passes**:

1. **Pass 1 (Greens):** for each position `i`, if `guess[i] == answer[i]`, mark green and decrement the remaining count of that letter in a multiset built from the answer.
2. **Pass 2 (Yellows), left-to-right:** for each non-green position `i`, if `guess[i]` still has a remaining count > 0 in that multiset, mark yellow and decrement. Otherwise mark grey.

This guarantees: the number of green+yellow tiles for a given letter never exceeds its frequency in the answer; "extra" duplicates beyond that count go grey. [source: https://wordlesolverx.org/past-wordle-words/does-wordle-repeat-letters/]

**Worked example — guess `ALLOY` vs answer `GLASS`** (the prompt's example):
- Answer letter counts: G=1, L=1, A=1, S=2.
- Pass 1 greens: position-by-position, A vs G (no), L vs L (yes — green, L count → 0), L vs A (no), O vs S (no), Y vs S (no). One green: the 2nd L.
- Pass 2 yellows L→R on the remaining positions:
  - `A` at pos 0: A has count 1 remaining → yellow (A → 0).
  - `L` at pos 2: L count is already 0 (used by the green) → grey.
  - `O` at pos 3: not in remaining counts → grey.
  - `Y` at pos 4: not in remaining counts → grey.
- Final colors: **Yellow, Green, Grey, Grey, Grey**. So the second L (correct position) is green; the first L is grey, *not* yellow, because GLASS only has one L and it's already accounted for.

A second canonical case — guess `LEVEL` vs answer `HOTEL`: the trailing E and L are green; the earlier E and L (positions 1 and 0) go grey because each letter occurs only once in HOTEL. [source: https://wordlesolverx.org/past-wordle-words/does-wordle-repeat-letters/]

A symmetric case where the guess has fewer copies than the answer: guess `CLEAN` vs answer `CHILL` → the L is yellow, but the player does **not** learn that the answer has two Ls from that single tile. [source: https://wordlesolverx.org/past-wordle-words/does-wordle-repeat-letters/]

### Feedback shown to player / host
- Standard 3-color tile grid: green (correct letter, correct position), yellow (in word, wrong position), grey (not in word given duplicate accounting above).
- On the host display: render every player's most recent guess row (anonymized or with avatars), plus a global "who has solved" indicator. Don't show the letters of other players' guesses if you want competition; do show only the color pattern (this is the standard convention in multiplayer Wordle variants).
- On the player phone: their own full board + virtual keyboard with cumulative letter states.

### Scoring suggestion
- Per-round score = `base_for_solving + speed_bonus + efficiency_bonus`.
- Suggested values: solving at all = 50; efficiency bonus = `(7 − guesses_used) × 20` (so a 1-guess solve is +120, a 6-guess solve is +20); speed bonus = scale 0–50 over the round timer (decays linearly). Round timer: 90–120s.
- Failing to solve = 0 points (or a tiny consolation 10 for participation).
- Tuneable; the important property is "fewer guesses dominates, ties broken by speed."

### Multiplayer adaptation
Three patterns to choose from:
1. **Simultaneous same-puzzle (recommended).** Every player gets the same hidden word and same round timer. They guess independently on their phones. Round ends when all players have either solved or used 6 guesses, OR the round timer expires (whichever first). Host display shows everyone's color-only grid in real time. This is closest to existing PHoG games (everyone answers, then scoring resolves), and it gives natural drama: "Player 3 solved on guess 2 — Player 1 still on row 4." [recommended]
2. **Race-to-solve.** First player to solve wins the round; everyone else can keep guessing for partial credit. Higher tension but punishes slow phones / slow typers and creates a sudden-death feel that may not fit a party-game vibe.
3. **Take-turns.** Players collaborate on one shared board, one guess each. Cute but reduces individual scoring fidelity. Better as an optional "team mode" later.

**Recommendation: simultaneous same-puzzle with shared timer.** It scales cleanly from 2 to 16 players and reuses the existing round-resolution shape.

### Data / content requirements
- An **answer list** of ~2,000–3,000 common 5-letter English words. The original Wordle answer list (pre-NYT) is publicly known and small enough to ship inline.
- An **allowed-guesses dictionary** of ~10,000–13,000 valid 5-letter words to validate submissions without forcing the answer pool. Without this you either accept any 5-letter string (cheaty) or reject too many legitimate guesses.
- Both should ship as JSON arrays bundled with the server package. No network calls.
- Optional: variant lists for 4-letter and 6-letter modes.

### Risks / open questions
- **Profanity filter** on the allowed-guesses dictionary — NYT scrubbed several words; we should do the same to avoid embarrassing host-display moments.
- **Word list disputes** — players will type valid Scrabble words that aren't in our list (e.g. obscure plurals). Tune the allowed-guesses list to be generous.
- **Variants worth flagging for later (not v1):** Dordle (2 words simultaneously, 7 guesses), Quordle (4 words, 9 guesses), Octordle (8 words, 13 guesses). These are interesting "advanced room" modes that share all infra with the base game. [source: https://medium.com/floodgates/the-complete-and-authoritative-list-of-wordle-spinoffs-fb00bfafc448]
- **Cheating risk** — a player could paste guesses from a solver. Probably not worth defending in a friends-only party game; just don't allow inhumanly fast submission rates.

---

## Game 2: Mathdle / Countdown Numbers Round

### Origin / inspiration
The numbers round from UK Channel 4's *Countdown* (on air since 1982). The user called this "Mathdle" but described the Countdown rules — we go with Countdown rules and propose **renaming to "Numbers" or "Numbers Round"** in-app, especially because the existing PHoG `countdown` game (a different format) already uses that name and we should avoid the collision. Suggestion: rename existing `countdown.js` game to its actual format (it's a letters/word round?) and call this one "Numbers Round" — or call this one **"Maths Round"** to keep the *Countdown*-show flavor. [source: https://en.wikipedia.org/wiki/Countdown_(game_show)]

### Core rules
- 6 tiles are drawn from a pool of 24: **4 "large" numbers** (25, 50, 75, 100 — one each) and **20 "small" numbers** (1 through 10, each appearing twice). Players choose how many large to include (0–4); the remainder are drawn from smalls. [source: https://en.wikipedia.org/wiki/Countdown_(game_show)]
- A random 3-digit target from **100 to 999** is generated.
- **30 seconds** to write an expression combining some or all of the 6 tiles using **+, −, ×, ÷** that reaches the target (or comes as close as possible). [source: https://wiki.apterous.org/Numbers_game]
- Constraints on intermediate results:
  - Each tile may be used **at most once** (a small number that appears twice on the board can be used twice).
  - Only the four basic operations.
  - **No fractions** — every division must be exact (no remainder).
  - **No negative numbers** at any intermediate step.
  - You do not have to use all 6 tiles.
- Closest solution wins the round.

### Player input shape
Options, in order of implementation cost:
1. **Free-form expression** typed on the phone, e.g. `(75 + 25) * 7 - 4 = 696`. Easiest server-side: parse with a safe expression evaluator, validate that every literal in the AST is a tile (consuming each tile at most as many times as it appears), and check the no-negatives / no-fractions constraints by evaluating the tree depth-first. Friendly UI on mobile is the challenge.
2. **Step-by-step builder** ("pick a tile, pick an op, pick a tile, store result"). Mimics how contestants actually play on the show. Better UX on phones, more state to manage server-side.

Recommend **option 1 with a numeric keypad + operator buttons + parentheses**; option 2 is a later polish.

Players also submit their **claimed result** (the final value). If the expression evaluates to something else, mark invalid.

### Validation logic
A submission is valid iff all of:
1. Expression parses (only literals, `+`, `-`, `*`, `/`, parentheses).
2. Every literal is one of the 6 drawn tiles, and the multiset of literals used is a subset of the multiset of tiles drawn.
3. Evaluating the expression left-to-right via the AST: every intermediate node value is a **non-negative integer** (no negatives, no fractions). This is the load-bearing rule — `(3 − 5)` is illegal even if the final result is positive.
4. Final value equals the player's claimed result.

The closest valid result to the target scores. Ties: split points or award all tied players (party-game friendly).

### Feedback shown to player / host
- During the round: host shows the 6 tiles big, target big, countdown timer (literal *Countdown* clock callback). Player phone shows the same plus their expression builder.
- After the round: host reveals each player's expression and how close they got. If any player hit it exactly, celebrate. Optional "perfect game" achievement.
- Optionally show the *optimal* solution after reveal (computed server-side by exhaustive search — the search space is small enough). [source: http://datagenetics.com/blog/august32014/index.html]

### Scoring suggestion
Stick with the canonical *Countdown* scoring, scaled up for party-game punch:
- **Exact** target hit: **10 points** (canonical) — bump to **50** in PHoG-scale.
- **Within 5** (1–5 away): **7 points** → 30.
- **Within 10** (6–10 away): **5 points** → 15.
- **More than 10 away, invalid, or no answer**: **0**.
- [source for canonical 10/7/5: https://en.wikipedia.org/wiki/Countdown_(game_show)]

Important difference from the TV show: on *Countdown* only the closest contestant scores. In PHoG we should **score every player by tier** — otherwise rounds where one math whiz dominates feel terrible for everyone else. Add a small bonus for being the closest (e.g. +10) so the speed/precision incentive is preserved.

### Multiplayer adaptation
Simultaneous-same-puzzle, same as Wordle. Everyone sees the same 6 tiles and target, everyone has 30 seconds. Naturally parallel — this game maps to the existing PHoG shape perfectly.

Variants for later: cooperative mode where players pool tiles, or a "draft" mode where each player picks one tile from the pool.

### Data / content requirements
Almost none. This is the easiest game from a data perspective:
- Tile pool generator (deterministic from a seed for replay/debug).
- Target generator (uniform 100–999).
- Server-side expression parser/evaluator with the constraints above.
- Optional: an exhaustive solver to compute the optimal answer for post-round reveal. A brute force search over all orderings of subsets of 6 numbers with all operator combinations is feasible (~hundreds of thousands of expressions, milliseconds). [source: https://cgjennings.ca/articles/countdown-numbers/]

No external word lists, no APIs, no licensed content. Pure logic.

### Risks / open questions
- **Mobile input UX.** Typing `(75+25)*7-4` on a phone is the make-or-break detail. Prototype this before committing.
- **Timer fairness.** 30s is brutal; consider 45s or 60s for casual mode.
- **Cheating** (using a solver in another tab) is trivial. Acceptable for friends; document it.
- **Name collision** with existing `countdown.js`. Decide naming early.

---

## Game 3: Travel / Country-Chain

### Origin / inspiration
Closest precedent is the browser game **Travle** (travle.earth), where you're given a start and end country and must type a sequence of countries forming a land-border path. Also resembles geography puzzles in *GeoGuessr*-adjacent communities.

### Core rules
- Host announces two countries (e.g. **Spain → Hungary**) that are connected by some land-border path.
- Players type a sequence of countries; each consecutive pair must share a land border, and the sequence must start adjacent to (or be) the start country and end adjacent to (or be) the end country. (Two conventions: either include or exclude the start/end in the typed list. **Recommend: typed list contains only the intermediate countries — fewer keystrokes, less ambiguity.**)
- Round ends when a valid chain is submitted or the timer expires.

### Player input shape
Free-text country name per step, with an autocomplete dropdown driven by the country list (essential — typing "Côte d'Ivoire" on a phone is hostile). Accept common synonyms ("UK" → "United Kingdom", "USA", "Czechia"/"Czech Republic"). One submission = one ordered list.

### Validation logic
Build a country **adjacency graph** at server boot:
- Nodes: ISO 3166-1 alpha-3 country codes.
- Edges: land borders (undirected).

A submitted chain `[c1, c2, …, cn]` is valid iff:
- `start` borders `c1` (or start == c1 if you allow that convention).
- For every `i`, `c_i` borders `c_{i+1}`.
- `cn` borders `end` (or cn == end).
- All countries in the chain exist in the dataset.
- No country appears twice (anti-cycle; optional but cleaner).

For "shortest path" comparisons, run **BFS** from start to end at round-start and cache the optimal length. Compare each submission's length to the optimum.

### Reference data
Three good options:
- **geodatasource/country-borders** (CSV, ISO codes, CC BY-SA 4.0, land borders only). Ready to import. [source: https://github.com/geodatasource/country-borders]
- **REST Countries API** — `borders` field on each country, but requires network or a one-time scrape.
- **Hand-rolled JSON** seeded from Wikipedia's "List of countries and territories by number of land borders." Most control, most maintenance.

**Recommendation: ship a hand-curated JSON** seeded from geodatasource and reviewed by a human, because edge cases (Russia ↔ North Korea via a tiny border, France ↔ Brazil via French Guiana, Spain ↔ Morocco via Ceuta/Melilla) need a deliberate yes/no decision. ~250 countries × ~3 borders avg = trivially small file.

### What counts as "bordering"
Decisions to make explicit, with our recommendations:
- **Land borders only** — yes. UK has no land border with mainland Europe (only with Ireland via Northern Ireland). Russia–USA via the Bering Strait is **not** a land border. [matches geodatasource convention]
- **Overseas territories of the same sovereign:** France's land border with Brazil and Suriname (via French Guiana) — **include**, it's pedagogically interesting and standard atlases list it.
- **Microstates** (Vatican City, San Marino, Monaco, Andorra, Liechtenstein, Lesotho): include as nodes, but flag them in difficulty tiers. Vatican City and San Marino are both fully enclaved in Italy — they're dead-end nodes (only adjacent to Italy). [source: https://en.wikipedia.org/wiki/European_microstates]
- **Disputed territories** (Kosovo, Palestine, Western Sahara, Taiwan, etc.): treat as a curation question — include Kosovo (widely recognized) but exclude Western Sahara from chains for simplicity. Document the choice; expect player complaints.
- **Islands** (UK, Iceland, Sri Lanka, Madagascar, Japan, etc.): unreachable in this game unless we add a "ferry" allowance. **v1: islands cannot be intermediate nodes.** They can still be start or end if the start/end pair is `island ↔ island` (degenerate) — recommend just not picking islands as endpoints in v1.

### Path requirements: shortest vs any valid
**Recommend: any valid path counts as a solve; shorter paths score more.** Requiring exact shortest is brutally hard at higher difficulty and creates "you typed a valid answer but lost" feel-bad moments.

### Feedback shown to player / host
- Phone shows the chain so far. After each step, immediate feedback: green check if the new country borders the previous one, red X with "X does not border Y" otherwise.
- Optional partial-completeness indicator: distance-to-end of current head node (BFS hop count remaining), shown as a small number. This is helpful and not too generous.
- After the round, host display animates each player's path on a world map (stretch goal — text-only is fine for v1).

### Scoring suggestion
- Base for any valid completion: **50 points**.
- Optimality bonus: `max(0, 30 − 10 × (your_length − optimal_length))`. So matching optimal: +30. One longer: +20. Two longer: +10. Three or more longer: 0.
- Speed bonus: linear decay over the round timer (~60–90s), max +20.
- Invalid or incomplete at timeout: 0 points (or 5 for any attempt that included at least one valid hop).

### Multiplayer adaptation
Simultaneous-same-pair. Same start/end for everyone, same timer, score on submission. Identical pattern to Wordle and Countdown-numbers. **Recommended.**

Alternative: "draft" mode where each player adds one country in turn to a shared chain. Cute but breaks the parallel-scoring model. Skip for v1.

### Difficulty tiers — country-pair examples
Curate a tier list, served at game-start. Three tiers feels right:
- **Easy** (optimal path length 1–2): Spain → Italy (via France, 2 hops), Germany → Czech Republic (1 hop, they border directly so just typing the empty list works — pick pairs that *don't* directly border for the easy tier), Sweden → Russia (via Finland, 1 hop intermediate), France → Austria (1–2 intermediate).
- **Medium** (optimal path length 3–4): Spain → Hungary (e.g. France → Switzerland → Austria, 3 hops), Portugal → Greece (4 hops), Norway → Italy (3 hops).
- **Hard** (optimal path length 5+): Portugal → Russia (5+ hops), South Africa → Egypt (5+ hops), Vietnam → Spain (8+ hops via Central Asia and Europe).

Exclude pairs with no land path entirely (e.g. anything involving the UK or Iceland or Japan as a non-endpoint).

### Risks / open questions
- **Disputed-border drama.** Players will absolutely complain about Kosovo, Israel/Palestine, Taiwan, China–India. Decide the curation policy once and ship the JSON; don't argue.
- **Autocomplete UX** is mandatory. Without it, "is Czechia the same as Czech Republic?" kills the game.
- **Geography knowledge gap.** Casual players may know zero African geography. Difficulty tiers and a "give up to see one hint" button mitigate this.
- **Naming conventions** — must decide on a canonical name per country and accept N aliases. Plan a few hours of curation work.
- **Open question:** allow water-adjacent crossings as a "ferry" rules variant? Probably no for v1.

---

## Game 4: Themed-dle (Harry Potter character guesser as v1)

### Origin / inspiration
The **Loldle/Pokedle/HPdle** family — daily character-guessing games where you submit a character name and the game reveals a row of attribute cells colored **green (exact match)** / **yellow/orange (partial match)** / **red (no match)**. Originated with Loldle for League of Legends. The Harry Potter variant (Harrypotterdle, Quizzdle's HP mode, etc.) is well established. [source: https://www.harrypotterdle.com/, https://loldle.org/]

### Core rules
- Server picks a secret character from a roster.
- Each round, players submit character-name guesses (one at a time, with delay between guesses, or simultaneously).
- After each guess, the player sees a row: one cell per attribute, colored by match type.
- Goal: identify the secret character. Standard variant gives unlimited guesses (Loldle) and scores on attempts used; bounded variants give 6–8 guesses.

### Player input shape
Character name selected from a typeahead/autocomplete dropdown pulled from the roster. **No free text** — too many spelling variations ("Voldemort" vs "Tom Riddle" vs "He-Who-Must-Not-Be-Named"). The autocomplete is non-negotiable.

### Validation logic — attribute comparison and partial matches

For each attribute, compare the guessed character's value(s) to the target's value(s):

- **Single-value categorical attribute** (e.g. Gender, House): exact match = green; else = red. No yellow possible.
- **Multi-value categorical attribute** (e.g. Species — a character can be "Human, Animagus"): green if value-sets are identical; yellow if non-empty intersection but not identical; red if disjoint. This is the standard Loldle convention. [source: https://wiki-en.loldle.net/wiki/LoLdle:Rules and similar]
- **Ordinal/numeric attribute** (e.g. Year of First Appearance, Age): green if equal; otherwise red with an **arrow** indicating whether the target's value is higher (↑) or lower (↓) than the guess. Optional "close" yellow within some delta (e.g. within 2 years).

**Suggested HP attributes for v1** (the user's prompt example):
1. **Gender** — single-value: Male / Female / Other.
2. **Species** — multi-value: Human, Half-giant, House-elf, Centaur, Goblin, Ghost, Werewolf, etc.
3. **Hogwarts House** — single-value: Gryffindor / Slytherin / Ravenclaw / Hufflepuff / Other-school / None.
4. **Blood status** — single-value: Pure-blood / Half-blood / Muggle-born / Squib / Magical-creature / Unknown.
5. **Hair color** — single-value with a small enum (Black, Brown, Red, Blonde, Grey, White, Bald, N/A).
6. **Eye color** — single-value, small enum.
7. **Wand wood** — single-value (canonical for major characters).
8. **Wand core** — single-value (Phoenix feather, Dragon heartstring, Unicorn hair, Veela hair, Thestral tail hair, etc.). Multi-value possible for the Elder Wand etc., so model as multi-value to be safe.
9. **Patronus** — single-value (where canonical).
10. **First appearance** (book number 1–7) — ordinal with ↑/↓ arrow.

Skip in v1 (research/curation cost too high relative to value): Boggart, signature spell, family ties, profession.

This list is a synthesis from the Loldle template applied to HP canon and what HP-dle clones surface — direct enumeration from harrypotterdle.com is blocked behind JS-rendered content but the attribute set is conventional across themed-dle clones. [source: Loldle attribute pattern confirmed at https://wiki-en.loldle.net/wiki/LoLdle:Rules and https://loldle.org/]

### Feedback shown to player / host
- Player phone: per-guess row with one tile per attribute; each tile shows the guessed character's value for that attribute, colored green/yellow/red. Numeric attributes also show ↑/↓.
- Host display: a leaderboard of "guesses used so far" per player, and on round-end the secret character is revealed with their full attribute row.
- Privacy across players: each player's own guesses are private until reveal (otherwise one fast player gives free info to the room). Show only attempt counts on the host until someone solves.

### Scoring suggestion
- Solve on first guess (lucky / clever): **120**.
- Solve on guess N (1-indexed): `max(20, 120 − (N−1) × 15)`. So 1 = 120, 2 = 105, 3 = 90, 4 = 75, 5 = 60, 6 = 45, 7 = 30, 8+ = 20.
- Speed tiebreaker bonus: +10 for first solver in the round.
- Fail to solve in the round timer or guess cap (recommend 8 guesses): 0 points.

### Multiplayer adaptation
**Simultaneous-same-character.** Every player tries to identify the same secret character. Round ends when all solve or the timer (~3 minutes) expires. Same scoring pattern as Wordle.

Race-to-solve is also workable here but feels less party-friendly because there's less per-guess drama for non-leaders. Take-turns is bad (gives free info to whoever guesses last). **Recommend simultaneous.**

### Data / content requirements
This is **the biggest content lift of the four games**, which is why the user flagged it.

For HP v1, need a curated table of ~30–60 named characters × ~10 attribute columns. That's 300–600 cells, each requiring canon-checking. Sources: Harry Potter Wiki (Fandom), Pottermore archives, the books themselves for edge cases.

**Minimum viable version (recommended):**
- **Roster: 30 well-known characters** (Harry, Ron, Hermione, Dumbledore, Snape, Voldemort, McGonagall, Hagrid, Sirius, Lupin, Draco, the Weasleys, Bellatrix, Luna, Neville, Ginny, Cho, Cedric, Fleur, Krum, Moody, Umbridge, Kingsley, Tonks, Filch, Trelawney, Slughorn, Lockhart, Quirrell, Dobby).
- **Attributes: just 6** to start — Gender, House, Blood status, Species, Hair color, First appearance (ordinal). Add wand wood/core, eye color, patronus in v2.
- **Themes: HP only at launch.** Schema designed to be theme-pluggable (a theme = JSON pack `{ name, attributes: [...], roster: [...] }`).

**Schema sketch (descriptive, not code):**
- `theme.attributes`: ordered list of `{ key, label, kind: "single" | "multi" | "ordinal", enum?: [...] }`.
- `theme.roster`: list of `{ name, aliases: [...], attributes: { key → value or [values] } }`.

### Risks / open questions — this game's scope concerns
The user explicitly flagged this as "might be too much of a lift." Concrete reasons:

1. **Curation cost.** Even 30 chars × 6 attrs = 180 cells to verify. Plan ~4–6 hours of focused canon work. Mitigate by starting with 6 attributes, not 10.
2. **Canon disputes.** Patronuses for minor characters aren't all canon; hair colors are sometimes ambiguous; Pottermore retconned several attributes. Document the source-of-truth ("we use the Fandom wiki as canon; if it's not there, we omit the attribute") and ship.
3. **JK Rowling brand sensitivity.** Some user bases may prefer a non-HP first theme. Easy mitigation: launch with **two themes** — HP and one neutral one (e.g. Pokemon Gen-1 starters + popular mons, or Premier League football clubs). The Pokemon roster is even more canonical and well-attributed than HP.
4. **Theme extension burden.** Each new theme = a new content pack with curated attribute tables. Without a content pipeline, this becomes a single-developer bottleneck. v2 idea: a JSON-importable pack format so the community can contribute.
5. **Popular themes to consider for later:** Pokemon (very large enthusiast audience), League of Legends (already exists upstream as Loldle), anime/Naruto/One Piece, NBA/Premier League footballers, Marvel characters, Studio Ghibli, *Star Wars*.
6. **Open question:** numeric attributes with arrows (↑/↓) require a different UI cell than categorical. Worth the cost in v1, or push to v2? Recommend pushing to v2 and using only categorical attributes at launch — simpler UI, simpler scoring, simpler validation.

### Recommended v1 cut
**One theme (HP), 30 characters, 6 attributes, all categorical (no arrows), unlimited guesses with 8-guess cap, simultaneous play.** This is buildable in roughly the same time as Wordle once the content table is done.

---

## Cross-cutting recommendations

### Which game to build first
**Countdown Numbers Round.** Reasons:
- Zero static content to curate — pure logic.
- Mobile UX is the only real risk and it's a tractable one.
- Maps cleanest onto the existing PHoG round shape (everyone gets the same puzzle, everyone submits, score by tier).
- Server-side validation is trivially testable (expression parser + constraint checker).

Build order recommendation: **Countdown Numbers → Wordle → Travel → Themed-dle**.
- Wordle needs only two JSON word lists, which exist publicly.
- Travel needs a curated borders JSON plus difficulty curation, but the dataset exists.
- Themed-dle needs the most original-content work (the attribute tables), so it benefits from infrastructure built for the first three.

### Shared infrastructure that all four games would benefit from
1. **Generic "guess → feedback row" socket event.** All four games are structurally `playerSubmits(guess) → serverComputes(feedbackRow) → broadcastsToPlayer(feedbackRow) + summaryToHost(progress)`. The feedback-row payload differs in shape (color array for Wordle, attribute-color map for themed-dle, numeric distance for Countdown, validity+length for Travel) but the *envelope* is identical. Worth abstracting at the server level.
2. **Same-puzzle simultaneous-play round shape.** All four use the "everyone gets the same input, runs their own timer, scoring at end" pattern. The existing PHoG engine probably has most of this; verify it generalizes.
3. **Autocomplete input component.** Travel and Themed-dle both need a phone-friendly typeahead from a fixed roster. One component, two consumers.
4. **A per-round scoring DSL** like `score(rank, attempts, timeLeft, optimalDelta)` so we don't reinvent scoring math per game. Each game just declares its tiers and the engine computes the points.
5. **Content packs as JSON.** Wordle answer/guess lists, country borders, theme rosters — all should ship as static JSON in `server/src/data/<game>/`, loaded once at boot, never network-fetched. Keeps the games offline-capable and testable.

### Biggest risk
**Themed-dle.** Not because the rules are complex (they aren't — the algorithm is shorter than Wordle's) but because every new theme is a hand-curated content pack and players will find every wrong cell. The risk is **maintenance burden over time**, not v1 build cost. Mitigations:
- Ship with one theme, design the pack format for easy contribution.
- Document the canon source-of-truth policy publicly.
- Make individual cells correctable without a redeploy (data is just JSON).

Second-biggest risk: **Travel**, because of disputed-border politics. Decide curation policy once, document it, do not relitigate.

Lowest risk: **Countdown Numbers** and **Wordle** — both have unambiguous, fully-specified rules and well-known content.

---

## Sources

- Wordle rules and double-letter algorithm: https://wordlesolverx.org/past-wordle-words/does-wordle-repeat-letters/, https://mitsloan.mit.edu/ideas-made-to-matter/how-algorithm-solves-wordle, https://en.wikipedia.org/wiki/Wordle
- Wordle variants (Dordle/Quordle/Octordle): https://medium.com/floodgates/the-complete-and-authoritative-list-of-wordle-spinoffs-fb00bfafc448
- Countdown numbers round: https://en.wikipedia.org/wiki/Countdown_(game_show), https://wiki.apterous.org/Numbers_game, https://cgjennings.ca/articles/countdown-numbers/, http://datagenetics.com/blog/august32014/index.html
- Country borders dataset: https://github.com/geodatasource/country-borders, https://github.com/P1sec/country_adjacency, https://restcountries.com/
- European microstates / Vatican / San Marino enclaves: https://en.wikipedia.org/wiki/European_microstates
- Themed-dle / Loldle attribute pattern: https://loldle.org/, https://www.harrypotterdle.com/, https://www.quizzdle.com/en/harrypotter
