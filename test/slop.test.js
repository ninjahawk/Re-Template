import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { analyze, level } from '../src/slop.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const slopHtml = readFileSync(join(HERE, '..', 'examples', 'slop', 'index.html'), 'utf8');

test('the canonical slop page scores heavy', () => {
  const { score, level: lvl, findings } = analyze(slopHtml);
  assert.ok(score >= 70, `expected heavy slop, got ${score}`);
  assert.equal(lvl, 'heavy');
  assert.ok(findings.length >= 5, 'expected several distinct tells');
});

test('detects the marquee tells by id', () => {
  const ids = analyze(slopHtml).findings.map((f) => f.id);
  for (const id of ['gradient-bg', 'gradient-text', 'default-font', 'emoji-heading']) {
    assert.ok(ids.includes(id), `expected to flag ${id}`);
  }
});

test('a deliberately styled page scores clean', () => {
  const clean = `<!doctype html><html><head><style>
    body{font-family:Georgia,serif;background:#fbfaf7;color:#1a1a1a}
    h1{color:#111}.btn{background:#8a1c1c;border-radius:3px}
  </style></head><body><h1>Field Notes</h1><a class="btn">Read the essay</a></body></html>`;
  const { score, level: lvl } = analyze(clean);
  assert.ok(score < 15, `expected clean, got ${score}`);
  assert.equal(lvl, 'clean');
});

test('score is clamped to 0..100 and monotonic with tells', () => {
  const empty = analyze('<html></html>');
  assert.equal(empty.score, 0);
  const doubled = analyze(slopHtml + slopHtml);
  assert.ok(doubled.score <= 100);
  assert.ok(doubled.score >= analyze(slopHtml).score);
});

test('level thresholds', () => {
  assert.equal(level(0), 'clean');
  assert.equal(level(20), 'light');
  assert.equal(level(50), 'moderate');
  assert.equal(level(85), 'heavy');
});
