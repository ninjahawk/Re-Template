import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { extract, render, reformat } from '../src/reformat.js';
import { loadPack } from '../src/packs.js';
import { analyze } from '../src/slop.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const slopHtml = readFileSync(join(HERE, '..', 'examples', 'slop', 'index.html'), 'utf8');
const poke500 = loadPack('poke500');

test('extracts a coherent content model from a slop page', () => {
  const m = extract(slopHtml);
  assert.equal(m.brand, 'FlowSync');
  assert.match(m.headline, /Ship faster with AI/);
  assert.match(m.subhead, /all-in-one platform/);
  assert.deepEqual(m.nav, ['Product', 'Pricing', 'Docs', 'Blog']);
  assert.equal(m.caps.length, 3);
  assert.equal(m.caps[0].name, 'Lightning Fast');
  assert.match(m.caps[0].desc, /Blazing-fast/);
});

test('re-casts cards into a hairline capabilities table', () => {
  const html = reformat(slopHtml, poke500);
  assert.match(html, /<table>/);
  assert.match(html, /<th>Capability<\/th><th>What it does<\/th>/);
  for (const cap of ['Lightning Fast', 'Secure by Default', 'AI-Powered']) {
    assert.ok(html.includes(cap), `table missing ${cap}`);
  }
  // the hero is a restrained quote block with a mono crumb, not a gradient splash
  assert.match(html, /class="crumb"/);
  assert.match(html, /class="head"/);
});

test('never fabricates data — no invented metrics, charts, or status badges', () => {
  const html = reformat(slopHtml, poke500);
  assert.doesNotMatch(html, /<svg/i, 'must not invent a chart');
  assert.doesNotMatch(html, /uptime|operational|\bLIVE\b|99\.9|as of \d/i, 'must not invent metrics/status');
});

test('strips decorative bullets and emoji from extracted text', () => {
  const m = extract(slopHtml);
  assert.doesNotMatch(m.kicker, /[●•]/);
  assert.doesNotMatch(m.headline, /🚀/u);
  const html = reformat(slopHtml, poke500);
  assert.doesNotMatch(html, /●/);
});

test('is theme-aware and emits pack tokens', () => {
  const html = reformat(slopHtml, poke500);
  assert.match(html, /prefers-color-scheme:dark/);
  assert.match(html, /--accent:#1a73e8/i);
  assert.match(html, /--bg:#131314/i); // dark canvas
});

test('is deterministic — same input yields byte-identical output', () => {
  assert.equal(reformat(slopHtml, poke500), reformat(slopHtml, poke500));
});

test('the reformatted page scores clean on the slop detector', () => {
  const after = analyze(reformat(slopHtml, poke500)).score;
  assert.ok(after < 15, `expected clean output, got ${after}`);
});

test('escapes content so it cannot break the markup', () => {
  const evil = `<!doctype html><title>x</title><body>
    <div class="brand">A&B</div><h1>Hi <script>alert(1)</script> "there"</h1>
    <p>${'lorem '.repeat(10)}</p></body>`;
  const html = reformat(evil, poke500);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /A&amp;B/);
});

// --- "can't fail" guarantees: never throws, always a valid skeleton ---

const skeleton = (html) => {
  assert.match(html, /^<!doctype html>/i);
  assert.equal((html.match(/<title>/g) || []).length, 1);
  assert.match(html, /class="bar"/);   // top bar
  assert.match(html, /class="quote"/); // hero
  assert.match(html, /<\/body><\/html>/);
};

test('degrades gracefully on a nearly-empty page', () => {
  const html = reformat('<html><body><h1>Hello</h1></body></html>', poke500);
  skeleton(html);
  assert.match(html, /Hello/);
  assert.doesNotMatch(html, /<table>/); // no caps → no empty table
});

test('never throws on junk, empty, or malformed input', () => {
  for (const input of ['', '   ', '<', '<html>', 'not html at all', '<div><span>', '<h1>']) {
    assert.doesNotThrow(() => skeleton(reformat(input, poke500)), `failed on: ${JSON.stringify(input)}`);
  }
});

test('works with any pack that defines color roles (single-theme too)', () => {
  const html = reformat(slopHtml, loadPack('primer'));
  skeleton(html);
  assert.match(html, /--accent:#0969da/i);
  assert.doesNotMatch(html, /prefers-color-scheme:dark/); // primer has no dark roles
});

test('render accepts a model directly and is pure', () => {
  const model = extract(slopHtml);
  assert.equal(render(model, poke500), render(model, poke500));
});
