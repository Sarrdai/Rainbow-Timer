"use client";

import { useEffect, useRef } from 'react';
import { ConfettiEngine, type ConfettiCommand, type ConfettiWorkerMessage } from './confetti-engine';

export { RAINBOW_COLORS } from './confetti-engine';

type Point = { x: number; y: number };
/** A command without its id; the id is added when it is sent */
type Request<T extends ConfettiCommand> = T extends { id: number } ? Omit<T, 'id'> : T;

/**
 * Single shared confetti renderer (see ConfettiEngine). Where the browser supports it, the engine runs in a
 * worker drawing on an OffscreenCanvas, so the confetti keep flying while the main thread is busy, e.g. while
 * the party decoration mounts; otherwise it runs on the main thread.
 */
class Confetti {
  private canvas: HTMLCanvasElement | null = null;
  private worker: Worker | null = null;
  private local: ConfettiEngine | null = null;
  /** Commands sent before the canvas is attached */
  private queue: ConfettiCommand[] = [];
  private pending = new Map<number, () => void>();
  private nextId = 1;

  attach(canvas: HTMLCanvasElement) {
    // A canvas can be transferred only once: a re-attach (Strict Mode) keeps the worker that holds it
    if (canvas !== this.canvas) {
      this.teardown();
      this.canvas = canvas;
      this.worker = this.startWorker(canvas);
      if (!this.worker) {
        this.local = new ConfettiEngine();
        this.local.attach(canvas);
      }
    } else if (this.worker) {
      this.post({ attach: true });
    } else {
      this.local?.attach();
    }
    window.addEventListener('resize', this.sendSize);
    this.sendSize();
    this.queue.splice(0).forEach((cmd) => this.send(cmd));
  }

  detach() {
    window.removeEventListener('resize', this.sendSize);
    if (this.worker) this.post({ detach: true });
    else this.local?.detach();
  }

  /** Burst from a ring around the dial (timer end). Resolves when all pieces are gone. */
  ringBurst(origin: Point, innerRadius: number, outerRadius: number, count?: number) {
    return this.request({ type: 'ringBurst', origin, innerRadius, outerRadius, count });
  }

  /** Burst from a single point (title click, celebration interrupt). */
  pointBurst(origin: Point, count?: number) {
    return this.request({ type: 'pointBurst', origin, count });
  }

  /** A short, light shower falling from above the top edge (entering party mode). */
  shower(count?: number) {
    return this.request({ type: 'shower', count });
  }

  /** Let title confetti that is still in the air fade out while it falls (leaving party mode). */
  dissolve() {
    this.send({ type: 'dissolve' });
  }

  setRaining(raining: boolean) {
    this.send({ type: 'rain', raining });
  }

  /** Stop the rain and sweep all celebration pieces away from top to bottom. */
  interrupt() {
    this.send({ type: 'interrupt' });
  }

  private request<T extends ConfettiCommand>(cmd: Request<T>): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.send({ ...cmd, id } as ConfettiCommand);
    });
  }

  private send(cmd: ConfettiCommand) {
    if (this.worker) this.post({ cmd });
    else if (this.local) this.local.handle(cmd)?.then(() => { if ('id' in cmd) this.finish(cmd.id); });
    else this.queue.push(cmd);
  }

  private startWorker(canvas: HTMLCanvasElement): Worker | null {
    if (typeof Worker === 'undefined' || !('transferControlToOffscreen' in canvas)) return null;
    let worker: Worker;
    try {
      worker = new Worker(new URL('./confetti.worker.ts', import.meta.url));
    } catch {
      return null;
    }
    worker.onmessage = (e: MessageEvent<number>) => this.finish(e.data);
    const offscreen = canvas.transferControlToOffscreen();
    worker.postMessage({ attach: true, canvas: offscreen } satisfies ConfettiWorkerMessage, [offscreen]);
    return worker;
  }

  private post(message: ConfettiWorkerMessage, transfer: Transferable[] = []) {
    this.worker?.postMessage(message, transfer);
  }

  private finish(id: number) {
    this.pending.get(id)?.();
    this.pending.delete(id);
  }

  private sendSize = () => {
    this.send({ type: 'size', width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio || 1 });
  };

  private teardown() {
    this.worker?.terminate();
    this.local?.detach();
    this.worker = null;
    this.local = null;
    // Bursts on the old canvas are gone with it
    this.pending.forEach((resolve) => resolve());
    this.pending.clear();
  }
}

export const confetti = new Confetti();

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
