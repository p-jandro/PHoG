# Themed-dle Implementation Guide

Complete handoff document for building the client (player phone) and host (big display) UIs for **Pokédle** and **HP-dle**. Server side is **fully implemented and tested** — only UI work remains.

---

## 1. Overview

**Two games**, each plays **all 4 modes sequentially** in a single session:

| Game | Mode 1 | Mode 2 | Mode 3 | Mode 4 |
|---|---|---|---|---|
| **Pokédle** | Classic | Emoji | Silhouette | 3×3 Grid |
| **HP-dle** | Classic | Emoji | Spell | 3×3 Grid |

Score accumulates across the 4 modes within a single game. End of game → one placement in the championship standings. Final friend-night winner = lowest sum of placements (Eurovision-style aggregation), already wired into the existing PHoG scoring engine.

**Order in a session:** Pokédle first (all 4 modes), then HP-dle (all 4 modes).

---

## 2. Server status — DONE

| File | Status | Notes |
|---|---|---|
| `packages/server/src/games/themedDle.js` | ✅ Complete | 600+ lines, all 4 modes |
| `packages/server/src/gameEngine.js` | ✅ Modified | `pokedle` + `hpdle` in validGames; reset() updated |
| `packages/server/src/utils/scoring.js` | ✅ Modified | Placements struct includes new games |
| `packages/server/src/index.js` | ✅ Modified | Player init + game wiring + socket handlers |
| `packages/server/src/data/pokedle/pokemon.json` | ✅ 151 entries | `gymLeader` field added |
| `packages/server/src/data/pokedle/emoji-puzzles.json` | ✅ 151 entries | Hardest emoji at index 0 |
| `packages/server/src/data/hpdle/characters.json` | ✅ 135 entries | Full HP roster |
| `packages/server/src/data/hpdle/emoji-puzzles.json` | ✅ 64 entries | Hardest emoji at index 0 |
| `packages/server/src/data/hpdle/spells.json` | ✅ 42 entries | Effect + first use + caster |

Smoke-tested: both themes instantiate, all modes set up cleanly, grid validation produces correct cell counts.

---

## 3. Data file schemas

### `pokemon.json`

```ts
{
  id: number,                      // 1-151
  name: string,                    // "Pikachu"
  aliases?: string[],
  types: string[],                 // ["Electric"] or ["Grass", "Poison"]
  color: string,                   // "Yellow"
  habitat: string | null,          // "Forest", "Cave", "Mountain", "Sea", etc.
  evolutionStage: string,          // "Base" | "Mid" | "Final" | "Single-stage"
  heightBucket: string,            // "Tiny" | "Small" | "Medium" | "Large" | "Huge"
  // ... plus many more attributes (see file)
  spriteUrl: string,               // PokeAPI artwork URL
  cryUrl: string,                  // PokeAPI cry URL
  iconicStatus: "tier1"|"tier2"|"tier3",
  gymLeader: string | null         // "Brock", "Misty", ... or null
}
```

### `characters.json` (HP)

```ts
{
  name: string,                    // "Harry Potter"
  aliases?: string[],
  gender: "M" | "F" | "Other",
  school: "Hogwarts" | "Beauxbatons" | "Durmstrang" | "None" | null,
  house: "Gryffindor" | "Slytherin" | "Ravenclaw" | "Hufflepuff" | null,
  bloodStatus: string | null,      // "Pure-blood", "Half-blood", "Muggle-born", etc.
  species: string[],               // ["Human"] or ["Human", "Animagus"]
  hairColor: string | null,
  affiliations: string[],          // ["Order of the Phoenix", "Hogwarts"]
  roles: string[],                 // ["Student", "Teacher", "Auror", "Death Eater"]
  deathEaterStatus: "yes"|"former"|"leader"|"sympathizer"|"no",
  iconicStatus: "tier1"|"tier2"|"tier3",
  // ... plus wand, patronus, boggart (often null), etc.
}
```

### `emoji-puzzles.json` (both packs)

```ts
{
  id?: number,                     // Pokédle only
  name: string,                    // matches an entry in the roster
  emojis: string[]                 // exactly 5, ordered hardest → easiest
}
```

**Index 0 is the most ambiguous emoji** (multi-candidate). Index 4 is the unique signature. The game reveals index 0 at start, +1 per wrong guess.

### `spells.json` (HP only)

```ts
{
  incantation: string,             // "Expecto Patronum"
  effect: string,                  // displayed to player
  category: "Charm" | "Curse" | "Hex" | ...,
  firstAppearance: { book: number, scene: string },
  notableCaster: string,           // character name
  iconicTier: "tier1"|"tier2"|"tier3",
  firstLetter: string,             // "E"
  lastLetter: string               // "M"
}
```

---

## 4. Socket protocol

### Game lifecycle (existing PHoG events — re-used)

- `phase:change` — `{ phase, previousPhase }` — `lobby` | `playing` | `leaderboard` | `finished`
- `game:start` — `{ game: 'pokedle' | 'hpdle' }`
- `game:end` — `{ game }`
- `players:update` — array of player objects
- `score:update` — `{ playerId, oldScore, newScore, points }`

### Themed-dle events

All events use `${gameName}:event` where `gameName` is `pokedle` or `hpdle`. Both games emit the same event names, just under different prefixes.

#### Server → client/host

**`{gameName}:intro`** — emitted at the start of each mode (4× per game). Brief mode-announcement screen.
```ts
{
  theme: 'pokemon' | 'hp',
  mode: 'classic' | 'emoji' | 'silhouette' | 'spell' | 'grid',
  difficulty: 'difficult',
  duration: 8000,
  endsAt: number,
  title: string,                   // e.g. "Pokédex Match"
  description: string,
  maxGuesses?: number,
  attributes?: string[]            // Classic only — column labels
}
```

**`{gameName}:playing:start`** — round begins for a mode.
```ts
{
  mode: string,
  duration: number,                // 150000-240000 depending on mode
  endsAt: number,
  maxGuesses: number | null,       // null for grid mode

  // Classic mode payload:
  roster?: { name: string, aliases?: string[] }[],

  // Emoji mode payload:
  emojis?: string[],               // initially 1 emoji
  revealedCount?: number,
  roster?: ...,

  // Silhouette mode payload:
  spriteUrl?: string,
  revealStage?: number,            // 0 (most cropped)
  roster?: ...,

  // Spell mode payload:
  effect?: string,
  category?: string,
  incantationLength?: number,
  spellList?: string[],

  // Grid mode payload:
  rows?: string[],                 // 3 row constraint labels
  cols?: string[],                 // 3 col constraint labels
  roster?: ...
}
```

**`{gameName}:guess:result`** — response to a player's guess (private to that player). Shape varies by mode:

Classic:
```ts
{
  guess: string,                   // canonical name
  correct: boolean,
  feedback: [
    { key: string, label: string, value: any, color: 'green'|'yellow'|'red' }
  ],
  guessesUsed: number,
  guessesRemaining: number,
  solved: boolean
}
```

Emoji:
```ts
{
  guess: string,
  correct: boolean,
  feedback: 'correct' | 'wrong',
  guessesUsed: number,
  guessesRemaining: number,
  solved: boolean,
  emojisRevealed: string[]         // grows by 1 per wrong guess, max 5
}
```

Silhouette:
```ts
{
  guess: string,
  correct: boolean,
  feedback: 'correct' | 'wrong',
  guessesUsed: number,
  guessesRemaining: number,
  solved: boolean,
  silhouetteStage: number          // 1..6, used by client to compute zoom + brightness
}
```

Spell:
```ts
{
  guess: string,
  correct: boolean,
  guessesUsed: number,
  guessesRemaining: number,
  solved: boolean,
  hint: { type: 'whenUsed'|'caster'|'letters', text: string } | null
}
```

Grid (different event — `{gameName}:grid:cell:result`):
```ts
{
  row: number,
  col: number,
  name: string,
  valid: boolean,                  // fits both row AND col constraint
  cellAnswers: Record<"r,c", string>   // full grid state for this player
}
```

**`{gameName}:guess:invalid`** — guess didn't match any roster entry (or duplicate for grid)
```ts
{ name: string, reason?: 'duplicate'|'unknown' }
```

**`{gameName}:progress`** — broadcast to all (host display especially)
```ts
{
  playerProgress: Record<playerId, {
    guessCount?: number,           // non-grid modes
    solved?: boolean,
    filledCells?: number           // grid mode
  }>
}
```

**`{gameName}:mode:results`** — end of a mode round (before next mode begins)
```ts
{
  mode: string,
  modeIndex: number,               // 0..3
  totalModes: 4,
  target: {                        // reveals the answer
    // Classic/Emoji/Silhouette: { name, attributes/emojis/spriteUrl }
    // Spell: { incantation, effect, notableCaster }
    // Grid: { rows, cols, cellAnswers (all valid answers per cell) }
  },
  results: Array<{
    playerId: string,
    playerName: string,
    modeScore: number,
    cumulativeScore: number,
    // mode-specific player summary:
    guesses?: Array<{ name, feedback, at, correct }>,
    solved?: boolean,
    filledCells?: number,
    cellAnswers?: Record<"r,c", string>
  }>,
  cumulativeScores: Record<playerId, number>,
  isLastMode: boolean,             // true when modeIndex === 3
  duration: number,
  endsAt: number
}
```

After the last mode's `:mode:results`, the engine emits standard `game:end` → `leaderboard:show` → game over.

#### Client → server

**`themedDle:guess`** — single event for all modes
```ts
// Classic / Emoji / Silhouette / Spell:
{ name: string }

// Grid:
{ row: number, col: number, name: string }
```

The server routes by `gameState.currentGame` (`pokedle` or `hpdle`) and `gameState[currentGame].mode`.

**`host:themedDle:configure`** — currently a no-op (we removed mode/difficulty config since play order is fixed). Kept for forward compatibility.

---

## 5. Game flow

```
Lobby
  ↓ (host clicks "Start Pokédle")
game:start { game: 'pokedle' }
  ↓
pokedle:intro             (mode 1 = Classic)
  ↓ 8s
pokedle:playing:start     (mode 1)
  ↓ ≤180s (or all solved/exhausted)
pokedle:mode:results      (mode 1)
  ↓ 8s
pokedle:intro             (mode 2 = Emoji)
  ↓ 8s
pokedle:playing:start     (mode 2)
  ↓ ≤150s
pokedle:mode:results      (mode 2)
  ↓ 8s
pokedle:intro             (mode 3 = Silhouette)
  ↓ 8s
pokedle:playing:start     (mode 3)
  ↓ ≤150s
pokedle:mode:results      (mode 3)
  ↓ 8s
pokedle:intro             (mode 4 = Grid)
  ↓ 8s
pokedle:playing:start     (mode 4)
  ↓ ≤240s
pokedle:mode:results      (mode 4, isLastMode: true)
  ↓ 8s
game:end → leaderboard:show
  ↓ host clicks "Start HP-dle"
[Same flow with theme: 'hp', mode 3 = 'spell']
```

Total per game: ~13 minutes (8 modes × ~90s avg + intros + result screens).

---

## 6. Mode-by-mode UI specs

### Mode 1: Classic Attribute Matrix

**Player input:** Autocomplete name picker. Top 5 suggestions as user types. Submit on tap.

**Player view:**
- 6 attribute column headers (e.g. "Type 1 | Type 2 | Color | Habitat | Evolution Stage | Height")
- Up to 6 rows below, one per submitted guess
- Each row: cell per attribute, showing the *guessed* Pokémon's value for that attribute, background-colored:
  - **Green** = exact match with target
  - **Yellow** = partial match (multi-value attribute intersection)
  - **Red** = no match
- Multi-value cells show the values inline (e.g. "Human, Animagus")
- Once solved, lock the matrix and show "🎉 Solved in N guesses"

**Host view:**
- Big display: "Classic Mode — guess the [Pokémon | character]"
- Side panel: each player's name with guess count and solved-status (✓ or ⏳)
- Don't show players' actual guesses (preserves competition)

**Schema for `feedback` array** (sent in `:guess:result`):
```ts
[
  { key: 'type1', label: 'Type 1', value: 'Electric', color: 'green' },
  { key: 'type2', label: 'Type 2', value: null,       color: 'green' },
  { key: 'color', label: 'Color',  value: 'Yellow',   color: 'red' },
  ...
]
```

---

### Mode 2: Emoji

**Player input:** Autocomplete same as Classic.

**Player view:**
- Big emoji display at top — **starts with 1 emoji** (the hardest from the curated set)
- After each wrong guess, one more emoji slides in (from index 1, 2, 3, 4 — easier each step)
- Max 5 emojis shown
- Up to 6 guesses total
- List of past guesses below the emoji display, with red ✗ next to wrong ones

**Host view:**
- Same emoji display (mirror what players see — same emoji count)
- Side panel: player progress (guess count, solved status)

**Server behavior:** wrong guess increments `emojiRevealCount` from 1 up to 5. The client gets the full `emojisRevealed` array in the `:guess:result` event.

---

### Mode 3a: Silhouette (Pokédle only)

**Player input:** Autocomplete.

**Player view:**
- Big canvas showing a cropped, silhouetted Pokémon
- The image is the official artwork from PokeAPI (`p.spriteUrl`)
- Apply CSS `filter: brightness(0)` for pure-black silhouette, transparent background
- Reveal progression — tied to wrong guesses, NOT a timer:
  - Stage 0 (initial): ~5% random crop, full black
  - Stage 1: ~25% crop, still black
  - Stage 2: ~50% crop, slight color bleed (`filter: brightness(0.1)`)
  - Stage 3: ~75% crop, more color (`filter: brightness(0.3)`)
  - Stage 4: full silhouette visible, partial color (`filter: brightness(0.6)`)
  - Stage 5: full image revealed (final attempt)

**Client implementation hint:**
```tsx
<canvas ref={canvasRef} />
useEffect(() => {
  const img = new Image();
  img.src = spriteUrl;
  img.onload = () => {
    const stage = silhouetteStage;
    const zoom = [0.05, 0.25, 0.5, 0.75, 1.0, 1.0][stage];
    const brightness = [0, 0, 0.1, 0.3, 0.6, 1.0][stage];
    // Draw cropped + filtered image to canvas
    // OR use CSS filter on a regular <img> with object-position for crop
  };
}, [silhouetteStage, spriteUrl]);
```

**Host view:** Same silhouette display, mirrored. Progress side panel.

---

### Mode 3b: Spell (HP-dle only)

**Player input:** Free-text incantation typing (incantations are normalized server-side — letters only, case-insensitive). Autocomplete is provided via `spellList` in the start event.

**Player view:**
- Big text card: the spell's effect description
- Below: input field for incantation
- Hint area: starts empty; on wrong guess, a new hint slot fills in:
  - Wrong 1: "First used in Book {N}: {scene}"
  - Wrong 2: "Notable caster: {character}"
  - Wrong 3: "Letters: {firstLetter} … {lastLetter}"
- 5 guesses max
- Past guesses shown as a list

**Server hint format** (in `:guess:result`):
```ts
hint: { type: 'whenUsed'|'caster'|'letters', text: string } | null
```

**Host view:** Effect prominently displayed. Mirror the revealed hints. Progress panel.

---

### Mode 4: 3×3 Grid (Immaculate Grid)

**Player input:** Tap a cell → opens an autocomplete modal → pick name → modal closes, cell shows the picked name.

**Player view:**
- 3×3 grid of cells, with row constraint labels on the left and col constraint labels on top
- Each cell shows either:
  - Empty placeholder (tappable)
  - A name with green border (valid: fits both constraints)
  - A name with red border (invalid: didn't fit constraints — chosen but locked as a wasted attempt). Optional UX: allow re-tap to change cell.
- **No-reuse rule:** each name can only be used in one cell across the player's whole grid. Trying to reuse → toast "already used."
- Round runs to a fixed 4-minute timer; no early end.

**Scoring (server-side):**
- Wrong/empty cell: 0
- Correct cell: `100 / N` where N = number of players who also said this name for this cell. Rarer answers score more.
- Total = sum across 9 cells.

**Host view:**
- Center: the 3×3 grid (row+col labels visible, cells empty during play)
- Big timer
- Side panel: per-player "filled cells" count (e.g. "Alice: 7/9")
- On `:mode:results`: reveal all valid answers per cell, then each player's actual answers, ranked by score

**Locked friend-night grids** (hardcoded in `themedDle.js`):

Pokédle:
| | Used by a Gym Leader | Final evolution | Owned by an anime regular |
|---|---|---|---|
| **Fire-type** | | | |
| **Color: Pink** | | | |
| **Cave habitat** | | | |

HP-dle:
| | Order of the Phoenix | Hogwarts staff | Death Eater |
|---|---|---|---|
| **Gryffindor** | | | |
| **Slytherin** | | | |
| **Female** | | | |

---

## 7. Client UI implementation guide

### Files to create

```
packages/client/src/
├── screens/
│   └── ThemedDle.tsx                  // outer shell, mode switching
├── components/
│   ├── themed-dle/
│   │   ├── ModeIntro.tsx              // 8-sec intro between modes
│   │   ├── ClassicMatrix.tsx          // mode 1
│   │   ├── EmojiClue.tsx              // mode 2
│   │   ├── Silhouette.tsx             // mode 3a
│   │   ├── SpellHint.tsx              // mode 3b
│   │   ├── Grid3x3.tsx                // mode 4
│   │   ├── AutocompletePicker.tsx     // shared widget (top-5 matches)
│   │   ├── CumulativeScoreBar.tsx     // header showing total + mode progress
│   │   └── ModeResults.tsx            // 8-sec results screen between modes
```

### Routing — modify `App.tsx`

```tsx
import { ThemedDle } from './screens/ThemedDle';

// in renderScreen() under case 'playing':
case 'pokedle':
case 'hpdle':
  return <ThemedDle socket={socket} />;
```

### `ThemedDle.tsx` skeleton

```tsx
import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import { ModeIntro } from '../components/themed-dle/ModeIntro';
import { ClassicMatrix } from '../components/themed-dle/ClassicMatrix';
import { EmojiClue } from '../components/themed-dle/EmojiClue';
import { Silhouette } from '../components/themed-dle/Silhouette';
import { SpellHint } from '../components/themed-dle/SpellHint';
import { Grid3x3 } from '../components/themed-dle/Grid3x3';
import { ModeResults } from '../components/themed-dle/ModeResults';
import { CumulativeScoreBar } from '../components/themed-dle/CumulativeScoreBar';

type Phase = 'intro' | 'playing' | 'results';
type Mode = 'classic' | 'emoji' | 'silhouette' | 'spell' | 'grid';

export const ThemedDle = ({ socket }: { socket: Socket | null }) => {
  const { currentGame } = useGameStore();                  // 'pokedle' or 'hpdle'
  const gamePrefix = currentGame;                          // event prefix

  const [phase, setPhase] = useState<Phase>('intro');
  const [mode, setMode] = useState<Mode>('classic');
  const [modeIndex, setModeIndex] = useState(0);
  const [introData, setIntroData] = useState<any>(null);
  const [playData, setPlayData] = useState<any>(null);
  const [resultsData, setResultsData] = useState<any>(null);
  const [myGuesses, setMyGuesses] = useState<any[]>([]);
  const [myCumulative, setMyCumulative] = useState(0);

  useEffect(() => {
    if (!socket || !gamePrefix) return;

    socket.on(`${gamePrefix}:intro`, (d) => {
      setPhase('intro');
      setIntroData(d);
      setMode(d.mode);
      setMyGuesses([]);
    });

    socket.on(`${gamePrefix}:playing:start`, (d) => {
      setPhase('playing');
      setPlayData(d);
      setMode(d.mode);
    });

    socket.on(`${gamePrefix}:guess:result`, (d) => {
      setMyGuesses((g) => [...g, d]);
    });

    socket.on(`${gamePrefix}:mode:results`, (d) => {
      setPhase('results');
      setResultsData(d);
      setModeIndex(d.modeIndex + 1);  // next mode coming
      const me = d.results.find((r: any) => r.playerId === playerId);
      if (me) setMyCumulative(me.cumulativeScore);
    });

    return () => {
      socket.off(`${gamePrefix}:intro`);
      socket.off(`${gamePrefix}:playing:start`);
      socket.off(`${gamePrefix}:guess:result`);
      socket.off(`${gamePrefix}:mode:results`);
    };
  }, [socket, gamePrefix]);

  if (phase === 'intro') return <ModeIntro data={introData} />;
  if (phase === 'results') return <ModeResults data={resultsData} />;
  // playing phase: route to mode subcomponent
  const submitGuess = (payload: any) => socket?.emit('themedDle:guess', payload);
  return (
    <>
      <CumulativeScoreBar mode={mode} modeIndex={modeIndex} totalModes={4} cumulative={myCumulative} />
      {mode === 'classic' && <ClassicMatrix data={playData} guesses={myGuesses} onGuess={submitGuess} />}
      {mode === 'emoji' && <EmojiClue data={playData} guesses={myGuesses} onGuess={submitGuess} />}
      {mode === 'silhouette' && <Silhouette data={playData} guesses={myGuesses} onGuess={submitGuess} />}
      {mode === 'spell' && <SpellHint data={playData} guesses={myGuesses} onGuess={submitGuess} />}
      {mode === 'grid' && <Grid3x3 data={playData} guesses={myGuesses} onGuess={submitGuess} />}
    </>
  );
};
```

### `AutocompletePicker.tsx` — shared component

```tsx
interface AutocompletePickerProps {
  roster: { name: string, aliases?: string[] }[];
  onSubmit: (name: string) => void;
  placeholder?: string;
  disabled?: boolean;
}
```

Behavior:
- Input field with placeholder
- As user types, filter `roster` to top 5 matches (substring on name + aliases, case-insensitive)
- Show as dropdown below input
- Tap a suggestion → fill input → enable submit
- Submit → call `onSubmit(name)` → clear input
- Mobile-friendly: large tap targets, dropdown scrollable

### Mode subcomponent props (shared interface)

```tsx
interface ModeProps {
  data: any;                       // the :playing:start payload
  guesses: any[];                  // accumulated :guess:result events
  onGuess: (payload: any) => void;
}
```

Each mode component owns its own internal state derived from `guesses` (latest emoji set, silhouette stage, hints unlocked, etc.).

---

## 8. Host display implementation guide

### Files to create

```
packages/host/src/
├── screens/
│   └── ThemedDleDisplay.tsx           // host's themed-dle view
├── components/
│   ├── themed-dle/
│   │   ├── HostClassicView.tsx
│   │   ├── HostEmojiView.tsx
│   │   ├── HostSilhouetteView.tsx
│   │   ├── HostSpellView.tsx
│   │   ├── HostGridView.tsx
│   │   ├── PlayerProgressPanel.tsx    // sidebar listing all players' progress
│   │   ├── ModeIntroSplash.tsx
│   │   └── ModeResultsReveal.tsx
```

### Routing — modify `packages/host/src/screens/Display.tsx`

Add the same `case 'pokedle' | 'hpdle'` branch in the host's screen-routing logic. (Display.tsx is large — search for the existing `quiz` / `countdown` / `pointless` branches and follow that pattern.)

### Host shell behavior

- Subscribes to all the same `${gamePrefix}:*` events as the client
- Renders the puzzle big and centered (everyone in the room looks at this screen)
- Per-player progress in a sidebar, updated via `${gamePrefix}:progress` events
- On `:mode:results`, animate the reveal sequence:
  1. Show the target ("It was Pikachu!")
  2. Sort players by mode score, show top 3 with emphasis
  3. Show cumulative leaderboard
  4. Tease the next mode ("Up next: Emoji…")

### Host display content per mode

| Mode | Host display content |
|---|---|
| Classic | "Guess the Pokémon" + attribute header row + per-player guess counts |
| Emoji | Big emoji display (mirrors what players see — same emoji count) |
| Silhouette | The cropped silhouette (mirrors player view) |
| Spell | The spell's effect description, with revealed hints (mirrored as they unlock) |
| Grid | The 3×3 grid with constraint labels; empty cells during play; revealed answers in results phase |

---

## 9. Host dashboard integration

Add two buttons to `packages/host/src/screens/Dashboard.tsx` for starting each game:

```tsx
<button onClick={() => socket.emit('host:start_game', { game: 'pokedle' })}>
  Start Pokédle
</button>
<button onClick={() => socket.emit('host:start_game', { game: 'hpdle' })}>
  Start HP-dle
</button>
```

(Check the existing Dashboard.tsx for the actual socket-event name used by Quiz/Countdown/etc. — it's likely `host:start_game` based on the engine pattern. If different, follow the existing pattern.)

For a "championship" flow that auto-plays Pokédle then HP-dle, use the existing championship system:

```ts
socket.emit('host:start_championship', { sequence: ['pokedle', 'hpdle'] });
```

The engine handles auto-advance via the `requestGameStart` event.

---

## 10. Patterns to copy from existing PHoG code

| What you need | Where to look |
|---|---|
| Phase-routed screen | [Quiz.tsx](packages/client/src/screens/Quiz.tsx) — useState phase, useEffect socket.on |
| Score / placement display | [Quiz.tsx](packages/client/src/screens/Quiz.tsx) — uses useGameStore, players list |
| Standard game header | `<GamePromptHeader />` in [components/](packages/client/src/components/) |
| Round-leaderboard overlay | `<RoundLeaderboardOverlay />` — already integrated, fires on `round:leaderboard:show` |
| Paused state | `<PausedOverlay />` — already integrated |
| Host display routing | [Display.tsx](packages/host/src/screens/Display.tsx) — long file, look for game switch |
| Host dashboard buttons | [Dashboard.tsx](packages/host/src/screens/Dashboard.tsx) — existing start-game buttons |
| Game state store | [gameStore.ts](packages/client/src/stores/gameStore.ts) — Zustand store |
| Socket hook | [useSocket.ts](packages/client/src/hooks/useSocket.ts) |

---

## 11. Test plan

### Local dev

```bash
# Terminal 1 — server
cd packages/server && npm start

# Terminal 2 — client
cd packages/client && npm run dev

# Terminal 3 — host
cd packages/host && npm run dev
```

### Smoke test sequence

1. Open host display in one browser tab; client app in another (or on phone via local IP)
2. Join 2-3 players from different browsers/phones
3. Host clicks "Start Pokédle"
4. Verify mode 1 (Classic): intro shows → playing phase → submit a guess → see colored feedback row → solve or run out → mode results → mode 2 starts automatically
5. Repeat through all 4 modes — verify mode transitions, cumulative score updates, host progress panel updates
6. After mode 4 (Grid) results, verify `game:end` fires and leaderboard shows
7. Host clicks "Start HP-dle" → same flow with spell mode replacing silhouette

### Edge cases to verify

- Player joins mid-game (should see current mode, not be retroactively scored)
- Player disconnects mid-mode (should be marked solved/0 on round end if not done)
- Player submits same name twice in Grid → reject with toast
- Player submits non-existent name → reject (no guess consumed)
- All players solve → mode ends early, doesn't wait for timer
- Last-mode results → game:end fires correctly, placement assigned

### Manual server-side debug

```bash
# Direct socket test (no UI needed)
node -e "
const io = require('socket.io-client');
const s = io('http://localhost:3000');
s.on('connect', () => {
  s.emit('player:join', { name: 'TestPlayer' });
});
s.on('pokedle:intro', d => console.log('INTRO', d));
s.on('pokedle:playing:start', d => console.log('START', d));
s.on('pokedle:guess:result', d => console.log('RESULT', d));
// ... submit a guess
setTimeout(() => s.emit('themedDle:guess', { name: 'Pikachu' }), 12000);
"
```

---

## 12. Open items / future work (not blocking v1)

- **Difficulty filtering** (user said skip for v1) — easy to add later via answer-pool subsetting on `iconicStatus` tier
- **Inherent-easy puzzle exclusion** (Snorlax, Voldemort, etc.) — same approach, filter the emoji-puzzle pool
- **Pokémon silhouette local cache** — currently fetches from PokeAPI CDN per round; fine for ~10 players but could pre-download
- **3×3 grid generator** — currently uses hardcoded friend-night grids; v2 should generate fresh grids per session
- **HP `roles` field hygiene** — split into `jobs` vs `affiliations` for cleaner Grid mode filtering (currently has Luna mis-tagged as Teacher)
- **Audio cues** — Pokémon cry sounds + spell incantation chimes would be nice polish

---

## 13. File reference

**Server (DONE):**
- [`packages/server/src/games/themedDle.js`](packages/server/src/games/themedDle.js) — main game module
- [`packages/server/src/gameEngine.js`](packages/server/src/gameEngine.js) — engine (modified)
- [`packages/server/src/utils/scoring.js`](packages/server/src/utils/scoring.js) — placements (modified)
- [`packages/server/src/index.js`](packages/server/src/index.js) — wiring + socket handlers (modified)
- [`packages/server/src/data/pokedle/`](packages/server/src/data/pokedle/) — data
- [`packages/server/src/data/hpdle/`](packages/server/src/data/hpdle/) — data

**Client (TODO):**
- `packages/client/src/screens/ThemedDle.tsx`
- `packages/client/src/components/themed-dle/*`
- Modify `packages/client/src/App.tsx`

**Host (TODO):**
- `packages/host/src/screens/ThemedDleDisplay.tsx`
- `packages/host/src/components/themed-dle/*`
- Modify `packages/host/src/screens/Display.tsx`
- Modify `packages/host/src/screens/Dashboard.tsx`

**Utility scripts:**
- [`scripts/validate-grids.mjs`](scripts/validate-grids.mjs) — grid validation tool
- [`scripts/add-gym-leader-field.mjs`](scripts/add-gym-leader-field.mjs) — one-shot data migration

---

## 14. Reference docs

- [`docs/new-games-research.md`](docs/new-games-research.md) — full design history and rationale for all design decisions
- [`docs/dle-mode-survey.md`](docs/dle-mode-survey.md) — survey of existing dle-family games (Pokédle.com, Loldle, etc.) that informed mode choices
