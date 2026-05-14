import assert from 'node:assert/strict';
import {
  resolveCountry,
  isAdjacent,
  shortestPathInfo,
  canReach,
  shortestPathChain,
  pickRandomPair,
  ALL_COUNTRIES
} from '../../packages/server/src/games/travel/graph.js';

// Resolver handles case + aliases
assert.equal(resolveCountry('france'), 'France');
assert.equal(resolveCountry('FRANCE'), 'France');
assert.equal(resolveCountry('USA'), 'United States');
assert.equal(resolveCountry('Czechia'), 'Czech Republic');
assert.equal(resolveCountry('Holland'), 'Netherlands');
assert.equal(resolveCountry('Atlantis'), null);

// Adjacency basics — borders are symmetric, so check both directions
assert.equal(isAdjacent('France', 'Spain'), true);
assert.equal(isAdjacent('Spain', 'France'), true);
assert.equal(isAdjacent('France', 'Germany'), true);
assert.equal(isAdjacent('Portugal', 'Germany'), false);

// Known short path: Portugal → Germany via Spain → France → Germany = 3 hops
const info = shortestPathInfo('Portugal', 'Germany');
assert.ok(info, 'Portugal-Germany should be reachable');
assert.equal(info.distance, 3);
// First step on shortest path: Spain (only border of Portugal)
assert.ok(info.nextOnShortestPath.has('Spain'));

// Unreachable: no path between disjoint subgraphs in this dataset (e.g. South Korea ↔ Madagascar)
// (No Madagascar in dataset — pick a known reachable pair instead and just verify the API.)
const sk = shortestPathInfo('South Korea', 'Norway');
assert.ok(sk, 'South Korea → Norway should still be reachable via NK → Russia → Norway');
assert.equal(sk.distance, 3);

// canReach uses the same graph
// (Post-H2: Brazil no longer borders France, so Europe ↔ South America is
// disconnected. Use an intra-continent pair instead.)
assert.equal(canReach('Spain', 'Germany'), true);
assert.equal(canReach('Brazil', 'Argentina'), true);

// shortestPathChain returns endpoints
const chain = shortestPathChain('Portugal', 'Germany');
assert.equal(chain[0], 'Portugal');
assert.equal(chain[chain.length - 1], 'Germany');
assert.equal(chain.length, info.distance + 1);

// pickRandomPair respects bounds
for (let i = 0; i < 20; i++) {
  const p = pickRandomPair(2, 5);
  assert.ok(p, 'should find a 2-5 hop pair');
  assert.ok(p.distance >= 2 && p.distance <= 5, `distance ${p.distance} out of range`);
}

// Sanity: dataset isn't empty
assert.ok(ALL_COUNTRIES.length >= 100, `expected >=100 countries, got ${ALL_COUNTRIES.length}`);

// ISO codes must exist on every country (added in Travel v2)
for (const c of ALL_COUNTRIES) {
  assert.ok(typeof c.iso === 'string' && c.iso.length === 3, `${c.name} missing valid iso code (got: ${c.iso})`);
}

// H2 regression — sea-hop edges must NOT be in the adjacency graph.
// Borders are symmetric; assert both directions to guard against asymmetric drift.
const seaHops = [
  ['France', 'Brazil'],
  ['France', 'Suriname'],
  ['Spain', 'Morocco'],
  ['United States', 'Russia'],
  ['Italy', 'Tunisia']
];
for (const [a, b] of seaHops) {
  assert.equal(isAdjacent(a, b), false, `${a} ↔ ${b} should not be adjacent (sea hop)`);
  assert.equal(isAdjacent(b, a), false, `${b} ↔ ${a} should not be adjacent (sea hop)`);
}

// USA accepts the 'USA' alias too — make sure removing the Russia edge holds under that alias
assert.equal(isAdjacent('USA', 'Russia'), false);

// Real land borders still hold after the scrub
assert.equal(isAdjacent('France', 'Spain'), true);

// Spain ↔ Andorra ↔ France: BFS distance ≤ 2 (in fact France-Spain is direct = 1)
const sf = shortestPathInfo('Spain', 'France');
assert.ok(sf, 'Spain → France should be reachable');
assert.ok(sf.distance <= 2, `Spain → France distance ${sf.distance} should be ≤ 2`);

// Italy ↔ Switzerland ↔ Austria — also ≤ 2 (Italy borders both Switzerland and Austria directly)
const ia = shortestPathInfo('Italy', 'Austria');
assert.ok(ia, 'Italy → Austria should be reachable');
assert.ok(ia.distance <= 2, `Italy → Austria distance ${ia.distance} should be ≤ 2`);

console.log('graph.test.mjs PASS');
