# Dle Mode Survey

## 1. Intro

Survey of Pokémon-themed, Harry Potter-themed, and cross-franchise "dle" daily guessing games, with a focus on what modes exist and how casual-friendly each is. Goal: pick 2–3 additional modes per pack to build alongside the already-committed Loldle-style classic attribute matrix.

**Loaded (WebFetch returned usable content):**
- `pokedle.io` (light)
- `squirdle.fireblend.com`
- `harrypotterdle.com`
- `quizzdle.com/en/harrypotter`
- `harrypotterdle.com/spell`
- `framed.wtf`

**Partial / refused / blocked (filled in via WebSearch):**
- `loldle.net` (page body returned only "LoLdle" — modes recovered from third-party hint sites)
- `pokedle.com` (same — modes recovered from third-party hint sites and pokedle.com mode-specific URLs surfaced in search)
- `pokepolitan.com/pokemon-heardle` (ECONNREFUSED — Heardle mechanics inferred from established Heardle pattern, flagged below)
- `smashdle.net` (not loaded directly — modes from hint-site descriptions)
- `animedle.lat` (not loaded directly — modes from search snippets)

Nothing speculative is in the catalog tables; everything listed has at least one independent source. Inferences are called out.

---

## 2. Pokédle mode catalog

| Mode | Source(s) | Clue type | Feedback mechanic | Self-balancing or time-gated | Casual-accessible | Notes |
|---|---|---|---|---|---|---|
| Classic (attribute matrix) | pokedle.io, pokedle.com/classic, squirdle.fireblend.com | Attribute row per guess: Gen, Type 1, Type 2, Height, Weight, Color, Habitat, Evolution stage | Per-cell color (green/yellow/red) + up/down arrows for numeric (height, weight, gen) | Self-balancing | Yes | The workhorse we already have. Squirdle is the OG version (fewer attributes, more arrow-driven). |
| Silhouette (progressive zoom-out) | pokedle.com/silhouette, smashdle silhouette | Black silhouette of the Pokémon, started zoomed-in / cropped | Each wrong guess zooms out a bit, revealing more of the outline | Self-balancing (guesses drive zoom) | Yes | "Who's That Pokémon?" energy. Shape-recognition, not encyclopedic. Visually distinct from any grid. |
| Image zoom (cropped colored sprite) | pokedle.com/image-zoom | Heavily-cropped section of a colored Pokémon image | Wrong guess → crop expands, revealing more colored detail | Self-balancing | Yes | Same structure as Silhouette but with color, so easier. Risks being too easy if used alongside Silhouette. |
| Card / TCG art | pokedle.com (Card mode) | Cropped or stylized TCG card artwork | Static image; standard "name it" guess | Time-gated (image doesn't change with guesses on most variants) | Iconic-only | TCG art is artist-stylized; casuals may not recognize it. |
| Description / Flavor text | pokedle.com (Description mode), harrypotterdle Description analog | Pokédex flavor text with the name redacted | Static text reveal; sometimes second line drips in after a wrong guess | Mostly time-gated | Iconic-only / Yes (genre-dependent) | Reads like a riddle. Fun if line-by-line drip is added; otherwise binary. |
| Cry / Audio (Heardle-style) | pokemoncries.com, fent.github.io/pokecry, pokepolitan Pokémon Heardle | Short audio clip of the Pokémon's cry | Each wrong guess extends the clip (Heardle convention); some sites just loop full cry | Self-balancing (Heardle pattern) or time-gated (single-clip pattern) | Iconic-only (Pikachu/Charizard/Jigglypuff cries are recognizable; most are not) | Distinct sensory channel (audio). Heardle drip is necessary or it's brutal. |
| Wordle-style letter grid (name) | pokedle.io | Pokémon name as letter grid | Wordle colors (green/yellow/gray) per letter | Self-balancing | Yes (if name length is given) | Pure Wordle reskin. Adds little vs classic. |
| Squirdle "Stats Edition" | squirdle.fireblend.com | Same attribute grid, numeric stats (HP/Atk/Def/etc.) instead of physical attrs | Up/down arrows on each stat | Self-balancing | No (stat lookup territory) | Super-fan-only. Skip. |

---

## 3. HP-dle mode catalog

| Mode | Source(s) | Clue type | Feedback mechanic | Self-balancing or time-gated | Casual-accessible | Notes |
|---|---|---|---|---|---|---|
| Classic (attribute matrix) | harrypotterdle.com, quizzdle.com/en/harrypotter | Attributes per guess: House, Species, Gender, Blood status, Hair color, Eye color, Loyalty/Affiliation, First-book appearance | Per-cell color (green / orange / red) + up/down arrows for "first book" numeric | Self-balancing | Yes | Direct HP analog of Loldle classic. |
| Quote | harrypotterdle.com (Quote section), Loldle Quote-style implementation | A short text quote from a character | Standard "guess who said it" — usually static text, occasionally a second-line reveal after N misses | Mostly time-gated | Iconic-only | Casuals know Hagrid / Dumbledore / Snape lines; deep cuts (Slughorn etc.) miss. Borderline. |
| Spell (description-to-spell) | harrypotterdle.com/spell | Plain-English description of what a spell does (e.g., "unlocks doors") | 4 tries; descriptions can drip a hint after a miss | Mostly time-gated | Yes | Strong: descriptions are guessable from logic, not memorization. Different answer pool (spells, not characters) — refreshing. |
| Description (character) | harrypotterdle.com (Description), quizzdle | Free-text character description with name redacted | Static or drip-fed reveal | Time-gated | Iconic-only | Same flavor as Pokédex description. Riddle-y. |
| Image (progressive reveal) | quizzdle.com/en/harrypotter (Image Mode) | Movie still / portrait, starts heavily blurred or pixelated | Each wrong guess de-blurs / un-pixelates further | Self-balancing | Yes | The HP equivalent of Silhouette/Framed. Faces are very recognizable. |
| Bingo / Bingo Infinite | quizzdle.com/en/harrypotter | Bingo grid of attributes; you fill cells by guessing characters that match | Match-tracking, not color-coded feedback | Hybrid | Iconic-only | Format-bender — feels like party bingo more than wordle. Worth a deeper look but mechanics underdocumented. |
| Multiplayer (real-time classic) | quizzdle.com/en/harrypotter | Same as classic, but synchronous | Race | Self-balancing | Yes | Format, not a mode — confirms multiplayer is a thing in this space. |
| Wordle (name letters) | chardle.com/game/harrypotter, harrypotterwordle.com, myrtle, Wizarding Worldle, HogWords | Letter grid for a character name or wizarding word | Wordle colors | Self-balancing | Yes | Several sites, all the same mechanic. Adds little over classic. |

---

## 4. Inventive modes from other franchises worth stealing

| Mode | Source franchise | How it would adapt to Pokémon / HP | Casual-accessibility prediction |
|---|---|---|---|
| Emoji puzzle | Loldle, Smashdle, Animedle, Gamedle (Keywords) | A 3–5 emoji sequence that hints at the character/Pokémon (e.g., 🌱🦖 = Bulbasaur; ⚡🦉 = Hedwig / Harry). Wrong guess can reveal one more emoji. | Yes — pictographic riddles play to general literacy, not lore depth. Highly party-friendly (room can debate aloud). |
| Framed-style progressive frame reveal | Framed.wtf (movies) | HP: show one movie frame per guess, up to 6 frames, in order. Pokémon: one anime episode frame per guess. | Yes — frames carry context (who's in scene, where) so even casual fans converge. HP particularly strong (movies are the shared cultural artifact). |
| Splash art / extreme crop | Loldle Splash Art, Pokedle Image Zoom | HP: a heavy crop of a movie still / book cover art. Pokémon: a heavy crop of official artwork (Sugimori art). Crop widens each guess. | Yes — same primitive as Silhouette but in full color. |
| Ability / Move icon | Loldle Ability, Smashdle Final Smash | Pokémon: show the icon / animation thumbnail of a signature move and player guesses the Pokémon. HP: show a spell's visual effect (movie VFX still). | Iconic-only — works for signature moves (Thunderbolt → Pikachu) but obscures non-signature mons. |
| Audio Heardle (extending clip) | Pokémon Heardle, Loldle Quote audio fallback | Pokémon: the cry, starting 0.3s and extending. HP: a few seconds of a character's voice line, extending. | Pokémon: iconic-only. HP: yes (voices are very distinctive — Hagrid, Snape, Dumbledore, Bellatrix all instantly recognizable). |
| Anidle-style progressive clue drip | Anidle | Each wrong guess unlocks a new metadata bullet (region, evolution count, type hint, generation). | Yes — but structurally overlaps with classic attribute matrix; would feel same-y in our context. |
| Kirby/Final Smash specialty | Smashdle | Strict gimmick mode for the franchise's "signature" thing. HP equivalent: Patronus reveal — show a Patronus form, guess the wizard. Pokémon equivalent: Mega/Gigantamax form silhouette. | HP Patronus: yes, iconic and beautiful. Pokémon Mega: iconic-only. |

---

## 5. Top 3 recommendations per pack

### Pokémon pack — recommended additions (beyond classic attributes)

1. **Silhouette with zoom-out reveal** (pokedle.com/silhouette). Pure shape-recognition, visually striking on screen, every wrong guess gives the room more to work with. Big sensory contrast vs the attribute grid.
2. **Emoji puzzle** (synthesis of Loldle/Smashdle/Animedle emoji modes — same mechanic, retargeted to Pokémon). Crowd-friendly: people shout interpretations. Visually nothing like the grid. Each guess can drip one more emoji to stay self-balancing.
3. **Cry Heardle (extending clip)** (Pokémon Heardle pattern: pokepolitan/pokemoncries.com). Adds an audio channel so the night doesn't feel single-sense. Heardle's clip-extension drip is required or it becomes super-fan-only — with the drip, casuals get there on iconic mons.

### Harry Potter pack — recommended additions (beyond classic attributes)

1. **Spell-by-description** (harrypotterdle.com/spell). Different answer pool entirely (spells, not characters), which keeps the night from feeling like four character grids. Descriptions are logic-guessable so casuals can play.
2. **Progressive image reveal (blur or Framed-style frame drip)** (synthesis of quizzdle Image Mode + framed.wtf). Movie stills are HP's shared cultural artifact — faces and scenes are extremely casual-accessible. Visually distinct from the grid.
3. **Voice Heardle (extending clip of a character speaking)** (Pokémon Heardle pattern applied to HP movie audio — not seen as a built dle in research, flagged as a synthesis). HP voices are unusually distinctive (Hagrid, Snape, Dumbledore, Bellatrix, McGonagall), so this is one of the rare audio modes that works for casuals.

Common thread across both packs: a **visual progressive-reveal** mode + an **audio** mode + a **lateral/different-answer-pool** mode (Emoji for Pokémon, Spell for HP) gives the party three sensory and structural breaks from the attribute grid.
