import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const pokemonPath = resolve(repoRoot, 'packages/server/src/data/pokedle/pokemon.json');

// Gen 1 Kanto Gym Leader rosters (Red/Blue canonical)
const gymLeaderRosters = {
  Brock:    ['Geodude', 'Onix'],
  Misty:    ['Staryu', 'Starmie'],
  'Lt. Surge': ['Voltorb', 'Pikachu', 'Raichu'],
  Erika:    ['Victreebel', 'Tangela', 'Vileplume'],
  Koga:     ['Koffing', 'Muk', 'Weezing'],
  Sabrina:  ['Abra', 'Kadabra', 'Alakazam', 'Mr. Mime', 'Venomoth'],
  Blaine:   ['Growlithe', 'Ponyta', 'Rapidash', 'Arcanine'],
  Giovanni: ['Rhyhorn', 'Dugtrio', 'Nidoqueen', 'Nidoking', 'Rhydon', 'Persian']
};

// Build name -> leader lookup
const leaderByName = {};
for (const [leader, mons] of Object.entries(gymLeaderRosters)) {
  for (const name of mons) {
    leaderByName[name] = leader;
  }
}

const pokemon = JSON.parse(readFileSync(pokemonPath, 'utf8'));

let added = 0;
for (const p of pokemon) {
  p.gymLeader = leaderByName[p.name] || null;
  if (p.gymLeader) added++;
}

writeFileSync(pokemonPath, JSON.stringify(pokemon, null, 2));

console.log(`Added gymLeader field to ${pokemon.length} entries (${added} non-null).`);

// Sanity check
const byLeader = {};
for (const p of pokemon) {
  if (!p.gymLeader) continue;
  byLeader[p.gymLeader] = (byLeader[p.gymLeader] || 0) + 1;
}
console.log('Per-leader counts:', byLeader);
