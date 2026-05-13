/**
 * Wordle two-pass coloring + word-list loader.
 *
 * Source-of-truth answer pool and allowed-guess dictionary live in
 *   packages/server/src/data/wordle/answers.json     (2,315 entries)
 *   packages/server/src/data/wordle/valid-guesses.json (10,657 entries)
 *
 * The "allowed guesses" union covers both files (a valid answer is also a
 * valid guess).
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dataDir = join(__dirname, '..', '..', 'data', 'wordle');
const answers = JSON.parse(readFileSync(join(dataDir, 'answers.json'), 'utf-8'));
const validGuesses = JSON.parse(readFileSync(join(dataDir, 'valid-guesses.json'), 'utf-8'));

const ALLOWED = new Set([...answers, ...validGuesses].map((w) => w.toLowerCase()));
const ANSWERS = answers.map((w) => w.toLowerCase());

export function isAllowedGuess(word) {
  return typeof word === 'string' && ALLOWED.has(word.toLowerCase());
}

export function pickRandomAnswer() {
  return ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
}

/**
 * Color a 5-letter guess against the answer using the canonical two-pass rule.
 * Returns an array of 5 color strings: 'green' | 'yellow' | 'grey'.
 *
 * Both inputs are normalized to lowercase. They must be exactly 5 characters.
 */
export function colorGuess(guess, answer) {
  if (typeof guess !== 'string' || typeof answer !== 'string') {
    throw new Error('colorGuess: guess and answer must be strings');
  }
  if (guess.length !== 5 || answer.length !== 5) {
    throw new Error('colorGuess: both inputs must be exactly 5 characters');
  }
  const g = guess.toLowerCase();
  const a = answer.toLowerCase();
  const result = new Array(5).fill('grey');
  const remaining = new Map();
  for (const ch of a) remaining.set(ch, (remaining.get(ch) || 0) + 1);

  // Pass 1 — greens
  for (let i = 0; i < 5; i++) {
    if (g[i] === a[i]) {
      result[i] = 'green';
      remaining.set(g[i], remaining.get(g[i]) - 1);
    }
  }
  // Pass 2 — yellows
  for (let i = 0; i < 5; i++) {
    if (result[i] === 'green') continue;
    const c = g[i];
    if ((remaining.get(c) || 0) > 0) {
      result[i] = 'yellow';
      remaining.set(c, remaining.get(c) - 1);
    }
  }
  return result;
}

/**
 * Given accumulated guess-feedback pairs, return a map of letter → best-color
 * (priority: green > yellow > grey). Used for keyboard cumulative state on the
 * client; exposed here for unit tests.
 */
export function cumulativeKeyboardState(history) {
  const RANK = { grey: 0, yellow: 1, green: 2 };
  const out = {};
  for (const { guess, colors } of history) {
    const g = guess.toLowerCase();
    for (let i = 0; i < g.length; i++) {
      const c = g[i];
      const newColor = colors[i];
      if (!out[c] || RANK[newColor] > RANK[out[c]]) {
        out[c] = newColor;
      }
    }
  }
  return out;
}
