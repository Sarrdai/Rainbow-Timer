import { Fragment } from 'react';
import { Shade, shine } from '../balloon-shapes';
import {
    colorAt, GarlandSection, GLOW, GlowGradient, Hang, lightTiming, Lit, makeKit, mix, RAINBOW, scallops, starPath, useSvgId,
    type DecoLayout, type DecoVariant, type Kit,
} from './kit';

/*
 * Garlands across the top edge. Light theme: fabric and paper with the balloons' flat shading.
 * Dark theme: strings of lights that switch on one after another and glow.
 */

const GOLD = '#ffc94d';
const GOLD_DARK = '#e6a417';

/* ---------- Light theme ---------- */

const PENNANT = 'M-18 0 L18 0 Q7.5 21 0 42 Q-7.5 21 -18 0 Z';
const PENNANT_FOLD = 'M0 0 L18 0 Q7.5 21 0 42 Z';
const PENNANT_SEAM = 'M-13.5 5.5 L13.5 5.5 Q5.6 20 0 34 Q-5.6 20 -13.5 5.5 Z';
const PENNANT_STAR = starPath(0, 17, 7);

/** Fabric pennants with dots, stripes, zigzag or a star patch, sewn around a cotton cord */
function FabricPennants({ layout }: { layout: DecoLayout }) {
    const id = useSvgId();
    const k = makeKit(layout, 1);
    const patterns = [`url(#${id}-dots)`, `url(#${id}-stripes)`, null, `url(#${id}-zigzag)`];
    return (
        <>
            <defs>
                <pattern id={`${id}-dots`} width={8} height={8} patternUnits="userSpaceOnUse">
                    <circle cx={2} cy={2} r={1.5} fill="#fff" opacity={0.75} />
                    <circle cx={6} cy={6} r={1.5} fill="#fff" opacity={0.75} />
                </pattern>
                <pattern id={`${id}-stripes`} width={7} height={7} patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
                    <rect width={2.6} height={7} fill="#fff" opacity={0.42} />
                </pattern>
                <pattern id={`${id}-zigzag`} width={8} height={7} patternUnits="userSpaceOnUse">
                    <path d="M0 4.5 L2 2.5 L4 4.5 L6 2.5 L8 4.5" fill="none" stroke="#fff" strokeWidth={1.3} opacity={0.65} />
                </pattern>
            </defs>
            {scallops(layout).map((s) => {
                const cord = s.path();
                return (
                    <GarlandSection key={s.index} fall={k.fall(0.25, 0.45)} delay={k.delay(s.start)}>
                        {/* Cotton cord: soft edge, cream core, twist marks */}
                        <path d={cord} fill="none" stroke="#6b4a8a" strokeOpacity={0.45} strokeWidth={4.4} strokeLinecap="round" />
                        <path d={cord} fill="none" stroke="#fffaf2" strokeWidth={2.8} strokeLinecap="round" />
                        <path d={cord} fill="none" stroke="#d8c6b2" strokeWidth={2.8} strokeDasharray="1.2 2.8" />
                        {s.points(48, 44).map((p) => {
                            const color = RAINBOW[colorAt(s, p)];
                            const pattern = patterns[(p.i + s.index) % patterns.length];
                            return (
                                <Hang key={p.i} x={p.x} y={p.y} angle={p.angle * 0.85} delay={k.delay(s.start + 0.3 + p.i * 0.05)} phase={k.phase()}>
                                    <path d={PENNANT} fill={color} />
                                    {pattern
                                        ? <path d={PENNANT} fill={pattern} />
                                        : <path d={PENNANT_STAR} fill="#fff" stroke="#fff" strokeWidth={1.4} strokeLinejoin="round" opacity={0.9} />}
                                    <path d={PENNANT_FOLD} fill="#000" opacity={0.13} />
                                    <path d={PENNANT_SEAM} fill="none" stroke="#fff" strokeWidth={1.1} strokeDasharray="2.4 2.2" opacity={0.8} />
                                    <path d="M-14 4 Q-7.6 18.5 -2.4 31" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" opacity={0.35} />
                                    {/* Hem folded over the cord */}
                                    <rect x={-18.5} y={-3.5} width={37} height={7} rx={2.2} fill={color} />
                                    <rect x={-18.5} y={-3.5} width={37} height={7} rx={2.2} fill="#000" opacity={0.22} />
                                    <path d="M-16.5 -2 H16.5" stroke="#fff" strokeWidth={1} opacity={0.35} />
                                </Hang>
                            );
                        })}
                    </GarlandSection>
                );
            })}
        </>
    );
}

const TONGUE = 'M-15 0 L15 0 L15 21 A15 15 0 0 1 -15 21 Z';

/** Rounded pennants shaded like the balloons, with dots and a dotted edge on ric-rac; pompom beads in between */
function RoundPennants({ layout }: { layout: DecoLayout }) {
    const k = makeKit(layout, 2);
    return (
        <>
            {scallops(layout).map((s) => {
                const cord = s.path((x) => 1.6 * Math.sin(x * 1.25), 1.2);
                const points = s.points(46, 38);
                return (
                    <GarlandSection key={s.index} fall={k.fall(0.25, 0.45)} delay={k.delay(s.start)}>
                        <path d={cord} fill="none" stroke="#6b4a8a" strokeOpacity={0.35} strokeWidth={3.8} strokeLinejoin="round" />
                        <path d={cord} fill="none" stroke="#fff" strokeWidth={2.4} strokeLinejoin="round" />
                        {points.map((p) => {
                            const color = RAINBOW[colorAt(s, p)];
                            return (
                                <Hang key={p.i} x={p.x} y={p.y} angle={p.angle * 0.85} delay={k.delay(s.start + 0.3 + p.i * 0.05)} phase={k.phase()}>
                                    <Shade fill={color} offset={[-3, -2.5]}><path d={TONGUE} /></Shade>
                                    <g fill="#fff" opacity={0.6}>
                                        <circle cx={5} cy={8} r={2.3} />
                                        <circle cx={-4} cy={16} r={2.3} />
                                        <circle cx={7} cy={21} r={2.3} />
                                        <circle cx={0} cy={29} r={2} />
                                    </g>
                                    <path d="M-11 21 A11 11 0 0 0 11 21" fill="none" stroke="#fff" strokeWidth={1.7} strokeLinecap="round" strokeDasharray="0.1 3.4" opacity={0.9} />
                                    {shine(-9, 10, 2.2, 5.5, -6, 0.42)}
                                    <rect x={-16} y={-3} width={32} height={6} rx={2} fill={color} />
                                    <rect x={-16} y={-3} width={32} height={6} rx={2} fill="#000" opacity={0.2} />
                                </Hang>
                            );
                        })}
                        {points.slice(1).map((p, j) => {
                            const q = points[j];
                            if (p.i !== q.i + 1) return null;
                            const x = (p.x + q.x) / 2;
                            return (
                                <Hang key={`bead-${p.i}`} x={x} y={s.y(x)} delay={k.delay(s.start + 0.5 + p.i * 0.05)} sway="">
                                    <Shade fill={RAINBOW[colorAt(s, p, 3)]} offset={[-1.5, -1.5]}><circle cx={0} cy={3} r={5} /></Shade>
                                    {shine(-1.6, 1.4, 1.1, 1.8, -30, 0.6)}
                                </Hang>
                            );
                        })}
                    </GarlandSection>
                );
            })}
        </>
    );
}

const TASSEL_SKIRT = 'M-4.5 13 C-6 24 -8.5 36 -10 45 L-7.5 47.5 L-5 45.5 L-2.5 48 L0 46 L2.5 48 L5 45.5 L7.5 47.5 L10 45 C8.5 36 6 24 4.5 13 Z';
const TASSEL_SKIRT_SHADE = 'M1.5 13 L4.5 13 C6 24 8.5 36 10 45 L7.5 47.5 L5 45.5 L2.5 48 L1.5 47 Z';
const TASSEL_STRANDS = [-8, -5.5, -3, -0.5, 2, 4.5, 7].map((x) => `M${Math.round(x * 4.2) / 10} 14 L${x} 45`).join(' ');

function Tassel({ color }: { color: string }) {
    return (
        <>
            <ellipse cx={0} cy={0} rx={2.4} ry={3.4} fill="none" stroke={color} strokeWidth={1.5} />
            <path d="M-3 3 Q0 1.2 3 3 L4.4 11 L-4.4 11 Z" fill={color} />
            <path d="M0.8 2.2 Q2.2 2.3 3 3 L4.4 11 L1.2 11 Z" fill="#000" opacity={0.12} />
            <path d={TASSEL_SKIRT} fill={color} />
            <path d={TASSEL_STRANDS} fill="none" stroke="#000" strokeOpacity={0.16} strokeWidth={0.8} />
            <path d="M-2.9 15 L-6.5 44 M-1.6 15 L-3.6 44" fill="none" stroke="#fff" strokeOpacity={0.4} strokeWidth={1} />
            <path d={TASSEL_SKIRT_SHADE} fill="#000" opacity={0.12} />
            <rect x={-5} y={10} width={10} height={3.6} rx={1.2} fill={GOLD} />
            <rect x={0.6} y={10} width={4.4} height={3.6} rx={1} fill={GOLD_DARK} />
            <path d="M-4 11.2 H-0.6" stroke="#fff" strokeWidth={0.9} opacity={0.75} />
        </>
    );
}

/** Tissue paper tassels with a gold band on a gold cord; they swing a little wider than pennants */
function TasselGarland({ layout }: { layout: DecoLayout }) {
    const k = makeKit(layout, 3);
    return (
        <>
            {scallops(layout).map((s) => {
                const cord = s.path();
                return (
                    <GarlandSection key={s.index} fall={k.fall(0.25, 0.45)} delay={k.delay(s.start)}>
                        <path d={cord} fill="none" stroke={GOLD_DARK} strokeWidth={2.6} strokeLinecap="round" />
                        <path d={cord} fill="none" stroke="#ffe39a" strokeWidth={1} transform="translate(0 -0.6)" />
                        {s.points(30, 48).map((p) => (
                            <Hang key={p.i} x={p.x} y={p.y} delay={k.delay(s.start + 0.3 + p.i * 0.04)} sway="party-sway party-sway--wide" phase={k.phase()}>
                                <Tassel color={RAINBOW[colorAt(s, p)]} />
                            </Hang>
                        ))}
                    </GarlandSection>
                );
            })}
        </>
    );
}

/* ---------- Dark theme ---------- */

const BULB = 'M0 7.5 C4.6 7.5 6.6 12.5 6.2 17.5 C5.8 22.5 2.6 27 0 29.5 C-2.6 27 -5.8 22.5 -6.2 17.5 C-6.6 12.5 -4.6 7.5 0 7.5 Z';

/** Pointed bulbs in rainbow colors on a twisted green cable; they switch on one after another and twinkle */
function FairyLights({ layout }: { layout: DecoLayout }) {
    const id = useSvgId();
    const k = makeKit(layout, 4);
    return (
        <>
            <defs>
                {RAINBOW.map((color, i) => (
                    <Fragment key={i}>
                        <GlowGradient id={`${id}-glow${i}`} color={GLOW[i]} strength={0.8} />
                        <radialGradient id={`${id}-bulb${i}`} cx={0.42} cy={0.62} r={0.7}>
                            <stop offset="0" stopColor="#fffbe8" />
                            <stop offset="0.4" stopColor={GLOW[i]} />
                            <stop offset="1" stopColor={color} />
                        </radialGradient>
                    </Fragment>
                ))}
            </defs>
            {scallops(layout).map((s) => (
                <GarlandSection key={s.index} fall={k.fall(0.75, 0.95)} delay={k.delay(s.start)}>
                    <path d={s.path((x) => 1.1 * Math.sin(x / 2.6), 1.5)} fill="none" stroke="#1d3a29" strokeWidth={1.7} strokeLinecap="round" />
                    <path d={s.path((x) => 1.1 * Math.sin(x / 2.6 + Math.PI), 1.5)} fill="none" stroke="#2f5a40" strokeWidth={1.7} strokeLinecap="round" />
                    {s.points(36, 32).map((p) => {
                        const i = colorAt(s, p);
                        const { on, off } = lightTiming(k, s, p);
                        return (
                            <Hang key={p.i} x={p.x} y={p.y} angle={(p.i % 2 ? 1 : -1) * k.rand(8, 22)} delay={k.delay(s.start + 0.3 + p.i * 0.04)} phase={k.phase()}>
                                <path d={BULB} fill={mix(RAINBOW[i], -0.55)} />
                                <Lit on={on} off={off}>
                                    <circle {...k.twinkle()} cx={0} cy={19} r={22} fill={`url(#${id}-glow${i})`} />
                                    <path d={BULB} fill={`url(#${id}-bulb${i})`} />
                                    {shine(-2.4, 15, 1.4, 3.8, 12, 0.75)}
                                </Lit>
                                {/* Socket */}
                                <rect x={-3.6} y={-1.5} width={7.2} height={10} rx={1.8} fill="#24452f" />
                                <rect x={0.6} y={-1.5} width={3} height={10} rx={1.2} fill="#000" opacity={0.3} />
                                <path d="M-3.6 2.5 H3.6 M-3.6 5 H3.6" stroke="#000" strokeOpacity={0.35} strokeWidth={0.7} />
                            </Hang>
                        );
                    })}
                </GarlandSection>
            ))}
        </>
    );
}

const FILAMENT = 'M-3.4 27.5 l1.7 -2.6 l1.7 2.6 l1.7 -2.6 l1.7 2.6';

/** Large globe bulbs with a visible filament and lightly tinted glass on a black cable; calm, warm light */
function FestoonBulbs({ layout }: { layout: DecoLayout }) {
    const id = useSvgId();
    const k = makeKit(layout, 5);
    return (
        <>
            <defs>
                {GLOW.map((tint, i) => (
                    <Fragment key={i}>
                        <GlowGradient id={`${id}-glow${i}`} color={tint} strength={0.6} />
                        <radialGradient id={`${id}-glass${i}`} cx={0.45} cy={0.55} r={0.62}>
                            <stop offset="0" stopColor="#fffef5" />
                            <stop offset="0.38" stopColor="#ffefc2" />
                            <stop offset="1" stopColor={tint} />
                        </radialGradient>
                    </Fragment>
                ))}
            </defs>
            {scallops(layout).map((s) => {
                const cord = s.path();
                return (
                    <GarlandSection key={s.index} fall={k.fall(0.75, 0.95)} delay={k.delay(s.start)}>
                        <path d={cord} fill="none" stroke="#0b0918" strokeWidth={3} strokeLinecap="round" />
                        <path d={cord} fill="none" stroke="#5a5290" strokeOpacity={0.7} strokeWidth={0.9} transform="translate(0 -0.8)" />
                        {s.points(62, 42).map((p) => {
                            const i = colorAt(s, p);
                            const { on, off } = lightTiming(k, s, p);
                            return (
                                <Hang key={p.i} x={p.x} y={p.y} delay={k.delay(s.start + 0.3 + p.i * 0.05)} sway="party-sway party-sway--slow" phase={k.phase()}>
                                    <path d="M0 0 V9" stroke="#0b0918" strokeWidth={1.6} />
                                    <circle cx={0} cy={27} r={11.5} fill="#fff" fillOpacity={0.07} stroke="#fff" strokeOpacity={0.22} />
                                    <path d={FILAMENT} fill="none" stroke="#c8a46a" strokeOpacity={0.5} strokeWidth={0.9} />
                                    <Lit on={on} off={off}>
                                        <circle {...k.twinkle('party-twinkle party-twinkle--calm')} cx={0} cy={27} r={40} fill={`url(#${id}-glow${i})`} />
                                        <circle cx={0} cy={27} r={11.5} fill={`url(#${id}-glass${i})`} />
                                        <path d={FILAMENT} fill="none" stroke="#fff6cf" strokeWidth={1.2} strokeLinejoin="round" />
                                    </Lit>
                                    <path d="M-7.5 23.5 A8.5 8.5 0 0 1 -2.5 18.8" fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" opacity={0.6} />
                                    <rect x={-4.2} y={7.5} width={8.4} height={9.5} rx={1.6} fill="#1b1830" />
                                    <path d="M-4.2 10.5 H4.2 M-4.2 13.5 H4.2" stroke="#4a4370" strokeWidth={0.8} />
                                </Hang>
                            );
                        })}
                    </GarlandSection>
                );
            })}
        </>
    );
}

const LANTERN_RX = 15;
const LANTERN_RY = 13;

/** Round paper lantern with ribs and a tassel, lit from the inside, on a string of length `drop` */
function Lantern({ id, i, drop, on, off, twinkle }: { id: string; i: number; drop: number; on: string; off: string; twinkle: ReturnType<Kit['twinkle']> }) {
    const cy = drop + 17;
    const bottom = cy + LANTERN_RY;
    const ribs = [-8.5, -4.2, 0, 4.2, 8.5].map((dy) => {
        const w = Math.round(LANTERN_RX * Math.sqrt(1 - (dy / LANTERN_RY) ** 2) * 10) / 10;
        return `M${-w} ${cy + dy} Q0 ${cy + dy + 2.4} ${w} ${cy + dy}`;
    }).join(' ');
    return (
        <>
            <path d={`M0 0 V${drop + 1}`} stroke="#4a4370" strokeWidth={1} />
            <ellipse cx={0} cy={cy} rx={LANTERN_RX} ry={LANTERN_RY} fill={mix(RAINBOW[i], -0.6)} />
            <Lit on={on} off={off}>
                <circle {...twinkle} cx={0} cy={cy} r={40} fill={`url(#${id}-glow${i})`} />
                <ellipse cx={0} cy={cy} rx={LANTERN_RX} ry={LANTERN_RY} fill={`url(#${id}-paper${i})`} />
            </Lit>
            <path d={ribs} fill="none" stroke="#000" strokeOpacity={0.2} strokeWidth={0.9} />
            <rect x={-6.5} y={drop + 1} width={13} height={3.4} rx={1.2} fill="#2a2340" />
            <rect x={-5.5} y={bottom - 1.6} width={11} height={3} rx={1.2} fill="#2a2340" />
            <path d={`M-2 ${bottom + 1.4} V${bottom + 9} M0 ${bottom + 1.4} V${bottom + 10} M2 ${bottom + 1.4} V${bottom + 9}`} stroke={GLOW[i]} strokeWidth={1} opacity={0.75} />
        </>
    );
}

function Lanterns({ layout }: { layout: DecoLayout }) {
    const id = useSvgId();
    const k = makeKit(layout, 6);
    return (
        <>
            <defs>
                {RAINBOW.map((color, i) => (
                    <Fragment key={i}>
                        <GlowGradient id={`${id}-glow${i}`} color={GLOW[i]} strength={0.6} />
                        <radialGradient id={`${id}-paper${i}`} cx={0.45} cy={0.45} r={0.62}>
                            <stop offset="0" stopColor="#fff4cc" />
                            <stop offset="0.5" stopColor={GLOW[i]} />
                            <stop offset="1" stopColor={color} />
                        </radialGradient>
                    </Fragment>
                ))}
            </defs>
            {scallops(layout).map((s) => (
                <GarlandSection key={s.index} fall={k.fall(0.75, 0.95)} delay={k.delay(s.start)}>
                    <path d={s.path()} fill="none" stroke="#3a3260" strokeWidth={1.5} strokeLinecap="round" />
                    {s.points(58, 58).map((p) => {
                        const { on, off } = lightTiming(k, s, p);
                        return (
                            <Hang key={p.i} x={p.x} y={p.y} delay={k.delay(s.start + 0.3 + p.i * 0.05)} sway="party-sway party-sway--slow" phase={k.phase()}>
                                <Lantern id={id} i={colorAt(s, p)} drop={4 + (p.i % 3) * 7} on={on} off={off} twinkle={k.twinkle('party-twinkle party-twinkle--calm')} />
                            </Hang>
                        );
                    })}
                </GarlandSection>
            ))}
        </>
    );
}

export const LIGHT_GARLANDS: DecoVariant[] = [FabricPennants, RoundPennants, TasselGarland];
export const DARK_GARLANDS: DecoVariant[] = [FairyLights, FestoonBulbs, Lanterns];
