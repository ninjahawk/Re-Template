// build-demo.js — generate the deterministic demo stage used to record media.
//
// The stage renders the *real* before/after sites (before = the slop example,
// after = the actual output of apply()) inside isolated iframes, with a terminal
// that types the real command and streams the real change ledger. Everything is
// a pure function of a timeline position `t`, exposed as window.seek(t), so the
// recorder can render exact, reproducible frames.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { analyze } from '../src/slop.js';
import { apply } from '../src/apply.js';
import { loadPack } from '../src/packs.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const beforeHtml = readFileSync(join(ROOT, 'examples', 'slop', 'index.html'), 'utf8');
const pack = loadPack('primer');
const { html: afterHtml, changes } = apply(beforeHtml, pack);
const beforeScore = analyze(beforeHtml).score;
const afterScore = analyze(afterHtml).score;

// The command and the ledger lines the terminal will show — taken from the real run.
const command = 're-template apply --pack primer ./site';
const ledger = changes
  .filter((c) => c.id !== 'inject-pack')
  .map((c) => c.label + (c.count > 1 ? `  (×${c.count})` : ''));

const data = { beforeHtml, afterHtml, beforeScore, afterScore, command, ledger, packName: pack.name };

const stage = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  :root { --w: 1280px; --h: 720px; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: var(--w); height: var(--h); overflow: hidden;
    background: radial-gradient(120% 120% at 50% 0%, #10151f 0%, #0a0d13 60%, #070a0f 100%);
    font-family: ui-monospace, 'SF Mono', 'DejaVu Sans Mono', monospace; color: #e6edf3; }
  #stage { position: relative; width: var(--w); height: var(--h); }

  .topbar { position: absolute; top: 22px; left: 32px; display: flex; align-items: center; gap: 12px; z-index: 5; }
  .logo { font-weight: 700; font-size: 18px; letter-spacing: -0.01em; color: #f0f6fc;
    font-family: -apple-system, 'Segoe UI', 'DejaVu Sans', sans-serif; }
  .logo b { color: #58a6ff; }
  .tag { font-size: 13px; color: #7d8590; font-family: -apple-system, 'DejaVu Sans', sans-serif; }

  /* Browser window holding the site */
  .browser { position: absolute; top: 74px; left: 80px; width: 1120px; height: 520px;
    border-radius: 12px; overflow: hidden; background: #fff;
    box-shadow: 0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06);
  }
  .chrome { height: 38px; background: #161b22; display: flex; align-items: center; padding: 0 14px; gap: 8px;
    border-bottom: 1px solid rgba(255,255,255,0.06); position: relative; z-index: 3; }
  .dot { width: 12px; height: 12px; border-radius: 50%; }
  .dot.r { background: #ff5f57; } .dot.y { background: #febc2e; } .dot.g { background: #28c840; }
  .url { flex: 1; text-align: center; font-size: 12px; color: #7d8590; }
  .viewport { position: relative; width: 100%; height: calc(520px - 38px); }
  .viewport iframe { position: absolute; inset: 0; width: 1120px; height: 482px; border: 0; background: #fff; }
  #after { clip-path: inset(0 100% 0 0); will-change: clip-path; }
  /* wipe seam */
  #seam { position: absolute; top: 0; bottom: 0; width: 3px; background: linear-gradient(#58a6ff,#a371f7);
    box-shadow: 0 0 18px 2px rgba(88,166,255,0.8); left: 0; opacity: 0; z-index: 2; }

  /* Score badge */
  .badge { position: absolute; top: 92px; right: 104px; z-index: 6;
    background: #161b22; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
    padding: 10px 16px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    font-family: -apple-system, 'DejaVu Sans', sans-serif; }
  .badge .lbl { font-size: 10px; letter-spacing: 0.14em; color: #7d8590; text-transform: uppercase; }
  .badge .num { font-size: 30px; font-weight: 800; line-height: 1.1; }
  .badge .sub { font-size: 10px; color: #7d8590; }

  /* Terminal */
  .term { position: absolute; left: 80px; right: 80px; bottom: 30px; height: 150px;
    background: rgba(13,17,23,0.96); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
    padding: 16px 20px; font-size: 15px; line-height: 1.55; z-index: 7;
    box-shadow: 0 20px 60px rgba(0,0,0,0.6); transform: translateY(200px); opacity: 0; }
  .term .cmdline { color: #e6edf3; white-space: pre; }
  .term .prompt { color: #3fb950; } .term .flag { color: #d2a8ff; } .term .path { color: #58a6ff; }
  .cursor { display: inline-block; width: 9px; height: 18px; background: #e6edf3; vertical-align: -3px; margin-left: 2px; }
  .term .ledger { margin-top: 8px; color: #adbac7; font-size: 13.5px; line-height: 1.5; }
  .term .ledger div { opacity: 0; }
  .term .ledger .ck { color: #3fb950; }
  .result { margin-top: 6px; font-size: 13.5px; opacity: 0; font-family: -apple-system,'DejaVu Sans',sans-serif; }

  /* Caption */
  .caption { position: absolute; left: 0; right: 0; bottom: 0; text-align: center; z-index: 8;
    font-family: -apple-system, 'DejaVu Sans', sans-serif; font-size: 15px; color: #c9d1d9;
    padding-bottom: 30px; opacity: 0; }
</style>
</head>
<body>
<div id="stage">
  <div class="topbar"><span class="logo">Re<b>-</b>Template</span><span class="tag">reskin the vibe-coded look</span></div>

  <div class="badge" id="badge">
    <div class="lbl">Slop score</div>
    <div class="num" id="badgeNum">--</div>
    <div class="sub" id="badgeSub"></div>
  </div>

  <div class="browser">
    <div class="chrome"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
      <span class="url">flowsync.app</span></div>
    <div class="viewport">
      <iframe id="before"></iframe>
      <iframe id="after"></iframe>
      <div id="seam"></div>
    </div>
  </div>

  <div class="term" id="term">
    <div class="cmdline"><span class="prompt">$</span> <span id="typed"></span><span class="cursor" id="cursor"></span></div>
    <div class="ledger" id="ledger"></div>
    <div class="result" id="result"></div>
  </div>

  <div class="caption" id="caption"></div>
</div>

<script id="data" type="application/json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
<script>
const D = JSON.parse(document.getElementById('data').textContent);
document.getElementById('before').srcdoc = D.beforeHtml;
document.getElementById('after').srcdoc = D.afterHtml;

// Build the command markup (prompt already outside). Highlight flag + path.
const cmdFull = D.command;
// Build ledger rows
const ledgerEl = document.getElementById('ledger');
D.ledger.forEach((line) => {
  const div = document.createElement('div');
  div.innerHTML = '<span class="ck">✓</span> ' + line;
  ledgerEl.appendChild(div);
});
const ledgerRows = [...ledgerEl.children];

const DURATION = 8600;
const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
const ease = (x)=> x<=0?0 : x>=1?1 : 1-Math.pow(1-x,3);

function fmtCmd(sub){
  // colorize the revealed substring
  let out = '';
  const flagIdx = cmdFull.indexOf('--pack');
  for (let i=0;i<sub.length;i++){
    out += sub[i];
  }
  // simple: wrap known tokens after full reveal handled by CSS spans is complex; keep plain + color via replace
  let html = sub
    .replace('--pack', '<span class="flag">--pack</span>')
    .replace('./site', '<span class="path">./site</span>');
  return html;
}

function render(t){
  t = clamp(t, 0, DURATION);
  // Terminal slide-in: 1500-1950
  const slide = ease(clamp((t-1500)/450,0,1));
  const term = document.getElementById('term');
  term.style.transform = 'translateY(' + (200*(1-slide)) + 'px)';
  term.style.opacity = slide;

  // Typing: 1950-3050
  const typeP = clamp((t-1950)/1100,0,1);
  const nChars = Math.round(typeP * cmdFull.length);
  document.getElementById('typed').innerHTML = fmtCmd(cmdFull.slice(0,nChars));
  document.getElementById('cursor').style.opacity = (t>1500 && Math.floor(t/450)%2===0) ? 1 : 0.15;

  // Ledger stream: start 3250, each row +230ms
  const rowStart = 3250, rowGap = 230;
  ledgerRows.forEach((row,i)=>{
    row.style.opacity = t >= rowStart + i*rowGap ? 1 : 0;
  });
  const lastRow = rowStart + (ledgerRows.length)*rowGap;

  // Wipe: after last row, 5300-6150
  const wipeStart = 5300, wipeEnd = 6150;
  const wp = ease(clamp((t-wipeStart)/(wipeEnd-wipeStart),0,1));
  document.getElementById('after').style.clipPath = 'inset(0 ' + (100 - wp*100) + '% 0 0)';
  const seam = document.getElementById('seam');
  seam.style.left = (wp*1120) + 'px';
  seam.style.opacity = (wp>0 && wp<1) ? 1 : 0;

  // Badge: number + color
  const num = document.getElementById('badgeNum');
  const sub = document.getElementById('badgeSub');
  let score, color, subtxt;
  if (t < wipeStart){ score = D.beforeScore; color='#f85149'; subtxt='heavy'; }
  else if (t < wipeEnd){ score = Math.round(D.beforeScore + (D.afterScore-D.beforeScore)*wp); color = wp<0.5?'#f85149':'#3fb950'; subtxt = wp<0.5?'heavy':'clean'; }
  else { score = D.afterScore; color='#3fb950'; subtxt='clean'; }
  num.textContent = score; num.style.color = color; sub.textContent = subtxt;

  // Result line
  const result = document.getElementById('result');
  result.style.opacity = t > lastRow + 120 ? 1 : 0;
  result.innerHTML = 'slop <b style="color:#f85149">'+D.beforeScore+'</b> → <b style="color:#3fb950">'+D.afterScore+'</b> &nbsp;·&nbsp; reskinned to <b>'+D.packName+'</b>';

  // Captions
  const cap = document.getElementById('caption');
  let capTxt = '', capOp = 0;
  if (t < 1400){ capTxt = 'Every AI-built site wears the same uniform.'; capOp = ease(clamp((t-200)/500,0,1)) * (t>1100?ease(clamp((1400-t)/300,0,1)):1); }
  else if (t > wipeEnd + 200){ capTxt = 'Now it looks like a real team shipped it.'; capOp = ease(clamp((t-wipeEnd-200)/500,0,1)); }
  cap.textContent = capTxt; cap.style.opacity = capOp;
}

window.__duration = DURATION;
window.seek = (t)=>{ render(t); };
// Real-time playback for video capture (?play=1 → window.play()).
window.play = ()=>{
  const HOLD = 1200; const start = performance.now();
  function tick(now){
    const t = now - start;
    render(Math.min(t, DURATION));
    if (t < DURATION + HOLD) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
};
render(0);
</script>
</body>
</html>`;

mkdirSync(join(ROOT, 'media'), { recursive: true });
writeFileSync(join(HERE, 'demo-stage.html'), stage);
console.log(`built demo-stage.html  (before=${beforeScore} after=${afterScore}, ${ledger.length} ledger rows)`);
