import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const pokemon = JSON.parse(readFileSync(resolve(repoRoot, 'packages/server/src/data/pokedle/pokemon.json'), 'utf8'));
const hp = JSON.parse(readFileSync(resolve(repoRoot, 'packages/server/src/data/hpdle/characters.json'), 'utf8'));

const isStaff = c => (c.roles || []).some(r => /teacher|headmaster|professor|head of house|staff/i.test(r));

// Gen 1 Gym Leader Pokémon (Red/Blue canonical rosters)
// Brock, Misty, Lt. Surge, Erika, Koga, Sabrina, Blaine, Giovanni
const gymLeaderPokemon = new Set([
  'Geodude', 'Onix',                                          // Brock
  'Staryu', 'Starmie',                                        // Misty
  'Voltorb', 'Pikachu', 'Raichu',                             // Lt. Surge
  'Victreebel', 'Tangela', 'Vileplume',                       // Erika
  'Koffing', 'Muk', 'Weezing',                                // Koga
  'Abra', 'Kadabra', 'Alakazam', 'Mr. Mime', 'Venomoth',     // Sabrina
  'Growlithe', 'Ponyta', 'Rapidash', 'Arcanine',              // Blaine
  'Rhyhorn', 'Dugtrio', 'Nidoqueen', 'Nidoking', 'Rhydon', 'Persian'  // Giovanni
]);
const isGymLeader = p => gymLeaderPokemon.has(p.name);
const isOrder = c => (c.affiliations || []).some(a => /order of the phoenix/i.test(a));
const isDE = c => ['yes', 'former', 'leader'].includes(c.deathEaterStatus);
const isStudent = c => (c.roles || []).includes('Student');
const isQuidditch = c => c.playedQuidditch === true;

function evalGrid(name, items, rows, cols, nameKey) {
  console.log(`\n=== ${name} ===`);
  const header = ['', ...Object.keys(cols)].map(s => s.padEnd(28)).join('');
  console.log(header);
  for (const [rowName, rowFn] of Object.entries(rows)) {
    let line = rowName.padEnd(28);
    for (const [, colFn] of Object.entries(cols)) {
      const matches = items.filter(x => rowFn(x) && colFn(x));
      line += `${String(matches.length).padStart(3)} (${matches.slice(0,3).map(x => x[nameKey]).join(', ')})`.padEnd(28);
    }
    console.log(line);
  }
  console.log('\nDetailed cell listings:');
  for (const [rowName, rowFn] of Object.entries(rows)) {
    for (const [colName, colFn] of Object.entries(cols)) {
      const matches = items.filter(x => rowFn(x) && colFn(x));
      console.log(`  ${rowName} × ${colName} (${matches.length}): ${matches.map(x => x[nameKey]).join(', ')}`);
    }
  }
}

evalGrid(
  'HP Grid A — House × Affiliation',
  hp,
  {
    'Gryffindor': c => c.house === 'Gryffindor',
    'Slytherin':  c => c.house === 'Slytherin',
    'Female':     c => c.gender === 'F'
  },
  {
    'Order member':    isOrder,
    'Hogwarts staff':  isStaff,
    'Death Eater':     isDE
  },
  'name'
);

evalGrid(
  'HP Grid B — Mixed traits',
  hp,
  {
    'Pure-blood': c => c.bloodStatus === 'Pure-blood',
    'Half-blood': c => c.bloodStatus === 'Half-blood',
    'Female':     c => c.gender === 'F'
  },
  {
    'Played Quidditch': isQuidditch,
    'Has died':         c => c.diedInCanon === true,
    'Gryffindor':       c => c.house === 'Gryffindor'
  },
  'name'
);

evalGrid(
  'Pokémon Grid A — Stage × Type',
  pokemon,
  {
    'Single-stage':    p => p.evolutionStage === 'Single-stage',
    'Final evolution': p => p.evolutionStage === 'Final',
    'Base stage':      p => p.evolutionStage === 'Base'
  },
  {
    'Fire-type':    p => p.types.includes('Fire'),
    'Water-type':   p => p.types.includes('Water'),
    'Psychic-type': p => p.types.includes('Psychic')
  },
  'name'
);

// REPLACING "Has secondary type" — test concrete column candidates with the locked rows.
const lockedRows = {
  'Fire-type':    p => p.types.includes('Fire'),
  'Color: Pink':  p => p.color === 'Pink',
  'Cave habitat': p => p.habitat === 'Cave'
};
const lockedTwoCols = {
  'Used by a Gym Leader': isGymLeader,
  'Final evolution':      p => p.evolutionStage === 'Final'
};

evalGrid('Pokémon SWAP A — third col = Evolves by stone',
  pokemon, lockedRows,
  { ...lockedTwoCols, 'Evolves by stone': p => p.evolutionStone !== null || p.evolvesByMethod === 'use-item' },
  'name');

evalGrid('Pokémon SWAP B — third col = 3-stage evolution family',
  pokemon, lockedRows,
  { ...lockedTwoCols, 'From a 3-stage family': p => p.evolutionFamilySize === 3 },
  'name');

evalGrid('Pokémon SWAP C — third col = Genderless',
  pokemon, lockedRows,
  { ...lockedTwoCols, 'Genderless': p => p.genderRatio === 'Genderless' },
  'name');

evalGrid('Pokémon SWAP D — third col = Quadruped body shape',
  pokemon, lockedRows,
  { ...lockedTwoCols, 'Quadruped body': p => p.shape === 'quadruped' },
  'name');

evalGrid('Pokémon SWAP E — third col = Bipedal body shape',
  pokemon, lockedRows,
  { ...lockedTwoCols, 'Bipedal body': p => /bipedal|humanoid/.test(p.shape || '') },
  'name');

evalGrid('Pokémon SWAP F — third col = Has a pre-evolution (Mid or Final)',
  pokemon, lockedRows,
  { ...lockedTwoCols, 'Has a pre-evolution': p => p.evolutionStage === 'Mid' || p.evolutionStage === 'Final' },
  'name');

evalGrid('Pokémon SWAP G — third col = Color: Yellow',
  pokemon, lockedRows,
  { ...lockedTwoCols, 'Color: Yellow': p => p.color === 'Yellow' },
  'name');

// Ash's roster from the original Indigo League / Orange Islands anime (Gen 1 species)
const ashPokemon = new Set([
  'Pikachu',
  'Caterpie', 'Metapod', 'Butterfree',
  'Pidgeotto', 'Pidgeot',
  'Bulbasaur',
  'Charmander', 'Charmeleon', 'Charizard',
  'Squirtle',
  'Krabby', 'Kingler',
  'Mankey', 'Primeape',
  'Muk',
  'Tauros',
  'Snorlax',
  'Lapras'
]);
const isAsh = p => ashPokemon.has(p.name);

// Broader: main anime cast in the original Indigo League era — Ash + Misty + Brock + Team Rocket
const mainCastPokemon = new Set([
  ...ashPokemon,
  // Misty
  'Staryu', 'Starmie', 'Psyduck', 'Goldeen', 'Horsea',
  // Brock
  'Geodude', 'Onix', 'Vulpix', 'Zubat',
  // Team Rocket (Jessie/James/Meowth)
  'Meowth', 'Ekans', 'Arbok', 'Koffing', 'Weezing', 'Lickitung', 'Victreebel'
]);
const isMainCast = p => mainCastPokemon.has(p.name);

evalGrid("Pokémon SWAP H — third col = Owned by Ash (Gen 1 anime)",
  pokemon, lockedRows,
  { ...lockedTwoCols, "Owned by Ash": isAsh },
  'name');

evalGrid("Pokémon SWAP I — third col = Owned by main anime cast",
  pokemon, lockedRows,
  { ...lockedTwoCols, "Owned by main anime cast": isMainCast },
  'name');

evalGrid(
  'Pokémon VARIED A — Type / Color / Stage × Lore / Habitat / Structural',
  pokemon,
  {
    'Fire-type':       p => p.types.includes('Fire'),
    'Color: Purple':   p => p.color === 'Purple',
    'Final evolution': p => p.evolutionStage === 'Final'
  },
  {
    'Used by a Gym Leader': isGymLeader,
    'Mountain habitat':     p => p.habitat === 'Mountain',
    'Has secondary type':   p => p.hasSecondaryType === true
  },
  'name'
);

evalGrid(
  'Pokémon VARIED B — Type / Color / Stage × Lore / Habitat / Structural (alt)',
  pokemon,
  {
    'Bug-type':        p => p.types.includes('Bug'),
    'Color: Pink':     p => p.color === 'Pink',
    'Final evolution': p => p.evolutionStage === 'Final'
  },
  {
    'Used by a Gym Leader': isGymLeader,
    'Cave habitat':         p => p.habitat === 'Cave',
    'Has secondary type':   p => p.hasSecondaryType === true
  },
  'name'
);

evalGrid(
  'Pokémon VARIED C — Type / Color / Stage × Lore / Habitat / Color',
  pokemon,
  {
    'Water-type':      p => p.types.includes('Water'),
    'Color: Yellow':   p => p.color === 'Yellow',
    'Single-stage':    p => p.evolutionStage === 'Single-stage'
  },
  {
    'Used by a Gym Leader': isGymLeader,
    'Forest habitat':       p => p.habitat === 'Forest',
    'Has secondary type':   p => p.hasSecondaryType === true
  },
  'name'
);

evalGrid(
  'Pokémon VARIED D — Type / Stage / Lore × Color / Habitat / Structural',
  pokemon,
  {
    'Grass-type':      p => p.types.includes('Grass'),
    'Final evolution': p => p.evolutionStage === 'Final',
    'Single-stage':    p => p.evolutionStage === 'Single-stage'
  },
  {
    'Used by a Gym Leader': isGymLeader,
    'Mountain habitat':     p => p.habitat === 'Mountain',
    'Color: Purple':        p => p.color === 'Purple'
  },
  'name'
);

evalGrid(
  'Pokémon VARIED E — Type / Color / Habitat × Lore / Stage / Structural',
  pokemon,
  {
    'Fire-type':         p => p.types.includes('Fire'),
    'Color: Pink':       p => p.color === 'Pink',
    'Cave habitat':      p => p.habitat === 'Cave'
  },
  {
    'Used by a Gym Leader': isGymLeader,
    'Final evolution':      p => p.evolutionStage === 'Final',
    'Has secondary type':   p => p.hasSecondaryType === true
  },
  'name'
);

evalGrid(
  'Pokémon SPICE 1 — Type rows × Stat/Lore/Color cols',
  pokemon,
  {
    'Water-type':    p => p.types.includes('Water'),
    'Grass-type':    p => p.types.includes('Grass'),
    'Electric-type': p => p.types.includes('Electric')
  },
  {
    'Used by a Gym Leader': isGymLeader,
    'Has BST 450+':         p => p.bstBucket === 'High' || p.bstBucket === 'Very high',
    'Color: Yellow':        p => p.color === 'Yellow'
  },
  'name'
);

evalGrid(
  'Pokémon SPICE 2 — Color rows × Type/Lore/Stage cols',
  pokemon,
  {
    'Color: Yellow': p => p.color === 'Yellow',
    'Color: Brown':  p => p.color === 'Brown',
    'Color: Pink':   p => p.color === 'Pink'
  },
  {
    'Fire-type':            p => p.types.includes('Fire'),
    'Used by a Gym Leader': isGymLeader,
    'Single-stage':         p => p.evolutionStage === 'Single-stage'
  },
  'name'
);

evalGrid(
  'Pokémon SPICE 3 — Iconic-category rows × Stat/Lore/Type cols',
  pokemon,
  {
    'Starter line': p => ['Bulbasaur','Ivysaur','Venusaur','Charmander','Charmeleon','Charizard','Squirtle','Wartortle','Blastoise'].includes(p.name),
    'Fossil':       p => p.isFossil === true,
    'Legendary or Mythical': p => p.isLegendary === true || p.isMythical === true
  },
  {
    'Used by a Gym Leader': isGymLeader,
    'Has secondary type':   p => p.hasSecondaryType === true,
    'Has BST 450+':         p => p.bstBucket === 'High' || p.bstBucket === 'Very high'
  },
  'name'
);

evalGrid(
  'Pokémon SPICE 4 — Fully mixed: every cell a different axis',
  pokemon,
  {
    'Has BST 450+': p => p.bstBucket === 'High' || p.bstBucket === 'Very high',
    'Color: Purple': p => p.color === 'Purple',
    'Bug-type':     p => p.types.includes('Bug')
  },
  {
    'Used by a Gym Leader': isGymLeader,
    'Single-stage':         p => p.evolutionStage === 'Single-stage',
    'Has secondary type':   p => p.hasSecondaryType === true
  },
  'name'
);

evalGrid(
  'Pokémon SPICE 5 — Stage × Type × Lore + Color',
  pokemon,
  {
    'Final evolution': p => p.evolutionStage === 'Final',
    'Color: Pink':     p => p.color === 'Pink',
    'Bug-type':        p => p.types.includes('Bug')
  },
  {
    'Used by a Gym Leader':    isGymLeader,
    'Fire-type':               p => p.types.includes('Fire'),
    'Cave or Mountain habitat': p => p.habitat === 'Cave' || p.habitat === 'Mountain'
  },
  'name'
);

evalGrid(
  'Pokémon GYM — Habitat × Trait × Gym Leader',
  pokemon,
  {
    'Cave habitat':     p => p.habitat === 'Cave',
    'Mountain habitat': p => p.habitat === 'Mountain',
    'Sea habitat':      p => p.habitat === 'Sea'
  },
  {
    'Has secondary type':       p => p.hasSecondaryType === true,
    'Final evolution':          p => p.evolutionStage === 'Final',
    "Used by a Gym Leader":     isGymLeader
  },
  'name'
);

evalGrid(
  'Pokémon GYM B — Stage × Type × Gym Leader',
  pokemon,
  {
    'Single-stage':    p => p.evolutionStage === 'Single-stage',
    'Final evolution': p => p.evolutionStage === 'Final',
    'Has secondary type': p => p.hasSecondaryType === true
  },
  {
    'Fire-type':            p => p.types.includes('Fire'),
    'Psychic-type':         p => p.types.includes('Psychic'),
    "Used by a Gym Leader": isGymLeader
  },
  'name'
);

evalGrid(
  'Pokémon GYM C — Color × Stage × Gym Leader',
  pokemon,
  {
    'Color: Purple':    p => p.color === 'Purple',
    'Color: Yellow':    p => p.color === 'Yellow',
    'Color: Brown':     p => p.color === 'Brown'
  },
  {
    'Final evolution':    p => p.evolutionStage === 'Final',
    'Single-stage':       p => p.evolutionStage === 'Single-stage',
    "Used by a Gym Leader": isGymLeader
  },
  'name'
);

evalGrid(
  'Pokémon Hard A — Habitat × Trait',
  pokemon,
  {
    'Cave habitat':     p => p.habitat === 'Cave',
    'Mountain habitat': p => p.habitat === 'Mountain',
    'Sea habitat':      p => p.habitat === 'Sea'
  },
  {
    'Has secondary type': p => p.hasSecondaryType === true,
    'Final evolution':    p => p.evolutionStage === 'Final',
    'Single-stage':       p => p.evolutionStage === 'Single-stage'
  },
  'name'
);

evalGrid(
  'Pokémon Hard B — Type × Stage with rare types',
  pokemon,
  {
    'Ground-type':   p => p.types.includes('Ground'),
    'Rock-type':     p => p.types.includes('Rock'),
    'Fighting-type': p => p.types.includes('Fighting')
  },
  {
    'Final evolution':    p => p.evolutionStage === 'Final',
    'Base stage':         p => p.evolutionStage === 'Base',
    'Has secondary type': p => p.hasSecondaryType === true
  },
  'name'
);

evalGrid(
  'Pokémon Hard C — Stone × Color × Final',
  pokemon,
  {
    'Evolves by stone': p => p.evolvesByMethod === 'use-item' || p.evolutionStone !== null,
    'Color: Brown':     p => p.color === 'Brown',
    'Color: Purple':    p => p.color === 'Purple'
  },
  {
    'Final evolution':    p => p.evolutionStage === 'Final',
    'Base stage':         p => p.evolutionStage === 'Base',
    'Has secondary type': p => p.hasSecondaryType === true
  },
  'name'
);

evalGrid(
  'Pokémon Hard D — Mixed obscure attributes',
  pokemon,
  {
    'Single-stage':       p => p.evolutionStage === 'Single-stage',
    'Has secondary type': p => p.hasSecondaryType === true,
    'Genderless':         p => p.genderRatio === 'Genderless'
  },
  {
    'Cave habitat':     p => p.habitat === 'Cave',
    'Mountain habitat': p => p.habitat === 'Mountain',
    'BST 450+ (High/Very high)': p => p.bstBucket === 'High' || p.bstBucket === 'Very high'
  },
  'name'
);
