// star-history.js — redraw the README star-history charts from live data.
//
// Run in CI (see .github/workflows/star-history.yml). Fetches stargazer
// timestamps from the GitHub API and plots a cumulative curve; on any failure
// (rate limit, no token, zero stars) it writes the "be the first" placeholder.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO = process.env.GITHUB_REPOSITORY || 'ninjahawk/Re-Template';
const TOKEN = process.env.GITHUB_TOKEN;
const MEDIA = join(dirname(fileURLToPath(import.meta.url)), '..', 'media');

const THEME = {
  light: { bg: '#ffffff', fg: '#1f2328', sub: '#59636e', axis: '#d1d9e0', grid: '#eef1f4', tick: '#8b949e', line: '#0969da' },
  dark: { bg: '#0d1117', fg: '#e6edf3', sub: '#7d8590', axis: '#30363d', grid: '#161b22', tick: '#6e7681', line: '#58a6ff' },
};

async function fetchStars() {
  const points = [];
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`https://api.github.com/repos/${REPO}/stargazers?per_page=100&page=${page}`, {
      headers: {
        Accept: 'application/vnd.github.star+json',
        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      },
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const batch = await res.json();
    if (!batch.length) break;
    for (const s of batch) points.push(new Date(s.starred_at).getTime());
    if (batch.length < 100) break;
  }
  return points.sort((a, b) => a - b);
}

function chart(theme, times) {
  const c = THEME[theme];
  const W = 640, H = 360, x0 = 72, x1 = 600, y0 = 300, yTop = 96;
  const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="-apple-system, Segoe UI, Roboto, sans-serif">
  <rect width="${W}" height="${H}" fill="${c.bg}"/>
  <text x="32" y="42" font-size="17" font-weight="700" fill="${c.fg}">Re-Template · star history</text>`;
  const axes = `
  <line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}" stroke="${c.axis}" stroke-width="1.5"/>
  <line x1="${x0}" y1="${yTop}" x2="${x0}" y2="${y0}" stroke="${c.axis}" stroke-width="1.5"/>
  <g stroke="${c.grid}" stroke-width="1"><line x1="${x0}" y1="249" x2="${x1}" y2="249"/><line x1="${x0}" y1="198" x2="${x1}" y2="198"/><line x1="${x0}" y1="147" x2="${x1}" y2="147"/></g>
  <text x="32" y="90" font-size="11" fill="${c.tick}">stars</text>
  <text x="596" y="320" font-size="11" fill="${c.tick}" text-anchor="end">time →</text>`;

  if (!times.length) {
    return `${head}
  <text x="32" y="64" font-size="12" fill="${c.sub}">Regenerated daily. Star the repo to plot the first point.</text>${axes}
  <text x="60" y="304" font-size="11" fill="${c.tick}" text-anchor="end">0</text>
  <circle cx="${x0}" cy="${y0}" r="5" fill="${c.line}"/>
  <text x="90" y="296" font-size="12" fill="${c.line}" font-weight="600">★ be the first</text>
</svg>`;
  }

  const n = times.length, tMin = times[0], tMax = times[n - 1] || tMin + 1;
  const sx = (t) => x0 + (x1 - x0) * ((t - tMin) / Math.max(1, tMax - tMin));
  const sy = (v) => y0 - (y0 - yTop) * (v / n);
  let d = `M ${x0} ${y0}`;
  times.forEach((t, i) => { d += ` L ${sx(t).toFixed(1)} ${sy(i + 1).toFixed(1)}`; });
  return `${head}
  <text x="32" y="64" font-size="12" fill="${c.sub}">${n} stars and counting.</text>${axes}
  <text x="60" y="304" font-size="11" fill="${c.tick}" text-anchor="end">0</text>
  <text x="60" y="100" font-size="11" fill="${c.tick}" text-anchor="end">${n}</text>
  <path d="${d}" fill="none" stroke="${c.line}" stroke-width="2.5" stroke-linejoin="round"/>
  <circle cx="${sx(tMax).toFixed(1)}" cy="${sy(n).toFixed(1)}" r="4" fill="${c.line}"/>
</svg>`;
}

let times = [];
try { times = await fetchStars(); } catch (e) { console.log('star fetch failed, writing placeholder:', e.message); }
writeFileSync(join(MEDIA, 'star-history.svg'), chart('light', times));
writeFileSync(join(MEDIA, 'star-history-dark.svg'), chart('dark', times));
console.log(`wrote star-history charts (${times.length} stars)`);
