// apply.js — the reskin engine.
//
// Takes raw HTML (with inline <style> and/or inline styles) plus a brand pack,
// and rewrites the *system-level* choices — color, type, gradients, radius,
// elevation — so the page inherits the pack's design language instead of the
// vibe-coded defaults. It replaces the look; it does not just strip it.
//
// Returns { html, changes } where `changes` is an explainable ledger of what
// was rewritten and how many times.

import { SLOP_HEXES } from './slop.js';

const GRADIENT_WORDS = /(indigo|violet|purple|fuchsia|blurple)/i;

// Emit the --rt-* custom properties for one set of color roles.
function roleVars(c) {
  return [
    `--rt-canvas:${c.canvas};`,
    `--rt-canvas-subtle:${c.canvasSubtle || c.canvas};`,
    `--rt-fg:${c.fg};`,
    `--rt-muted:${c.muted || c.fg};`,
    `--rt-accent:${c.accent};`,
    `--rt-accent-fg:${c.accentFg || '#fff'};`,
    `--rt-border:${c.border || '#d1d9e0'};`,
    `--rt-up:${c.success || c.accent};`,
    `--rt-down:${c.danger || c.accent};`,
  ].join('');
}

// Build the CSS custom properties for a pack, plus a normalizing base layer.
// Every transform below points at these variables, so a page reskinned to any
// pack resolves through one consistent set of tokens. When the pack ships a dark
// role set (`color.rolesDark`), the layer becomes theme-aware exactly the way a
// real design system does it: follow the OS by default, and honor an explicit
// `data-theme` on :root as an override.
function packStylesheet(pack) {
  const c = pack.tokens.color.roles;
  const dark = pack.tokens.color.rolesDark;
  const radius = pack.tokens.radius?.md ?? 8;
  const shadow = pack.tokens.shadow?.md ?? '0 3px 6px rgba(31,35,40,.15)';
  const sans = pack.tokens.font.sans;
  const mono = pack.tokens.font.mono || 'ui-monospace, SFMono-Regular, Menlo, monospace';
  const scale = pack.tokens.font.scale || [14, 16, 20, 24, 32, 40];

  let theming = '';
  if (dark) {
    theming = `
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${roleVars(dark)}}}
:root[data-theme="dark"]{${roleVars(dark)}}
:root[data-theme="light"]{${roleVars(c)}}`;
  }

  return `
/* re-template · reskinned to "${pack.name}" (${pack.basedOn})${dark ? ' · light + dark' : ''} */
:root{${roleVars(c)}--rt-sans:${sans};--rt-mono:${mono};--rt-radius:${radius}px;--rt-shadow:${shadow};}${theming}
body{font-family:var(--rt-sans);color:var(--rt-fg);background:var(--rt-canvas);-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums;}
h1,h2,h3,h4{font-family:var(--rt-sans);color:var(--rt-fg);letter-spacing:-0.01em;line-height:1.2;}
h1{font-size:${(scale[scale.length - 1] || 40) / 16}rem;font-weight:500;}
a{color:var(--rt-accent);}
code,kbd,samp,.rt-mono,.ticker{font-family:var(--rt-mono);}
.rt-btn,button,.btn{border-radius:var(--rt-radius);}
`.trim();
}

// A single ordered pass of textual rewrites. Each entry records its own count.
export function apply(source, pack) {
  let html = String(source || '');
  const changes = [];
  const record = (id, label, n) => { if (n > 0) changes.push({ id, label, count: n }); };
  const rules = pack.rules || {};

  // 1. Gradient-clipped text → solid foreground. Kill the clip, restore the fill.
  let n = 0;
  html = html.replace(/(-webkit-)?background-clip\s*:\s*text\s*;?/gi, () => (n++, 'background-clip:border-box;'));
  html = html.replace(/-webkit-text-fill-color\s*:\s*transparent\s*;?/gi, () => 'color:var(--rt-fg);');
  html = html.replace(/(^|[;{\s])color\s*:\s*transparent\s*;?/gi, (m, p) => `${p}color:var(--rt-fg);`);
  html = html.replace(/\b(text-transparent|bg-clip-text)\b/g, () => '');
  record('gradient-text', 'gradient headline text → solid foreground', n);

  // 2. Indigo/violet gradients (background) → subtle canvas fill.
  n = 0;
  html = html.replace(/(linear|radial|conic)-gradient\([^)]*\)/gi, (g) => {
    if (GRADIENT_WORDS.test(g) || SLOP_HEXES.some((h) => g.toLowerCase().includes(h))) {
      n++; return 'var(--rt-canvas-subtle)';
    }
    return g;
  });
  record('gradient-bg', 'indigo→purple gradient → subtle canvas', n);

  // 3. Raw indigo/violet hexes → accent.
  n = 0;
  const hexRe = new RegExp(`(${SLOP_HEXES.join('|')})\\b`, 'gi');
  html = html.replace(hexRe, () => (n++, 'var(--rt-accent)'));
  record('raw-indigo-hex', 'indigo/violet hex → accent color', n);

  // 4. Inter / default font declarations → pack sans.
  n = 0;
  html = html.replace(/font-family\s*:\s*[^;}]*inter[^;}]*/gi, () => (n++, 'font-family:var(--rt-sans)'));
  record('default-font', 'Inter → pack type family', n);

  // 5. Tailwind indigo/purple utilities → accent-mapped equivalents.
  n = 0;
  html = html.replace(/\b(bg|text|from|via|to|border|ring|fill)-(indigo|violet|purple|fuchsia)-\d{2,3}\b/gi,
    (m, prop) => { n++; return prop === 'text' ? 'rt-text-accent' : prop === 'bg' ? 'rt-bg-accent' : ''; });
  record('tailwind-indigo', 'Tailwind indigo/purple utilities → accent', n);

  // 6. Over-rounded corners → pack radius.
  if (rules.flattenOverRoundedCorners !== false) {
    n = 0;
    html = html.replace(/border-radius\s*:\s*(?:(?:1[6-9]|[2-9]\d|\d{3,})px|(?:1\.[5-9]|[2-9](?:\.\d+)?)rem)\s*;?/gi,
      () => (n++, 'border-radius:var(--rt-radius);'));
    html = html.replace(/\brounded-(2xl|3xl)\b/g, () => (n++, 'rounded-md'));
    record('over-rounded', 'over-rounded corners → pack radius', n);
  }

  // 7. Colored glow shadows → restrained pack elevation.
  if (rules.killGlowOnDark !== false) {
    n = 0;
    html = html.replace(/box-shadow\s*:[^;}]*(?:rgba?\([^)]*\)|#[0-9a-f]{3,8})[^;}]*\b(?:[2-9]\d|\d{3,})px[^;}]*;?/gi,
      () => (n++, 'box-shadow:var(--rt-shadow);'));
    record('glow-on-dark', 'colored glow → restrained elevation', n);
  }

  // 8. Emoji in headings → removed.
  if (rules.demoteEmojiHeadings !== false) {
    n = 0;
    const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;
    html = html.replace(/<h([1-3])([^>]*)>([\s\S]*?)<\/h\1>/gi, (m, lvl, attrs, inner) => {
      if (!emoji.test(inner)) return m;
      n++;
      const cleaned = inner.replace(emoji, '').replace(/\s{2,}/g, ' ').trim();
      return `<h${lvl}${attrs}>${cleaned}</h${lvl}>`;
    });
    record('emoji-heading', 'emoji removed from headings', n);
  }

  // 9. Inject the pack stylesheet so unstyled elements still inherit the system.
  const css = `<style data-re-template="${pack.id}">\n${packStylesheet(pack)}\n</style>`;
  if (/<\/head>/i.test(html)) {
    html = html.replace(/<\/head>/i, `${css}\n</head>`);
  } else if (/<body[^>]*>/i.test(html)) {
    html = html.replace(/(<body[^>]*>)/i, `$1\n${css}`);
  } else {
    html = `${css}\n${html}`;
  }
  changes.push({ id: 'inject-pack', label: `injected "${pack.name}" token layer`, count: 1 });

  return { html, changes };
}
