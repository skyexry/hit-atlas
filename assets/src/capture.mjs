// Regenerates the README images from the live page, at 2x pixel density.
//
//   python3 -m http.server 8000            # from the repository root, in another terminal
//   node assets/src/capture.mjs http://localhost:8000/atlas/
//
// Needs Google Chrome (or set CHROME=/path/to/chrome) and Python 3 with Pillow (or set
// PYTHON=/path/to/python3). Uses only Node's built-in fetch and WebSocket (Node 22+).
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.argv[2] || "http://localhost:8000/atlas/";
const OUT = fileURLToPath(new URL("../", import.meta.url)); // assets/
const work = mkdtempSync(join(tmpdir(), "hit-atlas-capture-"));
const PORT = 9300 + Math.floor(Math.random() * 400);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(work, "profile")}`,
  "--hide-scrollbars", "--force-color-profile=srgb", "--no-first-run", "--window-size=1440,900", "about:blank",
], { stdio: "ignore" });

async function devtools(path) {
  for (let i = 0; i < 60; i++) {
    try { return await (await fetch(`http://127.0.0.1:${PORT}${path}`)).json(); } catch { await sleep(250); }
  }
  throw new Error("Chrome did not start");
}

const page = (await devtools("/json/list")).find(t => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let seq = 0;
const pending = new Map();
ws.onmessage = event => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
async function run(expression) {
  const { result, exceptionDetails } = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
  return result.value;
}
async function until(expression, timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await run(`Boolean(${expression})`)) return;
    await sleep(150);
  }
  throw new Error(`Timed out waiting for ${expression}`);
}
async function viewport(width, height) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile: false });
}
async function open(url, width, height) {
  await viewport(width, height);
  await send("Page.navigate", { url });
  await until("window.hitAtlas && document.fonts.status === 'loaded' && document.querySelectorAll('#crate .rec').length > 0");
  // Keep third-party cover art out of the repository: the record glyph shows in its place.
  await run(`(() => { const s = document.createElement("style"); s.textContent = ".feature .f-art img, .sd-art { display: none !important; } .feature .f-art.has-art svg { left: 0 !important; }"; document.head.append(s); })()`);
  await sleep(800);
}
// Captures a document-coordinate rectangle (CSS pixels) at 2x.
async function capture(file, { x, y, width, height }) {
  const { data } = await send("Page.captureScreenshot", {
    format: "png", captureBeyondViewport: false,
    clip: { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height), scale: 1 },
  });
  writeFileSync(file, Buffer.from(data, "base64"));
  return file;
}
// Scrolls an element near the top of the viewport and frames it exactly, with padding, at a fixed aspect.
async function box(selector, { ratio = 1.6, top = 24, pad = 14 } = {}) {
  return run(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - ${top}, behavior: "instant" });
    const r = el.getBoundingClientRect();
    const width = r.width + 2 * ${pad};
    return { x: r.left + scrollX - ${pad}, y: r.top + scrollY - ${pad}, width, height: width / ${ratio} };
  })()`);
}
const PYTHON = process.env.PYTHON || "python3";
const py = code => execFileSync(PYTHON, ["-c", code], { stdio: ["ignore", "inherit", "inherit"] });
// Downscale with Lanczos and save as a progressive JPEG.
const jpg = (src, dest, width, quality = 86) => py(`
from PIL import Image
im = Image.open(${JSON.stringify(src)}).convert("RGB")
im = im.resize((${width}, round(im.height * ${width} / im.width)), Image.LANCZOS)
im.save(${JSON.stringify(dest)}, "JPEG", quality=${quality}, optimize=True, progressive=True, subsampling=0)
`);
// Animated GIF with one shared palette so colors hold steady between frames.
const gif = (frames, durations, dest, width) => py(`
from PIL import Image
frames = [Image.open(f).convert("RGB") for f in ${JSON.stringify(frames)}]
frames = [im.resize((${width}, round(im.height * ${width} / im.width)), Image.LANCZOS) for im in frames]
sheet = Image.new("RGB", (frames[0].width, frames[0].height * len(frames)))
for i, im in enumerate(frames): sheet.paste(im, (0, i * im.height))
palette = sheet.quantize(colors=255, method=Image.Quantize.MEDIANCUT)
out = [im.quantize(palette=palette, dither=Image.Dither.NONE) for im in frames]
out[0].save(${JSON.stringify(dest)}, save_all=True, append_images=out[1:], duration=${JSON.stringify(durations)}, loop=0, optimize=True, disposal=1)
`);

const CLEAN = `(() => {
  const s = document.createElement("style");
  s.id = "capture-style";
  s.textContent = ".masthead{visibility:hidden}.controls{position:relative!important;top:auto!important}.chapter-spine{display:none}";
  document.head.append(s);
})()`;

try {
  mkdirSync(OUT, { recursive: true });

  // ── Opening trailer: title screen, then the four eras on the record ──
  await open(BASE, 1440, 810);
  const frames = [];
  const shots = [null, 2, 3, 4, 5];
  for (const [i, step] of shots.entries()) {
    if (step === null) await run("window.scrollTo({ top: 0, behavior: 'instant' })");
    else await run(`document.querySelector('[data-step="${step}"] .step-card').scrollIntoView({ block: "center", behavior: "instant" })`);
    await sleep(1400);
    const y = await run("scrollY");
    frames.push(await capture(join(work, `frame-${i}.png`), { x: 0, y, width: 1440, height: 810 }));
  }
  jpg(frames[0], join(OUT, "hit-atlas-cover.jpg"), 1600, 90);
  gif(frames, frames.map((f, i) => (i === 0 ? 3200 : 2400)), join(OUT, "hit-atlas-trailer.gif"), 1100);

  // ── Social preview, 1280×640 ──
  await open(BASE, 1280, 640);
  const social = await capture(join(work, "social.png"), { x: 0, y: 0, width: 1280, height: 640 });
  jpg(social, join(OUT, "hit-atlas-social.jpg"), 1280, 90);

  // ── Chapter cards (16:10) ──
  await open(BASE, 1440, 900);
  await run(CLEAN);
  await run("hitAtlas.store.set({ year: 1979, emotion: null, genre: null, order: 'rank', word: 'love' })");
  await sleep(900);
  jpg(await capture(join(work, "c1.png"), await box(".year-detail")), join(OUT, "track-01-heart.jpg"), 1600);
  await run("hitAtlas.words.loadIndex()");
  await sleep(600);
  jpg(await capture(join(work, "c2.png"), await box(".words-grid")), join(OUT, "track-02-words.jpg"), 1600);
  await run("[...document.querySelectorAll('#era-chips button')].find(b => b.textContent.includes('peak')).click()");
  await sleep(1000);
  jpg(await capture(join(work, "c3.png"), await box(".panel-map")), join(OUT, "track-03-origins.jpg"), 1600);
  jpg(await capture(join(work, "c4.png"), await box(".sound-tiles")), join(OUT, "track-04-sound.jpg"), 1600);

  // ── One record, up close: the song dialog ──
  await run(`(() => {
    hitAtlas.store.set({ year: 1964 });
    const rec = [...document.querySelectorAll('#crate .rec')].find(g => g.getAttribute('aria-label').startsWith('No. 10, Where Did Our Love Go'));
    rec.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  })()`);
  await sleep(1500);
  const dlg = await run("(() => { const r = document.querySelector('#song-dialog').getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }; })()");
  jpg(await capture(join(work, "dialog.png"), dlg), join(OUT, "record-up-close.jpg"), 1400);
  console.log(`README images written to ${OUT}`);
} finally {
  ws.close();
  chrome.kill();
  await new Promise(resolve => { if (chrome.exitCode !== null) resolve(); else chrome.once("exit", resolve); });
  try { rmSync(work, { recursive: true, force: true }); } catch { /* Chrome may still be releasing its profile */ }
}
