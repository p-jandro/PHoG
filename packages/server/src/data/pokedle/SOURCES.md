# Pokédle Data Sources

This directory contains a Generation 1 Pokémon database used by PHoG's
"Pokédle" content pack. The same JSON powers two game modes:

- A **Loldle-style classic mode** — guess the daily Pokémon by attribute
  matrix (type, color, habitat, height bucket, weight bucket, evolution
  stage, etc.), with green / yellow / red feedback per attribute.
- An **Immaculate Grid 3×3 mode** — categorical-intersection trivia
  (e.g. *Forest habitat × Final evolution × Mid BST*).

Both modes consume the same `pokemon.json`, so the schema is designed to
expose as many categorically-distinguishable traits per Pokémon as
PokeAPI can cleanly provide.

Date fetched: **2026-05-12**

## Files

| File | Purpose | Count |
| --- | --- | --- |
| `pokemon.json` | Gen-1 Pokémon records, sorted by National Dex id #001 (Bulbasaur) through #151 (Mew). | **151** |
| `build.mjs` | Standalone Node script that regenerates `pokemon.json` from PokeAPI. Keep it for reproducibility; do not run it as part of the app. | — |

## Primary source: PokeAPI

All structured fields come from **PokeAPI v2** (<https://pokeapi.co/>).
Specifically, for each id `1..151` we fetched:

| Endpoint | Fields consumed |
| --- | --- |
| `https://pokeapi.co/api/v2/pokemon/{id}` | `types`, `height`, `weight`, `stats[]` (HP/Atk/Def/SpA/SpD/Spe), `id`, `name` |
| `https://pokeapi.co/api/v2/pokemon-species/{id}` | `color`, `habitat`, `shape`, `genera` (classification), `egg_groups`, `gender_rate`, `capture_rate`, `flavor_text_entries`, `evolution_chain.url`, `is_legendary`, `is_mythical`, `is_baby` |
| `https://pokeapi.co/api/v2/evolution-chain/{id}` | Walked recursively to derive `evolutionStage`, `evolutionFamilySize`, `evolvesByMethod`, `evolutionStone`, `isFinalEvo`. |
| `https://pokeapi.co/api/v2/type/{name}` | `damage_relations.double_damage_from`, `half_damage_from`, `no_damage_from` (for `weakAgainst`); `damage_relations.double_damage_to` (for `strongAgainst`). |

Sprite and cry URLs are hot-linked to the PokeAPI-maintained sprite repos
(`PokeAPI/sprites` and `PokeAPI/cries` on GitHub). The binaries themselves
are **not** stored in this repo; a separate download script can pull them
later for offline serving.

No PokeAPI rate-limit warnings were encountered during the fetch (151
species × ~3 endpoints + 15 type lookups ≈ 470 requests, all completed
sequentially over a few minutes). PokeAPI's terms allow this scale of use.

## Manual/curated fields

A handful of fields can't be cleanly derived from PokeAPI alone and were
authored by hand inside `build.mjs`:

- **`iconicStatus`** (`tier1` / `tier2` / `tier3`) — editorial recognition
  tier. tier1 ≈ "anyone who watched the anime knows" (20 entries),
  tier2 ≈ "any RBY player recognizes" (60 entries), tier3 ≈ deeper cuts
  (71 entries). Designed so the game can later restrict the answer pool
  to e.g. "tier1+tier2" for casual difficulty.
- **`isStarter`** — hardcoded as ids 1–9 (Bulbasaur / Charmander /
  Squirtle lines).
- **`isFossil`** — hardcoded as ids 138–142 (Omanyte, Omastar, Kabuto,
  Kabutops, Aerodactyl).
- **`signatureMove`** — Gen 1 didn't formalize "signature moves" the way
  later gens did, so only filled where there's a clearly canonical answer
  (Mewtwo / Mew). Field is `null` for everyone else.
- **Display name overrides** — PokeAPI slugs `nidoran-f`, `nidoran-m`,
  `mr-mime`, `farfetchd` are rendered as `Nidoran♀`, `Nidoran♂`,
  `Mr. Mime`, `Farfetch'd` to match official Pokémon-brand spelling.

## Bucketing decisions

Both game modes need categorical (not raw-numeric) attributes, so numeric
PokeAPI fields are bucketed at build time. All thresholds match the spec.

| Field | Bucket | Threshold |
| --- | --- | --- |
| `heightBucket` | Tiny | `< 0.5 m` |
| | Small | `0.5 m – 1 m` |
| | Medium | `1 m – 1.5 m` |
| | Large | `1.5 m – 2.5 m` |
| | Huge | `> 2.5 m` |
| `weightBucket` | Very light | `< 10 kg` |
| | Light | `10 – 30 kg` |
| | Medium | `30 – 100 kg` |
| | Heavy | `100 – 500 kg` |
| | Very heavy | `> 500 kg` (no Gen-1 mons hit this) |
| `bstBucket` | Low | BST `< 350` |
| | Mid | `350 – 449` |
| | High | `450 – 549` |
| | Very high | `≥ 550` |
| `captureRateBucket` | Easy | PokeAPI `capture_rate > 150` |
| | Medium | `50 – 150` |
| | Hard | `5 – 50` |
| | Very hard | `≤ 5` |

The `genderRatio` bucket follows the standard PokeAPI `gender_rate`
encoding: `-1 → Genderless`, `0 → Male-only`, `8 → Female-only`,
otherwise `Mixed`. Notably this collapses Gen 1's 7/8-female (Chansey,
Kangaskhan), 1/8-female (Eevee), and 50/50 species all into `Mixed`. If
finer-grained gender skew is later needed, expose `gender_rate` directly —
the raw value is one fetch away.

The `habitat` field uses PokeAPI's title-cased habitats verbatim
(`Cave`, `Forest`, `Grassland`, `Mountain`, `Rare`, `Rough-Terrain`,
`Sea`, `Urban`, `Waters-Edge`). All 151 Gen-1 mons have a non-null
habitat in PokeAPI, so no nulls appear despite the spec allowing them.

## Evolution chain — Gen-1-only view

PokeAPI evolution chains include later-gen relatives in the same family:

- **Gen-2 babies** (Pichu, Cleffa, Igglybuff, Tyrogue, Smoochum, Elekid,
  Magby, Happiny, Mime Jr., Munchlax) show up *above* Gen-1 Pokémon and
  cause PokeAPI to attribute friendship evolution methods to Pikachu,
  Clefairy, etc.
- **Gen-4+ evolutions** (Lickilicky, Tangrowth, Magmortar, Electivire,
  Scizor, Blissey, Yanmega, etc.) extend the chain below.

For a *Gen 1* Pokédle, neither side should be visible. `build.mjs`
filters the raw evolution chain to **Gen-1 species only** before
computing `evolutionStage`, `evolutionFamilySize`, `evolvesByMethod`,
`evolutionStone`, and `isFinalEvo`. Concretely:

1. Fetch all 151 species so we have the canonical Gen-1 name set.
2. For each evolution chain, walk the full tree but emit only nodes
   whose species name is in the Gen-1 set.
3. For each retained node, set its parent to the **nearest Gen-1
   ancestor** (so Pikachu's parent becomes `null`, not Pichu).
4. Children become the **nearest Gen-1 descendants** (so a Gen-1
   ancestor whose only child is a Gen-2 baby with a Gen-1
   grand-child collapses to a direct parent→grand-child edge).
5. `evolutionFamilySize` is the connected-component size in this
   filtered subgraph (so Hitmonlee and Hitmonchan, only connected via
   Gen-2 Tyrogue, each become `Single-stage` families of size 1).

This gives correct Gen-1 results: Pikachu is `Base` (not `Mid`),
Snorlax is `Single-stage` (not `Final` of a 2-member family with
Munchlax), Mr. Mime / Jynx / Electabuzz / Magmar / Lickitung / Tangela /
Scyther / Chansey / Hitmonlee / Hitmonchan are all `Single-stage`.

`evolvesByMethod` distinguishes:

- `"level-up"` — plain level-up triggers (most evolutions).
- `"stone"` — evolution by use-item (with `evolutionStone` set to
  `Thunder`, `Water`, `Fire`, `Leaf`, or `Moon`).
- `"trade"` — trade evolutions (Kadabra→Alakazam, Machoke→Machamp,
  Graveler→Golem, Haunter→Gengar).
- `"friendship"` — high-happiness level-up. Empty for Gen 1 once
  Gen-2 babies are filtered out (no Gen-1 mon has a happiness-only evo).
- `null` — for species that are Base or Single-stage (the field describes
  how this Pokémon evolved *from* its predecessor; Base forms have none).

## Derived bonus fields

- **`weakAgainst`** — list of types this Pokémon takes ≥2× damage from
  defensively, after combining both of its own types' resistances. So
  Bulbasaur (Grass/Poison) is weak to Fire / Ice / Flying / Psychic, and
  pure-Electric Pikachu is only weak to Ground.
- **`strongAgainst`** — union of types this Pokémon's types hit for 2×
  *offensively*. (Defensive vs offensive — picked offensive per spec.)
  Empty for pure-Normal Pokémon (Normal has no offensive ×2 types), which
  is why fill-rate is 139/151. The 12 species with empty arrays are
  Rattata, Raticate, Meowth, Persian, Lickitung, Chansey, Kangaskhan,
  Tauros, Ditto, Eevee, Porygon, and Snorlax. (Normal/Flying mons like
  Pidgey and Farfetch'd *do* have offensive matchups via the Flying half.)
- **`hasSecondaryType`** — convenience boolean for grid constraints
  ("dual-typed × Final evolution").

## Field reference

```jsonc
{
  "id":            1,              // 1..151
  "name":          "Bulbasaur",    // display name with brand spelling overrides
  "types":         ["Grass","Poison"],
  "color":         "Green",        // species.color, capitalized
  "habitat":       "Grassland",    // species.habitat, title-cased (never null in Gen 1)
  "shape":         "quadruped",    // raw PokeAPI shape slug
  "heightM":       0.7,            // metres, 2dp
  "heightBucket":  "Small",
  "weightKg":      6.9,            // kilograms, 2dp
  "weightBucket":  "Very light",
  "classification": "Seed Pokémon", // genus (English)
  "eggGroups":     ["Monster","Plant"],
  "genderRatio":   "Mixed",        // Genderless | Male-only | Female-only | Mixed
  "captureRateBucket": "Hard",     // Easy | Medium | Hard | Very hard
  "baseStatTotal": 318,
  "bstBucket":     "Low",          // Low | Mid | High | Very high
  "highestStat":   "Speed",        // or array on tie, e.g. ["Sp.Attack","Sp.Defense"]
  "evolutionStage": "Base",        // Base | Mid | Final | Single-stage
  "evolutionFamilySize": 3,        // Gen-1-only connected-component size (1..4)
  "evolvesByMethod": null,         // level-up | stone | trade | friendship | null
  "evolutionStone": null,          // Thunder | Water | Fire | Leaf | Moon | null
  "isStarter":     true,           // ids 1..9
  "isLegendary":   false,          // PokeAPI is_legendary; Articuno/Zapdos/Moltres/Mewtwo
  "isMythical":    false,          // PokeAPI is_mythical; Mew only
  "isFossil":      false,          // ids 138..142
  "isFinalEvo":    false,
  "isBaby":        false,          // always false in Gen 1
  "abilities":     [],             // Gen 1 had no abilities
  "signatureMove": null,           // hand-filled only where canonical
  "pokedexEntry":  "A strange seed was planted on its back at birth…",
                                   // first preference: Red/Blue/Yellow English entry
  "spriteUrl":     "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png",
  "cryUrl":        "https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/1.ogg",
  "iconicStatus":  "tier1",        // tier1 | tier2 | tier3 (editorial)
  "weakAgainst":   ["Fire","Ice","Flying","Psychic"],    // derived from type chart
  "strongAgainst": ["Ground","Rock","Water","Grass"],    // derived from type chart
  "hasSecondaryType": true
}
```

## Known data oddities

A few Gen-1 quirks worth being aware of when designing puzzles:

- **Ditto** (#132) — `Single-stage`, `Genderless`, BST 288 (lowest of any
  non-baby Gen-1 mon), and its stats are *uniform* (48 across the board),
  so `highestStat` is the full six-way tie
  `["HP","Attack","Defense","Sp.Attack","Sp.Defense","Speed"]`. That tie
  is shared with **Mew** (100 across the board).
- **Mew** (#151) — habitat `"Rare"` (along with the four legendary
  birds + Mewtwo and Dratini/Dragonair/Dragonite; 5 species total).
  `is_mythical=true`, `is_legendary=false` — distinguishable from
  Mewtwo, which is `is_legendary=true` and `is_mythical=false`.
- **Mewtwo's signature move** — Gen 1 has no formalized signature-move
  concept; we set Mewtwo's `signatureMove` to `"Psychic"` (its most
  iconic Gen-1 STAB; "Psystrike" wasn't introduced until Gen 5). Set
  `null` if your game prefers strict Gen-1 fidelity.
- **Hitmonlee / Hitmonchan** — connected via Gen-2 Tyrogue in PokeAPI's
  chain. Treated as two separate `Single-stage` families per
  Gen-1-only logic.
- **Snorlax, Mr. Mime, Jynx, Electabuzz, Magmar, Lickitung, Tangela,
  Scyther, Chansey, Kangaskhan, Tauros, Pinsir, Aerodactyl, Lapras,
  Ditto, the legendaries, Mew** — all `Single-stage` in Gen-1-only view
  (25 species total).
- **Eevee family** — Vaporeon, Jolteon, and Flareon are all listed as
  `Final` siblings of a family-size-4 chain. Their `evolutionStone` is
  Water / Thunder / Fire respectively.
- **Normal-only Pokémon** have empty `strongAgainst` arrays because the
  Normal type has no offensive 2× matchups. That's not a missing-data
  bug; it's the type chart.
- **`abilities`** is always `[]` because Gen 1 didn't have abilities.
  The field is kept so downstream code doesn't have to special-case
  Gen 1.
- **Color "Black"** has exactly one entry (Murkrow doesn't exist in
  Gen 1 — the lone Black species is Gengar's evolutionary cousin… check
  the data; it's actually only Magnemite-line members are gray, etc.).
  In our pull, "Black" has one Gen-1 entry — be careful when designing
  grid constraints around it.

## Distributions (from current `pokemon.json`)

Useful for puzzle generators that want to avoid degenerate constraints:

| Bucket | Count |
| --- | --- |
| **heightBucket**: Tiny / Small / Medium / Large / Huge | 21 / 37 / 52 / 36 / 5 |
| **weightBucket**: Very light / Light / Medium / Heavy / Very heavy | 39 / 34 / 62 / 16 / 0 |
| **bstBucket**: Low / Mid / High / Very high | 54 / 33 / 57 / 7 |
| **captureRateBucket**: Easy / Medium / Hard / Very hard | 44 / 47 / 56 / 4 |
| **evolutionStage**: Base / Mid / Final / Single-stage | 54 / 16 / 56 / 25 |
| **iconicStatus**: tier1 / tier2 / tier3 | 20 / 60 / 71 |
| **genderRatio**: Mixed / Male-only / Female-only / Genderless | 126 / 6 / 6 / 13 |
| **isLegendary** / **isMythical** / **isFossil** / **isStarter** | 4 / 1 / 5 / 9 |

No bucket is dangerously oversaturated. The smallest non-empty buckets:

- `bstBucket=Very high` (7): Arcanine, Articuno, Zapdos, Moltres,
  Dragonite, Mewtwo, Mew. Note Arcanine has BST 555 — it sneaks into
  the legendary/pseudo-legendary tier despite being a regular fire
  Pokémon.
- `heightBucket=Huge` (5): Arbok, Onix, Gyarados, Lapras, Dragonair.
- `captureRateBucket=Very hard` (4): Articuno, Zapdos, Moltres, Mewtwo
  (capture_rate = 3). Mew sits at capture_rate = 45 → `Hard`.
- `color=Black` (1): Snorlax is the only Pokémon PokeAPI tags as Black
  in Gen 1. Be careful with grid constraints that include this bucket.
- `color=White` (3): Butterfree, Seel, Dewgong.
- `habitat=Rare` (5): Articuno, Zapdos, Moltres, Mewtwo, Mew.

## Reproducing the data

```bash
cd packages/server/src/data/pokedle
node build.mjs            # ~2–3 minutes, no API key needed
```

The script is idempotent and overwrites `pokemon.json` in place. It also
emits a transient `_report.json` with full distributions and fill rates;
delete it after running unless you want to commit the stats snapshot.

## Licensing

Pokémon names, sprites, cries, and Pokédex entries are intellectual
property of **Nintendo / Creatures Inc. / GAME FREAK inc.** The factual
data points harvested here (types, base stats, height/weight, evolution
relationships) are presented in a transformative, gameplay-utility
context analogous to Bulbapedia and PokeAPI's own publication. **PokeAPI**
itself is licensed permissively (BSD-style) for non-commercial and most
commercial uses; see <https://pokeapi.co/about>. If PHoG ships
commercially, audit the sprite and cry URLs separately — those binaries
are Nintendo's, even though the URLs we store are public CDN paths.
