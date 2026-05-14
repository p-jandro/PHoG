import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createContentStore } from '../../packages/server/src/contentStore.js';

describe('contentStore atomic write', () => {
  it('save creates .bak of previous content and writes new content', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cs-'));
    try {
      const tfPath = join(dir, 'tf.json');
      const initial = [{ id: 'old', statement: 'Old', answer: true, enabled: true }];
      writeFileSync(tfPath, JSON.stringify(initial));
      const cs = createContentStore({ quizPath: null, statementsPath: tfPath, pointlessPath: null });
      const next = [{ id: 'new', statement: 'New', answer: false, enabled: true, explanation: '' }];
      const r = cs.saveStatements(next);
      assert.equal(r.ok, true);
      const written = JSON.parse(readFileSync(tfPath, 'utf-8'));
      assert.deepEqual(written, next);
      assert.ok(existsSync(tfPath + '.bak'), '.bak file should exist');
      const bak = JSON.parse(readFileSync(tfPath + '.bak', 'utf-8'));
      assert.deepEqual(bak, initial, '.bak should hold previous content');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('in-memory cache reflects saved data', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cs-'));
    try {
      const tfPath = join(dir, 'tf.json');
      writeFileSync(tfPath, '[]');
      const cs = createContentStore({ quizPath: null, statementsPath: tfPath, pointlessPath: null });
      assert.equal(cs.getStatementsAll().length, 0);
      cs.saveStatements([{ id: 's1', statement: 'X', answer: true, enabled: true, explanation: '' }]);
      assert.equal(cs.getStatementsAll().length, 1);
      assert.equal(cs.getStatements().length, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
