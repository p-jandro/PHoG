/**
 * Themed-dle Game Module — shared logic for Pokédle and HP-dle.
 *
 * Each game session plays all 4 modes sequentially:
 *   - Pokédle: Classic → Emoji → Silhouette → Grid
 *   - HP-dle:  Classic → Emoji → Spell → Grid
 * Scores accumulate across the 4 modes. One final placement per game.
 *
 * Theme switch:
 *   - theme: 'pokemon' → loads pokedle data
 *   - theme: 'hp'     → loads hpdle data
 *
 * Game name in engine: 'pokedle' or 'hpdle' depending on theme.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Timer } from '../utils/timer.js';
import { updatePlayerPlacements } from '../utils/scoring.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------- Data loading -----------------------------------------------------

function loadPack(theme) {
  const dataDir = join(__dirname, '..', 'data', theme === 'pokemon' ? 'pokedle' : 'hpdle');
  const rosterFile = theme === 'pokemon' ? 'pokemon.json' : 'characters.json';
  return {
    roster:       JSON.parse(readFileSync(join(dataDir, rosterFile), 'utf-8')),
    emojiPuzzles: JSON.parse(readFileSync(join(dataDir, 'emoji-puzzles.json'), 'utf-8')),
    spells:       theme === 'hp' ? JSON.parse(readFileSync(join(dataDir, 'spells.json'), 'utf-8')) : null
  };
}

// ---------- Theme-specific attribute sets for Classic mode -------------------

const CLASSIC_ATTRIBUTES = {
  pokemon: [
    { key: 'type1',          label: 'Type 1',         kind: 'single', value: p => p.types[0] || null },
    { key: 'type2',          label: 'Type 2',         kind: 'single', value: p => p.types[1] || null },
    { key: 'color',          label: 'Color',          kind: 'single', value: p => p.color },
    { key: 'habitat',        label: 'Habitat',        kind: 'single', value: p => p.habitat },
    { key: 'evolutionStage', label: 'Evolution Stage', kind: 'single', value: p => p.evolutionStage },
    { key: 'heightBucket',   label: 'Height',         kind: 'single', value: p => p.heightBucket }
  ],
  hp: [
    { key: 'gender',       label: 'Gender',       kind: 'single', value: c => c.gender },
    { key: 'house',        label: 'House',        kind: 'single', value: c => c.house },
    { key: 'bloodStatus',  label: 'Blood Status', kind: 'single', value: c => c.bloodStatus },
    { key: 'species',      label: 'Species',      kind: 'multi',  value: c => c.species || [] },
    { key: 'affiliations', label: 'Affiliations', kind: 'multi',  value: c => c.affiliations || [] },
    { key: 'hairColor',    label: 'Hair Color',   kind: 'single', value: c => c.hairColor }
  ]
};

function nameOf(entry, theme) {
  return entry.name;
}

// ---------- Locked friend-night grids (Mode 4) -------------------------------

const FRIEND_NIGHT_GRID = {
  pokemon: {
    rows: [
      { label: 'Fire-type',    test: p => p.types.includes('Fire') },
      { label: 'Color: Pink',  test: p => p.color === 'Pink' },
      { label: 'Cave habitat', test: p => p.habitat === 'Cave' }
    ],
    cols: [
      { label: 'Used by a Gym Leader',   test: p => p.gymLeader !== null && p.gymLeader !== undefined },
      { label: 'Final evolution',        test: p => p.evolutionStage === 'Final' },
      { label: 'Owned by an anime regular', test: p => ANIME_REGULAR_POKEMON.has(p.name) }
    ]
  },
  hp: {
    rows: [
      { label: 'Gryffindor', test: c => c.house === 'Gryffindor' },
      { label: 'Slytherin',  test: c => c.house === 'Slytherin' },
      { label: 'Female',     test: c => c.gender === 'F' }
    ],
    cols: [
      { label: 'Order of the Phoenix', test: c => (c.affiliations || []).some(a => /order of the phoenix/i.test(a)) },
      { label: 'Hogwarts staff',       test: c => c.school === 'Hogwarts' && (c.roles || []).some(r => /teacher|headmaster|professor|head of house|staff/i.test(r)) && !(c.roles || []).includes('Student') },
      { label: 'Death Eater',          test: c => ['yes', 'former', 'leader'].includes(c.deathEaterStatus) }
    ]
  }
};

const ANIME_REGULAR_POKEMON = new Set([
  'Pikachu', 'Caterpie', 'Metapod', 'Butterfree', 'Pidgeotto', 'Pidgeot',
  'Bulbasaur', 'Charmander', 'Charmeleon', 'Charizard', 'Squirtle',
  'Krabby', 'Kingler', 'Mankey', 'Primeape', 'Muk', 'Tauros', 'Snorlax', 'Lapras',
  'Staryu', 'Starmie', 'Psyduck', 'Goldeen', 'Horsea',
  'Geodude', 'Onix', 'Vulpix', 'Zubat',
  'Meowth', 'Ekans', 'Arbok', 'Koffing', 'Weezing', 'Lickitung', 'Victreebel'
]);

// ---------- Phase / timing constants -----------------------------------------

const INTRO_DURATION = 8000;
const CLASSIC_DURATION = 100000;
const EMOJI_DURATION = 100000;
const SILHOUETTE_DURATION = 100000;
const SPELL_DURATION = 100000;
const GRID_DURATION = 100000;
const RESULTS_DURATION = 8000;
// Players get 10 guesses total. Guesses 1-6 score on a sliding efficiency curve;
// guesses 7-10 are still allowed but score zero (kept around so a player can
// reveal the target for closure even after the scoring window closes).
const MAX_GUESSES = 10;
const SCORING_GUESS_CAP = 6;

// ---------- Scoring ----------------------------------------------------------

function scoreClassic(guessesUsed, solved, timeRemainingMs, totalMs) {
  if (!solved) return 0;
  // Beyond the scoring window (guess 7-10), no points are awarded even if solved.
  if (guessesUsed > SCORING_GUESS_CAP) return 0;
  const base = 100;
  const efficiency = (SCORING_GUESS_CAP - guessesUsed) * 20; // 0..100 (guess 1=100, guess 6=0)
  const speed = Math.max(0, Math.floor(30 * (timeRemainingMs / totalMs)));
  return base + efficiency + speed;
}

function scoreEmoji(emojisRevealed, solved, timeRemainingMs, totalMs) {
  if (!solved) return 0;
  const base = 100;
  // Fewer emojis revealed = better. Start with 1 (the hardest); up to 5 total.
  // Solving on the first emoji is the max bonus.
  const efficiency = (5 - emojisRevealed) * 30; // 0..120 (1 emoji=120, 5 emojis=0)
  const speed = Math.max(0, Math.floor(30 * (timeRemainingMs / totalMs)));
  return base + efficiency + speed;
}

function scoreSilhouette(guessesUsed, solved, timeRemainingMs, totalMs) {
  if (!solved) return 0;
  if (guessesUsed > SCORING_GUESS_CAP) return 0;
  const base = 120; // harder mode, slightly higher base
  const efficiency = (SCORING_GUESS_CAP - guessesUsed) * 20; // 0..100
  const speed = Math.max(0, Math.floor(30 * (timeRemainingMs / totalMs)));
  return base + efficiency + speed;
}

function scoreSpell(hintsUsed, solved, timeRemainingMs, totalMs) {
  if (!solved) return 0;
  const base = 100;
  const efficiency = (3 - hintsUsed) * 25; // 3 hint tiers; fewer used = more points
  const speed = Math.max(0, Math.floor(30 * (timeRemainingMs / totalMs)));
  return base + efficiency + speed;
}

function scoreGridCell(matchingPlayersCount) {
  if (matchingPlayersCount === 0) return 0;
  return Math.round(100 / matchingPlayersCount);
}

// ---------- Color comparison logic for Classic --------------------------------

function compareAttribute(attr, guessValue, targetValue) {
  if (attr.kind === 'single') {
    if (guessValue === null && targetValue === null) return 'green';
    if (guessValue === null || targetValue === null) return 'red';
    return guessValue === targetValue ? 'green' : 'red';
  }
  // multi-value
  const g = new Set(guessValue || []);
  const t = new Set(targetValue || []);
  if (g.size === 0 && t.size === 0) return 'green';
  const intersection = [...g].filter(x => t.has(x));
  if (intersection.length === 0) return 'red';
  // green if sets are identical, yellow if non-empty overlap but not identical
  if (g.size === t.size && intersection.length === g.size) return 'green';
  return 'yellow';
}

function buildFeedbackRow(theme, guess, target) {
  const attrs = CLASSIC_ATTRIBUTES[theme];
  return attrs.map(attr => ({
    key: attr.key,
    label: attr.label,
    value: attr.value(guess),
    color: compareAttribute(attr, attr.value(guess), attr.value(target))
  }));
}

// ---------- Random helpers ---------------------------------------------------

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function answerPoolForClassic(roster, theme, difficulty) {
  // 'difficult' = full roster; 'medium' = tier1+tier2; 'easy' = tier1 only.
  if (difficulty === 'easy')   return roster.filter(e => e.iconicStatus === 'tier1');
  if (difficulty === 'medium') return roster.filter(e => e.iconicStatus === 'tier1' || e.iconicStatus === 'tier2');
  return roster; // 'difficult' default
}

// =============================================================================
//   ThemedDleGame class
// =============================================================================

export class ThemedDleGame {
  /**
   * @param {Object} gameState
   * @param {Object} io
   * @param {Object} gameEngine
   * @param {Object} opts - { theme: 'pokemon' | 'hp', mode: 'classic' | 'emoji' | 'silhouette' | 'spell' | 'grid', difficulty: 'easy'|'medium'|'difficult' }
   */
  constructor(gameState, io, gameEngine, opts = {}) {
    this.gameState = gameState;
    this.io = io;
    this.gameEngine = gameEngine;
    this.theme = opts.theme || 'pokemon';
    this.gameName = this.theme === 'pokemon' ? 'pokedle' : 'hpdle';
    this.pack = loadPack(this.theme);
    this.timer = null;
    this.pendingTimeouts = [];

    // Mode sequence — locked play order per game.
    // Emoji mode is disabled: the emoji puzzles in the data packs proved too inconsistent
    // to make for fair clues. Keep the engine support for it in case we revisit.
    this.modes = opts.modes || (
      this.theme === 'pokemon'
        ? ['classic', 'silhouette', 'grid']
        : ['classic', 'spell', 'grid']
    );
    this.currentModeIndex = 0;
    this.mode = this.modes[0];

    // Per-player cumulative score across all 4 modes of this game
    this.cumulativeScores = new Map(); // playerId -> total points

    // Per-player state for the CURRENT round (reset each mode)
    this.playerState = new Map();

    // Round-level state (reset each mode)
    this.target = null;
    this.targetName = null;
    this.emojiPuzzle = null;
    this.spell = null;
    this.grid = null;
    this.phaseStartAt = null;
    this.phaseEndsAt = null;

    // Initialize per-theme gameState slot
    this.gameState[this.gameName] = {
      phase: 'intro',
      mode: this.mode,
      theme: this.theme,
      modes: this.modes,
      currentModeIndex: 0,
      target: null,
      revealedTarget: null,
      phaseEndsAt: null,
      playerProgress: {},
      cumulativeScores: {}     // playerId -> total points
    };

    // Seed cumulative scores
    for (const [playerId] of this.gameState.players) {
      this.cumulativeScores.set(playerId, 0);
    }
  }

  // -------- Lifecycle --------

  start() {
    console.log(`[${this.gameName.toUpperCase()}] Starting — ${this.modes.length} modes: ${this.modes.join(' → ')}`);
    this._playCurrentMode();
  }

  _playCurrentMode() {
    this.mode = this.modes[this.currentModeIndex];
    this.gameState[this.gameName].mode = this.mode;
    this.gameState[this.gameName].currentModeIndex = this.currentModeIndex;

    console.log(`[${this.gameName}] === Mode ${this.currentModeIndex + 1}/${this.modes.length}: ${this.mode} ===`);

    // Reset round-level state
    this.target = null;
    this.targetName = null;
    this.emojiPuzzle = null;
    this.spell = null;
    this.grid = null;
    this.playerState.clear();

    // Setup based on mode
    switch (this.mode) {
      case 'classic':    this._setupClassic();    break;
      case 'emoji':      this._setupEmoji();      break;
      case 'silhouette': this._setupSilhouette(); break;
      case 'spell':      this._setupSpell();      break;
      case 'grid':       this._setupGrid();       break;
      default:
        console.error(`[${this.gameName}] Unknown mode: ${this.mode}`);
        return;
    }

    // Init player state for this round (preserving cumulative across)
    for (const [playerId] of this.gameState.players) {
      this._initPlayerState(playerId);
      if (!this.cumulativeScores.has(playerId)) {
        this.cumulativeScores.set(playerId, 0);
      }
    }

    this._showIntro();
  }

  _initPlayerState(playerId) {
    if (this.mode === 'grid') {
      this.playerState.set(playerId, {
        cellAnswers: {}, // "rowIdx,colIdx" -> name string or null
        usedNames: new Set()
      });
    } else {
      this.playerState.set(playerId, {
        guesses: [],
        solved: false,
        solvedAt: null,
        emojiRevealCount: 1,  // start with the hardest (cryptic) emoji, +1 per wrong guess up to 5
        hintsUsed: 0          // spell-mode hint tier
      });
    }
  }

  _showIntro() {
    this.gameState[this.gameName].phase = 'intro';
    this.phaseEndsAt = Date.now() + INTRO_DURATION;
    this.gameState[this.gameName].phaseEndsAt = this.phaseEndsAt;

    const introPayload = {
      theme: this.theme,
      mode: this.mode,
      difficulty: this.difficulty,
      duration: INTRO_DURATION,
      endsAt: this.phaseEndsAt,
      // mode-specific intro hint
      ...this._modePublicHint()
    };

    this.io.emit(`${this.gameName}:intro`, introPayload);
    console.log(`[${this.gameName}] Intro → playing in ${INTRO_DURATION}ms`);

    this.timer = new Timer(INTRO_DURATION, null, () => this._startPlaying());
    this.timer.start();
  }

  _startPlaying() {
    const phaseDuration = this._modeDuration();
    this.gameState[this.gameName].phase = 'playing';
    this.phaseStartAt = Date.now();
    this.phaseEndsAt = this.phaseStartAt + phaseDuration;
    this.gameState[this.gameName].phaseEndsAt = this.phaseEndsAt;

    const startPayload = {
      mode: this.mode,
      modeIndex: this.currentModeIndex,
      totalModes: this.modes.length,
      duration: phaseDuration,
      endsAt: this.phaseEndsAt,
      maxGuesses: this.mode === 'grid' ? null : (this.mode === 'spell' ? 5 : MAX_GUESSES),
      ...this._modePublicPrompt()
    };

    this.io.emit(`${this.gameName}:playing:start`, startPayload);
    console.log(`[${this.gameName}] Playing phase started`);

    this.timer = new Timer(phaseDuration, null, () => this._endRound());
    this.timer.start();
  }

  _endRound() {
    // End-of-mode: compute scores, accumulate, broadcast results, advance to next mode or end game.
    this.gameState[this.gameName].phase = 'results';
    this.gameState[this.gameName].revealedTarget = this._targetReveal();
    this.gameState[this.gameName].phaseEndsAt = Date.now() + RESULTS_DURATION;

    const isLastMode = this.currentModeIndex >= this.modes.length - 1;

    // Compute this mode's score per player, add to cumulative
    const playerResults = [];
    for (const [playerId, player] of this.gameState.players) {
      const ps = this.playerState.get(playerId);
      if (!ps) {
        // Player joined mid-game / wasn't initialized — count as 0 for this mode
        const cumul = this.cumulativeScores.get(playerId) || 0;
        playerResults.push({
          playerId,
          playerName: player.name,
          modeScore: 0,
          cumulativeScore: cumul
        });
        continue;
      }
      const modeScore = this._computeScore(ps);
      const cumul = (this.cumulativeScores.get(playerId) || 0) + modeScore;
      this.cumulativeScores.set(playerId, cumul);

      // player.score is the engine's per-game score → set to cumulative for placement calc
      player.score = cumul;

      playerResults.push({
        playerId,
        playerName: player.name,
        modeScore,
        cumulativeScore: cumul,
        ...this._playerSummary(ps)
      });
    }

    // Snapshot cumulative scores for clients
    this.gameState[this.gameName].cumulativeScores = Object.fromEntries(this.cumulativeScores);

    this.io.emit(`${this.gameName}:mode:results`, {
      mode: this.mode,
      modeIndex: this.currentModeIndex,
      totalModes: this.modes.length,
      target: this._targetReveal(),
      results: playerResults,
      cumulativeScores: this.gameState[this.gameName].cumulativeScores,
      isLastMode,
      duration: RESULTS_DURATION,
      endsAt: this.gameState[this.gameName].phaseEndsAt
    });

    console.log(`[${this.gameName}] Mode ${this.mode} ended. Last mode: ${isLastMode}`);
    this.gameEngine.broadcastPlayerList();

    this.timer = new Timer(RESULTS_DURATION, null, () => {
      if (isLastMode) {
        // All 4 modes done — finalize the game (engine assigns placement)
        console.log(`[${this.gameName}] All modes complete. Ending game.`);
        this.gameEngine.endGame();
      } else {
        // Move to next mode
        this.currentModeIndex++;
        this._playCurrentMode();
      }
    });
    this.timer.start();
  }

  // -------- Mode-specific setup --------

  _setupClassic() {
    const pool = answerPoolForClassic(this.pack.roster, this.theme, this.difficulty);
    this.target = pickRandom(pool);
    this.targetName = this.target.name;
    console.log(`[${this.gameName}/classic] Target: ${this.targetName}`);
  }

  _setupEmoji() {
    // Pick a random emoji puzzle, restricted to entries whose target exists in the roster
    const rosterByName = new Map(this.pack.roster.map(e => [e.name, e]));
    const playable = this.pack.emojiPuzzles.filter(p => rosterByName.has(p.name));
    this.emojiPuzzle = pickRandom(playable);
    this.target = rosterByName.get(this.emojiPuzzle.name);
    this.targetName = this.emojiPuzzle.name;
    console.log(`[${this.gameName}/emoji] Target: ${this.targetName}`);
  }

  _setupSilhouette() {
    // Pokédle only
    if (this.theme !== 'pokemon') {
      throw new Error('Silhouette mode is Pokédle-only');
    }
    // Random Pokémon with a spriteUrl
    const pool = answerPoolForClassic(this.pack.roster, this.theme, this.difficulty).filter(p => p.spriteUrl);
    this.target = pickRandom(pool);
    this.targetName = this.target.name;
    console.log(`[${this.gameName}/silhouette] Target: ${this.targetName}`);
  }

  _setupSpell() {
    // HP-dle only
    if (this.theme !== 'hp') {
      throw new Error('Spell mode is HP-dle-only');
    }
    this.spell = pickRandom(this.pack.spells);
    this.targetName = this.spell.incantation;
    console.log(`[${this.gameName}/spell] Target: ${this.targetName}`);
  }

  _setupGrid() {
    // Friend-night locked grid (Mode 4 v1). Future: a generator.
    this.grid = FRIEND_NIGHT_GRID[this.theme];
    this.targetName = null; // grid has no single answer
    console.log(`[${this.gameName}/grid] Using friend-night locked grid`);
  }

  // -------- Mode-specific public hints --------

  _modeDuration() {
    return {
      classic: CLASSIC_DURATION,
      emoji: EMOJI_DURATION,
      silhouette: SILHOUETTE_DURATION,
      spell: SPELL_DURATION,
      grid: GRID_DURATION
    }[this.mode];
  }

  _modePublicHint() {
    // Intro-screen content — never includes target identity
    switch (this.mode) {
      case 'classic':
        return {
          title: this.theme === 'pokemon' ? 'Pokédex Match' : 'Wizarding Match',
          description: 'Guess the hidden ' + (this.theme === 'pokemon' ? 'Pokémon' : 'character') + ' by their attributes.',
          maxGuesses: MAX_GUESSES,
          attributes: CLASSIC_ATTRIBUTES[this.theme].map(a => a.label)
        };
      case 'emoji':
        return {
          title: 'Emoji Puzzle',
          description: 'Guess from the emoji clues. Each wrong guess reveals one more.',
          maxGuesses: MAX_GUESSES
        };
      case 'silhouette':
        return {
          title: 'Silhouette',
          description: "Who's that Pokémon? Each wrong guess reveals more.",
          maxGuesses: MAX_GUESSES
        };
      case 'spell':
        return {
          title: 'Name That Spell',
          description: "From the effect, guess the incantation. Wrong guesses unlock hints.",
          maxGuesses: 5
        };
      case 'grid':
        return {
          title: '3×3 Grid',
          description: 'Fill each cell with a ' + (this.theme === 'pokemon' ? 'Pokémon' : 'character') + ' that matches both the row AND column. No repeats — rarer answers score higher.'
        };
    }
  }

  _modePublicPrompt() {
    // Sent at start-of-playing — the actual puzzle the player needs to see.
    switch (this.mode) {
      case 'classic':
        return { roster: this._publicRoster() };
      case 'emoji':
        return {
          emojis: this.emojiPuzzle.emojis.slice(0, 1), // start with 1 (the hardest)
          revealedCount: 1,
          roster: this._publicRoster()
        };
      case 'silhouette':
        return {
          spriteUrl: this.target.spriteUrl,
          revealStage: 0, // 0..5
          roster: this._publicRoster()
        };
      case 'spell':
        return {
          effect: this.spell.effect,
          category: this.spell.category,
          incantationLength: this.spell.incantation.length,
          spellList: this.pack.spells.map(s => s.incantation) // for autocomplete
        };
      case 'grid':
        return {
          rows: this.grid.rows.map(r => r.label),
          cols: this.grid.cols.map(c => c.label),
          roster: this._publicRoster()
        };
    }
  }

  _publicRoster() {
    // Slim roster for the autocomplete dropdown — names only, no spoilers
    return this.pack.roster.map(e => ({ name: e.name, aliases: e.aliases || [] }));
  }

  _targetReveal() {
    if (this.mode === 'grid') {
      // Reveal the grid breakdown: rows, cols, sample valid answers per cell
      const cellAnswers = {};
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const validMembers = this.pack.roster.filter(e =>
            this.grid.rows[r].test(e) && this.grid.cols[c].test(e)
          ).map(e => e.name);
          cellAnswers[`${r},${c}`] = validMembers;
        }
      }
      return { rows: this.grid.rows.map(r => r.label), cols: this.grid.cols.map(c => c.label), cellAnswers };
    }
    if (this.mode === 'spell') return { incantation: this.spell.incantation, effect: this.spell.effect, notableCaster: this.spell.notableCaster };
    if (this.mode === 'silhouette') return { name: this.target.name, spriteUrl: this.target.spriteUrl };
    return { name: this.targetName, attributes: this._publicTargetAttributes() };
  }

  _publicTargetAttributes() {
    if (this.mode === 'emoji') {
      return { emojis: this.emojiPuzzle.emojis };
    }
    if (!this.target) return {};
    return {
      ...(this.theme === 'pokemon' ? {
        types: this.target.types,
        color: this.target.color,
        habitat: this.target.habitat,
        spriteUrl: this.target.spriteUrl,
        evolutionStage: this.target.evolutionStage
      } : {
        house: this.target.house,
        bloodStatus: this.target.bloodStatus,
        species: this.target.species,
        affiliations: this.target.affiliations
      })
    };
  }

  // -------- Guess handling --------

  handleGuess(playerId, guess) {
    const ps = this.playerState.get(playerId);
    if (!ps) return;

    if (this.mode === 'grid') {
      return this._handleGridGuess(playerId, guess);
    }

    if (ps.solved) return; // already won

    const maxAttempts = this.mode === 'spell' ? 5 : MAX_GUESSES;
    if (ps.guesses.length >= maxAttempts) return; // out of guesses

    const guessName = String(guess?.name || '').trim();
    if (!guessName) return;

    // Resolve the guess to a roster entry (case-insensitive, also check aliases)
    const guessed = this.pack.roster.find(e =>
      e.name.toLowerCase() === guessName.toLowerCase() ||
      (e.aliases || []).some(a => a.toLowerCase() === guessName.toLowerCase())
    );

    if (!guessed) {
      // For spell mode, accept free-text since incantations are unique strings
      if (this.mode === 'spell') {
        return this._handleSpellGuess(playerId, ps, guessName);
      }
      // Invalid guess — let the client know but don't consume an attempt
      const socket = this._socketFor(playerId);
      if (socket) socket.emit(`${this.gameName}:guess:invalid`, { name: guessName });
      return;
    }

    const correct = guessed.name === this.targetName;

    // Build feedback based on mode
    let feedback = null;
    if (this.mode === 'classic') {
      feedback = buildFeedbackRow(this.theme, guessed, this.target);
    } else if (this.mode === 'emoji' || this.mode === 'silhouette') {
      feedback = correct ? 'correct' : 'wrong';
      if (!correct && this.mode === 'emoji') {
        ps.emojiRevealCount = Math.min(5, ps.emojiRevealCount + 1);
      }
    }

    ps.guesses.push({ name: guessed.name, feedback, at: Date.now(), correct });

    if (correct) {
      ps.solved = true;
      ps.solvedAt = Date.now();
    }

    const socket = this._socketFor(playerId);
    if (socket) {
      socket.emit(`${this.gameName}:guess:result`, {
        guess: guessed.name,
        correct,
        feedback,
        guessesUsed: ps.guesses.length,
        guessesRemaining: MAX_GUESSES - ps.guesses.length,
        solved: ps.solved,
        emojisRevealed: this.mode === 'emoji'
          ? this.emojiPuzzle.emojis.slice(0, ps.emojiRevealCount)
          : undefined,
        silhouetteStage: this.mode === 'silhouette' ? ps.guesses.length : undefined
      });
    }

    // Update host with progress (no name leak)
    this._broadcastProgress();

    // Early-end if everyone solved or used all guesses
    this._checkRoundComplete();
  }

  _handleSpellGuess(playerId, ps, guessName) {
    // Normalize spell incantation guesses
    const normalize = s => s.toLowerCase().replace(/[^a-z]/g, '');
    const target = normalize(this.spell.incantation);
    const guess = normalize(guessName);
    const correct = guess === target;

    ps.guesses.push({ name: guessName, correct, at: Date.now() });
    if (correct) {
      ps.solved = true;
      ps.solvedAt = Date.now();
    } else {
      ps.hintsUsed = Math.min(3, ps.hintsUsed + 1);
    }

    const socket = this._socketFor(playerId);
    if (socket) {
      socket.emit(`${this.gameName}:guess:result`, {
        guess: guessName,
        correct,
        guessesUsed: ps.guesses.length,
        guessesRemaining: 5 - ps.guesses.length,
        solved: ps.solved,
        hint: !correct ? this._spellHintFor(ps.hintsUsed) : null
      });
    }

    this._broadcastProgress();
    this._checkRoundComplete();
  }

  _spellHintFor(tier) {
    // tier 1: when used; tier 2: who; tier 3: first+last letter
    switch (tier) {
      case 1: return { type: 'whenUsed', text: `Book ${this.spell.firstAppearance.book}: ${this.spell.firstAppearance.scene}` };
      case 2: return { type: 'caster',    text: this.spell.notableCaster };
      case 3: return { type: 'letters',   text: `${this.spell.firstLetter} … ${this.spell.lastLetter}` };
      default: return null;
    }
  }

  _handleGridGuess(playerId, { row, col, name }) {
    const ps = this.playerState.get(playerId);
    if (!ps) return;
    const key = `${row},${col}`;
    // Already used this name elsewhere?
    if (ps.usedNames.has(name) && ps.cellAnswers[key] !== name) {
      const socket = this._socketFor(playerId);
      if (socket) socket.emit(`${this.gameName}:guess:invalid`, { reason: 'duplicate', name });
      return;
    }
    // Validate name in roster
    const entry = this.pack.roster.find(e =>
      e.name.toLowerCase() === String(name).toLowerCase() ||
      (e.aliases || []).some(a => a.toLowerCase() === String(name).toLowerCase())
    );
    if (!entry) {
      const socket = this._socketFor(playerId);
      if (socket) socket.emit(`${this.gameName}:guess:invalid`, { reason: 'unknown', name });
      return;
    }
    // Check both constraints
    const rowDef = this.grid.rows[row];
    const colDef = this.grid.cols[col];
    if (!rowDef || !colDef) return;
    const fits = rowDef.test(entry) && colDef.test(entry);

    // If overwriting a previous answer in this cell, free its name from usedNames
    const prevName = ps.cellAnswers[key];
    if (prevName) ps.usedNames.delete(prevName);

    ps.cellAnswers[key] = fits ? entry.name : null;
    if (fits) ps.usedNames.add(entry.name);

    const socket = this._socketFor(playerId);
    if (socket) {
      socket.emit(`${this.gameName}:grid:cell:result`, {
        row, col,
        name: entry.name,
        valid: fits,
        cellAnswers: ps.cellAnswers
      });
    }
    this._broadcastProgress();
    // E7: auto-advance the round the moment every connected player has all
    // 9 cells filled with a valid placement — no point burning the rest of
    // the clock if everyone's done.
    this._checkGridAllSolved();
  }

  _checkGridAllSolved() {
    if (this.mode !== 'grid') return;
    const everyone = [...this.gameState.players.keys()];
    if (everyone.length === 0) return;
    const allFilled = everyone.every((pid) => {
      const ps = this.playerState.get(pid);
      if (!ps) return false;
      const validCells = Object.values(ps.cellAnswers || {}).filter((n) => !!n).length;
      return validCells >= 9;
    });
    if (allFilled) {
      console.log(`[${this.gameName}/grid] All players filled 9 cells — ending round early`);
      if (this.timer) { this.timer.stop(); this.timer = null; }
      this._endRound();
    }
  }

  _checkRoundComplete() {
    if (this.mode === 'grid') {
      // Grid runs to time. No early-end.
      return;
    }
    const everyone = [...this.gameState.players.keys()];
    if (everyone.length === 0) return;
    const allDone = everyone.every(pid => {
      const ps = this.playerState.get(pid);
      if (!ps) return true;
      const maxG = this.mode === 'spell' ? 5 : MAX_GUESSES;
      return ps.solved || ps.guesses.length >= maxG;
    });
    if (allDone) {
      if (this.timer) { this.timer.stop(); this.timer = null; }
      this._endRound();
    }
  }

  _broadcastProgress() {
    // Host display gets per-player progress, no names of targets
    const playerProgress = {};
    for (const [pid, ps] of this.playerState) {
      if (this.mode === 'grid') {
        playerProgress[pid] = {
          filledCells: Object.values(ps.cellAnswers || {}).filter(n => n).length
        };
      } else {
        playerProgress[pid] = {
          guessCount: ps.guesses.length,
          solved: ps.solved
        };
      }
    }
    this.gameState[this.gameName].playerProgress = playerProgress;
    this.io.emit(`${this.gameName}:progress`, { playerProgress });
  }

  _computeScore(ps) {
    const totalMs = this._modeDuration();
    const timeRemainingMs = Math.max(0, this.phaseEndsAt - (ps.solvedAt || Date.now()));
    switch (this.mode) {
      case 'classic':
        return scoreClassic(ps.guesses.length, ps.solved, timeRemainingMs, totalMs);
      case 'emoji':
        return scoreEmoji(ps.emojiRevealCount, ps.solved, timeRemainingMs, totalMs);
      case 'silhouette':
        return scoreSilhouette(ps.guesses.length, ps.solved, timeRemainingMs, totalMs);
      case 'spell':
        return scoreSpell(ps.hintsUsed, ps.solved, timeRemainingMs, totalMs);
      case 'grid':
        return this._scoreGrid(ps);
    }
    return 0;
  }

  _scoreGrid(ps) {
    let total = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const key = `${r},${c}`;
        const name = ps.cellAnswers[key];
        if (!name) continue;
        // How many other players also said this same name for this same cell?
        let matchCount = 0;
        for (const [, otherPs] of this.playerState) {
          if (otherPs.cellAnswers[key] === name) matchCount++;
        }
        total += scoreGridCell(matchCount);
      }
    }
    return total;
  }

  _playerSummary(ps) {
    if (this.mode === 'grid') {
      return {
        filledCells: Object.values(ps.cellAnswers || {}).filter(n => n).length,
        cellAnswers: ps.cellAnswers
      };
    }
    return {
      guesses: ps.guesses,
      solved: ps.solved
    };
  }

  _socketFor(playerId) {
    const player = this.gameState.players.get(playerId);
    if (!player) return null;
    return this.io.sockets.sockets.get(player.socketId);
  }

  // -------- Lifecycle hooks --------

  pause()  { if (this.timer) this.timer.pause(); }
  resume() { if (this.timer) this.timer.resume(); }
  skip() {
    if (this.timer) {
      this.timer.stop();
      if (this.timer.onComplete) this.timer.onComplete();
    }
  }

  cleanup() {
    console.log(`[${this.gameName}] Cleaning up`);
    if (this.timer) { this.timer.stop(); this.timer = null; }
    this.pendingTimeouts.forEach(clearTimeout);
    this.pendingTimeouts = [];
    this.playerState.clear();
  }

  getState() {
    const s = this.gameState[this.gameName];
    return {
      phase: s?.phase || 'intro',
      mode: this.mode,
      theme: this.theme,
      difficulty: this.difficulty,
      phaseEndsAt: this.phaseEndsAt,
      playerProgress: s?.playerProgress || {}
    };
  }

  /**
   * Per bug-report 2026-05-14 §A5: replay the events the host display needs
   * for the current mode/phase. The host gets the target name when it's safe
   * for them to know (i.e. when the secret is gameplay-relevant for the host
   * tracker overlay). Players never get the target identity here — they
   * receive only the same publicly-known prompt fields that everyone got at
   * round-start.
   */
  getResyncEvents({ isHost = false } = {}) {
    const events = [];
    const s = this.gameState[this.gameName];
    if (!s) return events;

    if (s.phase === 'intro') {
      events.push({
        name: `${this.gameName}:intro`,
        payload: {
          theme: this.theme,
          mode: this.mode,
          difficulty: this.difficulty,
          duration: Math.max(0, (this.phaseEndsAt || Date.now()) - Date.now()),
          endsAt: this.phaseEndsAt,
          ...this._modePublicHint()
        }
      });
    } else if (s.phase === 'playing') {
      const playingStart = {
        mode: this.mode,
        modeIndex: this.currentModeIndex,
        totalModes: this.modes.length,
        duration: Math.max(0, (this.phaseEndsAt || Date.now()) - Date.now()),
        endsAt: this.phaseEndsAt,
        maxGuesses: this.mode === 'grid' ? null : (this.mode === 'spell' ? 5 : MAX_GUESSES),
        ...this._modePublicPrompt()
      };
      events.push({
        name: `${this.gameName}:playing:start`,
        payload: playingStart
      });
      // Rebroadcast per-player progress so a host tracker repaints immediately.
      events.push({
        name: `${this.gameName}:progress`,
        payload: { playerProgress: s.playerProgress || {} }
      });
      // For the HOST only, also include the target identity so the host display
      // can render any "answer banner" UI (mirroring the wordle host-only
      // round:start:host event). Players never receive this.
      if (isHost && this.targetName) {
        events.push({
          name: `${this.gameName}:playing:start:host`,
          payload: {
            target: this._targetReveal(),
            mode: this.mode,
            modeIndex: this.currentModeIndex
          }
        });
      }
    } else if (s.phase === 'results' && s.revealedTarget) {
      // Re-emit mode results so the host display lands on the right screen.
      // playerResults can't be reconstructed perfectly post-hoc, but the
      // cumulativeScores + target are enough to repaint the results panel.
      events.push({
        name: `${this.gameName}:mode:results`,
        payload: {
          mode: this.mode,
          modeIndex: this.currentModeIndex,
          totalModes: this.modes.length,
          target: s.revealedTarget,
          results: [], // playerResults not retained across the timer window
          cumulativeScores: s.cumulativeScores || {},
          isLastMode: this.currentModeIndex >= this.modes.length - 1,
          duration: Math.max(0, (s.phaseEndsAt || Date.now()) - Date.now()),
          endsAt: s.phaseEndsAt
        }
      });
    }
    return events;
  }
}
