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

test('de-pills the eyebrow badge: no bubble fill, no leading dot', () => {
  const { html, changes } = apply(slopHtml, primer);
  // the eyebrow rule keeps its huge radius but loses the tinted background fill
  const eyebrow = html.match(/\.eyebrow\s*\{[^}]*\}/i)[0];
  assert.doesNotMatch(eyebrow, /background\s*:/i, 'eyebrow should have no background fill');
  // the leading ● dot is stripped from the label text
  assert.doesNotMatch(html, />\s*●\s*Now with AI/);
  assert.match(html, />Now with AI superpowers</);
  assert.ok(changes.some((c) => c.id === 'eyebrow-pill'), 'records the eyebrow-pill change');
});

test('maps near-white text (authored for a dark hero) to the readable foreground', () => {
  const { html } = apply(slopHtml, primer);
  // the card titles and brand were color:#fff — invisible on a light canvas
  assert.doesNotMatch(html, /\bcolor\s*:\s*#fff\b/i);
  // but background-color values are untouched
  assert.match(html, /background:\s*rgba\(255,255,255,0\.03\)/i);
});

test('removes emoji used as icons and decorations', () => {
  const { html, changes } = apply(slopHtml, primer);
  // the feature-card emoji "icon" tiles are gone entirely
  assert.doesNotMatch(html, /<div class="icon">[\s\S]*?<\/div>/);
  // no stray decorative emoji left in the brand or footer text
  assert.doesNotMatch(html, /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  assert.match(html, /FlowSync/); // the words around them survive
  assert.ok(changes.some((c) => c.id === 'emoji-icon'), 'records the emoji-icon change');
});

test('cards are flat, hairline-delineated blocks — not filled boxes', () => {
  const { html } = apply(slopHtml, primer);
  const layer = html.match(/<style data-re-template[^>]*>([\s\S]*?)<\/style>/i)[1];
  const cardRule = layer.match(/\.card[^{]*\{[^}]*\}/)[0];
  // no fill, no box border, no radius — just a single top hairline
  assert.match(cardRule, /background:transparent/);
  assert.match(cardRule, /border-top:1px solid var\(--rt-border\)/);
  assert.doesNotMatch(cardRule, /background:var\(--rt-(accent|canvas-subtle)\)/);
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
  for (const id of ['primer', 'material', 'polaris', 'carbon', 'editorial', 'terminal', 'poke500']) {
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
