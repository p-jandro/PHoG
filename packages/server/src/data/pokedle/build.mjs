// Builds pokemon.json for Gen 1 (151 Pokémon) from PokeAPI.
// Run: node build.mjs
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'pokemon.json');

const BASE = 'https://pokeapi.co/api/v2';

// -------- Manual / curated tables (Gen 1 facts not trivially in PokeAPI) --------

// Iconic status — judgment call per spec.
// tier1: anime-famous / on every box-art reference (~25)
// tier2: well-known to any RBY player
// tier3: deeper cuts
const ICONIC = {
  // ---- tier1 ----
  1: 'tier1',  // Bulbasaur (starter, Ash's)
  4: 'tier1',  // Charmander (starter, Ash's)
  6: 'tier1',  // Charizard (mascot tier)
  7: 'tier1',  // Squirtle (starter, Ash's)
  9: 'tier1',  // Blastoise (Blue box art)
  25: 'tier1', // Pikachu (mascot)
  39: 'tier1', // Jigglypuff (anime icon)
  52: 'tier1', // Meowth (Team Rocket)
  54: 'tier1', // Psyduck (anime icon)
  94: 'tier1', // Gengar
  131: 'tier1', // Lapras
  132: 'tier1', // Ditto
  133: 'tier1', // Eevee
  143: 'tier1', // Snorlax
  144: 'tier1', // Articuno (legendary bird)
  145: 'tier1', // Zapdos
  146: 'tier1', // Moltres
  149: 'tier1', // Dragonite
  150: 'tier1', // Mewtwo
  151: 'tier1', // Mew

  // ---- tier2 ----
  3: 'tier2',   // Venusaur
  8: 'tier2',   // Wartortle
  10: 'tier2',  // Caterpie
  12: 'tier2',  // Butterfree (Ash's)
  16: 'tier2',  // Pidgey
  18: 'tier2',  // Pidgeot
  19: 'tier2',  // Rattata
  21: 'tier2',  // Spearow
  23: 'tier2',  // Ekans (Jessie's)
  24: 'tier2',  // Arbok
  26: 'tier2',  // Raichu
  27: 'tier2',  // Sandshrew
  29: 'tier2',  // Nidoran-F
  32: 'tier2',  // Nidoran-M
  35: 'tier2',  // Clefairy
  37: 'tier2',  // Vulpix
  41: 'tier2',  // Zubat
  43: 'tier2',  // Oddish
  50: 'tier2',  // Diglett
  56: 'tier2',  // Mankey
  58: 'tier2',  // Growlithe
  60: 'tier2',  // Poliwag
  63: 'tier2',  // Abra
  66: 'tier2',  // Machop
  68: 'tier2',  // Machamp
  74: 'tier2',  // Geodude
  76: 'tier2',  // Golem
  79: 'tier2',  // Slowpoke
  81: 'tier2',  // Magnemite
  88: 'tier2',  // Grimer
  90: 'tier2',  // Shellder
  92: 'tier2',  // Gastly (Haunter)
  93: 'tier2',  // Haunter
  95: 'tier2',  // Onix (Brock's)
  98: 'tier2',  // Krabby
  100: 'tier2', // Voltorb
  104: 'tier2', // Cubone
  113: 'tier2', // Chansey
  115: 'tier2', // Kangaskhan
  116: 'tier2', // Horsea
  120: 'tier2', // Staryu (Misty's)
  121: 'tier2', // Starmie
  122: 'tier2', // Mr. Mime
  123: 'tier2', // Scyther
  124: 'tier2', // Jynx
  125: 'tier2', // Electabuzz
  126: 'tier2', // Magmar
  127: 'tier2', // Pinsir
  128: 'tier2', // Tauros
  129: 'tier2', // Magikarp
  130: 'tier2', // Gyarados
  134: 'tier2', // Vaporeon
  135: 'tier2', // Jolteon
  136: 'tier2', // Flareon
  137: 'tier2', // Porygon
  138: 'tier2', // Omanyte (fossil)
  140: 'tier2', // Kabuto (fossil)
  142: 'tier2', // Aerodactyl
  147: 'tier2', // Dratini
  148: 'tier2', // Dragonair
};

// Starters (incl. evolutions)
const STARTERS = new Set([1,2,3,4,5,6,7,8,9]);

// Fossils
const FOSSILS = new Set([138,139,140,141,142]);

// Signature moves (Gen 1; canonical / well-known)
const SIGNATURE = {
  150: 'Psychic', // Mewtwo has Psystrike in later gens; in Gen 1 no true sig — leave null
  151: 'Pound',
  // Realistically Gen 1 didn't formalize "signature" moves the way later gens did.
  // We'll only record moves the species line is famous for / first learned uniquely.
};

// -------- Helpers --------

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}

function bucketHeight(m) {
  if (m < 0.5) return 'Tiny';
  if (m < 1.0) return 'Small';
  if (m < 1.5) return 'Medium';
  if (m < 2.5) return 'Large';
  return 'Huge';
}
function bucketWeight(kg) {
  if (kg < 10) return 'Very light';
  if (kg < 30) return 'Light';
  if (kg < 100) return 'Medium';
  if (kg < 500) return 'Heavy';
  return 'Very heavy';
}
function bucketBst(bst) {
  if (bst < 350) return 'Low';
  if (bst < 450) return 'Mid';
  if (bst < 550) return 'High';
  return 'Very high';
}
function bucketCapture(cr) {
  // PokeAPI capture_rate: 0–255. spec: Easy >150, Medium 50-150, Hard 5-50, Very hard <=5.
  if (cr > 150) return 'Easy';
  if (cr >= 50) return 'Medium';
  if (cr > 5) return 'Hard';
  return 'Very hard';
}
function genderFromRate(r) {
  if (r === -1) return 'Genderless';
  if (r === 0) return 'Male-only';
  if (r === 8) return 'Female-only';
  return 'Mixed';
}
function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
function titleCaseHyphenated(s) {
  if (!s) return s;
  return s.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

// Gen 1 has a handful of names whose canonical display differs from the
// PokeAPI slug. Use the official Pokémon-brand spellings.
const NAME_OVERRIDES = {
  'nidoran-f': 'Nidoran♀',
  'nidoran-m': 'Nidoran♂',
  'mr-mime': 'Mr. Mime',
  'farfetchd': "Farfetch'd",
};
function displayName(slug) {
  if (NAME_OVERRIDES[slug]) return NAME_OVERRIDES[slug];
  return titleCaseHyphenated(slug);
}
const STAT_LABELS = {
  hp: 'HP', attack: 'Attack', defense: 'Defense',
  'special-attack': 'Sp.Attack', 'special-defense': 'Sp.Defense', speed: 'Speed',
};
function pickHighestStat(stats) {
  // stats: array { stat: { name }, base_stat }
  let max = -1;
  for (const s of stats) if (s.base_stat > max) max = s.base_stat;
  const winners = stats.filter(s => s.base_stat === max).map(s => STAT_LABELS[s.stat.name]);
  return winners;
}

// Map species-name -> National Dex id (Gen 1 only). Built lazily from a name lookup.
// We'll pass an explicit "is Gen 1" predicate built from a Set of Gen-1 species names
// gathered from the first 151 species fetches.
function flattenChainGen1Only(chain, gen1Names) {
  // Walk the full chain, but only emit nodes whose species is in Gen 1.
  // For each such node, recompute parent/evolutionDetails/evolvesTo relative
  // to the nearest Gen-1 ancestor / descendant, so that Gen-2 babies and
  // Gen-4 extensions are invisible.
  const fullNodes = [];
  function walk(node, parentSpeciesFull) {
    fullNodes.push({
      species: node.species.name,
      parent: parentSpeciesFull,
      evolutionDetails: node.evolution_details,
      childrenFull: node.evolves_to.map(c => c.species.name),
      raw: node,
    });
    for (const child of node.evolves_to) walk(child, node.species.name);
  }
  walk(chain, null);

  // Find nearest Gen-1 ancestor for a node by walking parents up.
  const byName = Object.fromEntries(fullNodes.map(n => [n.species, n]));
  function nearestGen1Ancestor(name) {
    let cur = byName[name];
    while (cur && cur.parent) {
      if (gen1Names.has(cur.parent)) return byName[cur.parent];
      cur = byName[cur.parent];
    }
    return null;
  }
  // Find nearest Gen-1 descendants by DFS, stopping when we hit a Gen-1 species.
  function nearestGen1Descendants(name) {
    const start = byName[name];
    const out = [];
    const stack = [...start.raw.evolves_to];
    while (stack.length) {
      const child = stack.pop();
      if (gen1Names.has(child.species.name)) out.push(child.species.name);
      else stack.push(...child.evolves_to);
    }
    return out;
  }

  const gen1Nodes = fullNodes.filter(n => gen1Names.has(n.species));
  // Compute structure for Gen 1 subset.
  const result = gen1Nodes.map(n => {
    const anc = nearestGen1Ancestor(n.species);
    const descendants = nearestGen1Descendants(n.species);
    // If our parent in the full chain isn't Gen 1, but a non-Gen-1 ancestor exists,
    // treat this node as a "base" (no parent in Gen-1-only view), and discard evolution_details.
    const hasGen1Parent = !!anc;
    return {
      species: n.species,
      parent: hasGen1Parent ? anc.species : null,
      evolutionDetails: hasGen1Parent ? n.evolutionDetails : [],
      evolvesTo: descendants,
    };
  });
  // depth: BFS from nodes with no Gen-1 parent
  const depthMap = {};
  const roots = result.filter(r => r.parent === null);
  for (const r of roots) depthMap[r.species] = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of result) {
      if (depthMap[r.species] != null) {
        for (const child of r.evolvesTo) {
          if (depthMap[child] == null) {
            depthMap[child] = depthMap[r.species] + 1;
            changed = true;
          }
        }
      }
    }
  }
  return result.map(r => ({ ...r, depth: depthMap[r.species] ?? 0 }));
}

function extractEvolutionInfo(node) {
  // node.evolutionDetails describes HOW this Pokémon evolved FROM its parent.
  // If empty, this is a base form.
  if (!node.evolutionDetails || node.evolutionDetails.length === 0) {
    return { evolvesByMethod: null, evolutionStone: null };
  }
  // Use first detail entry
  const d = node.evolutionDetails[0];
  const trigger = d.trigger?.name; // level-up, use-item, trade, ...
  if (trigger === 'use-item' && d.item) {
    const item = d.item.name; // e.g. thunder-stone
    const stoneMap = {
      'thunder-stone': 'Thunder',
      'water-stone': 'Water',
      'fire-stone': 'Fire',
      'leaf-stone': 'Leaf',
      'moon-stone': 'Moon',
    };
    return { evolvesByMethod: 'stone', evolutionStone: stoneMap[item] || titleCaseHyphenated(item.replace(/-stone$/, '')) };
  }
  if (trigger === 'trade') return { evolvesByMethod: 'trade', evolutionStone: null };
  if (trigger === 'level-up') {
    if ((d.min_happiness ?? 0) >= 160 || d.min_happiness != null) {
      return { evolvesByMethod: 'friendship', evolutionStone: null };
    }
    return { evolvesByMethod: 'level-up', evolutionStone: null };
  }
  return { evolvesByMethod: trigger || null, evolutionStone: null };
}

function findGen1EnglishFlavor(species) {
  // Prefer red/blue/yellow english entries
  const entries = species.flavor_text_entries.filter(e => e.language.name === 'en');
  const preferred = entries.find(e => ['red','blue','yellow'].includes(e.version.name));
  const chosen = preferred || entries[0];
  return chosen ? chosen.flavor_text.replace(/[\f\n\r]+/g, ' ').replace(/\s+/g, ' ').trim() : null;
}

function classifyHabitat(name) {
  if (!name) return null;
  // PokeAPI returns e.g. "rough-terrain", "waters-edge"
  return name.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('-');
}

// -------- Type effectiveness cache --------
const typeCache = {};
async function getType(name) {
  if (typeCache[name]) return typeCache[name];
  const t = await fetchJson(`${BASE}/type/${name}`);
  typeCache[name] = t;
  return t;
}

// Compute weakAgainst (defensive: types that hit US for 2x or more) and
// strongAgainst (offensive: types we hit for 2x).
async function computeTypeMatchups(typeNames) {
  // Defensive: combine damage multipliers across the Pokémon's types.
  const ALL_TYPES = ['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon'];
  const defMul = Object.fromEntries(ALL_TYPES.map(t => [t, 1]));
  for (const tn of typeNames) {
    const t = await getType(tn);
    const dr = t.damage_relations;
    for (const x of dr.double_damage_from) if (defMul[x.name] != null) defMul[x.name] *= 2;
    for (const x of dr.half_damage_from)   if (defMul[x.name] != null) defMul[x.name] *= 0.5;
    for (const x of dr.no_damage_from)     if (defMul[x.name] != null) defMul[x.name] *= 0;
  }
  const weakAgainst = ALL_TYPES.filter(t => defMul[t] >= 2).map(capitalize);

  // Offensive: union of "double_damage_to" across the Pokémon's types.
  const off = new Set();
  for (const tn of typeNames) {
    const t = await getType(tn);
    for (const x of t.damage_relations.double_damage_to) off.add(x.name);
  }
  // Filter to Gen 1 types only
  const strongAgainst = [...off].filter(t => ALL_TYPES.includes(t)).map(capitalize);
  return { weakAgainst, strongAgainst };
}

// -------- Main --------

async function main() {
  console.error('Fetching species + pokemon for Gen 1 (151 entries)...');
  // First pass: just collect species names so we can build a Gen-1 names set.
  // We have to fetch /pokemon-species/{id} anyway, so do everything in one pass
  // but cache evolution-chain parsing for the second pass.
  const speciesByName = {}; // name -> species json
  const pokemonById = {};
  const evolutionChainRawCache = {}; // url -> raw chain JSON
  for (let id = 1; id <= 151; id++) {
    process.stderr.write(`#${id} `);
    const [pokemon, species] = await Promise.all([
      fetchJson(`${BASE}/pokemon/${id}`),
      fetchJson(`${BASE}/pokemon-species/${id}`),
    ]);
    pokemonById[id] = pokemon;
    speciesByName[species.name] = { ...species, _id: id };
    const ecUrl = species.evolution_chain.url;
    if (!evolutionChainRawCache[ecUrl]) {
      evolutionChainRawCache[ecUrl] = await fetchJson(ecUrl);
    }
  }
  process.stderr.write('\n');

  const gen1Names = new Set(Object.keys(speciesByName));
  // Pre-flatten chains per Gen-1 only view.
  const flattenedByUrl = {};
  for (const [url, ec] of Object.entries(evolutionChainRawCache)) {
    flattenedByUrl[url] = flattenChainGen1Only(ec.chain, gen1Names);
  }

  const records = [];
  for (let id = 1; id <= 151; id++) {
    const pokemon = pokemonById[id];
    const species = Object.values(speciesByName).find(s => s._id === id);
    const evolutionChain = flattenedByUrl[species.evolution_chain.url];

    const ourNode = evolutionChain.find(n => n.species === species.name);

    // Compute connected-component family size in the Gen-1-only subgraph (undirected).
    const componentOf = (start) => {
      const visited = new Set();
      const stack = [start];
      while (stack.length) {
        const cur = stack.pop();
        if (visited.has(cur)) continue;
        visited.add(cur);
        const node = evolutionChain.find(n => n.species === cur);
        if (!node) continue;
        if (node.parent && !visited.has(node.parent)) stack.push(node.parent);
        for (const c of node.evolvesTo) if (!visited.has(c)) stack.push(c);
      }
      return visited;
    };
    const component = componentOf(species.name);
    const familySize = component.size;
    let evolutionStage;
    if (familySize === 1) {
      evolutionStage = 'Single-stage';
    } else if (ourNode.depth === 0) {
      evolutionStage = 'Base';
    } else if (ourNode.evolvesTo.length === 0) {
      evolutionStage = 'Final';
    } else {
      evolutionStage = 'Mid';
    }
    const isFinalEvo = familySize === 1 || ourNode.evolvesTo.length === 0;
    const { evolvesByMethod, evolutionStone } = extractEvolutionInfo(ourNode);

    // Types
    const types = pokemon.types.sort((a,b) => a.slot - b.slot).map(t => capitalize(t.type.name));
    const hasSecondaryType = types.length > 1;

    // Stats
    const baseStatTotal = pokemon.stats.reduce((sum, s) => sum + s.base_stat, 0);
    const highestStat = pickHighestStat(pokemon.stats);

    // Genus (classification)
    const genusEntry = species.genera.find(g => g.language.name === 'en');
    const classification = genusEntry ? genusEntry.genus : null;

    // Egg groups
    const eggGroups = species.egg_groups.map(g => titleCaseHyphenated(g.name));

    // Flavor text (Gen 1 preferred)
    const pokedexEntry = findGen1EnglishFlavor(species);

    // Color / habitat / shape
    const color = species.color ? capitalize(species.color.name) : null;
    const habitat = classifyHabitat(species.habitat?.name);
    const shape = species.shape ? species.shape.name : null;

    // Height/weight (PokeAPI: decimetres and hectograms)
    const heightM = pokemon.height / 10;
    const weightKg = pokemon.weight / 10;

    // Type matchups
    const typeLowercase = types.map(t => t.toLowerCase());
    const { weakAgainst, strongAgainst } = await computeTypeMatchups(typeLowercase);

    const rec = {
      id,
      name: displayName(species.name),
      types,
      color,
      habitat,
      shape,
      heightM: +heightM.toFixed(2),
      heightBucket: bucketHeight(heightM),
      weightKg: +weightKg.toFixed(2),
      weightBucket: bucketWeight(weightKg),
      classification,
      eggGroups,
      genderRatio: genderFromRate(species.gender_rate),
      captureRateBucket: bucketCapture(species.capture_rate),
      baseStatTotal,
      bstBucket: bucketBst(baseStatTotal),
      highestStat: highestStat.length === 1 ? highestStat[0] : highestStat,
      evolutionStage,
      evolutionFamilySize: familySize,
      evolvesByMethod,
      evolutionStone,
      isStarter: STARTERS.has(id),
      isLegendary: !!species.is_legendary,
      isMythical: !!species.is_mythical,
      isFossil: FOSSILS.has(id),
      isFinalEvo: isFinalEvo,
      isBaby: !!species.is_baby,
      abilities: [], // Gen 1 had none
      signatureMove: SIGNATURE[id] ?? null,
      pokedexEntry,
      spriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
      cryUrl: `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${id}.ogg`,
      iconicStatus: ICONIC[id] || 'tier3',
      weakAgainst,
      strongAgainst,
      hasSecondaryType,
    };
    records.push(rec);
  }
  process.stderr.write('\n');

  records.sort((a,b) => a.id - b.id);
  await writeFile(OUT, JSON.stringify(records, null, 2));
  console.error(`Wrote ${records.length} records to ${OUT}`);

  // Stats summary
  const dist = (key) => {
    const counts = {};
    for (const r of records) {
      const v = r[key];
      const k = Array.isArray(v) ? v.join('+') : String(v);
      counts[k] = (counts[k] || 0) + 1;
    }
    return counts;
  };
  const fill = (key) => {
    let filled = 0;
    for (const r of records) {
      const v = r[key];
      if (v === null || v === undefined) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      filled++;
    }
    return `${filled}/${records.length}`;
  };

  const report = {
    total: records.length,
    fillRates: Object.fromEntries(Object.keys(records[0]).map(k => [k, fill(k)])),
    heightBucket: dist('heightBucket'),
    weightBucket: dist('weightBucket'),
    bstBucket: dist('bstBucket'),
    captureRateBucket: dist('captureRateBucket'),
    evolutionStage: dist('evolutionStage'),
    color: dist('color'),
    habitat: dist('habitat'),
    genderRatio: dist('genderRatio'),
    iconicStatus: dist('iconicStatus'),
    legendaryCount: records.filter(r => r.isLegendary).length,
    mythicalCount: records.filter(r => r.isMythical).length,
    fossilCount: records.filter(r => r.isFossil).length,
    starterCount: records.filter(r => r.isStarter).length,
  };
  await writeFile(join(__dirname, '_report.json'), JSON.stringify(report, null, 2));
  console.error('Report written.');
}

main().catch(err => {
  console.error('FATAL', err);
  process.exit(1);
});
