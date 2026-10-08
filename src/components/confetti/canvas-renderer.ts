import { FLAG, env, evaluate, type Evaluated, type Particle } from './model';
import { Loop, sizeCanvas, type Renderer } from './loop';
import { haloSprite, sprite } from './sprites';
import { RAINBOW_COLORS } from '@/lib/palette';

/** The 2D canvas stays cheap with clears and draws at 1.5x */
const MAX_DPR = 1.5;

/** Fallback renderer: the same formula evaluated in JavaScript, tinted sprites drawn with drawImage */
export class CanvasRenderer implements Renderer {
  private ctx: CanvasRenderingContext2D;
  private list: Particle[] = [];
  private loop: Loop;
  private tmp: Evaluated = { x: 0, y: 0, a: 0, rot: 0, fl: 1, tau: 0 };

  constructor(private canvas: HTMLCanvasElement, busy: () => boolean) {
    this.ctx = canvas.getContext('2d')!;
    this.loop = new Loop((t) => this.frame(t), () => { canvas.width = 1; canvas.height = 1; }, busy);
    // Warm the sprite cache for the rainbow colors
    for (const c of RAINBOW_COLORS) for (let s = 0; s < 5; s++) { sprite(s, c, false, env.dark); sprite(s, c, true, env.dark); }
  }

  add(list: Particle[]) {
    let until = 0;
    for (const p of list) { this.list.push(p); until = Math.max(until, p.t0 + p.life); }
    this.loop.extend(until);
  }

  extendTo(t: number) { this.loop.extend(t); }

  private frame(t: number) {
    const { ctx, tmp: out } = this;
    const dpr = sizeCanvas(this.canvas, MAX_DPR, env.w, env.h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    let write = 0;
    const halos: [Particle, number, number, number, number][] = [];
    for (const p of this.list) {
      if (t - p.t0 > p.life) continue;
      this.list[write++] = p;
      if (!evaluate(p, t, out) || out.a <= 0.01) continue;
      const cs = Math.cos(out.rot);
      const sn = Math.sin(out.rot);
      const sx = p.w / 32;
      const sy = p.h / 32 * out.fl;
      ctx.globalAlpha = out.a;
      ctx.setTransform(dpr * cs * sx, dpr * sn * sx, -dpr * sn * sy, dpr * cs * sy, dpr * out.x, dpr * out.y);
      ctx.drawImage(sprite(p.shape, p.color, out.fl < 0, env.dark), -16, -16);
      if (env.dark && (p.flags & FLAG.glow)) halos.push([p, out.x, out.y, out.a, out.tau]);
    }
    this.list.length = write;
    if (halos.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (const [p, x, y, a, tau] of halos) {
        const m = Math.max(p.w, p.h) * 3.4;
        ctx.globalAlpha = a * 0.5 * (0.7 + 0.3 * Math.sin(tau * 5 + p.phase));
        ctx.setTransform(dpr * m / 32, 0, 0, dpr * m / 32, dpr * x, dpr * y);
        ctx.drawImage(haloSprite(p.color), -16, -16);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  destroy() { this.loop.stop(); this.list = []; }
}
