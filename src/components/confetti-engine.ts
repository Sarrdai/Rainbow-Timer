/**
 * Confetti engine shared by all effects (title bursts, timer-end burst, party rain): one canvas and one
 * animation loop. The loop only runs while pieces are alive or rain is active, and the canvas backing store
 * is released when idle. Physics is time-based, so the animation runs at the same speed on 60 Hz,
 * 120 Hz and throttled displays.
 */

export const RAINBOW_COLORS = ['#e81416', '#ffa500', '#faeb36', '#79c314', '#487de7', '#4b369d', '#70369d'];

const FRAME_MS = 1000 / 60;
const MAX_DT_MS = 50;
/** Confetti are small flat pieces: 1.5x is sharp enough and draws ~44 % fewer pixels than 2x */
const MAX_DPR = 1.5;
const BURN_OFF_MS = 1500;
const RAIN_PIECES_PER_FRAME = 1;
const RELEASE_DELAY_MS = 500;

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
const SHOWER_PHYSICS: Physics = { gravity: 0.06, terminal: 4.2, dragX: 0.015, dragY: 0, fade: 1, fadeAtBottom: true };
/** Per-frame alpha multiplier for dissolving pieces (~0.6 s to invisible) */
const DISSOLVE_FADE = 0.9;

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
  /** Fades out while it keeps falling (party mode switched off) */
  dissolving: boolean;
  group: number;
}

interface Group { count: number; resolve: () => void }

type Canvas = HTMLCanvasElement | OffscreenCanvas;
type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Commands to the engine; the ones with an id are answered when their pieces are gone */
export type ConfettiCommand =
  | { type: 'size'; width: number; height: number; dpr: number }
  | { type: 'ringBurst'; id: number; origin: Point; innerRadius: number; outerRadius: number; count?: number }
  | { type: 'pointBurst'; id: number; origin: Point; count?: number }
  | { type: 'shower'; id: number; count?: number }
  | { type: 'dissolve' }
  | { type: 'rain'; raining: boolean }
  | { type: 'interrupt' };

/** Messages from the page to the confetti worker: engine commands plus attaching the transferred canvas */
export type ConfettiWorkerMessage =
  | { cmd: ConfettiCommand }
  | { attach: true; canvas?: OffscreenCanvas }
  | { detach: true };

/** Messages from the confetti worker: a finished burst, or whether the animation loop runs */
export type ConfettiWorkerReply = { done: number } | { running: boolean };

interface Point { x: number; y: number }

// Workers without requestAnimationFrame fall back to a timer
const raf: (cb: (now: number) => void) => number = typeof requestAnimationFrame === 'function'
  ? (cb) => requestAnimationFrame(cb)
  : (cb) => setTimeout(() => cb(performance.now()), FRAME_MS) as unknown as number;
const cancelRaf = (id: number) => (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(id) : clearTimeout(id));

/**
 * Confetti physics and drawing. Free of DOM access, so it runs in a worker on an OffscreenCanvas
 * (or on the main thread as a fallback); the viewport size is passed in.
 */
export class ConfettiEngine {
  private canvas: Canvas | null = null;
  private ctx: Context | null = null;
  private attached = false;
  private pieces: Piece[] = [];
  private groups = new Map<number, Group>();
  private nextGroup = 1;
  private raining = false;
  private rainAcc = 0;
  private burnStart: number | null = null;
  private rafId: number | null = null;
  private releaseTimer: ReturnType<typeof setTimeout> | null = null;
  /** Called when the animation loop starts and stops */
  onRunning: ((running: boolean) => void) | null = null;
  private lastTime = 0;
  private width = 0;
  private height = 0;
  private dpr = 1;

  /** Starts drawing on `canvas` (or on the canvas of an earlier attach) */
  attach(canvas?: Canvas) {
    if (canvas && canvas !== this.canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d') as Context | null;
    }
    this.attached = true;
    if (this.pieces.length || this.raining) this.start();
  }

  detach() {
    this.stop();
    this.attached = false;
  }

  handle(cmd: ConfettiCommand): Promise<void> | void {
    switch (cmd.type) {
      case 'size': return this.setSize(cmd.width, cmd.height, cmd.dpr);
      case 'ringBurst': return this.ringBurst(cmd.origin, cmd.innerRadius, cmd.outerRadius, cmd.count);
      case 'pointBurst': return this.pointBurst(cmd.origin, cmd.count);
      case 'shower': return this.shower(cmd.count);
      case 'dissolve': return this.dissolve();
      case 'rain': return this.setRaining(cmd.raining);
      case 'interrupt': return this.interrupt();
    }
  }

  setSize(width: number, height: number, dpr: number) {
    this.width = width;
    this.height = height;
    this.dpr = Math.min(dpr || 1, MAX_DPR);
    if (this.rafId !== null) this.resize();
  }

  /** Burst from a ring around the dial (timer end). Resolves when all pieces are gone. */
  ringBurst(origin: Point, innerRadius: number, outerRadius: number, count = 150): Promise<void> {
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
  pointBurst(origin: Point, count = 150): Promise<void> {
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

  /** A short, light shower falling from above the top edge (entering party mode). */
  shower(count = 55): Promise<void> {
    const { width, height } = this;
    return this.spawnGroup(count, () => this.makePiece(
      RAINBOW_COLORS[Math.floor(Math.random() * RAINBOW_COLORS.length)],
      Math.random() * width, -10 - Math.random() * height * 0.35,
      Math.random() * 1.2 - 0.6, Math.random() * 1.8 + 1.6,
      SHOWER_PHYSICS, false,
    ));
  }

  /** Let title confetti that is still in the air fade out while it falls (leaving party mode). */
  dissolve() {
    for (const p of this.pieces) {
      if (!p.burnable) p.dissolving = true;
    }
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
      physics, burnable, doomed: false, dissolving: false, group: 0,
    };
  }

  private spawnGroup(count: number, factory: (i: number) => Piece): Promise<void> {
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

  private resize() {
    if (!this.canvas) return;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
  }

  private start() {
    if (this.rafId !== null || !this.canvas || !this.attached) return;
    if (this.releaseTimer !== null) { clearTimeout(this.releaseTimer); this.releaseTimer = null; }
    this.resize();
    this.lastTime = performance.now();
    this.rafId = raf(this.frame);
    this.onRunning?.(true);
  }

  private stop() {
    if (this.rafId !== null) {
      cancelRaf(this.rafId);
      this.onRunning?.(false);
    }
    this.rafId = null;
    this.burnStart = null;
    if (!this.canvas || !this.ctx || this.releaseTimer !== null) return;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // Release the backing store while idle, but only once the cleared frame is on screen: an OffscreenCanvas
    // never shows a 0x0 frame and would keep showing the last pieces
    this.releaseTimer = setTimeout(() => {
      this.releaseTimer = null;
      if (this.rafId === null && this.canvas) { this.canvas.width = 0; this.canvas.height = 0; }
    }, RELEASE_DELAY_MS);
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
      if (p.dissolving) p.alpha *= Math.pow(DISSOLVE_FADE, k);
      if (ph.fadeAtBottom && p.y > fadeStart) {
        const range = Math.max(1, height * p.fadeEnd - fadeStart);
        p.alpha = Math.min(p.alpha, p.baseAlpha * (1 - Math.min(1, (p.y - fadeStart) / range)));
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
      this.rafId = raf(this.frame);
    } else {
      this.stop();
    }
  };
}
