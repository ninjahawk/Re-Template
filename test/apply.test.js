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

test('classifies components by CSS signature, not class name', () => {
  // a page whose classes are named nothing like the demo's
  const page = `<!doctype html><html><head><style>
    .signup{background:linear-gradient(90deg,#6366f1,#8b5cf6);border-radius:14px;padding:14px 30px;color:#fff}
    .feature{background:#fff;border:1px solid #eee;border-radius:20px;padding:28px;box-shadow:0 20px 60px rgba(99,102,241,.3)}
    .tag{background:rgba(99,102,241,.15);border-radius:9999px;padding:6px 14px;color:#a5b4fc}
  </style></head><body>
    <span class="tag">New</span>
    <a class="signup" href="#">Start free trial</a>
    <div class="feature"><h3>Fast</h3><p>Very fast.</p></div>
  </body></html>`;
  const { html } = apply(page, loadPack('poke500'));
  assert.match(html, /<a class="signup rt-btn"/, 'filled anchor tagged as a button');
  assert.match(html, /<div class="feature rt-card"/, 'bordered padded block tagged as a card');
  assert.match(html, /<span class="tag rt-kicker"/, 'full-pill label tagged as a kicker');
});

test('never rewrites inside <script>, <pre>, or <textarea>', () => {
  const page = `<!doctype html><head><style>.hero{background:#6366f1;font-family:Inter}</style></head>
  <body><h1>Demo</h1>
  <script>const c={fill:'#6366f1'};ctx.fillStyle='#8b5cf6';const f='Inter';/*border-radius:24px*/</script>
  <pre>.box{ background:#6366f1; border-radius: 24px; font-family: Inter; }</pre>
  <textarea>#6366f1 Inter</textarea></body>`;
  const { html } = apply(page, primer);
  // CSS in <style> is transformed…
  assert.match(html, /--rt-accent/);
  // …but the script's code, the code sample, and the textarea are byte-for-byte intact
  assert.match(html, /ctx\.fillStyle='#8b5cf6'/);
  assert.match(html, /const c=\{fill:'#6366f1'\}/);
  assert.match(html, /<pre>\.box\{ background:#6366f1; border-radius: 24px; font-family: Inter; \}<\/pre>/);
  assert.match(html, /<textarea>#6366f1 Inter<\/textarea>/);
});

test('does not de-pill a fixed-size shape (avatar/icon), only text pills', () => {
  const page = `<!doctype html><head><style>
    .avatar{width:96px;height:96px;border-radius:9999px;background:linear-gradient(135deg,#6366f1,#a855f7)}
    .eyebrow{padding:6px 14px;border-radius:9999px;background:rgba(99,102,241,.2)}
  </style></head><body><div class="avatar"></div><span class="eyebrow">New</span></body>`;
  const { html } = apply(page, primer);
  // the shaped element keeps a background (not stripped) and isn't tagged a kicker
  assert.match(html, /\.avatar\{[^}]*background:/);
  assert.doesNotMatch(html, /class="avatar rt-kicker"/);
  // the text pill is still de-pilled (background removed)
  assert.match(html, /\.eyebrow\{(?:(?!background:)[^}])*\}/);
});

test('normalizes form fields, labels, and table headers', () => {
  const { html } = apply(slopHtml, primer);
  const layer = html.match(/<style data-re-template[^>]*>([\s\S]*?)<\/style>/i)[1];
  assert.match(layer, /textarea[^{]*\{[^}]*border:1px solid var\(--rt-border\)/);
  assert.match(layer, /label,th\{color:var\(--rt-muted\)/);
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
