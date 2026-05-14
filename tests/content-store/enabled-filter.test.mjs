import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createContentStore } from '../../packages/server/src/contentStore.js';

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'cs-'));
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

describe('contentStore enabled filter', () => {
  it('getQuizRounds excludes enabled=false; getQuizRoundsAll includes all', () => {
    withTempDir((dir) => {
      const file = join(dir, 'quiz.json');
      writeFileSync(file, JSON.stringify([
        { roundNumber: 1, enabled: true,  options: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] },
        { roundNumber: 2, enabled: false, options: [{ id: 'e' }, { id: 'f' }, { id: 'g' }, { id: 'h' }] },
        { roundNumber: 3,                  options: [{ id: 'i' }, { id: 'j' }, { id: 'k' }, { id: 'l' }] }
      ]));
      const cs = createContentStore({ quizPath: file, statementsPath: null, pointlessPath: null });
      assert.equal(cs.getQuizRounds().length, 2, 'enabled and missing-enabled count');
      assert.equal(cs.getQuizRoundsAll().length, 3, 'all included');
    });
  });

  it('getStatements excludes enabled=false', () => {
    withTempDir((dir) => {
      const file = join(dir, 'tf.json');
      writeFileSync(file, JSON.stringify([
        { id: 't1', statement: 'A', answer: true, enabled: true },
        { id: 't2', statement: 'B', answer: false, enabled: false }
      ]));
      const cs = createContentStore({ quizPath: null, statementsPath: file, pointlessPath: null });
      assert.equal(cs.getStatements().length, 1);
      assert.equal(cs.getStatementsAll().length, 2);
    });
  });

  it('getPointlessRounds excludes enabled=false', () => {
    withTempDir((dir) => {
      const file = join(dir, 'p.json');
      writeFileSync(file, JSON.stringify([
        { id: 'r1', category: 'A', question: 'Q', answers: { a: 100, b: 50, c: 25, d: 0 }, enabled: true },
        { id: 'r2', category: 'B', question: 'Q', answers: { e: 100, f: 50, g: 25, h: 0 }, enabled: false }
      ]));
      const cs = createContentStore({ quizPath: null, statementsPath: null, pointlessPath: file });
      assert.equal(cs.getPointlessRounds().length, 1);
      assert.equal(cs.getPointlessRoundsAll().length, 2);
    });
  });
});
