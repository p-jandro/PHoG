/**
 * Tile draw for Numbers Round.
 *
 * Pool: 4 large tiles (25, 50, 75, 100, one of each) + 20 small tiles
 *       (each integer 1..10 appears twice).
 *
 * A round consists of exactly 6 tiles. The number of large tiles is randomized
 * 0..4; the remainder are drawn from smalls without replacement *within a round*.
 *
 * Target: uniform integer in [100, 999].
 */

const LARGE = [25, 50, 75, 100];

function buildSmallPool() {
  const pool = [];
  for (let n = 1; n <= 10; n++) {
    pool.push(n, n);
  }
  return pool;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function drawTiles() {
  const numLarge = Math.floor(Math.random() * 5); // 0..4
  const largeChosen = shuffle([...LARGE]).slice(0, numLarge);
  const smallPool = shuffle(buildSmallPool());
  const smallChosen = smallPool.slice(0, 6 - numLarge);
  return shuffle([...largeChosen, ...smallChosen]);
}

export function drawTarget() {
  return 100 + Math.floor(Math.random() * 900); // 100..999
}
