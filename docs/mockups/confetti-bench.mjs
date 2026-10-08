/*
 * Measures the confetti renderers of confetti-mockup.html in headless Chromium.
 * Usage: node docs/mockups/confetti-bench.mjs   (env: THROTTLE=4 RUNS=3 ENGINES=webgl,canvas,dom
 *        PLAYWRIGHT_DIR=<node_modules with playwright> CHROMIUM=<executable>)
 * Main-thread time comes from CDP Performance.getMetrics (TaskDuration), frame intervals from requestAnimationFrame.
 */
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules/');
const { chromium } = require('playwright');
const URL = pathToFileURL(new globalThis.URL('confetti-mockup.html', import.meta.url).pathname).href;
const THROTTLE = +(process.env.THROTTLE || 4);
const RUNS = +(process.env.RUNS || 3);
const ENGINES = (process.env.ENGINES || 'webgl,canvas,dom').split(',');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

const recorder = () => {
  window.__fr = { list: [], last: 0 };
  const tick = (ts) => { if (__fr.last) __fr.list.push(ts - __fr.last); __fr.last = ts; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  window.__take = () => { const l = __fr.list; __fr.list = []; return l; };
  // Synthetic decoration mount: re-creates 60 small SVG items every frame (style, layout, paint, commit work)
  window.__deco = (on) => {
    let box = document.getElementById('deco-sim');
    if (!box) { box = document.createElement('div'); box.id = 'deco-sim'; box.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:50'; document.body.append(box); }
    window.__decoOn = on;
    const step = () => {
      if (!__decoOn) { box.innerHTML = ''; return; }
      let h = '';
      for (let i = 0; i < 60; i++) h += `<div style="position:absolute;left:${(i * 37) % innerWidth}px;top:${(i * 53) % 300}px;width:40px;height:60px;will-change:transform;animation:bob 3s ease-in-out infinite"><svg viewBox="0 0 100 150" width="40" height="60"><path d="M50 4 C82 4 96 30 96 58 C96 90 70 110 53 113 L47 113 C30 110 4 90 4 58 C4 30 18 4 50 4 Z" fill="hsl(${i * 30} 80% 55%)"/></svg></div>`;
      box.innerHTML = h;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
};

async function measure(page, cdp, ms) {
  const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
  await page.evaluate(() => __take());
  const s0 = await page.evaluate(() => ({ f: mock.stats.frames, j: mock.stats.jsMs }));
  const a = await m();
  await page.waitForTimeout(ms);
  const b = await m();
  const fr = await page.evaluate(() => __take());
  const s1 = await page.evaluate(() => ({ f: mock.stats.frames, j: mock.stats.jsMs }));
  const js = s1.f > s0.f ? (s1.j - s0.j) / (s1.f - s0.f) : 0;
  const sorted = [...fr].sort((x, y) => x - y);
  const task = (b.TaskDuration - a.TaskDuration) * 1000;
  return {
    frames: fr.length,
    taskPerFrame: task / Math.max(1, fr.length),
    p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    js,
    engineFrames: s1.f - s0.f,
    layers: b.LayoutCount - a.LayoutCount,
  };
}

const results = {};
for (const engine of ENGINES) {
  const runs = [];
  for (let run = 0; run < RUNS; run++) {
    const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625 });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    await page.goto(`${URL}?engine=canvas&swgl`);
    await page.evaluate(recorder);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    await page.waitForTimeout(500);
    // Init measured on a fresh engine switch (includes shader compile and atlas for WebGL)
    const init = await page.evaluate((e) => mock.setEngine(e), engine);
    await page.evaluate(() => { mock.settings.look = 'mix'; mock.settings.sound = false; });
    await page.waitForTimeout(800);
    const idle = await measure(page, cdp, 1500);

    // Timer-end burst (200 pieces): spawn cost plus the first 400 ms, then steady flight
    await page.evaluate(() => { mock.timerEnd(document.getElementById('dial').getBoundingClientRect(), false); });
    const spawn = await page.evaluate(() => mock.stats.spawnMs);
    if (process.env.DEBUG) console.error(engine, await page.evaluate(() => ({ alive: mock.renderer.alive(), name: mock.renderer.name })));
    const first = await measure(page, cdp, 400);
    const burst = await measure(page, cdp, 1600);
    await page.evaluate(() => { mock.interrupt(200, 400); });
    await page.waitForTimeout(2500);

    // Stress: three bursts at once (600 pieces)
    await page.evaluate(() => { const r = document.getElementById('dial').getBoundingClientRect(); for (let i = 0; i < 3; i++) mock.timerEnd(r, false); });
    await page.waitForTimeout(200);
    const stress = await measure(page, cdp, 1500);
    await page.evaluate(() => { mock.interrupt(200, 400); });
    await page.waitForTimeout(6000);

    // Party rain steady state (after the initial burst has fallen)
    await page.evaluate(() => { mock.timerEnd(document.getElementById('dial').getBoundingClientRect(), true); });
    await page.waitForTimeout(5000);
    const rain = await measure(page, cdp, 2000);
    const rainAlive = await page.evaluate(() => mock.renderer.alive());
    await page.evaluate(() => { mock.interrupt(200, 400); });
    await page.waitForTimeout(6000);

    // Decoration-like DOM work with and without a running burst
    await page.evaluate(() => __deco(true));
    await page.waitForTimeout(500);
    const decoOnly = await measure(page, cdp, 1500);
    await page.evaluate(() => { mock.timerEnd(document.getElementById('dial').getBoundingClientRect(), false); });
    await page.waitForTimeout(100);
    const decoBurst = await measure(page, cdp, 1500);
    await page.evaluate(() => __deco(false));
    await page.evaluate(() => { mock.interrupt(200, 400); });
    await page.waitForTimeout(2000);
    if (process.env.DEBUG) console.error(JSON.stringify({ first, burst, stress }));
    runs.push({ init, spawn, idle, first, burst, stress, rain, rainAlive, decoOnly, decoBurst });
    await page.close();
  }
  results[engine] = runs;
}
const med = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const summary = {};
for (const [engine, runs] of Object.entries(results)) {
  const pick = (f) => med(runs.map(f));
  summary[engine] = {
    initMs: pick((r) => r.init),
    spawnJsMs: pick((r) => r.spawn),
    firstMaxFrameMs: pick((r) => r.first.max),
    firstTaskPerFrame: pick((r) => r.first.taskPerFrame),
    idleTaskPerFrame: pick((r) => r.idle.taskPerFrame),
    burstTaskPerFrame: pick((r) => r.burst.taskPerFrame),
    burstJsPerFrame: pick((r) => r.burst.js),
    burstP95: pick((r) => r.burst.p95),
    burstFps: pick((r) => r.burst.frames / 1.6),
    stressTaskPerFrame: pick((r) => r.stress.taskPerFrame),
    stressJsPerFrame: pick((r) => r.stress.js),
    stressP95: pick((r) => r.stress.p95),
    rainTaskPerFrame: pick((r) => r.rain.taskPerFrame),
    rainJsPerFrame: pick((r) => r.rain.js),
    rainAlive: pick((r) => r.rainAlive),
    decoOnlyTaskPerFrame: pick((r) => r.decoOnly.taskPerFrame),
    decoBurstTaskPerFrame: pick((r) => r.decoBurst.taskPerFrame),
    decoBurstP95: pick((r) => r.decoBurst.p95),
  };
}
console.log(JSON.stringify({ throttle: THROTTLE, runs: RUNS, summary }, null, 1));
await browser.close();
