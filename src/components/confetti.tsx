"use client";

import { useEffect, useRef } from 'react';

/**
 * Single shared confetti renderer.
 *
 * All effects (title bursts, timer-end burst, party rain) share one canvas and
 * one requestAnimationFrame loop. The loop only runs while pieces are alive or
 * rain is active, and the canvas backing store is released when idle.
 * Physics is time-based, so the animation runs at the same speed on 60 Hz,
 * 120 Hz and throttled displays.
 */

export const RAINBOW_COLORS = ['#e81416', '#ffa500', '#faeb36', '#79c314', '#487de7', '#4b369d', '#70369d'];

const FRAME_MS = 1000 / 60;
const MAX_DT_MS = 50;
const MAX_DPR = 2;
const BURN_OFF_MS = 1500;
const RAIN_PIECES_PER_FRAME = 1;

interface Physics {
  gravity: number;
  terminal: number;
  dragX: number;
  dragY: number;
  /** Per-frame alpha multiplier (1 = no fade over time) */
  fade: number;
  /** Fade out near the bottom of the viewport */
  fadeAtBottom: boolean;
}

const BURST_PHYSICS: Physics = { gravity: 0.125, terminal: 8, dragX: 0.075, dragY: 0.075, fade: 1, fadeAtBottom: true };
const POINT_PHYSICS: Physics = { gravity: 0.08, terminal: 6, dragX: 0.02, dragY: 0, fade: 0.98, fadeAtBottom: false };

interface Piece {
  x: number; y: number;
  vx: number; vy: number;
  rot: number; rotSpeed: number;
  flip: number; flipSpeed: number;
  w: number; h: number;
  color: string;
  alpha: number; baseAlpha: number;
  fadeEnd: number;
  physics: Physics;
  /** Celebration pieces are swept away on interrupt; title bursts are not */
  burnable: boolean;
  doomed: boolean;
  group: number;
}

interface Group { count: number; resolve: () => void }

class ConfettiEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private pieces: Piece[] = [];
  private groups = new Map<number, Group>();
  private nextGroup = 1;
  private raining = false;
  private rainAcc = 0;
  private burnStart: number | null = null;
  private rafId: number | null = null;
  private lastTime = 0;
  private width = 0;
  private height = 0;
  private dpr = 1;

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    window.addEventListener('resize', this.handleResize);
    if (this.pieces.length || this.raining) this.start();
  }

  detach() {
    window.removeEventListener('resize', this.handleResize);
    this.stop();
    this.canvas = null;
    this.ctx = null;
  }

  /** Burst from a ring around the dial (timer end). Resolves when all pieces are gone. */
  ringBurst(origin: { x: number; y: number }, innerRadius: number, outerRadius: number, count = 150): Promise<void> {
    return this.spawnGroup(count, (i) => {
      const angle = Math.random() * Math.PI * 2;
      const radius = innerRadius + Math.random() * (outerRadius - innerRadius);
      const speed = Math.random() * 6 + 6;
      return this.makePiece(
        RAINBOW_COLORS[i % RAINBOW_COLORS.length],
        origin.x + Math.cos(angle) * radius, origin.y + Math.sin(angle) * radius,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        BURST_PHYSICS, true,
      );
    });
  }

  /** Burst from a single point (title click, celebration interrupt). */
  pointBurst(origin: { x: number; y: number }, count = 150): Promise<void> {
    return this.spawnGroup(count, (i) => {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 5;
      const p = this.makePiece(
        RAINBOW_COLORS[RAINBOW_COLORS.length - 1 - (i % RAINBOW_COLORS.length)],
        origin.x, origin.y,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        POINT_PHYSICS, false,
      );
      p.alpha = p.baseAlpha = 1;
      return p;
    });
  }

  setRaining(raining: boolean) {
    this.raining = raining;
    if (raining) this.start();
  }

  /** Stop the rain and sweep all celebration pieces away from top to bottom. */
  interrupt() {
    this.raining = false;
    let any = false;
    for (const p of this.pieces) {
      if (p.burnable) { p.doomed = true; any = true; }
    }
    if (any) this.burnStart = performance.now();
  }

  private makePiece(color: string, x: number, y: number, vx: number, vy: number, physics: Physics, burnable: boolean): Piece {
    const size = Math.random() * 0.7 + 0.5;
    const baseAlpha = Math.min(1, size);
    return {
      x, y, vx, vy,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() * 10 - 5) * Math.PI / 180,
      flip: Math.random() * Math.PI * 2,
      flipSpeed: 0.05 + Math.random() * 0.1,
      w: 8 * size, h: 12 * size,
      color, alpha: baseAlpha, baseAlpha,
      fadeEnd: Math.random() * 0.13 + 0.85,
      physics, burnable, doomed: false, group: 0,
    };
  }

  private spawnGroup(count: number, factory: (i: number) => Piece): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();
    const group = this.nextGroup++;
    return new Promise<void>((resolve) => {
      this.groups.set(group, { count, resolve });
      for (let i = 0; i < count; i++) {
        const p = factory(i);
        p.group = group;
        this.pieces.push(p);
      }
      this.start();
    });
  }

  private spawnRainPiece() {
    const p = this.makePiece(
      RAINBOW_COLORS[Math.floor(Math.random() * RAINBOW_COLORS.length)],
      Math.random() * this.width, -20,
      Math.random() * 4 - 2, Math.random() * 2 + 2,
      BURST_PHYSICS, true,
    );
    p.rotSpeed = (Math.random() * 6 - 3) * Math.PI / 180;
    this.pieces.push(p);
  }

  private handleResize = () => {
    if (this.rafId !== null) this.resize();
  };

  private resize() {
    if (!this.canvas) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
  }

  private start() {
    if (this.rafId !== null || !this.canvas) return;
    this.resize();
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  private stop() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.burnStart = null;
    // Release the backing store while idle
    if (this.canvas) { this.canvas.width = 0; this.canvas.height = 0; }
  }

  private release(p: Piece) {
    if (!p.group) return;
    const g = this.groups.get(p.group);
    if (!g) return;
    if (--g.count <= 0) {
      this.groups.delete(p.group);
      g.resolve();
    }
  }

  private frame = (now: number) => {
    const ctx = this.ctx;
    if (!ctx || !this.canvas) { this.rafId = null; return; }

    const dt = Math.min(now - this.lastTime, MAX_DT_MS);
    this.lastTime = now;
    const k = dt / FRAME_MS;

    if (this.raining) {
      this.rainAcc += RAIN_PIECES_PER_FRAME * k;
      while (this.rainAcc >= 1) { this.spawnRainPiece(); this.rainAcc -= 1; }
    }

    let burnY: number | null = null;
    let sweepDone = false;
    if (this.burnStart !== null) {
      burnY = ((now - this.burnStart) / BURN_OFF_MS) * this.height;
      if (burnY > this.height) { sweepDone = true; this.burnStart = null; }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const { height, dpr } = this;
    const fadeStart = height * 0.8;
    let write = 0;
    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i];
      const ph = p.physics;

      p.vy = Math.min(p.vy + ph.gravity * k, ph.terminal);
      if (ph.dragX) p.vx *= Math.pow(1 - ph.dragX, k);
      if (ph.dragY) p.vy *= Math.pow(1 - ph.dragY, k);
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.rot += p.rotSpeed * k;
      p.flip += p.flipSpeed * k;
      if (ph.fade !== 1) p.alpha *= Math.pow(ph.fade, k);
      if (ph.fadeAtBottom && p.y > fadeStart) {
        const range = Math.max(1, height * p.fadeEnd - fadeStart);
        p.alpha = p.baseAlpha * (1 - Math.min(1, (p.y - fadeStart) / range));
      }

      const dead = p.alpha <= 0.02 || p.y > height + 20
        || (p.doomed && (sweepDone || (burnY !== null && p.y < burnY)));
      if (dead) { this.release(p); continue; }

      const cos = Math.cos(p.rot), sin = Math.sin(p.rot);
      const sy = Math.cos(p.flip);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.setTransform(dpr * cos, dpr * sin, -dpr * sin * sy, dpr * cos * sy, dpr * p.x, dpr * p.y);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);

      this.pieces[write++] = p;
    }
    this.pieces.length = write;
    ctx.globalAlpha = 1;

    if (write > 0 || this.raining) {
      this.rafId = requestAnimationFrame(this.frame);
    } else {
      this.rafId = null;
      this.stop();
    }
  };
}

export const confetti = new ConfettiEngine();

/** Mount once per page. Hosts the shared confetti canvas. */
export function ConfettiLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    confetti.attach(canvas);
    return () => confetti.detach();
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] h-full w-full" />;
}
