import { RAINBOW_COLORS } from '@/lib/palette';

/**
 * Particle model shared by both renderers. A particle's state is a pure function of time: linear drag `k` pulls
 * the launch velocity toward the falling speed `vt`, so
 *   x(t) = x0 + vx (1 - e^-kt) / k + sway
 *   y(t) = y0 + vt t + (vy - vt) (1 - e^-kt) / k
 * Nothing is integrated per frame; a renderer only evaluates the formula at the current time (the WebGL
 * renderer does so in the vertex shader, `evaluate` is its CPU mirror).
 */

export const SHAPE = { paper: 0, dot: 1, star: 2, curl: 3, heart: 4, halo: 5 } as const;
export const FLAG = { burnable: 1, glow: 2, rain: 4 } as const;

const EPOCH = typeof performance === 'undefined' ? 0 : performance.now();
/** Seconds since page load; the time base of all particles */
export const now = () => (performance.now() - EPOCH) / 1000;

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

/** State shared by the occasions and the renderers */
export const env = {
  /** Viewport size in CSS px */
  w: 0,
  h: 0,
  dark: false,
  reduced: false,
  dissolveAt: 1e9,
  sweepAt: 1e9,
  sweepX: 0,
  sweepY: 0,
  rainCut: 1e9,
};

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  t0: number; life: number; k: number; vt: number;
  rot0: number; spin: number; flip0: number; flip: number;
  amp: number; freq: number; phase: number;
  w: number; h: number; shape: number;
  color: string; rgb: [number, number, number];
  flags: number;
}

interface ShapePhysics {
  w: [number, number]; h: [number, number] | null; vt: [number, number];
  amp: [number, number]; freq: [number, number]; flip: [number, number]; spin: [number, number];
}

/** Per shape: size in CSS px, falling speed, flutter */
const SHAPE_PHYSICS: Record<number, ShapePhysics> = {
  [SHAPE.paper]: { w: [8, 10], h: [12, 15], vt: [120, 175], amp: [14, 30], freq: [2.4, 4.2], flip: [5, 11], spin: [1, 3.5] },
  [SHAPE.dot]: { w: [7, 9], h: null, vt: [190, 240], amp: [2, 6], freq: [2, 3], flip: [3, 7], spin: [0, 1] },
  [SHAPE.star]: { w: [13, 16], h: null, vt: [150, 200], amp: [6, 14], freq: [1.6, 2.6], flip: [0.5, 2], spin: [2, 5] },
  [SHAPE.curl]: { w: [15, 19], h: null, vt: [105, 150], amp: [10, 20], freq: [1.4, 2.4], flip: [2.5, 5], spin: [0.6, 2] },
  [SHAPE.heart]: { w: [11, 13], h: null, vt: [140, 180], amp: [10, 18], freq: [1.6, 2.6], flip: [1.5, 3.5], spin: [0.5, 1.5] },
};

/** "Party mix": paper 50 %, curls 17 %, dots 17 %, stars 11 %, hearts 5 % */
const MIX: [number, number][] = [[SHAPE.paper, 0.5], [SHAPE.curl, 0.17], [SHAPE.dot, 0.17], [SHAPE.star, 0.11], [SHAPE.heart, 0.05]];

function pickShape() {
  let r = Math.random();
  for (const [shape, share] of MIX) { if ((r -= share) <= 0) return shape; }
  return SHAPE.paper;
}

export function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Time until a particle has fallen below `bottom` (the asymptote of y(t); exact enough once the launch has decayed) */
function lifeUntil(y0: number, vy: number, k: number, vt: number, bottom: number) {
  return Math.min(12, Math.max(0.6, (bottom - y0 - (vy - vt) / k) / vt));
}

export interface LaunchOptions {
  x: number; y: number; vx: number; vy: number; t0: number; k: number;
  color?: string;
  burnable?: boolean;
  rain?: boolean;
}

/** Number of pieces for an occasion; fewer with reduced motion */
export const count = (n: number) => (env.reduced ? Math.ceil(n * 0.3) : n);

/**
 * Creates one particle. With reduced motion it appears where its launch would carry it and only fades in and out.
 */
export function makeParticle(o: LaunchOptions): Particle {
  const shape = pickShape();
  const sp = SHAPE_PHYSICS[shape];
  const w = rand(...sp.w);
  const h = sp.h ? rand(...sp.h) : w;
  const vt = rand(...sp.vt);
  const color = o.color ?? pick(RAINBOW_COLORS);
  const glow = shape === SHAPE.star || shape === SHAPE.dot;
  const p: Particle = {
    x: o.x, y: o.y, vx: o.vx, vy: o.vy, t0: o.t0, k: o.k, vt,
    rot0: rand(0, Math.PI * 2), spin: rand(...sp.spin) * (Math.random() < 0.5 ? -1 : 1),
    flip0: rand(0, Math.PI * 2), flip: rand(...sp.flip),
    amp: rand(...sp.amp), freq: rand(...sp.freq), phase: rand(0, Math.PI * 2),
    w, h, shape, color, rgb: hexRgb(color),
    flags: (o.burnable ? FLAG.burnable : 0) | (glow ? FLAG.glow : 0) | (o.rain ? FLAG.rain : 0),
    life: 0,
  };
  if (env.reduced) {
    p.x += p.vx / p.k; p.y += Math.max(p.vy, -200) / p.k;
    p.vx = p.vy = 0; p.vt = 0; p.k = 1; p.amp = 0; p.spin = 0; p.flip = 0; p.flip0 = 0;
    p.life = 1.8;
  } else {
    p.life = lifeUntil(p.y, p.vy, p.k, vt, env.h + 30);
  }
  return p;
}

export interface Evaluated { x: number; y: number; a: number; rot: number; fl: number; tau: number }

/** CPU mirror of the vertex shader. Returns null while the particle is not visible. */
export function evaluate(p: Particle, t: number, out: Evaluated): Evaluated | null {
  const tau = t - p.t0;
  if (tau < 0 || tau > p.life) return null;
  if ((p.flags & FLAG.rain) && p.t0 > env.rainCut) return null;
  const e = Math.exp(-p.k * tau);
  const om = (1 - e) / p.k;
  let x = p.x + p.vx * om + p.amp * Math.sin(p.freq * tau + p.phase) * (1 - e);
  let y = p.y + p.vt * tau + (p.vy - p.vt) * om;
  let a = Math.min(1, tau / (env.reduced ? 0.25 : 0.08)) * Math.min(1, Math.max(0, (p.life - tau) / (env.reduced ? 0.5 : 0.4)));
  a *= Math.min(1, Math.max(0, (env.h * 1.02 - y) / (env.h * 0.2)));
  if (!(p.flags & FLAG.burnable) && p.t0 < env.dissolveAt) a *= Math.min(1, Math.max(0, 1 - (t - env.dissolveAt) / 0.6));
  if ((p.flags & FLAG.burnable) && p.t0 < env.sweepAt && t > env.sweepAt) {
    const ds = t - env.sweepAt;
    const dx = x - env.sweepX;
    const dy = y - env.sweepY;
    const len = Math.max(1, Math.hypot(dx, dy));
    const push = 1600 * ds * ds;
    x += dx / len * push; y += dy / len * push + 700 * ds * ds;
    a *= Math.max(0, 1 - ds / 0.6);
  }
  out.x = x; out.y = y; out.a = a;
  out.rot = p.rot0 + p.spin * tau;
  out.fl = Math.cos(p.flip0 + p.flip * tau);
  out.tau = tau;
  return out;
}
