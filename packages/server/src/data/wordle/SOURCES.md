# Wordle Word List Sources

This directory contains the two word lists used by PHoG's Wordle game mode.
They mirror the **original pre-NYT Wordle source** (Josh Wardle's January 2022
release of `https://www.powerlanguage.co.uk/wordle/`), before The New York
Times acquired the game and curated some entries out of the answer pool.

Date fetched: **2026-05-12**

## Files

| File | Purpose | Count |
| --- | --- | --- |
| `answers.json` | The daily-target answer pool (Wordle's `La` array in the original JS). Common, curated 5-letter words. | **2,315** |
| `valid-guesses.json` | Additional words a player may type as a guess but that are never the answer (Wordle's `Ta` array). Mostly obscure Scrabble-legal 5-letter words. | **10,657** |
| Combined legal input dictionary | Union of the two — a guess is legal if it appears in either list. | **12,972** |

Both files are JSON arrays of lowercase ASCII strings, sorted alphabetically
for diffability. The two lists are **disjoint** (no word appears in both).

## Primary source

The lists were downloaded on 2026-05-12 from these public GitHub gists
maintained by Chris Freshman (`cfreshman`), who extracted them from the
original `powerlanguage.co.uk/wordle/` page source:

- **Answers (`La`):** <https://gist.github.com/cfreshman/a03ef2cba789d8cf00c08f767e0fad7b>
  - Raw: <https://gist.githubusercontent.com/cfreshman/a03ef2cba789d8cf00c08f767e0fad7b/raw>
  - Description on the gist: *"Original Wordle answers from source code in alphabetical order."*
- **Valid extra guesses (`Ta`):** <https://gist.github.com/cfreshman/cdcdf777450c5b5301e439061d29694c>
  - Raw: <https://gist.githubusercontent.com/cfreshman/cdcdf777450c5b5301e439061d29694c/raw>
  - Description on the gist: *"Original Wordle allowed guesses, not including answers."*

The cfreshman gists are the most widely cited mirrors of the original
pre-acquisition lists and are used by the `freshman.dev/wordle/leaderboard`
solver leaderboard.

## Cross-reference

The lists were cross-checked against an independent mirror to confirm we
have the canonical pre-NYT source rather than a curated/expanded variant:

- **tabatkins/wordle-list:** <https://github.com/tabatkins/wordle-list>
  - Raw: <https://raw.githubusercontent.com/tabatkins/wordle-list/main/words>
  - This is a single combined list pulled "straight from the game's source code."
  - As of the fetch date it contains 14,855 unique words (it includes some
    NYT-era additions, so it is a superset of the original pre-NYT lists).
  - **Verification:** all 2,315 of our answers and all 10,657 of our
    extras are present in this list (perfect inclusion), confirming the
    cfreshman lists are an authentic subset of the canonical Wordle
    dictionary.

## What about NYT removals?

After NYT acquired Wordle, a small number of entries (commonly cited
examples include `agora`, `pupal`, `lynch`, `fibre`, `slave`, `wench`,
and a few others) were removed from the answer pool for editorial reasons.
We deliberately keep the **original launch lists** here because:

1. They are a clean, stable, well-attributed historical snapshot.
2. Game logic that needs to avoid sensitive answers can filter at runtime
   without losing valid-guess coverage.
3. These are still the lists most third-party Wordle clones and solvers
   use, so PHoG's behavior will match player expectations.

If, in the future, you want to drop specific words from the answer pool
for PHoG's own editorial reasons, do that as a runtime filter rather than
mutating `answers.json` — that keeps this file faithful to its source.

## Validation performed at write time

Before writing, the build script confirmed:

- Every entry matches `/^[a-z]{5}$/` (exactly 5 lowercase ASCII letters).
- No duplicates within either list.
- Zero overlap between `answers.json` and `valid-guesses.json`.
- Both arrays are alphabetically sorted.
- Spot checks: `cigar` (Wordle #1), `rebus` (#2), `sissy` (#3), `humph`,
  `awake`, `blush`, `focal` are all in `answers.json`. `aahed`, `aalii`,
  `zygal`, `xylyl`, `zymic` are all in `valid-guesses.json`.

## Licensing

Plain word lists are widely treated as uncopyrightable facts (lists of
existing English words; no creative arrangement claimed). Neither
cfreshman gist nor the tabatkins repository attaches a software license
to the lists themselves, and both are published publicly as references
for derivative Wordle work. We include attribution above as a courtesy
and to document provenance, not because any license requires it.

If you redistribute PHoG, you may want to keep this `SOURCES.md` alongside
the JSON files for the same reason.
