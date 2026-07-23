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
/* Primary actions get a real, filled button in the pack's language — otherwise a
   CTA whose slop gradient became a subtle canvas fill turns into invisible
   light-on-light text. The injected layer loads last, so these win the cascade. */
.rt-btn,button,.btn,.cta,a.cta,[role="button"],input[type="submit"],input[type="button"]{border-radius:var(--rt-radius);background:var(--rt-accent);color:var(--rt-accent-fg);border:1px solid transparent;}
/* Cards are defined by a hairline and a faint surface one step off the canvas —
   restrained, the way a data-terminal delineates a panel. No fill, no heavy
   shadow; the accent stays reserved for genuine actions like the buttons. */
.rt-card,.card,[class*="card"],.panel,.tile{background:var(--rt-canvas-subtle);border:1px solid var(--rt-border);border-radius:var(--rt-radius);box-shadow:none;}
/* The author's house style — the details that make it read as *his* page, not a
   recolored one. Kicker/eyebrow labels are small, quiet, uppercase (never a
   colored badge). Nav is muted ink that warms to the accent on hover. So the one
   accent stays reserved for real actions and the whole thing feels authored. */
.eyebrow,[class*="eyebrow"],[class*="kicker"],[class*="overline"]{color:var(--rt-muted);text-transform:uppercase;letter-spacing:.06em;font-weight:500;font-size:.6875rem;}
nav a,nav .links,header nav a{color:var(--rt-muted);}
nav a:hover,nav .links:hover{color:var(--rt-fg);}
`.trim();
}

// A single ordered pass of textual rewrites. Each entry records its own count.
export function apply(source, pack) {
  let html = String(source || '');
  const changes = [];
  const record = (id, label, n) => { if (n > 0) changes.push({ id, label, count: n }); };
  const rules = pack.rules || {};

  // 0. Pre-pass: in any rule block that clips its background to text, drop the
  // gradient fill outright. Otherwise, once we neutralize `background-clip:text`
  // below, the gradient that fed the clip survives as a visible colored box
  // behind the (now solid) headline. A clipped-text gradient is decoration for
  // the glyphs, not a real background — so it should vanish, not become a fill.
  html = html.replace(/\{[^{}]*\}/g, (block) => {
    if (!/background-clip\s*:\s*text/i.test(block)) return block;
    return block.replace(
      /background(-image)?\s*:\s*(?:linear|radial|conic)-gradient\([^;}]*\)\s*;?/gi,
      'background:transparent;',
    );
  });

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

  // 3b. Near-white text colors → pack foreground. Vibe-coded pages set light
  // text (`#fff`, tailwind gray-50/100…) for a dark hero; once the canvas flips
  // to the pack's light surface, that text goes invisible (white headings, an
  // unreadable brand). Map it to the readable foreground. The lookbehind keeps
  // us on the `color` property — never `background-color`/`border-color` — and
  // buttons re-assert their accent-on-fill label through the injected layer.
  n = 0;
  html = html.replace(
    /(?<![-\w])color\s*:\s*(#fff(?:fff)?|#fefefe|#fcfcfc|#fafafa|#f9fafb|#f8f9fa|#f3f4f6|#f1f5f9|#e5e7eb|#e2e8f0|white|rgba?\(\s*255\s*,\s*255\s*,\s*255\b[^)]*\))/gi,
    () => (n++, 'color:var(--rt-fg)'),
  );
  record('white-text', 'near-white text (for a dark hero) → pack foreground', n);

  // 4. Inter / default font declarations → pack sans.
  n = 0;
  html = html.replace(/font-family\s*:\s*[^;}]*inter[^;}]*/gi, () => (n++, 'font-family:var(--rt-sans)'));
  record('default-font', 'Inter → pack type family', n);

  // 5. Tailwind indigo/purple utilities → accent-mapped equivalents.
  n = 0;
  html = html.replace(/\b(bg|text|from|via|to|border|ring|fill)-(indigo|violet|purple|fuchsia)-\d{2,3}\b/gi,
    (m, prop) => { n++; return prop === 'text' ? 'rt-text-accent' : prop === 'bg' ? 'rt-bg-accent' : ''; });
  record('tailwind-indigo', 'Tailwind indigo/purple utilities → accent', n);

  // 5b. De-pill "eyebrow"/badge chips. The vibe-coded eyebrow is an inline label
  // wrapped in a full-radius pill with a tinted fill and a leading ● dot. Real
  // design languages set an eyebrow as plain (usually small, muted) text — no
  // bubble. So strip the fill/border/shadow off any painted full pill, and drop
  // the leading dot glyph. Runs before the radius pass, while the pill is still
  // recognizable by its huge border-radius.
  if (rules.demoteEyebrowPills !== false) {
    n = 0;
    // (a) CSS: a rule that rounds into a full pill (≥100px radius) *and* paints a
    //     background is a chip — remove what makes it a bubble.
    html = html.replace(/\{[^{}]*\}/g, (block) => {
      const isPill = /border-radius\s*:\s*\d{3,}px/i.test(block);
      if (!isPill || !/background(-color|-image)?\s*:/i.test(block)) return block;
      n++;
      return block
        .replace(/background(-color|-image)?\s*:[^;}]*;?/gi, '')
        .replace(/border\s*:[^;}]*;?/gi, '')
        .replace(/box-shadow\s*:[^;}]*;?/gi, '');
    });
    // (b) Tailwind: the rounded-full pill utility.
    html = html.replace(/\brounded-full\b/g, () => (n++, ''));
    // (c) Leading dot glyph that opens an inline label (e.g. `>● Now with…`).
    html = html.replace(/(>)\s*[●•]\s*/g, (m, gt) => (n++, gt));
    record('eyebrow-pill', 'eyebrow pill badge → plain label', n);
  }

  // 6. Over-rounded corners → pack radius.
  if (rules.flattenOverRoundedCorners !== false) {
    n = 0;
    html = html.replace(/border-radius\s*:\s*(?:(?:1[6-9]|[2-9]\d|\d{3,})px|(?:1\.[5-9]|[2-9](?:\.\d+)?)rem)\s*;?/gi,
      () => (n++, 'border-radius:var(--rt-radius);'));
    html = html.replace(/\brounded-(2xl|3xl)\b/g, () => (n++, 'rounded-md'));
    record('over-rounded', 'over-rounded corners → pack radius', n);
  }

  // 7. Colored glow shadows → restrained pack elevation. A "glow" is a shadow
  // that carries a color *and* a large blur/offset — regardless of which comes
  // first (e.g. `0 30px 80px rgba(...)` puts the big radius before the color).
  if (rules.killGlowOnDark !== false) {
    n = 0;
    html = html.replace(/box-shadow\s*:\s*([^;}]*);?/gi, (m, value) => {
      const hasColor = /rgba?\([^)]*\)|#[0-9a-f]{3,8}/i.test(value);
      const hasBigBlur = /\b(?:[2-9]\d|\d{3,})px\b/.test(value);
      if (hasColor && hasBigBlur) { n++; return 'box-shadow:var(--rt-shadow);'; }
      return m;
    });
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

  // 8b. Emoji used as iconography/decoration → gone. Headings are handled above;
  // here we take the rest: an element whose entire content is emoji (the icon
  // "tile" in feature cards), plus stray decorative emoji left in body text
  // (brand ✨, footer ❤️). A real design language uses an icon set, not emoji.
  if (rules.demoteEmojiIcons !== false) {
    n = 0;
    const RANGES = '\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{2190}-\\u{21FF}\\u{2B00}-\\u{2BFF}\\u{FE0F}\\u{200D}';
    const oneEmoji = new RegExp(`[${RANGES}]`, 'u');
    const emojiRun = new RegExp(`[${RANGES}]+`, 'gu');
    // (a) An element that is *only* emoji is a decorative icon — drop it whole,
    //     so we don't leave an empty tinted tile behind.
    html = html.replace(new RegExp(`<(\\w+)[^>]*>[\\s${RANGES}]*<\\/\\1>`, 'gu'), (m) => {
      if (!oneEmoji.test(m)) return m;
      n++;
      return '';
    });
    // (b) Emoji still sitting in a text run → removed, with whitespace/punctuation
    //     tidied so we don't leave "with  and" or a dangling space.
    html = html.replace(/>([^<]*)</g, (m, text) => {
      if (!oneEmoji.test(text)) return m;
      n++;
      const cleaned = text
        .replace(emojiRun, '')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\s+([.,;:!?])/g, '$1');
      return `>${cleaned}<`;
    });
    record('emoji-icon', 'emoji icons/decorations removed', n);
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
