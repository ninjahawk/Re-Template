// record.js — render the demo stage to media/ (gif, mp4, stills).
//
// Drives tools/demo-stage.html frame by frame via window.seek(t), screenshots
// each frame, then assembles them with Playwright's bundled ffmpeg. Deterministic:
// every frame is rendered at an exact timeline position, so the output is stable.

import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, readdirSync, existsSync, readFileSync, createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';
import GIFEncoder from 'gif-encoder-2';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const MEDIA = join(ROOT, 'media');
const FRAMES = join(HERE, '.frames');

const FFMPEG = '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
const CHROME = firstExisting([
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  ...glob('/opt/pw-browsers', /^chromium-\d+$/).map((d) => join('/opt/pw-browsers', d, 'chrome-linux', 'chrome')),
]);

const W = 1280, H = 720, FPS = 25, HOLD_MS = 1200;

function glob(dir, re) { try { return readdirSync(dir).filter((n) => re.test(n)); } catch { return []; } }
function firstExisting(paths) { return paths.find((p) => existsSync(p)); }
function pad(n) { return String(n).padStart(4, '0'); }

const REUSE = process.env.REUSE_FRAMES === '1';

async function main() {
  if (REUSE && existsSync(join(FRAMES, 'f0000.png'))) {
    console.log('REUSE_FRAMES=1 — reusing captured frames, re-encoding only');
    const duration = 8600;
    await encodeGif();
    await recordWebm(duration + HOLD_MS);
    console.log('done (reuse): media/demo.gif, media/demo.webm');
    return;
  }
  rmSync(FRAMES, { recursive: true, force: true });
  mkdirSync(FRAMES, { recursive: true });
  mkdirSync(MEDIA, { recursive: true });

  const browser = await chromium.launch({ executablePath: CHROME, args: ['--force-color-profile=srgb'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1.5 });
  await page.goto('file://' + join(HERE, 'demo-stage.html'));
  await page.waitForFunction('typeof window.seek === "function" && window.__duration > 0');
  // Let the iframed sites paint (fonts/layout).
  await page.waitForTimeout(500);

  const duration = await page.evaluate(() => window.__duration);
  const step = 1000 / FPS;
  const nFrames = Math.ceil(duration / step);
  const holdFrames = Math.round((HOLD_MS / 1000) * FPS);

  console.log(`recording ${nFrames}+${holdFrames} frames @ ${FPS}fps  (duration ${duration}ms)`);

  let idx = 0;
  for (let i = 0; i <= nFrames; i++) {
    const t = Math.min(i * step, duration);
    await page.evaluate((tt) => window.seek(tt), t);
    await page.screenshot({ path: join(FRAMES, `f${pad(idx++)}.png`), animations: 'disabled' });
  }
  // Hold on the final clean frame.
  await page.evaluate((tt) => window.seek(tt), duration);
  for (let i = 0; i < holdFrames; i++) {
    await page.screenshot({ path: join(FRAMES, `f${pad(idx++)}.png`), animations: 'disabled' });
  }

  // Stills — three moments, mirroring a real product's "what the tool shows" trio.
  const stills = {
    still_slop: 1200,   // the slop site, badge 84
    still_apply: 4900,  // terminal mid-stream, checkmarks landing
    still_clean: 6700,  // the reskinned site (light), badge 9, before the dark reveal
    still_dark: 8600,   // same page, dark theme — the pack is theme-aware
  };
  for (const [name, t] of Object.entries(stills)) {
    await page.evaluate((tt) => window.seek(tt), t);
    await page.screenshot({ path: join(MEDIA, `${name}.png`), animations: 'disabled' });
  }

  await browser.close();
  console.log(`captured ${idx} frames; encoding…`);

  await encodeGif();

  // WebM — the "watch the demo" link target. Recorded in real time via
  // Playwright's native capture (the stripped ffmpeg can't read a frame sequence).
  await recordWebm(duration + HOLD_MS);

  console.log('done: media/demo.gif, media/demo.webm, media/still_*.png');
}

// GIF — the inline hero asset. Pure-JS neuquant encoder; subsample to keep the
// file README-friendly, downscale to gifW, one hold frame trimmed at the tail.
async function encodeGif() {
  const gifFps = 12.5, gifW = 920;
  const stride = Math.max(1, Math.round(FPS / gifFps)); // 25→ every 2nd frame
  const scaled = gifW, scaledH = Math.round((gifW / W) * H);
  const frames = readdirSync(FRAMES).filter((f) => /^f\d+\.png$/.test(f)).sort();
  const enc = new GIFEncoder(scaled, scaledH, 'neuquant', true);
  const out = createWriteStream(join(MEDIA, 'demo.gif'));
  const done = new Promise((res) => out.on('close', res));
  enc.createReadStream().pipe(out);
  enc.start();
  enc.setRepeat(0);
  enc.setDelay(Math.round(1000 / gifFps) * stride);
  enc.setQuality(16);
  let used = 0;
  for (let i = 0; i < frames.length; i += stride) {
    const png = PNG.sync.read(readFileSync(join(FRAMES, frames[i])));
    enc.addFrame(downscaleRGBA(png, scaled, scaledH));
    used++;
  }
  enc.finish();
  await done;
  console.log(`gif: ${used} frames, ${scaled}x${scaledH}`);
}

// Play the stage in real time (?play=1) and let Playwright capture the page to webm.
async function recordWebm(totalMs) {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--force-color-profile=srgb'] });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H }, deviceScaleFactor: 1,
    recordVideo: { dir: FRAMES, size: { width: W, height: H } },
  });
  const page = await ctx.newPage();
  await page.goto('file://' + join(HERE, 'demo-stage.html') + '?play=1');
  await page.waitForFunction('typeof window.play === "function"');
  await page.waitForTimeout(400);
  await page.evaluate(() => window.play());
  await page.waitForTimeout(totalMs + 600);
  const video = page.video();
  await ctx.close(); // flushes the video file
  await browser.close();
  const src = await video.path();
  execFileSync('cp', [src, join(MEDIA, 'demo.webm')]);
}

// Nearest-neighbour downscale of a decoded PNG to an RGBA Uint8Array (w*h*4).
function downscaleRGBA(png, w, h) {
  const { width: sw, height: sh, data } = png;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(sh - 1, (y * sh / h) | 0);
    for (let x = 0; x < w; x++) {
      const sx = Math.min(sw - 1, (x * sw / w) | 0);
      const si = (sy * sw + sx) * 4, di = (y * w + x) * 4;
      out[di] = data[si]; out[di + 1] = data[si + 1]; out[di + 2] = data[si + 2]; out[di + 3] = 255;
    }
  }
  return out;
}

function ff(args) { execFileSync(FFMPEG, args, { stdio: ['ignore', 'ignore', 'inherit'] }); }

main().catch((e) => { console.error(e); process.exit(1); });
