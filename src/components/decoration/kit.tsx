import { Fragment, useId, type CSSProperties, type ReactNode } from 'react';
import { RAINBOW_COLORS } from '@/lib/palette';

/*
 * Shared pieces of the party decoration variants: layout, seeded randomness, garland and streamer geometry,
 * and the wrappers that give every hanging item the same entrance, sway and exit (the party-* styles in globals.css).
 */

export type DecoTheme = 'light' | 'dark';

export interface DecoLayout {
    width: number;
    height: number;
    /** Phone layout: fewer and closer corner pieces */
    small: boolean;
    /** Added to every entrance delay (seconds); negative for a scene rebuilt in its settled state */
    base: number;
    /** Area the garland keeps clear of (the title) */
    avoid: DOMRect | null;
    /** Seeds the variant's randomness, so every render draws the same scene */
    seed: number;
}

/** A garland or corner decoration: layers placed in window coordinates inside the full-window decoration */
export type DecoVariant = (props: { layout: DecoLayout }) => ReactNode;

export const RAINBOW = RAINBOW_COLORS;
/** Brighter versions of the rainbow colors for lights in the dark */
export const GLOW = ['#ff6b6d', '#ffb84a', '#fff27a', '#a8ea5c', '#86b4ff', '#a993ff', '#d897ff'];
export const INK = '#2d1b3d';

export const f1 = (n: number) => Math.round(n * 10) / 10;
export const seconds = (n: number) => `${Math.round(n * 100) / 100}s`;
export const vars = (v: Record<string, string | number>) => v as CSSProperties;

/** CSS-safe id prefix for the gradients, masks and patterns of one drawing */
export const useSvgId = () => useId().replace(/[^\w-]/g, '');

/** Mixes a hex color toward black (k < 0) or white (k > 0) */
export function mix(hex: string, k: number) {
    const n = parseInt(hex.slice(1), 16);
    const target = k < 0 ? 0 : 255;
    const channel = (v: number) => Math.round(v + (target - v) * Math.abs(k));
    return `rgb(${channel(n >> 16)} ${channel((n >> 8) & 255)} ${channel(n & 255)})`;
}

function mulberry32(seed: number) {
    let a = seed | 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** The layout plus seeded randomness and the timing styles derived from it; `salt` gives each variant its own sequence */
export function makeKit(layout: DecoLayout, salt: number) {
    const next = mulberry32(layout.seed + salt * 7919);
    const rand = (a: number, b: number) => a + next() * (b - a);
    return {
        ...layout,
        rand,
        /** Entrance delay, shifted for settled scenes */
        delay: (d: number) => seconds(layout.base + d),
        /** Random start within a looping animation */
        phase: (max = 3.5) => seconds(-rand(0, max)),
        /** Style of a group that falls to the floor when the party ends */
        fall: (min: number, max: number) => vars({
            '--fall-delay': seconds(rand(min, max)),
            '--fall-dur': seconds(rand(0.8, 1.1)),
            '--fall-rot': `${f1(rand(-25, 25))}deg`,
            '--fall-dy': `${layout.height + 60}px`,
        }),
        /** Props of a glow that pulses at its own pace */
        twinkle: (className = 'party-twinkle') => ({ className, style: vars({ '--tw': seconds(rand(1.4, 2.8)), '--tw-delay': seconds(-rand(0, 3)) }) }),
    };
}
export type Kit = ReturnType<typeof makeKit>;

/* ---------- Geometry ---------- */

export interface HangPoint { x: number; y: number; angle: number; i: number }

export interface Scallop {
    index: number;
    /** Center x */
    mid: number;
    /** Entrance delay (seconds, unshifted): the middle sections drop in first */
    start: number;
    y: (x: number) => number;
    /** Path along the scallop, offset vertically by dy */
    path: (dy?: (x: number) => number, step?: number) => string;
    /** Evenly spaced hang points; items of the given height that would hang behind the title are left out */
    points: (gap: number, height: number) => HangPoint[];
}

/** Garland sections hanging in scallops across the top edge */
export function scallops({ width, avoid }: DecoLayout): Scallop[] {
    const count = Math.max(2, Math.round(width / 420));
    const span = (width + 40) / count;
    const sag = Math.min(70, span * 0.16);
    const top = 6;
    return Array.from({ length: count }, (_, index) => {
        const x0 = -20 + index * span;
        const half = span / 2;
        const mid = x0 + half;
        const y = (x: number) => top + sag * (1 - ((x - mid) / half) ** 2);
        return {
            index,
            mid,
            start: 0.05 + Math.abs(index - (count - 1) / 2) * 0.08,
            y,
            path: (dy = () => 0, step = 3) => {
                let d = '';
                for (let x = x0; x <= x0 + span + 0.5; x += step) d += `${d ? 'L' : 'M'}${f1(x)} ${f1(y(x) + dy(x))}`;
                return d;
            },
            points: (gap, height) => {
                const n = Math.max(3, Math.floor(span / gap));
                const out: HangPoint[] = [];
                for (let i = 1; i < n; i++) {
                    const x = x0 + (i * span) / n;
                    const yy = y(x);
                    if (avoid && x > avoid.left - 20 && x < avoid.right + 20 && yy + height > avoid.top) continue;
                    out.push({ x, y: yy, angle: (Math.atan((-2 * sag * (x - mid)) / half ** 2) * 180) / Math.PI, i });
                }
                return out;
            },
        };
    });
}

export const colorAt = (s: Scallop, p: HangPoint, shift = 0) => (p.i + s.index * 3 + shift) % RAINBOW.length;

/** Lights switch on from left to right once the garland has dropped in, and go out in the same order */
export const lightTiming = (k: Kit, s: Scallop, p: HangPoint) => ({
    on: k.delay(s.start + 0.75 + (p.x / k.width) * 0.9),
    off: seconds((p.x / k.width) * 0.45),
});

type Point = readonly [number, number, ...unknown[]];
export const toPath = (points: readonly Point[]) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${f1(x)} ${f1(y)}`).join('');

export interface Curl {
    x: number;
    side: 1 | -1;
    len: number;
    colorIndex: number;
    amp: number;
    turns: number;
    width: number;
    /** Entrance delay (seconds, unshifted) */
    start: number;
    fall: CSSProperties;
    phase: string;
}

/** Streamers hanging from both top corners */
export function curls(k: Kit): Curl[] {
    const perSide = k.small ? 3 : 5;
    const out: Curl[] = [];
    for (const side of [1, -1] as const) {
        let x = side === 1 ? 14 : k.width - 14;
        for (let i = 0; i < perSide; i++) {
            const len = k.height * k.rand(0.22, 0.5) * (1 - i * 0.08);
            out.push({
                x, side, len,
                colorIndex: (i * 2 + (side === 1 ? 0 : 1)) % RAINBOW.length,
                amp: k.rand(7, 12),
                turns: len / k.rand(32, 44),
                width: k.rand(4, 6),
                start: 0.25 + i * 0.09,
                fall: k.fall(0.05, 0.35),
                phase: k.phase(3.4),
            });
            x += side * k.rand(26, 38);
        }
    }
    return out;
}

/**
 * A helix hanging from the top edge, seen slightly from above: with loop > 0 the back of each turn rises,
 * so the turns overlap. The flag marks points on the front half.
 */
export function curlPoints(c: Curl, loop: number): [number, number, boolean][] {
    return Array.from({ length: 221 }, (_, n) => {
        const t = n / 220;
        const th = t * c.turns * 2 * Math.PI;
        const amp = c.amp * (0.35 + 0.65 * t);
        return [c.x + c.side * amp * Math.sin(th), -6 + t * c.len + loop * amp * Math.cos(th), Math.cos(th) >= 0];
    });
}

/** Circles as one path (filled as their union): far fewer elements than one circle each */
export const circlesPath = (circles: readonly (readonly [number, number, number])[]) =>
    circles.map(([cx, cy, r]) => `M${f1(cx - r)} ${f1(cy)}a${f1(r)} ${f1(r)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-2 * r)} 0Z`).join('');

export function starPath(cx: number, cy: number, outer: number, inner = outer * 0.45) {
    return Array.from({ length: 10 }, (_, k) => {
        const a = ((-90 + k * 36) * Math.PI) / 180;
        const r = k % 2 ? inner : outer;
        return `${k ? 'L' : 'M'}${f1(cx + r * Math.cos(a))} ${f1(cy + r * Math.sin(a))}`;
    }).join('') + 'Z';
}

/** Draws once per top corner; `fromEdge` turns an offset from that corner's side edge into an x position */
export const corners = (k: Kit, draw: (fromEdge: (dx: number) => number, side: 0 | 1) => ReactNode) =>
    ([0, 1] as const).map((side) => <Fragment key={side}>{draw((dx) => (side === 0 ? dx : k.width - dx), side)}</Fragment>);

/* ---------- Wrappers ---------- */

/*
 * Every animated piece is an HTML node of its own with a small SVG drawing inside, so the browser moves it on the
 * compositor instead of repainting a window-sized SVG on every frame. Nodes have zero size; positions and
 * transform origins are in pixels relative to the enclosing node.
 */

/** Zero-size node at the top left corner of the enclosing node */
export function Layer({ className, style, children }: { className?: string; style?: CSSProperties; children?: ReactNode }) {
    return <div className={className ? `party-node ${className}` : 'party-node'} style={style}>{children}</div>;
}

/** Style that moves a layer to (x, y), optionally rotated (degrees) and scaled */
export const place = (x: number, y: number, angle = 0, scale = 1): CSSProperties => ({
    transform: `translate(${f1(x)}px, ${f1(y)}px)${angle ? ` rotate(${f1(angle)}deg)` : ''}${scale !== 1 ? ` scale(${f1(scale)})` : ''}`,
});

/** SVG drawing in pixels around the enclosing node; it overflows its zero size */
export function Art({ children }: { children: ReactNode }) {
    return <svg className="party-art">{children}</svg>;
}

/** Gradients and patterns of one variant, shared by all of its drawings */
export function Defs({ children }: { children: ReactNode }) {
    return <svg className="party-defs"><defs>{children}</defs></svg>;
}

/** Falls to the floor when the party ends, tipping over around (x, y) */
export function Fall({ fall, x, y = 0, children }: { fall: CSSProperties; x: number; y?: number; children: ReactNode }) {
    return <Layer className="party-fall" style={{ ...fall, transformOrigin: `${f1(x)}px ${f1(y)}px` }}>{children}</Layer>;
}

interface GarlandSectionProps {
    /** Center of the section; it tips over around its top center when it falls */
    x: number;
    fall: CSSProperties;
    delay: string;
    /** SVG drawing of the cord */
    cord: ReactNode;
    /** Hang items */
    children: ReactNode;
}

/** One garland section: drops in from the top edge and falls to the floor when the party ends */
export function GarlandSection({ x, fall, delay, cord, children }: GarlandSectionProps) {
    return (
        <Fall fall={fall} x={x}>
            <Layer className="party-drop" style={vars({ '--delay': delay })}>
                <Art>{cord}</Art>
                {children}
            </Layer>
        </Fall>
    );
}

interface HangProps {
    x: number;
    y: number;
    angle?: number;
    delay: string;
    /** Sway animation class; empty for items that keep still */
    sway?: string;
    phase?: string;
    /** Glow layer behind the drawing; it is round and close to the hang point, so it does not need to sway along */
    glow?: ReactNode;
    /** SVG drawing around the hang point */
    children: ReactNode;
}

/** An item hanging from (x, y): unfolds on entrance, then sways around its hang point */
export function Hang({ x, y, angle = 0, delay, sway = 'party-sway', phase = '0s', glow, children }: HangProps) {
    const art = <Art>{children}</Art>;
    return (
        <Layer style={place(x, y, angle)}>
            <Layer className="party-item" style={vars({ '--delay': delay })}>
                {glow}
                {sway ? <Layer className={sway} style={vars({ '--sway-delay': phase })}>{art}</Layer> : art}
            </Layer>
        </Layer>
    );
}

interface DangleProps { x: number; len: number; delay: string; fall: CSSProperties; phase: string; glow?: ReactNode; children: ReactNode }

/** An item on a string of length `len` from the top edge: drops in from above and swings gently */
export function Dangle({ x, len, delay, fall, phase, glow, children }: DangleProps) {
    return (
        <Fall fall={fall} x={x} y={-6}>
            <Layer style={place(x, 0)}>
                <Layer className="party-hang" style={vars({ '--delay': delay, '--from': `${-Math.round(len + 80)}px` })}>
                    <Layer className="party-sway party-sway--gentle" style={vars({ '--sway-delay': phase })}>
                        {glow}
                        <Art>
                            <path className="party-thread" d={`M0 -6 V${f1(len)}`} fill="none" strokeWidth={1.2} />
                            {children}
                        </Art>
                    </Layer>
                </Layer>
            </Layer>
        </Fall>
    );
}

interface CornerStrandProps {
    x: number;
    fall: CSSProperties;
    phase: string;
    gentle?: boolean;
    /** Layers of the strand: Art, Unroll, Sweep */
    children: ReactNode;
}

/** A streamer or light strand hanging from a top corner at x: sways from its top and falls at the end */
export function CornerStrand({ x, fall, phase, gentle, children }: CornerStrandProps) {
    return (
        <Fall fall={fall} x={x}>
            <Layer className={gentle ? 'party-curl party-curl--gentle' : 'party-curl'} style={{ ...vars({ '--sway-delay': phase }), transformOrigin: `${f1(x)}px 0` }}>
                {children}
            </Layer>
        </Fall>
    );
}

interface SweepProps {
    /** Window in the coordinates of the enclosing node */
    left: number;
    top: number;
    width: number;
    height: number;
    /** CSS mask image: the brightness profile the window runs down with */
    mask: string;
    /** Animation class moving the window and its content (party-sweep-on with --delay, --dur, --sweep-from and
        optionally --ease; party-drip) */
    className: string;
    style?: CSSProperties;
    children: ReactNode;
}

/**
 * A masked window that slides down over its children while they counter-move and stay in place: a brightness
 * profile running down a light strand as two compositor animations, instead of one animation per light.
 */
export function Sweep({ left, top, width, height, mask, className, style, children }: SweepProps) {
    return (
        <div
            className={`party-sweep ${className}`}
            style={{ ...style, left: f1(left), top: f1(top), width: f1(width), height: f1(height), maskImage: mask, WebkitMaskImage: mask }}
        >
            <div className="party-sweep-hold">
                <Layer style={place(-left, -top)}>{children}</Layer>
            </div>
        </div>
    );
}

/** Bounding box [left, top, right, bottom] of points, grown by `pad` */
export function bounds(points: readonly Point[], pad: number): [number, number, number, number] {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
}

/** Soft front edge of an unrolling drawing */
const UNROLL_EDGE = 16;

/**
 * Reveals an SVG drawing within `box` from the top down, as if it unrolled or was drawn downwards: a sliding
 * window on the compositor instead of an animated stroke that repaints the drawing on every frame.
 */
export function Unroll({ box: [left, top, right, bottom], delay, children }: { box: readonly number[]; delay: string; children: ReactNode }) {
    const height = bottom - top + UNROLL_EDGE;
    return (
        <Sweep
            left={left} top={top} width={right - left} height={height}
            mask={`linear-gradient(to top, transparent, #000 ${UNROLL_EDGE}px)`}
            className="party-sweep-on"
            style={vars({ '--delay': delay, '--dur': '1.25s', '--ease': 'cubic-bezier(0.25, 0.8, 0.25, 1)', '--sweep-from': `${-f1(height)}px` })}
        >
            <Art>{children}</Art>
        </Sweep>
    );
}

/** The lit part of a light: switches on at `on` and goes out at `off` when the party ends */
export function Lit({ on, off, neon, children }: { on: string; off: string; neon?: boolean; children: ReactNode }) {
    return <g className={neon ? 'party-lit party-lit--neon' : 'party-lit'} style={vars({ '--on': on, '--off': off })}>{children}</g>;
}

/** Soft round glow in SVG that fades out to the edge; cheaper than a blur filter */
export function GlowGradient({ id, color, strength }: { id: string; color: string; strength: number }) {
    return (
        <radialGradient id={id}>
            <stop offset="0" stopColor={color} stopOpacity={strength} />
            <stop offset="0.4" stopColor={color} stopOpacity={Math.round(strength * 34) / 100} />
            <stop offset="1" stopColor={color} stopOpacity={0} />
        </radialGradient>
    );
}

interface GlowProps {
    x?: number;
    y: number;
    r: number;
    /** Hex color #rrggbb */
    color: string;
    strength: number;
    on: string;
    off: string;
    twinkle: ReturnType<Kit['twinkle']>;
}

/** Glow of a light around (x, y) as a layer of its own, so its twinkle runs on the compositor; switches on and off like Lit */
export function Glow({ x = 0, y, r, color, strength, on, off, twinkle }: GlowProps) {
    const alpha = (a: number) => color + Math.round(a * 255).toString(16).padStart(2, '0');
    return (
        <Layer className="party-lit" style={vars({ '--on': on, '--off': off })}>
            <div
                className={`party-glow ${twinkle.className}`}
                style={{
                    ...twinkle.style,
                    left: f1(x - r), top: f1(y - r), width: f1(2 * r), height: f1(2 * r),
                    background: `radial-gradient(closest-side, ${alpha(strength)}, ${alpha(strength * 0.34)} 40%, ${alpha(0)})`,
                }}
            />
        </Layer>
    );
}
