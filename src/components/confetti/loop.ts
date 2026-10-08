import { now } from './model';

/** How long the full-window drawing buffer stays allocated after the last particle (re-creating it is slow) */
const RELEASE_AFTER_MS = 10000;

export interface Renderer {
  /** Adds particles (start times may lie in the future) */
  add(list: import('./model').Particle[]): void;
  /** Keeps the frame loop running until time `t` (fade-outs and sweeps of existing particles) */
  extendTo(t: number): void;
  destroy(): void;
}

/** Size the drawing buffer to the viewport; returns the device pixel ratio used */
export function sizeCanvas(canvas: HTMLCanvasElement, maxDpr: number, w: number, h: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const pw = Math.round(w * dpr);
  const ph = Math.round(h * dpr);
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
  return dpr;
}

/** Runs `frame` on requestAnimationFrame while particles live (or `busy()`); then calls `onIdle` after a delay */
export class Loop {
  private id = 0;
  private until = 0;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private frame: (t: number) => void, private onIdle: () => void, private busy: () => boolean) {}

  extend(until: number) {
    this.until = Math.max(this.until, until);
    this.wake();
  }

  wake() {
    clearTimeout(this.idleTimer);
    if (!this.id) this.id = requestAnimationFrame(this.tick);
  }

  private tick = () => {
    const t = now();
    this.frame(t);
    if (t < this.until || this.busy()) {
      this.id = requestAnimationFrame(this.tick);
    } else {
      this.id = 0;
      this.idleTimer = setTimeout(this.onIdle, RELEASE_AFTER_MS);
    }
  };

  stop() {
    cancelAnimationFrame(this.id);
    clearTimeout(this.idleTimer);
    this.id = 0;
  }
}
