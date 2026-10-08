import { SHAPE, hexRgb } from './model';

/** Every shape is drawn once in the flat two-tone style of the balloons (a darker crescent at the lower right, the
 *  lit part offset up-left) plus a soft highlight. */
export const CELL = 64;

type Ctx = CanvasRenderingContext2D;

function shapePath(ctx: Ctx, shape: number) {
  ctx.beginPath();
  switch (shape) {
    case SHAPE.paper: ctx.roundRect(5, 5, 54, 54, 6); break;
    case SHAPE.dot: ctx.arc(32, 32, 26, 0, Math.PI * 2); break;
    case SHAPE.star:
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 11.5 : 27;
        const a = -Math.PI / 2 + i * Math.PI / 5;
        ctx.lineTo(32 + Math.cos(a) * r, 34 + Math.sin(a) * r);
      }
      ctx.closePath();
      break;
    case SHAPE.curl:
      ctx.moveTo(10, 50); ctx.bezierCurveTo(8, 30, 30, 28, 31, 40); ctx.bezierCurveTo(32, 52, 52, 50, 53, 33); ctx.bezierCurveTo(54, 20, 44, 13, 37, 15);
      break;
    case SHAPE.heart:
      ctx.moveTo(32, 55); ctx.bezierCurveTo(14, 42, 5, 31, 5, 21); ctx.bezierCurveTo(5, 12, 12, 7, 19, 7); ctx.bezierCurveTo(25, 7, 30, 11, 32, 16);
      ctx.bezierCurveTo(34, 11, 39, 7, 45, 7); ctx.bezierCurveTo(52, 7, 59, 12, 59, 21); ctx.bezierCurveTo(59, 31, 50, 42, 32, 55); ctx.closePath();
      break;
  }
}

function paint(ctx: Ctx, shape: number, style: string) {
  shapePath(ctx, shape);
  if (shape === SHAPE.curl) {
    ctx.strokeStyle = style; ctx.lineWidth = 13; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  } else if (shape === SHAPE.star) {
    ctx.fillStyle = style; ctx.strokeStyle = style; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.fill(); ctx.stroke();
  } else {
    ctx.fillStyle = style; ctx.fill();
  }
}

/** [x, y, rx, ry, rotation, alpha] */
const HIGHLIGHTS: Record<number, number[][]> = {
  [SHAPE.paper]: [[19, 15, 10, 3.5, -0.5, 0.32]],
  [SHAPE.dot]: [[22, 21, 6.5, 10, -0.55, 0.5], [35, 15, 2.8, 2.8, 0, 0.6]],
  [SHAPE.star]: [[26, 25, 4.5, 6, -0.6, 0.5]],
  [SHAPE.curl]: [[16, 36, 2.5, 6, 0.3, 0.35]],
  [SHAPE.heart]: [[17, 19, 5, 8.5, -0.6, 0.45], [26, 12, 2, 2, 0, 0.55]],
};

/** Draws a shape into a 64×64 cell at the context's origin. hl: highlight color, hlScale: highlight strength. */
function drawShape(ctx: Ctx, shape: number, lit: string, dark: string, hl: string, hlScale = 1) {
  if (shape === SHAPE.halo) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    g.addColorStop(0, lit); g.addColorStop(0.35, withAlpha(lit, 0.45)); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return;
  }
  ctx.save();
  paint(ctx, shape, dark);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.translate(-5, -5);
  paint(ctx, shape, lit);
  ctx.translate(5, 5);
  ctx.fillStyle = hl;
  for (const [x, y, rx, ry, rot, a] of HIGHLIGHTS[shape]) {
    ctx.globalAlpha = a * hlScale;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

const withAlpha = (rgb: string, a: number) => rgb.replace('rgb(', 'rgba(').replace(')', `,${a})`);

/** Atlas for the shader: R = shading (lit 1, crescent 0.77), G = highlight, A = coverage; transparent texels bled.
 *  Cell 5 (halo) is drawn separately by the shader's halo pass from the same texture. */
export function buildAtlas(): ImageData {
  const c = document.createElement('canvas');
  c.width = CELL * 8; c.height = CELL;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  for (const shape of [0, 1, 2, 3, 4, 5]) {
    ctx.save(); ctx.translate(shape * CELL, 0);
    drawShape(ctx, shape, 'rgb(255,0,0)', 'rgb(196,0,0)', 'rgb(255,255,0)');
    ctx.restore();
  }
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] === 0) { d[i] = 235; d[i + 1] = 0; }
  return img;
}

function mixRgb(hex: string, k: number) {
  const [r, g, b] = hexRgb(hex).map((v) => v * 255);
  const t = k < 0 ? 0 : 255;
  const f = Math.abs(k);
  return `rgb(${Math.round(r + (t - r) * f)},${Math.round(g + (t - g) * f)},${Math.round(b + (t - b) * f)})`;
}

const scaleRgb = (css: string, f: number) => css.replace(/\d+(\.\d+)?/g, (v) => String(Math.round(+v * f)));

const spriteCache = new Map<string, HTMLCanvasElement>();

/** Tinted sprites for the 2D renderer, cached per shape, color, side and theme */
export function sprite(shape: number, color: string, back: boolean, dark: boolean, size = 32): HTMLCanvasElement {
  const key = `${shape}|${color}|${back}|${dark}|${size}`;
  let s = spriteCache.get(key);
  if (s) return s;
  s = document.createElement('canvas');
  s.width = s.height = size;
  const ctx = s.getContext('2d')!;
  ctx.scale(size / CELL, size / CELL);
  const base = mixRgb(color, dark ? 0.14 : 0);
  const lit = back ? scaleRgb(base, 0.74) : base;
  drawShape(ctx, shape, lit, scaleRgb(lit, 0.77), '#fff', back ? 0.15 : 1);
  spriteCache.set(key, s);
  return s;
}

export function haloSprite(color: string): HTMLCanvasElement {
  const key = `halo|${color}`;
  let s = spriteCache.get(key);
  if (!s) {
    s = document.createElement('canvas'); s.width = s.height = 32;
    const ctx = s.getContext('2d')!;
    ctx.scale(0.5, 0.5);
    drawShape(ctx, SHAPE.halo, mixRgb(color, 0.14), '', '');
    spriteCache.set(key, s);
  }
  return s;
}
