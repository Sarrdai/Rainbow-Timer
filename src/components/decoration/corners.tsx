import { Shade, shine } from '../balloon-shapes';
import {
    CornerStrand, corners, curlPoints, curls, Dangle, f1, GLOW, GlowGradient, INK, Lit, makeKit, mix, RAINBOW, seconds, starPath, toPath, useSvgId, vars,
    type DecoLayout, type DecoVariant, type Kit,
} from './kit';

/*
 * Decoration hanging from the two top corners. Light theme: streamers and paper decorations.
 * Dark theme: light strands, neon streamers and glowing stars.
 */

/* ---------- Light theme ---------- */

/** Path of the front halves of the turns, each run extended by one point into the back half on both ends */
function frontPath(points: [number, number, boolean][]) {
    const runs: [number, number, boolean][][] = [];
    let run: [number, number, boolean][] | null = null;
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (p[2]) {
            if (!run) {
                run = i ? [points[i - 1]] : [];
                runs.push(run);
            }
            run.push(p);
        } else if (run) {
            run.push(p);
            run = null;
        }
    }
    return runs.map(toPath).join('');
}

/** Curling ribbons: the light front of each turn with a glossy edge over the darker inside; they unroll from the corners */
function RibbonCurls({ layout }: { layout: DecoLayout }) {
    const id = useSvgId();
    const k = makeKit(layout, 11);
    return (
        <>
            {curls(k).map((c, n) => {
                const points = curlPoints(c, 0.85);
                const full = toPath(points);
                const front = frontPath(points);
                const color = RAINBOW[c.colorIndex];
                const w = f1(c.width + 1.6);
                return (
                    <CornerStrand key={n} fall={c.fall} phase={c.phase}>
                        {/* Reveals the ribbon along its length as it unrolls */}
                        <mask id={`${id}-${n}`} maskUnits="userSpaceOnUse" x={-60} y={-60} width={k.width + 120} height={k.height + 120}>
                            <path className="party-draw" pathLength={1} style={vars({ '--delay': k.delay(c.start) })} d={full} fill="none" stroke="#fff" strokeWidth={w + 18} strokeLinecap="round" />
                        </mask>
                        <g mask={`url(#${id}-${n})`}>
                            <path d={full} fill="none" stroke={color} strokeWidth={w} strokeLinejoin="round" />
                            <path d={full} fill="none" stroke="#000" strokeOpacity={0.34} strokeWidth={w} strokeLinejoin="round" />
                            <path d={front} fill="none" stroke={color} strokeWidth={w} strokeLinejoin="round" />
                            <path d={front} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={f1(w * 0.22)} strokeLinecap="round" transform={`translate(0 ${f1(-w * 0.24)})`} />
                        </g>
                    </CornerStrand>
                );
            })}
        </>
    );
}

/** Accordion paper fan: alternating pleats with a zigzag rim and a round button */
function Fan({ cx, cy, r, color, button }: { cx: number; cy: number; r: number; color: string; button: string }) {
    const pleats = 36;
    const at = (a: number, radius: number) => `${f1(cx + radius * Math.cos(a))} ${f1(cy + radius * Math.sin(a))}`;
    let all = '';
    let dark = '';
    for (let i = 0; i < pleats; i++) {
        const a0 = (i / pleats) * 2 * Math.PI;
        const a1 = ((i + 1) / pleats) * 2 * Math.PI;
        const wedge = `M${f1(cx)} ${f1(cy)}L${at(a0, i % 2 ? r * 0.9 : r)}L${at(a1, i % 2 ? r : r * 0.9)}Z`;
        all += wedge;
        if (i % 2) dark += wedge;
    }
    return (
        <>
            <path d={all} fill={color} stroke={color} strokeWidth={0.6} strokeLinejoin="round" />
            <path d={dark} fill="#000" opacity={0.17} />
            <path d={all} fill="none" stroke="#fff" strokeOpacity={0.18} strokeWidth={0.6} />
            <circle cx={f1(cx)} cy={f1(cy)} r={f1(r * 0.3)} fill="#fff" opacity={0.9} />
            <Shade fill={button} offset={[f1(-r * 0.05), f1(-r * 0.05)]}><circle cx={f1(cx)} cy={f1(cy)} r={f1(r * 0.22)} /></Shade>
            {shine(f1(cx - r * 0.08), f1(cy - r * 0.08), f1(r * 0.05), f1(r * 0.08), -35, 0.6)}
        </>
    );
}

/** Paper honeycomb ball centered on (0, 0) */
function HoneycombBall({ r, color }: { r: number; color: string }) {
    return (
        <>
            <Shade fill={color} dark={0.16} offset={[f1(-r * 0.13), f1(-r * 0.11)]}><circle cx={0} cy={0} r={r} /></Shade>
            <g fill="none" stroke="#000" strokeOpacity={0.16} strokeWidth={1}>
                {[0.36, 0.7, 0.94].map((share) => <ellipse key={share} cx={0} cy={0} rx={f1(r * share)} ry={r} />)}
                <path d={`M0 ${-r} V${r}`} />
            </g>
            <ellipse cx={0} cy={0} rx={f1(r * 0.53)} ry={r} fill="none" stroke="#fff" strokeOpacity={0.28} />
            {shine(f1(-r * 0.42), f1(-r * 0.36), f1(r * 0.13), f1(r * 0.28), -30, 0.5)}
            <rect x={-2.5} y={-r - 3} width={5} height={4} rx={1} fill={mix(color, -0.3)} />
        </>
    );
}

/** Fans as [dx from the edge, cy, radius, color index, button color index] */
const FANS = [[112, 8, 34, 4, 2], [44, 18, 52, 0, 3]] as const;
/** Honeycomb balls as [dx from the edge, string length as share of the height, radius, color index] */
const HONEYCOMBS = [[30, 0.24, 22, 1], [80, 0.36, 17, 5], [136, 0.2, 14, 2]] as const;
const HONEYCOMBS_SMALL = [[26, 0.2, 17, 1], [70, 0.3, 13, 5]] as const;

/** Paper fans in the corners that spin open on entrance, with honeycomb balls on strings below */
function FansAndHoneycombs({ layout }: { layout: DecoLayout }) {
    const k = makeKit(layout, 12);
    const scale = k.small ? 0.75 : 1;
    return (
        <>
            {corners(k, (fromEdge, side) => (
                <>
                    {(k.small ? HONEYCOMBS_SMALL : HONEYCOMBS).map(([dx, share, r, ci], j) => {
                        const len = k.height * share;
                        return (
                            <Dangle key={j} x={fromEdge(dx * scale)} len={len} delay={k.delay(0.35 + j * 0.1)} fall={k.fall(0.15, 0.4)} phase={k.phase(3.6)}>
                                <g transform={`translate(0 ${f1(len + r)})`}>
                                    <HoneycombBall r={r} color={RAINBOW[(ci + side * 3) % RAINBOW.length]} />
                                </g>
                            </Dangle>
                        );
                    })}
                    {FANS.map(([dx, cy, r, ci, bi], j) => (
                        <g key={`fan-${j}`} className="party-fall" style={k.fall(0.1, 0.3)}>
                            <g className="party-pop-in" style={vars({ '--delay': k.delay(0.15 + j * 0.12) })}>
                                <Fan cx={fromEdge(dx * scale)} cy={cy * scale} r={r * scale} color={RAINBOW[(ci + side * 3) % RAINBOW.length]} button={RAINBOW[(bi + side * 3) % RAINBOW.length]} />
                            </g>
                        </g>
                    ))}
                </>
            ))}
        </>
    );
}

/** Ring of puffs around a filled center */
const POMPOM_PUFFS = 17;

/** Tissue pompom centered on (0, 0); `folds` are the little crinkle arcs */
function Pompom({ r, color, folds }: { r: number; color: string; folds: { lit: string; shaded: string } }) {
    const body = [
        ...Array.from({ length: POMPOM_PUFFS }, (_, n) => {
            const a = (n / POMPOM_PUFFS) * 2 * Math.PI;
            return <circle key={n} cx={f1(r * 0.78 * Math.cos(a))} cy={f1(r * 0.78 * Math.sin(a))} r={f1(r * 0.24)} />;
        }),
        <circle key="center" cx={0} cy={0} r={f1(r * 0.8)} />,
    ];
    return (
        <>
            <Shade fill={color} dark={0.15} offset={[f1(-r * 0.14), f1(-r * 0.12)]}>{body}</Shade>
            <path d={folds.shaded} fill="none" stroke="#000" strokeOpacity={0.2} strokeWidth={1.1} strokeLinecap="round" />
            <path d={folds.lit} fill="none" stroke="#fff" strokeOpacity={0.6} strokeWidth={1.1} strokeLinecap="round" />
        </>
    );
}

/** Crinkles of a pompom: small arcs that bulge outward, alternately lit and shaded */
function pompomFolds(k: Kit, r: number) {
    let lit = '';
    let shaded = '';
    for (let n = 0; n < 26; n++) {
        const a = k.rand(0, 2 * Math.PI);
        const rho = r * Math.sqrt(k.rand(0.02, 0.85));
        const size = r * k.rand(0.1, 0.16);
        const [px, py, cos, sin] = [rho * Math.cos(a), rho * Math.sin(a), Math.cos(a), Math.sin(a)];
        const d = `M${f1(px + sin * size)} ${f1(py - cos * size)} Q${f1(px + cos * size)} ${f1(py + sin * size)} ${f1(px - sin * size)} ${f1(py + cos * size)}`;
        if (n % 2) lit += d;
        else shaded += d;
    }
    return { lit, shaded };
}

/** Pompoms as [dx from the edge, string length as share of the height, radius] */
const POMPOMS = [[26, 0.32, 22], [64, 0.16, 17], [102, 0.4, 20], [142, 0.22, 14]] as const;
const POMPOMS_SMALL = [[20, 0.22, 16], [50, 0.1, 12], [78, 0.3, 13]] as const;

/** Tissue pompoms in rainbow colors at different heights */
function Pompoms({ layout }: { layout: DecoLayout }) {
    const k = makeKit(layout, 13);
    return (
        <>
            {corners(k, (fromEdge, side) => (k.small ? POMPOMS_SMALL : POMPOMS).map(([dx, share, r], j) => {
                const len = k.height * share;
                return (
                    <Dangle key={j} x={fromEdge(dx)} len={len} delay={k.delay(0.25 + j * 0.1)} fall={k.fall(0.15, 0.4)} phase={k.phase(3.6)}>
                        <g transform={`translate(0 ${f1(len + r * 0.95)})`}>
                            <Pompom r={r} color={mix(RAINBOW[(j * 2 + side * 3) % RAINBOW.length], 0.12)} folds={pompomFolds(k, r)} />
                        </g>
                    </Dangle>
                );
            }))}
        </>
    );
}

/* ---------- Dark theme ---------- */

/** Fine strands of lights instead of streamers; a shimmer runs down each strand */
function CurtainLights({ layout }: { layout: DecoLayout }) {
    const id = useSvgId();
    const k = makeKit(layout, 14);
    const perSide = k.small ? 3 : 5;
    return (
        <>
            <defs>
                {GLOW.map((color, i) => <GlowGradient key={i} id={`${id}-${i}`} color={color} strength={1} />)}
            </defs>
            {corners(k, (fromEdge, side) => {
                let dx = 14;
                return Array.from({ length: perSide }, (_, i) => {
                    const len = k.height * k.rand(0.26, 0.56) * (1 - i * 0.06);
                    const ci = (i * 2 + side) % GLOW.length;
                    const x = fromEdge(dx);
                    const start = 0.25 + i * 0.09;
                    dx += k.rand(22, 30);
                    const wireX = (y: number) => x + 2.5 * Math.sin(y / 38 + i);
                    const wire = toPath(Array.from({ length: Math.ceil((len + 6) / 4) + 1 }, (_, n) => [wireX(-6 + n * 4), -6 + n * 4] as const));
                    const leds: number[] = [];
                    for (let y = 10; y <= len; y += 16) leds.push(y);
                    return (
                        <CornerStrand key={i} fall={k.fall(0.45, 0.7)} phase={k.phase(3.4)} gentle>
                            <path className="party-draw party-wire" pathLength={1} style={vars({ '--delay': k.delay(start) })} d={wire} fill="none" strokeWidth={1} />
                            {leds.map((y) => (
                                <g key={y} transform={`translate(${f1(wireX(y))} ${y})`}>
                                    <circle r={2} fill={mix(RAINBOW[ci], -0.45)} />
                                    <Lit on={k.delay(start + (y / len) * 0.9)} off={seconds(k.rand(0, 0.35))}>
                                        <circle className="party-drip" style={vars({ '--tw-delay': seconds((y / len) * 1.3 - 2.6) })} r={10} fill={`url(#${id}-${ci})`} />
                                        <circle r={2.2} fill={mix(GLOW[ci], 0.6)} />
                                    </Lit>
                                </g>
                            ))}
                        </CornerStrand>
                    );
                });
            })}
        </>
    );
}

/** The streamers as glowing neon tubes that flicker on after unrolling */
function NeonCurls({ layout }: { layout: DecoLayout }) {
    const k = makeKit(layout, 15);
    return (
        <>
            {curls(k).map((c, n) => {
                const d = toPath(curlPoints(c, 0.5));
                const glow = GLOW[c.colorIndex];
                const tube = (stroke: string, width: number, opacity: number) => (
                    <path className="party-draw" pathLength={1} style={vars({ '--delay': k.delay(c.start) })} d={d} fill="none" stroke={stroke} strokeWidth={f1(width)} strokeOpacity={opacity} strokeLinecap="round" strokeLinejoin="round" />
                );
                return (
                    <CornerStrand key={n} fall={c.fall} phase={c.phase}>
                        <Lit on={k.delay(c.start + 0.9)} off={seconds(k.rand(0, 0.3))} neon>
                            {tube(glow, c.width + 10, 0.1)}
                            {tube(glow, c.width + 4.5, 0.24)}
                            {tube(glow, c.width * 0.8, 1)}
                            {tube('#fff', c.width * 0.26, 0.8)}
                        </Lit>
                    </CornerStrand>
                );
            })}
        </>
    );
}

/** Folded paper star centered on (0, 0): each point has a lit and a shaded facet */
function FoldedStar({ r, color }: { r: number; color: string }) {
    const at = (k: number, radius: number) => {
        const a = ((-90 + k * 36) * Math.PI) / 180;
        return `${f1(radius * Math.cos(a))} ${f1(radius * Math.sin(a))}`;
    };
    let lit = '';
    let shaded = '';
    for (let k = 0; k < 10; k += 2) {
        lit += `M0 0L${at(k - 1, r * 0.46)}L${at(k, r)}Z`;
        shaded += `M0 0L${at(k, r)}L${at(k + 1, r * 0.46)}Z`;
    }
    return (
        <>
            <path d={starPath(0, 0, r, r * 0.46)} fill={color} stroke={color} strokeWidth={f1(r * 0.18)} strokeLinejoin="round" />
            <path d={lit} fill={mix(color, 0.42)} />
            <path d={shaded} fill={mix(color, -0.18)} />
        </>
    );
}

const MOON = '#ffe08a';

/** Crescent moon centered on (0, 0) with a sleepy face like the balloons */
function SleepyMoon({ r, maskId }: { r: number; maskId: string }) {
    const at = (k: number) => f1(r * k);
    return (
        <>
            <mask id={maskId} maskUnits="userSpaceOnUse" x={-r - 4} y={-r - 4} width={2 * r + 8} height={2 * r + 8}>
                <circle r={r} fill="#fff" />
                <circle cx={at(0.5)} cy={at(-0.25)} r={at(0.78)} fill="#000" />
            </mask>
            <g mask={`url(#${maskId})`}>
                <circle r={r} fill={MOON} />
                <circle r={r} fill="#000" opacity={0.12} />
                <circle cx={at(-0.08)} cy={at(-0.07)} r={r} fill={MOON} />
                <circle cx={at(-0.55)} cy={at(0.5)} r={at(0.1)} fill="#000" opacity={0.07} />
                <circle cx={at(-0.75)} cy={at(0.1)} r={at(0.07)} fill="#000" opacity={0.07} />
            </g>
            {shine(at(-0.66), at(-0.3), at(0.07), at(0.2), 20, 0.55)}
            <path d={`M${at(-0.5)} ${at(-0.06)} Q${at(-0.4)} ${at(0.05)} ${at(-0.3)} ${at(-0.06)} l${at(0.04)} ${at(-0.06)}`} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <ellipse cx={at(-0.52)} cy={at(0.2)} rx={at(0.11)} ry={at(0.065)} fill="#ff6fa5" opacity={0.5} />
            <path d={`M${at(-0.28)} ${at(0.36)} Q${at(-0.18)} ${at(0.44)} ${at(-0.08)} ${at(0.35)}`} fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
        </>
    );
}

const STAR_COLORS = ['#ffd54a', '#ff9ec8', '#8fd0ff', '#ffd54a', '#c3a1ff', '#a8ea5c'];
const SPARKLE = 'M0 -6 Q0.9 -0.9 6 0 Q0.9 0.9 0 6 Q-0.9 0.9 -6 0 Q-0.9 -0.9 0 -6 Z';
/** Per corner: [dx from the edge, string length as share of the height, kind, radius]; all hang below the garland */
const SKY: (readonly [number, number, 'star' | 'moon', number])[][] = [
    [[20, 0.3, 'star', 12], [64, 0.18, 'moon', 28], [114, 0.3, 'star', 16], [158, 0.2, 'star', 11]],
    [[22, 0.24, 'star', 17], [62, 0.4, 'star', 11], [104, 0.17, 'star', 15], [146, 0.32, 'star', 12]],
];

/** A sleeping moon and folded glowing stars on strings, with sparkles blinking in between */
function MoonAndStars({ layout }: { layout: DecoLayout }) {
    const id = useSvgId();
    const k = makeKit(layout, 16);
    // Phones keep two smaller items per corner, close to the edge, so they stay clear of the title
    const scale = k.small ? 0.8 : 1;
    return (
        <>
            <defs>
                <GlowGradient id={`${id}-glow`} color="#fff1a8" strength={0.55} />
            </defs>
            {corners(k, (fromEdge, side) => (
                <>
                    <g className="party-fall" style={k.fall(0, 0.2)}>
                        {Array.from({ length: k.small ? 3 : 5 }, (_, n) => (
                            <g key={n} transform={`translate(${f1(fromEdge(k.rand(10, k.small ? 80 : 170)))} ${f1(k.rand(30, k.height * 0.45))}) scale(${f1(k.rand(0.5, 1.1))})`}>
                                <path className="party-blink" style={vars({ '--tw': seconds(k.rand(2.2, 3.6)), '--tw-delay': seconds(-k.rand(0, 3.6)) })} d={SPARKLE} fill="#fff6c8" />
                            </g>
                        ))}
                    </g>
                    {SKY[side].slice(0, k.small ? 2 : 4).map(([dx, share, kind, size], j) => {
                        const r = size * scale;
                        const len = k.height * share * scale;
                        const moon = kind === 'moon';
                        return (
                            <Dangle key={j} x={fromEdge(dx * scale)} len={len} delay={k.delay(0.25 + j * 0.1)} fall={k.fall(0.15, 0.4)} phase={k.phase(3.6)}>
                                <Lit on={k.delay(0.6 + j * 0.15)} off={seconds(k.rand(0, 0.3))}>
                                    <circle {...k.twinkle(moon ? 'party-twinkle party-twinkle--calm' : undefined)} cx={0} cy={f1(len + r)} r={f1(r * (moon ? 2.4 : 2.8))} fill={`url(#${id}-glow)`} />
                                </Lit>
                                <g transform={`translate(0 ${f1(len + r)})`}>
                                    {moon
                                        ? <SleepyMoon r={r} maskId={`${id}-moon${side}`} />
                                        : <FoldedStar r={r} color={STAR_COLORS[(j + side * 3) % STAR_COLORS.length]} />}
                                </g>
                            </Dangle>
                        );
                    })}
                </>
            ))}
        </>
    );
}

export const LIGHT_CORNERS: DecoVariant[] = [RibbonCurls, FansAndHoneycombs, Pompoms];
export const DARK_CORNERS: DecoVariant[] = [CurtainLights, NeonCurls, MoonAndStars];
