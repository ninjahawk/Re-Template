// reformat.js — re-*structure* a page into a pack author's layout grammar.
//
// `apply` reskins: same skeleton, new paint. `reformat` goes further — it reads
// the page into a semantic content model (brand, headline, subhead, action,
// capabilities, footer) and re-emits it in the author's structure: a slim top
// bar, a hero framed as a restrained "quote", capabilities as a hairline table,
// a subscribe row, a footer. Deterministic: the same content always produces the
// same page, and the skeleton *is* the author's, so the output can't drift off
// style.
//
// It restructures real content only — it never fabricates metrics, charts, or
// status badges, because injecting invented data into someone's real page would
// misrepresent it.

import { loadPack } from './packs.js';

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;
// Decorative bullet/leader glyphs vibe-coded eyebrows use as a leading dot.
const BULLETS = /[•‣⁃∙▪○●◦‧·‣▪◦]/g;

// Collapse a run of HTML to its readable text: drop tags, emoji, bullets, space.
function text(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(EMOJI, '')
    .replace(BULLETS, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Escape text for safe insertion into the emitted HTML.
function esc(s) {
  return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const firstMatch = (src, re) => { const m = src.match(re); return m ? m[1] : ''; };

// Pull a semantic content model out of arbitrary slop HTML. Every field has a
// fallback so a thin or unusual page still yields something coherent.
export function extract(html) {
  const src = String(html || '');
  const noHead = src
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const title = text(firstMatch(src, /<title[^>]*>([\s\S]*?)<\/title>/i)) || 'Untitled';
  const siteName = title.split(/[—|·:]/)[0].trim() || title;

  // Brand: an explicit brand/logo element, else the first nav link, else the title.
  let brand = text(firstMatch(noHead, /<[^>]+class=["'][^"']*\b(?:brand|logo|wordmark)\b[^"']*["'][^>]*>([\s\S]*?)<\//i));
  if (!brand) brand = siteName;

  // Nav: link/label text inside a <nav> or a menu-ish container.
  let navRegion = firstMatch(noHead, /<nav[^>]*>([\s\S]*?)<\/nav>/i)
    || firstMatch(noHead, /<[^>]+class=["'][^"']*\b(?:menu|links|navbar)\b[^"']*["'][^>]*>([\s\S]*?)<\/[a-z]+>/i);
  const nav = [];
  if (navRegion) {
    for (const m of navRegion.matchAll(/<(?:a|span|li)[^>]*>([\s\S]*?)<\/(?:a|span|li)>/gi)) {
      const t = text(m[1]);
      if (t && t.length <= 24 && t.toLowerCase() !== brand.toLowerCase() && !nav.includes(t)) nav.push(t);
    }
  }

  // Headline: the first <h1>, else the biggest heading, else the title.
  const headline = text(firstMatch(noHead, /<h1[^>]*>([\s\S]*?)<\/h1>/i))
    || text(firstMatch(noHead, /<h2[^>]*>([\s\S]*?)<\/h2>/i))
    || siteName;

  // Subhead: the first reasonably long paragraph.
  let subhead = '';
  for (const m of noHead.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const t = text(m[1]);
    if (t.length >= 30) { subhead = t; break; }
  }

  // Primary action: a call-to-action button/link, else a sensible default.
  let cta = text(firstMatch(noHead, /<(?:a|button)[^>]*class=["'][^"']*\b(?:cta|btn|button|signup|sign-up|get-started|primary|action)\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|button)>/i))
    || text(firstMatch(noHead, /<button[^>]*>([\s\S]*?)<\/button>/i));
  if (!cta || cta.length > 32) cta = 'Get started';

  // Capabilities: repeated (heading + paragraph) blocks below the hero. We pair
  // each h2–h4 with the paragraph that follows it, skipping the h1/hero.
  const caps = [];
  const seen = new Set();
  const blockRe = /<h([2-4])[^>]*>([\s\S]*?)<\/h\1>\s*(?:<[^>]+>\s*)*?<p[^>]*>([\s\S]*?)<\/p>/gi;
  for (const m of noHead.matchAll(blockRe)) {
    const name = text(m[2]);
    const desc = text(m[3]);
    if (!name || name.length > 48 || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    caps.push({ name, desc });
    if (caps.length >= 8) break;
  }

  // Footer: an explicit <footer>, else a copyright line.
  let footer = text(firstMatch(noHead, /<footer[^>]*>([\s\S]*?)<\/footer>/i));
  if (!footer) footer = text(firstMatch(noHead, /(©[\s\S]{0,80}?)(?:<|$)/));

  // Kicker: an eyebrow/badge label, quieted (used above the hero).
  const kicker = text(firstMatch(noHead, /<[^>]+class=["'][^"']*\b(?:eyebrow|kicker|tag|badge|pill|overline)\b[^"']*["'][^>]*>([\s\S]*?)<\//i));

  return { title, siteName, brand, nav, headline, subhead, cta, caps, footer, kicker };
}

// Build the theme-aware CSS variables from a pack's color roles.
function themeVars(pack) {
  const c = pack.tokens.color.roles;
  const d = pack.tokens.color.rolesDark;
  const vars = (r) => [
    `--bg:${r.canvas};`,
    `--soft:${r.canvasSubtle || r.canvas};`,
    `--ink:${r.fg};`,
    `--muted:${r.muted || r.fg};`,
    `--border:${r.border || '#dadce0'};`,
    `--accent:${r.accent};`,
    `--accent-fg:${r.accentFg || '#fff'};`,
    `--up:${r.success || r.accent};`,
  ].join('');
  const sans = pack.tokens.font.sans;
  const mono = pack.tokens.font.mono || 'ui-monospace, SFMono-Regular, Menlo, monospace';
  let css = `:root{${vars(c)}--sans:${sans};--mono:${mono};}`;
  if (d) css += `@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${vars(d)}}}:root[data-theme="dark"]{${vars(d)}}:root[data-theme="light"]{${vars(c)}}`;
  return css;
}

const ONLY_EMPTY = (s) => !s || !s.trim();

// Render the content model into the author's structure. Pure string composition,
// so it is deterministic and dependency-free.
export function render(model, pack) {
  const m = model;
  const brandWords = (m.brand || m.siteName).trim().split(/\s+/);
  const brandHtml = brandWords.length > 1
    ? `<b>${esc(brandWords[0])}</b>${esc(' ' + brandWords.slice(1).join(' '))}`
    : `<b>${esc(brandWords[0] || 'Site')}</b>`;

  const nav = m.nav.length
    ? `<nav class="nav">${m.nav.map((t) => `<a>${esc(t)}</a>`).join('')}</nav>`
    : '';

  const crumb = `${esc((m.siteName || m.brand).toUpperCase())}${m.kicker ? ' · ' + esc(m.kicker.toUpperCase()) : ' · OVERVIEW'}`;

  const lede = ONLY_EMPTY(m.subhead) ? '' : `<p class="lede">${esc(m.subhead)}</p>`;

  const sub = `<form class="sub" onsubmit="return false">
      <input type="email" placeholder="you@company.com" aria-label="Email"/>
      <button>${esc(m.cta)}</button>
    </form>`;

  const table = m.caps.length ? `
  <section class="sec">
    <h2>Capabilities</h2>
    <table>
      <thead><tr><th>Capability</th><th>What it does</th></tr></thead>
      <tbody>
        ${m.caps.map((c) => `<tr><td class="name">${esc(c.name)}</td><td class="desc">${esc(c.desc)}</td></tr>`).join('\n        ')}
      </tbody>
    </table>
  </section>` : '';

  const footer = ONLY_EMPTY(m.footer) ? `© ${new Date().getFullYear()} ${esc(m.siteName)}` : esc(m.footer);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(m.title)}</title>
<style>
${themeVars(pack)}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:var(--sans);background:var(--bg);color:var(--ink);font-size:14px;line-height:1.5;font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}
.wrap{max-width:1040px;margin:0 auto;padding:0 24px}
.bar{display:flex;align-items:center;justify-content:space-between;gap:24px;height:52px;border-bottom:1px solid var(--border)}
.brand{font-size:16px;font-weight:500;letter-spacing:-.01em}
.brand b{font-weight:700}
.nav{display:flex;gap:22px;font-size:13px;color:var(--muted);flex-wrap:wrap}
.nav a{color:inherit;text-decoration:none;cursor:pointer}
.nav a:hover{color:var(--ink)}
.quote{padding:40px 0 8px}
.crumb{font-family:var(--mono);font-size:12px;color:var(--muted);letter-spacing:.02em;margin-bottom:12px}
.head{font-size:clamp(34px,6vw,50px);font-weight:400;letter-spacing:-.02em;line-height:1.08;max-width:16ch}
.lede{color:var(--muted);font-size:16px;max-width:60ch;margin:16px 0 0}
.sub{margin-top:26px;display:flex;gap:8px;max-width:420px}
.sub input{flex:1;min-width:0;padding:9px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--ink);font:inherit}
.sub input:focus{outline:none;border-color:var(--accent)}
.sub button{padding:9px 18px;border:1px solid transparent;border-radius:8px;background:var(--accent);color:var(--accent-fg);font-weight:500;font-size:13.5px;cursor:pointer}
.sec{margin-top:44px}
.sec h2{font-size:11px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:8px}
table{width:100%;border-collapse:collapse;font-size:14px}
th{text-align:left;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);padding:10px 12px;border-bottom:1px solid var(--border)}
td{padding:14px 12px;border-bottom:1px solid var(--border);vertical-align:top}
td.name{font-weight:500;white-space:nowrap;padding-right:28px}
td.desc{color:var(--muted)}
footer{margin-top:44px;padding:22px 0;border-top:1px solid var(--border);color:var(--muted);font-size:12.5px}
</style></head><body><div class="wrap">
  <header class="bar">
    <div class="brand">${brandHtml}</div>
    ${nav}
  </header>
  <section class="quote">
    <div class="crumb">${crumb}</div>
    <h1 class="head">${esc(m.headline)}</h1>
    ${lede}
    ${sub}
  </section>${table}
  <footer>${footer}</footer>
</div></body></html>
`;
}

// One call: extract → render. Always returns a valid poke500-structured page.
export function reformat(html, pack) {
  const p = pack && pack.tokens ? pack : loadPack(pack || 'poke500');
  return render(extract(html), p);
}
