import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { analyze } from '../src/slop.js';
import { apply } from '../src/apply.js';
import { loadPack } from '../src/packs.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const slopHtml = readFileSync(join(HERE, '..', 'examples', 'slop', 'index.html'), 'utf8');
const primer = loadPack('primer');

test('reskinning drops the slop score substantially', () => {
  const before = analyze(slopHtml).score;
  const { html } = apply(slopHtml, primer);
  const after = analyze(html).score;
  assert.ok(after < before - 40, `expected a big drop, ${before} → ${after}`);
  assert.ok(after < 20, `expected near-clean result, got ${after}`);
});

test('records an explainable ledger of changes', () => {
  const { changes } = apply(slopHtml, primer);
  const ids = changes.map((c) => c.id);
  for (const id of ['gradient-text', 'gradient-bg', 'default-font', 'emoji-heading', 'inject-pack']) {
    assert.ok(ids.includes(id), `expected change ${id}`);
  }
});

test('neutralizes gradient-clipped text', () => {
  const { html } = apply(slopHtml, primer);
  assert.doesNotMatch(html, /background-clip\s*:\s*text/i);
  assert.doesNotMatch(html, /text-fill-color\s*:\s*transparent/i);
});

test('replaces indigo hexes and Inter with pack tokens', () => {
  const { html } = apply(slopHtml, primer);
  assert.doesNotMatch(html, /#6366f1|#a855f7|#8b5cf6/i);
  assert.doesNotMatch(html, /font-family[^;}]*inter/i);
  assert.match(html, /--rt-accent:\s*#0969da/i);
});

test('strips emoji from headings but keeps the words', () => {
  const { html } = apply(slopHtml, primer);
  assert.match(html, /Ship faster with AI/);
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)[1];
  assert.doesNotMatch(h1, /🚀/u);
});

test('injects exactly one pack token layer', () => {
  const { html } = apply(slopHtml, primer);
  const layers = html.match(/data-re-template=/g) || [];
  assert.equal(layers.length, 1);
});

test('is idempotent-ish: re-applying does not worsen the score', () => {
  const once = apply(slopHtml, primer).html;
  const twice = apply(once, primer).html;
  assert.ok(analyze(twice).score <= analyze(once).score + 1);
});

test('every pack produces a valid reskin', () => {
  for (const id of ['primer', 'material', 'polaris', 'carbon', 'editorial', 'terminal']) {
    const pack = loadPack(id);
    const { html } = apply(slopHtml, pack);
    assert.match(html, new RegExp(`data-re-template="${id}"`));
    assert.ok(analyze(html).score < analyze(slopHtml).score);
  }
});

test('a pack with a dark role set emits theme-aware variables', () => {
  const { html } = apply(slopHtml, loadPack('terminal'));
  assert.match(html, /prefers-color-scheme:\s*dark/);
  assert.match(html, /:root\[data-theme="dark"\]/);
  assert.match(html, /--rt-canvas:#131314/i);   // dark canvas present
  assert.match(html, /--rt-canvas:#ffffff/i);   // light canvas present
});

test('a pack without a dark role set stays single-theme', () => {
  const { html } = apply(slopHtml, loadPack('primer'));
  assert.doesNotMatch(html, /prefers-color-scheme:\s*dark/);
});
