import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createContentStore } from '../../packages/server/src/contentStore.js';

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'cs-'));
  const quizPath = join(dir, 'quiz.json');
  const statementsPath = join(dir, 'tf.json');
  const pointlessPath = join(dir, 'p.json');
  writeFileSync(quizPath, '[]');
  writeFileSync(statementsPath, '[]');
  writeFileSync(pointlessPath, '[]');
  const cs = createContentStore({ quizPath, statementsPath, pointlessPath });
  return { cs, dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe('contentStore validation', () => {
  it('saveQuizRounds: requires exactly 4 options per round', () => {
    const { cs, cleanup } = setup();
    try {
      const r = cs.saveQuizRounds([{ roundNumber: 1, enabled: true, options: [] }]);
      assert.equal(r.ok, false);
      assert.match(r.reason, /options/);
    } finally { cleanup(); }
  });

  it('saveQuizRounds: rejects bad difficulty', () => {
    const { cs, cleanup } = setup();
    const goodOpt = (id) => ({
      id, category: 'C', difficulty: 'easy', color: '#ffffff',
      question: 'Q?', answers: { A: 'a', B: 'b', C: 'c', D: 'd' }, correct: 'A'
    });
    try {
      const bad = { ...goodOpt('x'), difficulty: 'trivial' };
      const r = cs.saveQuizRounds([{ roundNumber: 1, enabled: true, options: [bad, goodOpt('a'), goodOpt('b'), goodOpt('c')] }]);
      assert.equal(r.ok, false);
      assert.match(r.reason, /difficulty/);
    } finally { cleanup(); }
  });

  it('saveStatements: rejects non-boolean answer', () => {
    const { cs, cleanup } = setup();
    try {
      const r = cs.saveStatements([{ id: 's1', statement: 'X', answer: 'true', enabled: true }]);
      assert.equal(r.ok, false);
      assert.match(r.reason, /answer/);
    } finally { cleanup(); }
  });

  it('savePointlessRounds: requires >= 4 answers', () => {
    const { cs, cleanup } = setup();
    try {
      const r = cs.savePointlessRounds([{ id: 'p1', category: 'C', question: 'Q', answers: { a: 100 }, enabled: true }]);
      assert.equal(r.ok, false);
      assert.match(r.reason, /at least 4 answers/i);
    } finally { cleanup(); }
  });

  it('savePointlessRounds: rejects score outside 0-100', () => {
    const { cs, cleanup } = setup();
    try {
      const r = cs.savePointlessRounds([{
        id: 'p1', category: 'C', question: 'Q',
        answers: { a: 100, b: 50, c: 25, d: 150 }, enabled: true
      }]);
      assert.equal(r.ok, false);
      assert.match(r.reason, /0-100/);
    } finally { cleanup(); }
  });

  it('saveQuizRounds: happy path returns ok and a version', () => {
    const { cs, cleanup } = setup();
    const opt = (id) => ({
      id, category: 'C', difficulty: 'easy', color: '#ffffff',
      question: 'Q?', answers: { A: 'a', B: 'b', C: 'c', D: 'd' }, correct: 'A'
    });
    try {
      const r = cs.saveQuizRounds([{ roundNumber: 1, enabled: true, options: [opt('a'), opt('b'), opt('c'), opt('d')] }]);
      assert.equal(r.ok, true);
      assert.equal(typeof r.version, 'number');
    } finally { cleanup(); }
  });
});
