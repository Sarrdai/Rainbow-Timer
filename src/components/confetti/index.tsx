"use client";

import { useEffect, useRef } from 'react';
import { RAINBOW_COLORS } from '@/lib/palette';
import { CanvasRenderer } from './canvas-renderer';
import { GLRenderer } from './gl-renderer';
import type { Renderer } from './loop';
import { count, env, makeParticle, now, pick, rand, type Particle } from './model';

/** Rain is scheduled ahead in batches with future start times: no per-frame work on the CPU */
const RAIN_RATE = 14;
const RAIN_BATCH_MS = 1000;
const RAIN_AHEAD_S = 1.5;
/** Fade-out and sweep durations (seconds) the loop must outlast */
const EFFECT_S = 0.7;

const CANVAS_CLASS = 'pointer-events-none fixed inset-0 z-[60] h-full w-full';

const rain = { on: false, until: 0, timer: undefined as ReturnType<typeof setInterval> | undefined };

let host: HTMLElement | null = null;
let renderer: Renderer | null = null;
/** Resolvers of timerEnd() promises; interrupt() resolves them early */
const waiters = new Set<() => void>();
let lostCanvas: HTMLCanvasElement | null = null;

const busy = () => rain.on;

function newCanvas() {
  const canvas = document.createElement('canvas');
  canvas.className = CANVAS_CLASS;
  canvas.setAttribute('aria-hidden', 'true');
  host?.appendChild(canvas);
  return canvas;
}

/** Fails soft: without hardware WebGL (or after a lost context) the 2D renderer takes over */
function createRenderer(preferGL: boolean) {
  if (!host) return;
  renderer?.destroy();
  host.replaceChildren();
  if (preferGL) {
    const canvas = newCanvas();
    const gl = GLRenderer.create(canvas, busy);
    if (gl) {
      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        lostCanvas = canvas;
        createRenderer(false);
        // Keep the lost canvas (hidden) so that its restore event still arrives
        canvas.style.display = 'none';
        host?.appendChild(canvas);
      });
      canvas.addEventListener('webglcontextrestored', () => {
        if (lostCanvas === canvas) { lostCanvas = null; createRenderer(true); }
      });
      renderer = gl;
      return;
    }
    canvas.remove();
  }
  renderer = new CanvasRenderer(newCanvas(), busy);
}

function ensure() {
  if (!renderer && host) createRenderer(true);
  return renderer;
}

function spawn(list: Particle[]) {
  ensure()?.add(list);
  return list.reduce((end, p) => Math.max(end, p.t0 + p.life), 0);
}

/** Resolves when `end` (seconds on the confetti clock) has passed, or when the pieces are swept away */
function until(end: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => { clearTimeout(timer); waiters.delete(done); resolve(); };
    const timer = setTimeout(done, Math.max(0, end - now()) * 1000);
    waiters.add(done);
  });
}

function schedule() {
  const end = now() + RAIN_AHEAD_S;
  const list: Particle[] = [];
  for (let t = rain.until; t < end; t += 1 / RAIN_RATE) {
    list.push(makeParticle({ x: rand(0, env.w), y: rand(-40, -15), vx: rand(-30, 30), vy: rand(20, 90), t0: t + rand(0, 1 / RAIN_RATE), k: 1.2, burnable: true, rain: true }));
  }
  rain.until = end;
  if (list.length) ensure()?.add(list);
}

export const confetti = {
  /** Party mode on: shower from the top plus a small fan out of the title. */
  partyStart(titleRect: DOMRect): void {
    const t = now();
    const list: Particle[] = [];
    for (let i = 0; i < count(64); i++) {
      list.push(makeParticle({ x: rand(-10, env.w + 10), y: rand(-50, -12), vx: rand(-60, 60), vy: rand(30, 140), t0: t + rand(0, 0.7), k: 1.4 }));
    }
    const cx = titleRect.left + titleRect.width / 2;
    const cy = titleRect.top + titleRect.height / 2;
    for (let i = 0; i < count(14); i++) {
      const a = rand(-Math.PI * 0.92, -Math.PI * 0.08);
      const s = rand(260, 540);
      list.push(makeParticle({ x: cx + rand(-titleRect.width / 3, titleRect.width / 3), y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t0: t, k: 2.8 }));
    }
    spawn(list);
  },

  /** Party mode off: title confetti still in the air fades out. */
  partyEnd(): void {
    env.dissolveAt = now();
    renderer?.extendTo(env.dissolveAt + EFFECT_S);
  },

  /** Balloon popped: pieces mostly in the balloon's color. */
  balloonPop(x: number, y: number, color: string): void {
    const t = now();
    const list: Particle[] = [];
    for (let i = 0; i < count(44); i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(200, 640);
      list.push(makeParticle({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, t0: t, k: 3.4, color: Math.random() < 0.7 ? color : pick(RAINBOW_COLORS) }));
    }
    spawn(list);
  },

  /** Timer end: burst out of the dial ring. Resolves when the burst has fallen (or was swept away). */
  timerEnd(dialRect: DOMRect): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();
    const t = now();
    const half = dialRect.width / 2;
    const cx = dialRect.left + half;
    const cy = dialRect.top + half;
    const list: Particle[] = [];
    for (let i = 0; i < count(200); i++) {
      const a = rand(0, Math.PI * 2);
      const r = rand(half * 0.375, half * 0.79);
      const s = rand(320, 820);
      list.push(makeParticle({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 140, t0: t + rand(0, 0.05), k: 2.7, burnable: true, color: RAINBOW_COLORS[i % RAINBOW_COLORS.length] }));
    }
    return until(spawn(list));
  },

  /** Party rain during a celebration. */
  setRaining(raining: boolean): void {
    if (raining === rain.on) return;
    clearInterval(rain.timer);
    rain.on = raining;
    if (!raining) {
      env.rainCut = now();
      return;
    }
    if (env.reduced || !ensure()) { rain.on = false; return; }
    env.rainCut = 1e9;
    rain.until = now() + 0.3;
    schedule();
    rain.timer = setInterval(schedule, RAIN_BATCH_MS);
  },

  /** Tap during the celebration: stop the rain, blow the celebration confetti away from the tap. */
  interrupt(x: number, y: number): void {
    confetti.setRaining(false);
    env.sweepAt = now();
    env.sweepX = x;
    env.sweepY = y;
    renderer?.extendTo(env.sweepAt + EFFECT_S);
    [...waiters].forEach((done) => done());
    const t = env.sweepAt + 0.001;
    const list: Particle[] = [];
    for (let i = 0; i < count(16); i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(140, 400);
      list.push(makeParticle({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t0: t, k: 3.6 }));
    }
    spawn(list);
  },
};

/** Mount once in the page: owns the canvas, picks WebGL or 2D, follows theme and reduced motion. */
export function ConfettiLayer() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    host = el;

    const readView = () => { env.w = window.innerWidth; env.h = window.innerHeight; };
    readView();
    window.addEventListener('resize', readView);

    const readTheme = () => { env.dark = document.documentElement.getAttribute('data-theme') === 'dark'; };
    readTheme();
    const themeObserver = new MutationObserver(readTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const readMotion = () => { env.reduced = motion.matches; };
    readMotion();
    motion.addEventListener('change', readMotion);

    // Creating the context and the atlas takes a moment: do it when idle, not on the first title click
    const init = () => { ensure(); };
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(init, { timeout: 2000 })
      : window.setTimeout(init, 500);

    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle); else clearTimeout(idle);
      window.removeEventListener('resize', readView);
      themeObserver.disconnect();
      motion.removeEventListener('change', readMotion);
      confetti.setRaining(false);
      waiters.forEach((done) => done());
      renderer?.destroy();
      renderer = null;
      el.replaceChildren();
      host = null;
    };
  }, []);

  return <div ref={hostRef} aria-hidden="true" />;
}
