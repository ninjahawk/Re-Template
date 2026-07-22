// slop.js — the AI-slop fingerprint.
//
// A single source of truth for the visual tells of vibe-coded design, shared by
// the detector (which scores them) and the transformer (which removes them).
// Every tell is a named rule with a regex, a per-hit weight, and a cap, so the
// score is fully explainable: "you lost 24 points to indigo→purple gradients."

// The indigo / violet palette that AI tools reach for by default. Tailwind's
// indigo-* and purple-*/violet-* scales, plus the raw hexes they compile to.
export const SLOP_HEXES = [
  '#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#818cf8', '#a5b4fc',
  '#7c3aed', '#6d28d9', '#8b5cf6', '#a78bfa', '#c4b5fd', '#7e22ce',
  '#9333ea', '#a855f7', '#c084fc', '#d946ef', '#5b21b6', '#4c1d95',
];

// Words that flag an indigo/violet gradient without a hex (named colors,
// Tailwind stops, generic "purple").
const GRADIENT_WORDS = /(indigo|violet|purple|fuchsia|blurple)/i;

// Detection rules. `points` is charged per match up to `cap`. Totals are summed
// then clamped to 100, so a page drowning in one tell can't exceed the ceiling
// on its own — it takes a spread of tells to score truly high.
export const RULES = [
  {
    id: 'gradient-bg',
    label: 'indigo→purple gradient background',
    points: 9,
    cap: 24,
    test: (src) => {
      const grads = src.match(/(linear|radial|conic)-gradient\([^)]*\)/gi) || [];
      return grads.filter((g) => GRADIENT_WORDS.test(g) || SLOP_HEXES.some((h) => g.toLowerCase().includes(h)));
    },
  },
  {
    id: 'gradient-text',
    label: 'gradient-clipped headline text',
    points: 14,
    cap: 14,
    test: (src) => {
      // background-clip:text (or -webkit-) paired with a gradient / transparent fill.
      const hits = src.match(/(-webkit-)?background-clip\s*:\s*text|\btext-transparent\b|\bbg-clip-text\b/gi) || [];
      return hits;
    },
  },
  {
    id: 'default-font',
    label: 'Inter / default system font, no type choice',
    points: 10,
    cap: 10,
    test: (src) => {
      const inter = src.match(/font-family\s*:\s*[^;}]*inter/gi) || [];
      const cls = src.match(/\bfont-(inter|sans)\b/gi) || [];
      return [...inter, ...cls].slice(0, 1); // it's binary: styled on purpose or not
    },
  },
  {
    id: 'tailwind-indigo',
    label: 'Tailwind indigo/purple utility classes',
    points: 4,
    cap: 20,
    test: (src) => src.match(/\b(bg|text|from|via|to|border|ring|fill)-(indigo|violet|purple|fuchsia)-\d{2,3}\b/gi) || [],
  },
  {
    id: 'raw-indigo-hex',
    label: 'raw indigo/violet hex colors',
    points: 3,
    cap: 12,
    test: (src) => {
      const lower = src.toLowerCase();
      const out = [];
      for (const h of SLOP_HEXES) {
        let i = 0;
        while ((i = lower.indexOf(h, i)) !== -1) { out.push(h); i += h.length; }
      }
      return out;
    },
  },
  {
    id: 'emoji-heading',
    label: 'emoji in headings',
    points: 6,
    cap: 12,
    test: (src) => {
      const heads = src.match(/<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>/gi) || [];
      const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/u;
      return heads.filter((h) => emoji.test(h));
    },
  },
  {
    id: 'over-rounded',
    label: 'over-rounded corners everywhere',
    points: 3,
    cap: 9,
    test: (src) => {
      const big = src.match(/border-radius\s*:\s*(1[6-9]|[2-9]\d|\d{3,})px|border-radius\s*:\s*(1\.[5-9]|[2-9])rem|\brounded-(2xl|3xl|full)\b/gi) || [];
      return big;
    },
  },
  {
    id: 'glow-on-dark',
    label: 'colored glow-on-dark shadows',
    points: 5,
    cap: 10,
    test: (src) => src.match(/box-shadow\s*:[^;}]*(rgba?\([^)]*\)|#[0-9a-f]{3,8})[^;}]*\b([2-9]\d|\d{3,})px/gi) || [],
  },
  {
    id: 'generic-cta',
    label: 'generic "Get Started" CTA',
    points: 3,
    cap: 6,
    test: (src) => src.match(/>\s*(get started(?:\s+for\s+free)?|start (?:building|free)|try (?:it )?free)\s*</gi) || [],
  },
  {
    id: 'eyebrow-pill',
    label: 'pill "eyebrow" badge with leading dot',
    points: 3,
    cap: 6,
    test: (src) => src.match(/●|•|<span[^>]*rounded-full[^>]*>|✨\s*\w/gi) || [],
  },
];

// Analyze raw HTML/CSS source. Returns { score, level, findings[] }.
export function analyze(source) {
  const src = String(source || '');
  const findings = [];
  let total = 0;
  for (const rule of RULES) {
    const matches = rule.test(src) || [];
    const count = matches.length;
    if (count === 0) continue;
    const points = Math.min(rule.cap, count * rule.points);
    total += points;
    findings.push({ id: rule.id, label: rule.label, count, points });
  }
  const score = Math.max(0, Math.min(100, Math.round(total)));
  findings.sort((a, b) => b.points - a.points);
  return { score, level: level(score), findings };
}

export function level(score) {
  if (score >= 70) return 'heavy';
  if (score >= 40) return 'moderate';
  if (score >= 15) return 'light';
  return 'clean';
}
