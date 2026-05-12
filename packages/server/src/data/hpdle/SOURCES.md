# Harry Potter "dle" Character Database — Sources & Field Documentation

**Compiled:** 2026-05-12
**Roster size:** 135 characters
**File:** `characters.json`

## Provenance

This dataset was compiled from canonical Harry Potter sources. WebFetch access to `harrypotter.fandom.com` was blocked (HTTP 403) during compilation, so verification of sparse fields (wands, patronuses, boggarts, species classifications) was performed via WebSearch against multiple sources that quote the wiki. Common-knowledge attributes (gender, house, blood status of major characters, deaths, basic affiliations) were drawn from the seven-book canon, with the wiki used as tie-breaker.

### Searches performed (representative)

- Wand specs: holly/phoenix feather/11" (Harry); vine/dragon heartstring (Hermione); willow/unicorn hair/14" (Ron); elder/thestral/15" (Dumbledore); yew/phoenix/13½" (Voldemort); walnut/dragon heartstring/12¾" (Bellatrix); elm/dragon heartstring/18" (Lucius); hawthorn/unicorn/10" (Draco); cherry/unicorn/13" (Neville's second wand); fir/9½" (McGonagall, core disputed); hornbeam/dragon heartstring/10¼" (Krum).
- Patronus: confirmed for Harry (stag), Hermione (otter), Ron (Jack Russell terrier), Snape (doe), Dumbledore (phoenix), McGonagall (cat), Tonks (wolf), Lupin (wolf), Kingsley (lynx), Cho (swan), Luna (hare), Arthur (weasel), Ginny (horse), Aberforth (goat), Umbridge (cat — Pottermore), Seamus (fox — Pottermore), Lily (doe), James (stag — Animagus form), Ernie Macmillan (boar — Pottermore).
- Boggart: Harry (Dementor), Ron (spider), Hermione (McGonagall failing her), Lupin (full moon), Neville (Snape), Mrs. Weasley (dead family), Parvati (mummy), Seamus (banshee), Dean (severed hand), Tom Riddle (his own corpse).
- Half-breed / part-human status: Hagrid (half-giant, wizard father + giantess mother); Madame Maxime (half-giant, parentage ambiguous); Fleur Delacour (quarter-Veela, mother Apolline is half-Veela); Filius Flitwick (part-goblin per JKR Pottermore essay); Firenze (centaur); Filch + Mrs. Figg (Squibs).
- Animagi: confirmed Sirius (dog), James (stag), Peter (rat), Rita Skeeter (beetle), McGonagall (tabby cat).

### Pages that would have been first-line sources had WebFetch worked
- `harrypotter.fandom.com/wiki/<Character>` infoboxes (priority 1)
- `harrypotter.com/fact-file/characters-and-pets/<character>` (Wizarding World, priority 2)
- `hp-lexicon.org/character/<character>` (priority 2 — heavily book-cited)

## Field documentation

### Identity / classification
- **`name`** — Character's canonical full name (or most-known name for non-humans like Dobby, Hedwig).
- **`aliases`** — Multi. Nicknames, titles, alternate names ("The Boy Who Lived", "Padfoot", "R.A.B.", maiden names).
- **`gender`** — `M | F | Other`. `Other` used for Peeves (poltergeist, no canonical gender).
- **`iconicStatus`** — `tier1 | tier2 | tier3`. Curator's judgment for game answer-pool subsets.
  - **tier1 (19)**: Any casual film viewer recognizes — Harry, Hermione, Ron, Dumbledore, Voldemort, Snape, Sirius, Lupin, Hagrid, McGonagall, Draco, Ginny, Neville, Luna, Bellatrix, Fred, George, Molly, Dobby.
  - **tier2 (45)**: Any book/film fan recognizes — Lucius, Narcissa, Tonks, Kingsley, Moody, Umbridge, Fudge, Pettigrew, James, Lily, Fleur, Krum, Cedric, Cho, Hooch is t3 — etc.
  - **tier3 (71)**: Deep cuts — Lavender, Pansy, Crabbe, Goyle, Marcus Flint, Anthony Goldstein, Ted Tonks, Sturgis Podmore, Bane, the founders, etc.

### Magical biology
- **`species`** — Multi. Canonical species/condition tags. Sirius is `["Human","Animagus"]`; Lupin is `["Human","Werewolf"]`; Tonks is `["Human","Metamorphmagus"]`; Fleur is `["Human","Part-Veela"]`. Animals (Hedwig, Crookshanks, Buckbeak, Fawkes, Aragog, Nagini) get species-only tags. Ghosts use `["Ghost"]`; the Bloody Baron etc. were human in life — kept as just `["Ghost"]` because the species-test in canon treats ghosts as their own category.
- **`bloodStatus`** — `Pure-blood | Half-blood | Muggle-born | Squib | Half-breed | Magical-creature | Part-Goblin | null`. `Half-breed` is the offensive in-canon term used for half-giants (Hagrid, Maxime) and werewolves (Fenrir). `Magical-creature` is used for house-elves, goblins, centaurs. `Part-Goblin` is Flitwick's per-canon JKR essay. `null` for Muggles where the concept doesn't apply.
- **`isMagical`** — `false` only for Muggles (Dursleys, Hedwig — non-magical owl) and Squibs (Filch, Mrs. Figg). Squibs are arguably "wizard world" — flagged `false` here because they cannot perform magic.
- **`isAnimagus`** / **`animagusForm`** — Boolean + form string. Five canonical Animagi in this set: Sirius (black dog), James (stag), Peter (rat), McGonagall (tabby cat), Rita Skeeter (beetle).

### Hogwarts attributes
- **`school`** — `Hogwarts | Beauxbatons | Durmstrang | Ilvermorny | None | null`. `None` = canonically magical but no school attendance (Dobby, Kreacher). `null` = pre-school-system or unknown (Flamel, Nagini).
- **`house`** — `Gryffindor | Slytherin | Ravenclaw | Hufflepuff | Beauxbatons | Durmstrang | null`. `null` for adults whose house is not canon (Kingsley, Moody, Filch, Hooch — surprisingly many).
- **`isHogwartsFounder`** — Boolean. True for Godric, Salazar, Rowena, Helga.

### Roles / affiliations (semantic split)
- **`affiliations`** — Multi. *Factions, organisations, family-houses, teams* the character belongs to: "Order of the Phoenix", "Death Eaters", "Dumbledore's Army", "Hogwarts", "Ministry of Magic", "House of Black", "Gryffindor Quidditch team", "Holyhead Harpies", "Slug Club", etc.
- **`roles`** — Multi. *Jobs, positions, titles*: "Student", "Teacher", "Headmaster", "Prefect", "Head Boy/Girl", "Auror", "Healer", "Shopkeeper", "Minister of Magic", "Triwizard champion", "Death Eater", "Order member", "Quidditch player (professional)", "Dark Lord", "Hogwarts founder", "Ghost", "House-elf", etc.

  *Note:* "Death Eater" and "Order member" appear in `roles` as well as in `affiliations` (`"Death Eaters"`, `"Order of the Phoenix"`) — this is intentional duplication so the dle can match on either. The yellow-cell logic should handle the overlap fine.

- **`deathEaterStatus`** — Added beyond schema. `leader | yes | former | sympathizer | no`. Richer than binary because Snape (double agent), Karkaroff (former), Crouch Jr. (yes), Umbridge (sympathizer, never marked), Lucius (former by series end), and Voldemort/Tom Riddle (leader) are usefully distinguished.

### Appearance
- **`hairColor`** — `Black | Brown | Red | Blonde | Grey | White | Silver | Bald | Ginger | Sandy | varies | null`. `varies` = Tonks (Metamorphmagus). `Ginger` is distinguished from `Red` for Crookshanks/Mundungus (book uses different word). Note Weasley red != Crookshanks ginger.
- **`eyeColor`** — Free-string from canon. `Green | Blue | Brown | Black | Grey | Hazel | Yellow | Amber | Silver | Watery | varies | null`.
- **`skinTone`** — Only filled where canonically distinctive. `"Black"` for Kingsley, Angelina, Lee Jordan, Dean Thomas, Blaise Zabini, Aurora Sinistra. Otherwise `null` — book canon rarely specifies and we don't want to default.

### Story
- **`firstAppearance`** — Book number 1–7. `null` for characters whose first appearance is film/play/Pottermore only (Herbert Beery is set to `null`).
- **`ageBracket`** — `Child | Young | Adult | Old | Ancient`. Soft buckets: `Young` ~ 11–25 (Hogwarts era), `Adult` ~ 25–60, `Old` ~ 60–100, `Ancient` ~ 100+ or pre-canon founders/Flamel/ghosts.
- **`approxAgeAtBookEnd`** — Integer estimate at end of DH (1998). `null` if unknown. Flamel is 665; Dumbledore 116; etc.

### Combat / sport
- **`playedQuidditch`** — Boolean (school or pro).
- **`quidditchPosition`** — `Seeker | Keeper | Beater | Chaser | null`.

### Sparse fields (the gold)
- **`wand`** — Object `{ wood, core, length }` or `null`. **Note:** Snape's wand is canonically unknown (J.K. Rowling has stated this on Twitter, 2022) — left `null`. Voldemort and Tom Riddle share the same wand (yew/phoenix/13½").
- **`patronus`** — Single string or `null`. Notable disputes: Molly Weasley's patronus is not canon (fan-speculation says bear); left `null`.
- **`boggart`** — Single string or `null`. Mostly only filled for Marauders-era/PoA-era characters since the DADA boggart lesson is the main canon source.

### Death
- **`diedInCanon`** — Boolean. True for any character who died on-page or whose death is confirmed in the seven books (including pre-canon deaths like the Potters, Myrtle, Helena Ravenclaw).
- **`deathBook`** — Book number 1–7 where the death occurred / was confirmed, or `null`. Pre-canon deaths (founders, Bloody Baron, Frank Bryce-era) have `null` even though `diedInCanon: true`.
- **`deathEvent`** — Short string describing cause/location.

### Family
- **`maritalStatus`** — `Married | Widowed | null`. Sparse, only filled where canon.
- **`notableRelations`** — Multi. Light list of canonically well-known relations.

## Canon ambiguity & judgment calls

1. **McGonagall's wand core.** Pottermore-era sources give "fir, 9½ inches", but the core is disputed (some say dragon heartstring, others say not specified). Marked `core: null` — wood and length only.
2. **Snape's wand.** Films show 13¼", but J.K. Rowling has stated wand wood/core is unwritten. Entire `wand` field `null`.
3. **Voldemort vs. Tom Riddle.** Same person, but the diary-Tom-Riddle is a distinct Horcrux entity that "dies" in book 2. Both entries are included separately as the dle game may want both as possible answers; their wand entries are identical because the wand is the same.
4. **Madame Maxime's species.** "Big-boned" in her own euphemism; canonically a half-giant per Hagrid's confirmation in GoF. Marked `["Half-giant"]`.
5. **Filius Flitwick.** JKR's Pottermore essay says part-goblin; older film portrayal suggests full human. Going with author canon: `Part-Goblin` bloodStatus, `["Human","Part-goblin"]` species.
6. **Founders' blood status.** Only Slytherin's pure-blood obsession is canon-clear; the other three founders' personal blood status is not explicit. Set to `null` for Gryffindor/Ravenclaw/Hufflepuff; `Pure-blood` for Slytherin.
7. **House for non-students/staff.** Many adults (Kingsley, Moody, Filch, Hooch, Sprout-as-student, Fudge) have no canonical house. Set `null` rather than guess. (Hooch/Sprout/Trelawney's adult-Hogwarts-staff house is sometimes guessed; only Sprout's = Hufflepuff and Trelawney's = Ravenclaw are JKR-confirmed in interview/Pottermore.)
8. **Lavender Brown's death.** Book 7 says she was attacked by Fenrir Greyback and "stopped moving"; whether she died is genuinely ambiguous. Most fans treat her death as canon (especially with the film confirming it). Marked `diedInCanon: true, deathBook: 7`.
9. **Stan Shunpike**, Mundungus, etc. — DA / Order side-characters; ages are unknown so `null`.
10. **Crookshanks species.** Confirmed part-Kneazle in canon; tagged `["Cat","Part-kneazle"]`.
11. **Nagini.** Per *Crimes of Grindelwald* (Fantastic Beasts canon), Nagini was a Maledictus — a human cursed into permanent snake form. Tagged `["Maledictus","Snake"]`. Some purists reject this; book-canon-only would be `["Snake"]`. Chose to include Maledictus since it's JKR-confirmed.
12. **Peter Pettigrew's wand.** Listed as chestnut/dragon heartstring/9¼" per Pottermore — this is one of the few sparse-field cases where Pottermore went beyond the books.

## Pages that could not be fetched

`harrypotter.fandom.com` returned HTTP 403 to WebFetch during compilation. All wiki-derived data was therefore obtained via web search snippets that quote the wiki. If re-verifying any value, the wiki infobox is still the canonical primary source — these are the URLs to re-check:

- `/wiki/Harry_Potter`, `/wiki/Hermione_Granger`, `/wiki/Ron_Weasley`, `/wiki/Severus_Snape` (et al for every character)
- `/wiki/Patronus_Charm`, `/wiki/Boggart`, `/wiki/Animagus`
- `/wiki/Severus_Snape's_wand` (confirms wand info is canonically blank)

## Final-report metrics

### Total: 135 characters

### Fill rates
| Field              | Filled | Rate |
|--------------------|--------|------|
| gender             | 135    | 100% |
| species            | 135    | 100% |
| ageBracket         | 135    | 100% |
| deathEaterStatus   | 135    | 100% |
| firstAppearance    | 134    | 99%  |
| school             | 124    | 92%  |
| hairColor          | 115    | 85%  |
| house              | 80     | 59%  |
| bloodStatus        | 76     | 56%  |
| eyeColor           | 66     | 49%  |
| approxAgeAtBookEnd | 54     | 40%  |
| deathBook          | 34     | 25%  |
| wand               | 22     | 16%  |
| patronus           | 21     | 16%  |
| quidditchPosition  | 19     | 14%  |
| boggart            | 10     | 7%   |
| animagusForm       | 5      | 4%   |
| skinTone           | 6      | 4%   |

### Top 5 most-distinguishing attributes (fill rate × value variety)
1. **`house`** — 4 Hogwarts houses + 2 foreign + null. 59% filled. Excellent for Loldle yellow/green logic.
2. **`bloodStatus`** — 7+ distinct values (Pure-blood, Half-blood, Muggle-born, Squib, Half-breed, Magical-creature, Part-Goblin). 56% filled.
3. **`species`** — Multi-value with rich variety (Human, Half-giant, House-elf, Werewolf, Ghost, Centaur, Goblin, Animagus tag, Metamorphmagus, Part-Veela, Phoenix, Hippogriff, etc.). 100% filled.
4. **`affiliations`** — Multi-value, ~30+ distinct factions. Avg 1.67 per char. Order/Death Eaters/DA are the high-frequency ones; family houses and Quidditch teams add long-tail.
5. **`deathEaterStatus`** — 5 discrete values, 100% filled. Cleanly partitions the antagonist axis (leader/yes/former/sympathizer/no).

### Notable canon disputes punted on
- Snape's wand (left null — JKR-confirmed unwritten).
- McGonagall's wand core (left null — sources conflict).
- Molly Weasley's patronus (left null — never canon).
- Lavender Brown's death (treated as canon-yes; could be argued either way).
- Founders' blood status except Slytherin (left null — never made explicit).
- Many tier-3 students' first-name canonicity (taken from JKR's class lists).

### Iconic-status distribution
- **tier1**: 19 (Harry, Hermione, Ron, Dumbledore, Voldemort, Snape, Sirius, Lupin, Hagrid, McGonagall, Draco, Ginny, Neville, Luna, Bellatrix, Fred, George, Molly, Dobby)
- **tier2**: 45 (well-known supporting cast — Tonks, Kingsley, Moody, Umbridge, Pettigrew, James, Lily, Fleur, Krum, Cedric, Cho, Lockhart, Slughorn, Quirrell, Filch, Dursleys, Hedwig, Fawkes, Buckbeak, Nagini, Tom Riddle, Lucius, Narcissa, Grindelwald, etc.)
- **tier3**: 71 (Marauders-era and side cast — Lavender, Pansy, Crabbe, Goyle, Patil twins, Death Eater rank-and-file, Order rank-and-file, Hogwarts staff minors, founders, Gaunts, etc.)

---

# Harry Potter Spell Database — Sources & Field Documentation

**Compiled:** 2026-05-12
**Roster size:** 42 spells
**File:** `spells.json`

## Provenance

This dataset was compiled for the "guess the incantation from the effect" HP-dle mode. WebFetch access to `harrypotter.fandom.com` returned HTTP 403 during compilation (same pattern as the character harvest), so first-appearance scenes and casters were verified via WebSearch snippets that quote the Fandom wiki, the Wizarding World fact-files, the Harry Potter Lexicon, and Wikibooks' Muggles' Guide.

Each spell entry has been verified for the following (42 spells total):
- canonical incantation spelling and capitalization
- book number of the first canonical print appearance (not chronological universe time)
- a specific, named scene rather than a vague "appears in book X"
- a notable caster who is a character in `characters.json`

### Pages that would have been first-line sources had WebFetch worked

Per-spell wiki pages:
- `harrypotter.fandom.com/wiki/Disarming_Charm` (Expelliarmus)
- `harrypotter.fandom.com/wiki/Patronus_Charm` (Expecto Patronum)
- `harrypotter.fandom.com/wiki/Killing_Curse` (Avada Kedavra)
- `harrypotter.fandom.com/wiki/Cruciatus_Curse` (Crucio)
- `harrypotter.fandom.com/wiki/Imperius_Curse` (Imperio)
- `harrypotter.fandom.com/wiki/Levitation_Charm` (Wingardium Leviosa)
- `harrypotter.fandom.com/wiki/Wand-Lighting_Charm` (Lumos)
- `harrypotter.fandom.com/wiki/Wand-Extinguishing_Charm` (Nox)
- `harrypotter.fandom.com/wiki/Summoning_Charm` (Accio)
- `harrypotter.fandom.com/wiki/Unlocking_Charm` (Alohomora)
- `harrypotter.fandom.com/wiki/Stunning_Spell` (Stupefy)
- `harrypotter.fandom.com/wiki/Boggart-Banishing_Spell` (Riddikulus)
- `harrypotter.fandom.com/wiki/Laceration_Curse` (Sectumsempra)
- `harrypotter.fandom.com/wiki/Memory_Charm` (Obliviate)
- `harrypotter.fandom.com/wiki/Mending_Charm` (Reparo)
- `harrypotter.fandom.com/wiki/Water-Making_Spell` (Aguamenti)
- `harrypotter.fandom.com/wiki/Blasting_Curse` (Confringo)
- `harrypotter.fandom.com/wiki/Severing_Charm` (Diffindo)
- `harrypotter.fandom.com/wiki/Engorgement_Charm` (Engorgio)
- `harrypotter.fandom.com/wiki/Shrinking_Charm` (Reducio)
- `harrypotter.fandom.com/wiki/Episkey`
- `harrypotter.fandom.com/wiki/Bandaging_Charm` (Ferula)
- `harrypotter.fandom.com/wiki/General_Counter-Spell` (Finite Incantatem)
- `harrypotter.fandom.com/wiki/Pimple_Jinx` (Furnunculus)
- `harrypotter.fandom.com/wiki/Doubling_Charm` (Geminio)
- `harrypotter.fandom.com/wiki/Impediment_Jinx` (Impedimenta)
- `harrypotter.fandom.com/wiki/Incarcerous`
- `harrypotter.fandom.com/wiki/Fire-Making_Spell` (Incendio)
- `harrypotter.fandom.com/wiki/Dangling_Jinx` (Levicorpus)
- `harrypotter.fandom.com/wiki/Morsmordre`
- `harrypotter.fandom.com/wiki/Muffliato_Charm`
- `harrypotter.fandom.com/wiki/Full_Body-Bind_Curse` (Petrificus Totalus)
- `harrypotter.fandom.com/wiki/Shield_Charm` (Protego)
- `harrypotter.fandom.com/wiki/Tickling_Charm` (Rictusempra)
- `harrypotter.fandom.com/wiki/Scouring_Charm` (Scourgify)
- `harrypotter.fandom.com/wiki/Silencing_Charm` (Silencio)
- `harrypotter.fandom.com/wiki/Dancing_Jinx` (Tarantallegra)
- `harrypotter.fandom.com/wiki/Reductor_Curse` (Reducto)
- `harrypotter.fandom.com/wiki/Mobilicorpus`
- `harrypotter.fandom.com/wiki/Snake_Summons_Spell` (Serpensortia)
- `harrypotter.fandom.com/wiki/Leg-Locker_Curse` (Locomotor Mortis)
- `harrypotter.fandom.com/wiki/Oppugno_Jinx`

Secondary sources actually used (visible via search snippets):
- `harrypotter.com/fact-file/spells/*` (Wizarding World official encyclopedia)
- `www.hp-lexicon.org/magic/*` (Harry Potter Lexicon — book-cited)
- `en.wikibooks.org/wiki/Muggles'_Guide_to_Harry_Potter/Magic/*`
- `harrypotterbooks.fandom.com/wiki/*` (book-only canon wiki)

## Field documentation

- **`incantation`** — Canonical spelling and capitalization. Multi-word incantations (Wingardium Leviosa, Avada Kedavra, Petrificus Totalus, Finite Incantatem, Locomotor Mortis) keep their canonical title-cased spacing.
- **`effect`** — One- or two-sentence description of what the spell does in canon. Where the spell has notable lore (e.g. invented by Snape, Unforgivable, has a counter-charm), that's included.
- **`category`** — One of `Charm | Curse | Jinx | Spell`. Follows Fandom-wiki classification where canonical; the in-universe distinction between Curse, Jinx, and Hex is fuzzy and Rowling herself uses the terms loosely. `Spell` is used as a fallback for things that don't fit cleanly (e.g. Mobilicorpus, Serpensortia, Incarcerous — which have ambiguous classifications across sources).
- **`firstAppearance.book`** — Integer 1–7, the book where the incantation is first heard/seen in canonical print. For spells used non-verbally before being named (e.g. Stupefy seen in Book 3 but identified by incantation in Book 4), the *first named appearance* is used. For Levicorpus the book-6 reading-of-the-Prince's-book appearance is used since Snape's Worst Memory in Book 5 shows the effect via James but doesn't name the spell (the incantation is only identified retroactively in HBP).
- **`firstAppearance.scene`** — Short prose pointer to the specific moment. Includes location and other characters when distinctive.
- **`notableCaster`** — The character most associated with the spell in canon, not necessarily the first caster. e.g. Avada Kedavra is most associated with Voldemort even though the first canonical use is by Barty Crouch Jr. on a spider. Cross-checked against `characters.json` — all 43 notable casters are present in the character roster.
- **`iconicTier`** — `tier1` (everyone knows it), `tier2` (book-readers know it), `tier3` (deep cuts).
- **`firstLetter` / `lastLetter`** — Uppercase first and last alphabetic character of the incantation. For multi-word spells, taken from the *first letter of the first word* and *last letter of the last word*. Examples: "Expecto Patronum" → E, M; "Petrificus Totalus" → P, S; "Avada Kedavra" → A, A; "Locomotor Mortis" → L, S; "Finite Incantatem" → F, M.

## Canon ambiguity & judgment calls

1. **Stupefy first-appearance book.** The Stunning effect appears in Book 3 (Lupin stuns Snape; Hogwarts professors stun Sirius), but the incantation "Stupefy" is first explicitly used and named at the Quidditch World Cup riot in Book 4. Going with Book 4 since this database keys on incantations, not effects.
2. **Protego first-appearance book.** Same situation — the Shield Charm appears nonverbally earlier, but is first named when Hermione teaches it to Harry in GoF chapter 31 (Third Task prep). Book 4.
3. **Expelliarmus first canonical appearance.** First heard in CoS at the Duelling Club (Snape vs. Lockhart). Some sources note Quirrell's earlier wand-disarming at the broomstick incident in PS, but Snape's CoS use is the first time the incantation itself is spoken. Going with Book 2.
4. **Lumos.** The wand-lighting effect appears in Book 1 (Filch lights his wand in the third-floor corridor), but the incantation "Lumos" is first explicitly named in Book 2 when Harry uses it to navigate Aragog's forest path. Book 2.
5. **Reparo.** Mr Weasley's repair of Harry's glasses in CoS (Book 2) is the first named in-narrative use; Hermione's Hogwarts Express glasses fix is film-canon only ("Oculus Reparo" doesn't appear in the books). Book 2.
6. **Riddikulus, Mobilicorpus, Ferula.** All three are PoA spells used by Lupin in the same handful of chapters; kept all three in for variety.
7. **Levicorpus notable caster.** Invented by Snape, popularised by the Marauders, most iconic use in canon is James Potter dangling Severus by his ankles in Snape's Worst Memory (OotP). Listed `notableCaster: "James Potter"` because that scene is the strongest reader association.
8. **Crucio notable caster.** First used by Crouch Jr. in canon, but Bellatrix is more iconic (Longbottoms, Hermione at Malfoy Manor). Listed Bellatrix.
9. **Imperio notable caster.** Listed Crouch Jr. — his demo and his Imperius of his own father are the most extended in-text portrayals; Voldemort uses it but rarely on-page.
10. **Avada Kedavra notable caster.** Voldemort despite Crouch Jr.'s demo. The reader association with the curse is overwhelmingly Voldemort.
11. **Tarantallegra notable caster.** Draco is the only on-page caster (CoS Duelling Club). Listed Draco rather than Snape (who counter-cancels it).
12. **Densaugeo dropped.** First appearance is clear (Book 4 corridor fight, hits Hermione), but as the "make teeth grow" jinx it's too obscure and too tonally similar to Furnunculus to be useful in a Wordle-style game. Cut to keep the roster tight.
13. **Anapneo dropped.** Slughorn's anti-choking spell in HBP is a clean appearance, but it's deeply obscure and the player association is near-zero outside hardcore fandom.
14. **Bombarda dropped.** Film-only ("Bombarda" doesn't appear in the books in this form — only Hermione's PoA-film cell-door blast and PoA video-game tie-in). Excluded because the rubric specifies book-canon first appearances.
15. **Confundo / Confundus Charm dropped.** Effect mentioned in PoA (the rumour about Sirius), but the incantation "Confundo" only really shows in HBP (Hermione on McLaggen). The scene-specificity is decent but the spell is a bit obscure for tier-2 and not iconic enough for tier-1 — dropped to keep the tier-2 size manageable.
16. **Avis included implicitly via Oppugno.** "Avis" is the bird-conjuring incantation Hermione uses just before "Oppugno" in HBP. Kept Oppugno because the scene is more memorable; cut Avis for redundancy.
17. **Liberacorpus dropped.** Counter-spell to Levicorpus; only ever spoken by Snape after James's pensieve attack. Too redundant with Levicorpus.

## Spells considered and dropped

| Spell | Reason dropped |
|---|---|
| Bombarda | Film-only canon; not in books |
| Confundo | Scene ambiguity between PoA (effect) and HBP (named incantation); marginal recognition |
| Densaugeo | Too obscure / tonally redundant with Furnunculus |
| Anapneo | Too obscure |
| Avis | Redundant with Oppugno in the same HBP scene |
| Liberacorpus | Counter-jinx of Levicorpus; redundant |
| Lacarnum Inflamare | Film-only |
| Locomotor (general) | The bare "Locomotor [object]" charm appears in OotP (the trunk) but is ambiguous as a standalone incantation — usually appended to an object name |
| Salvio Hexia, Cave Inimicum, Repello Muggletum | DH protective enchantments; each is canonical but the player association is very weak and many readers conflate them |
| Aparecium | One-off in CoS (Tom Riddle's diary scene); too easily confused with Apparition |

## Final-report metrics

### Total: 42 spells

### Tier distribution
- **tier1 (15)**: Expelliarmus, Expecto Patronum, Avada Kedavra, Crucio, Imperio, Wingardium Leviosa, Lumos, Nox, Accio, Alohomora, Stupefy, Riddikulus, Sectumsempra, Obliviate, Reparo
- **tier2 (22)**: Aguamenti, Confringo, Diffindo, Engorgio, Reducio, Episkey, Ferula, Finite Incantatem, Furnunculus, Geminio, Impedimenta, Incarcerous, Incendio, Levicorpus, Morsmordre, Muffliato, Petrificus Totalus, Protego, Rictusempra, Scourgify, Silencio, Tarantallegra
- **tier3 (5)**: Reducto, Mobilicorpus, Serpensortia, Locomotor Mortis, Oppugno

### Book distribution
| Book | Count | Spells |
|---|---|---|
| 1 (Philosopher's Stone) | 4 | Wingardium Leviosa, Alohomora, Petrificus Totalus, Locomotor Mortis |
| 2 (Chamber of Secrets) | 8 | Expelliarmus, Lumos, Obliviate, Reparo, Finite Incantatem, Rictusempra, Tarantallegra, Serpensortia |
| 3 (Prisoner of Azkaban) | 5 | Expecto Patronum, Nox, Riddikulus, Ferula, Mobilicorpus |
| 4 (Goblet of Fire) | 14 | Avada Kedavra, Crucio, Imperio, Accio, Stupefy, Diffindo, Engorgio, Reducio, Furnunculus, Impedimenta, Incendio, Morsmordre, Protego, Reducto |
| 5 (Order of the Phoenix) | 3 | Incarcerous, Scourgify, Silencio |
| 6 (Half-Blood Prince) | 6 | Sectumsempra, Aguamenti, Episkey, Levicorpus, Muffliato, Oppugno |
| 7 (Deathly Hallows) | 2 | Confringo, Geminio |

GoF is overrepresented because it's where Rowling formalised the incantations for many spells that had appeared effect-only in earlier books — the Unforgivables demonstration is a one-stop shop for naming Avada Kedavra, Crucio, Imperio, Engorgio, and Reducio.

### Category breakdown
- Charm: 25
- Curse: 9
- Jinx: 5
- Spell (catch-all): 3

### Iconic spells we could NOT confidently include
None of the required tier-1 list. All 15 mandatory iconic spells made it in with confident first-appearance scenes. From the tier-2 candidate pool, dropped: Aguamenti was kept, Confundo dropped, Densaugeo dropped, Anapneo dropped. The 15-spell tier-2 floor was easily met (23 included).

### Cross-reference with characters.json
All 42 `notableCaster` values are present as names in `characters.json`:
- Harry Potter, Hermione Granger, Ron Weasley (not used), Remus Lupin, Lord Voldemort, Bellatrix Lestrange, Barty Crouch Jr., Severus Snape, Gilderoy Lockhart, Neville Longbottom, Nymphadora Tonks, Dolores Umbridge, Draco Malfoy, James Potter, Arthur Weasley.

No `notableCaster` is missing from the character roster.
