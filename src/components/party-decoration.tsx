"use client";

import React, { useEffect, useRef, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { RAINBOW_COLORS } from './confetti';

const BALLOON_COLORS = ['#e81416', '#ffa500', '#79c314', '#487de7', '#70369d', '#faeb36'];
/** Longest exit animation (last balloon pop + falling string) */
const EXIT_MS = 1800;
/** Entrance delays are shifted by this when a scene is rebuilt after a resize, so it appears settled */
const SETTLED_OFFSET_S = -5;
/** Time from a click-pop until the replacement balloon starts floating in */
const RESPAWN_MS = 600;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface Fall { fallDelay: number; fallDur: number; fallRot: number }
interface Curl extends Fall { d: string; color: string; width: number; delay: number; sway: number }
interface Flag { d: string; shade: string; color: string; delay: number; sway: number }
interface Garland extends Fall { twists: { d: string; color: string }[]; flags: Flag[]; delay: number }
interface Balloon { x: number; y: number; w: number; color: string; delay: number; tilt: number; sway: number; bob: number; pop: number; shards: number[]; gen: number; popping?: boolean; fresh?: boolean }

interface Scene {
    id: number;
    width: number;
    height: number;
    curls: Curl[];
    garlands: Garland[];
    balloons: Balloon[];
    exitedAt: number | null;
}

const fall = (min: number, max: number): Fall => ({ fallDelay: rand(min, max), fallDur: rand(0.8, 1.1), fallRot: rand(-25, 25) });

/** A helix seen from the side, hanging down from an anchor at the top edge; it widens as it hangs lower. */
function curlPath(x0: number, len: number, amp: number, turns: number, dir: number) {
    const steps = 160;
    let d = '';
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = x0 + dir * amp * (0.35 + 0.65 * t) * Math.sin(t * turns * Math.PI * 2);
        d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${(-6 + t * len).toFixed(1)}`;
    }
    return d;
}

function buildCurls(W: number, H: number, base: number): Curl[] {
    const perSide = W < 600 ? 3 : 5;
    const curls: Curl[] = [];
    for (const side of [1, -1]) {
        let x = side === 1 ? 14 : W - 14;
        for (let i = 0; i < perSide; i++) {
            const len = H * rand(0.22, 0.5) * (1 - i * 0.08);
            curls.push({
                d: curlPath(x, len, rand(7, 12), len / rand(34, 46), side),
                color: RAINBOW_COLORS[(i * 2 + (side === 1 ? 0 : 1)) % RAINBOW_COLORS.length],
                width: rand(4, 6),
                delay: base + 0.25 + i * 0.09,
                sway: -rand(0, 3.4),
                ...fall(0.05, 0.35),
            });
            x += side * rand(26, 38);
        }
    }
    return curls;
}

/** Twisted two-tone crepe streamer hanging in scallops across the top edge, with pennants. */
function buildGarlands(W: number, base: number, avoid: DOMRect | null): Garland[] {
    const scallops = Math.max(2, Math.round(W / 420));
    const span = (W + 40) / scallops;
    const top = 6;
    const sag = Math.min(70, span * 0.16);
    const garlands: Garland[] = [];
    for (let k = 0; k < scallops; k++) {
        const x0 = -20 + k * span;
        const delay = base + 0.05 + Math.abs(k - (scallops - 1) / 2) * 0.08;
        const y = (x: number) => top + sag * (1 - ((x - x0 - span / 2) / (span / 2)) ** 2);
        const pair = [RAINBOW_COLORS[(k * 2) % 7], RAINBOW_COLORS[(k * 2 + 3) % 7]];
        const twists = [0, Math.PI].map((phase, j) => {
            let d = '';
            for (let x = x0; x <= x0 + span + 0.5; x += 3) {
                d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${(y(x) + 4 * Math.sin(x / 9 + phase)).toFixed(1)}`;
            }
            return { d, color: pair[j] };
        });
        const count = Math.max(3, Math.floor(span / 62));
        const flags: Flag[] = [];
        for (let f = 1; f < count; f++) {
            const fx = x0 + (f * span) / count;
            const fy = y(fx) + 2;
            // Leave out pennants that would hang behind the title
            if (avoid && fx > avoid.left - 20 && fx < avoid.right + 20 && fy + 32 > avoid.top) continue;
            flags.push({
                d: `M${fx - 15} ${fy} L${fx + 15} ${fy} L${fx} ${fy + 32} Z`,
                shade: `M${fx - 15} ${fy} L${fx + 15} ${fy} L${fx + 11} ${fy + 4} L${fx - 11} ${fy + 4} Z`,
                color: RAINBOW_COLORS[(f + k * 3) % 7],
                delay: delay + 0.35 + f * 0.06,
                sway: -rand(0, 2.8),
            });
        }
        garlands.push({ twists, flags, delay, ...fall(0.25, 0.45) });
    }
    return garlands;
}

const makeShards = () => Array.from({ length: 8 }, (_, s) => s * 45 + rand(-10, 10));

/** Replacement for a balloon popped by a click: same spot, new color, floats in from below. */
function respawnBalloon(b: Balloon): Balloon {
    const colors = BALLOON_COLORS.filter((c) => c !== b.color);
    return {
        ...b,
        w: b.w * rand(0.92, 1.08),
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: 0,
        tilt: rand(-20, 20),
        sway: -rand(0, 3),
        shards: makeShards(),
        gen: b.gen + 1,
        popping: false,
        fresh: true,
    };
}

function buildBalloons(W: number, H: number, base: number): Balloon[] {
    const small = W < 600;
    const w = small ? 54 : 78;
    // Fractions of the viewport; kept to the sides (desktop) or below the dial (phone)
    const spots = small
        ? [[-0.04, 0.74], [0.08, 0.8], [0.74, 0.8], [0.86, 0.73]]
        : [[0.02, 0.5], [0.09, 0.6], [0.03, 0.7], [0.82, 0.55], [0.9, 0.47], [0.86, 0.66]];
    const popOrder = spots.map((_, i) => i).sort(() => Math.random() - 0.5);
    return spots.map(([fx, fy], i) => ({
        x: fx * W,
        y: fy * H,
        w: w * rand(0.85, 1.15),
        color: BALLOON_COLORS[i % BALLOON_COLORS.length],
        delay: base + 0.2 + i * 0.09,
        tilt: rand(-20, 20),
        sway: -rand(0, 3),
        bob: rand(2.8, 3.8),
        pop: 0.06 + popOrder[i] * rand(0.07, 0.11),
        shards: makeShards(),
        gen: 0,
    }));
}

function buildScene(id: number, settled: boolean, avoid: DOMRect | null): Scene {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const base = settled ? SETTLED_OFFSET_S : 0;
    return { id, width: W, height: H, curls: buildCurls(W, H, base), garlands: buildGarlands(W, base, avoid), balloons: buildBalloons(W, H, base), exitedAt: null };
}

const vars = (v: Record<string, string | number>) => v as CSSProperties;
const fallVars = (f: Fall, H: number) => vars({ '--fall-delay': `${f.fallDelay}s`, '--fall-dur': `${f.fallDur}s`, '--fall-rot': `${f.fallRot}deg`, '--fall-dy': `${H + 60}px` });

function SceneView({ scene, onPop }: { scene: Scene; onPop: (index: number, x: number, y: number) => void }) {
    const { width: W, height: H } = scene;
    const exiting = scene.exitedAt !== null;
    return (
        <>
            {/* Streamers and garland hang behind the title */}
            <svg className={cn('party-deco fixed inset-0 z-[40]', exiting && 'is-exiting')} width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
                {scene.curls.map((c, i) => (
                    <g key={i} className="party-curl" style={{ ...fallVars(c, H), ...vars({ '--sway-delay': `${c.sway}s` }) }}>
                        <path d={c.d} pathLength={1} fill="none" stroke={c.color} strokeWidth={c.width} strokeLinecap="round" strokeLinejoin="round" style={vars({ '--delay': `${c.delay}s` })} />
                    </g>
                ))}
                {scene.garlands.map((g, i) => (
                    <g key={i} className="party-garland" style={{ ...fallVars(g, H), ...vars({ '--delay': `${g.delay}s` }) }}>
                        {g.twists.map((t, j) => (
                            <path key={j} className="party-twist" d={t.d} pathLength={1} fill="none" stroke={t.color} strokeWidth={4.5} strokeLinecap="round" />
                        ))}
                        {g.flags.map((f, j) => (
                            <g key={j} className="party-flag" style={vars({ '--delay': `${f.delay}s` })}>
                                <g className="party-flag-sway" style={vars({ '--sway-delay': `${f.sway}s` })}>
                                    <path d={f.d} fill={f.color} />
                                    <path d={f.shade} fill="#000" opacity={0.12} />
                                </g>
                            </g>
                        ))}
                    </g>
                ))}
            </svg>
            {/* Balloons float in front of the dial, below the confetti */}
            <div className={cn('party-deco fixed inset-0 z-[50]', exiting && 'is-exiting')}>
                {scene.balloons.map((b, i) => (
                    <div
                        key={`${i}-${b.gen}`}
                        className={cn('party-balloon', b.popping && 'is-popping', b.fresh && 'is-fresh')}
                        style={vars({ '--x': `${b.x}px`, '--y': `${b.y}px`, '--w': `${b.w}px`, '--delay': `${b.delay}s`, '--tilt': `${b.tilt}deg`, '--pop': b.popping ? '0s' : `${b.pop}s` })}
                    >
                        <div className="party-balloon-bob" style={vars({ '--sway-delay': `${b.sway}s`, '--bob': `${b.bob}s` })}>
                            <svg viewBox="0 0 100 300">
                                <path className="party-balloon-string" d="M50 118 C 40 150, 62 180, 48 215 S 56 270, 50 300" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={1.6} opacity={0.7} />
                                <g className="party-balloon-body" onPointerDown={(e) => {
                                    if (exiting || b.popping) return;
                                    const r = e.currentTarget.getBoundingClientRect();
                                    onPop(i, r.left + r.width / 2, r.top + r.height / 2);
                                }}>
                                    <path d="M50 4 C82 4 96 30 96 58 C96 90 70 110 53 113 L47 113 C30 110 4 90 4 58 C4 30 18 4 50 4 Z" fill={b.color} />
                                    <path d="M50 4 C82 4 96 30 96 58 C96 90 70 110 53 113 C78 96 88 70 84 44 C80 22 68 8 50 4 Z" fill="#000" opacity={0.14} />
                                    <ellipse cx="31" cy="34" rx="8" ry="16" transform="rotate(-24 31 34)" fill="#fff" opacity={0.45} />
                                    <path d="M44 120 L50 111 L56 120 Z" fill={b.color} />
                                </g>
                            </svg>
                            {(exiting || b.popping) && b.shards.map((a, s) => (
                                <span key={s} className="party-shard" style={vars({ '--a': `${a}deg`, '--c': b.color })} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

/**
 * Party decoration around the whole window: garland, curly streamers and balloons.
 * Entering party mode builds a new scene that unfolds into place; leaving it pops the balloons
 * and drops everything else to the floor. Scenes are independent, so fast toggling overlaps cleanly.
 */
interface PartyDecorationProps {
    active: boolean;
    visible: boolean;
    /** Element the garland's pennants keep clear of (the title) */
    avoidRef?: React.RefObject<HTMLElement | null>;
    /** Called with the center of a balloon popped by a click (for sound and confetti) */
    onBalloonPop?: (x: number, y: number) => void;
}

export function PartyDecoration({ active, visible, avoidRef, onBalloonPop }: PartyDecorationProps) {
    const [scenes, setScenes] = useState<Scene[]>([]);
    const nextId = useRef(1);
    const respawnTimers = useRef(new Set<ReturnType<typeof setTimeout>>());

    useEffect(() => {
        const timers = respawnTimers.current;
        return () => timers.forEach(clearTimeout);
    }, []);

    const updateBalloon = (sceneId: number, index: number, update: (b: Balloon) => Balloon) =>
        setScenes((s) => s.map((sc) => (sc.id === sceneId && sc.exitedAt === null
            ? { ...sc, balloons: sc.balloons.map((b, i) => (i === index ? update(b) : b)) }
            : sc)));

    // A clicked balloon bursts, then a new one floats into its place
    const popBalloon = (sceneId: number, index: number, x: number, y: number) => {
        onBalloonPop?.(x, y);
        updateBalloon(sceneId, index, (b) => ({ ...b, popping: true }));
        const t = setTimeout(() => {
            respawnTimers.current.delete(t);
            updateBalloon(sceneId, index, (b) => (b.popping ? respawnBalloon(b) : b));
        }, RESPAWN_MS);
        respawnTimers.current.add(t);
    };

    useEffect(() => {
        if (active) {
            const scene = buildScene(nextId.current++, false, avoidRef?.current?.getBoundingClientRect() ?? null);
            setScenes((s) => [...s, scene]);
        } else {
            const now = performance.now();
            setScenes((s) => s.map((sc) => (sc.exitedAt === null ? { ...sc, exitedAt: now } : sc)));
        }
    }, [active, avoidRef]);

    // Drop scenes once their exit animation has finished
    useEffect(() => {
        if (!scenes.some((s) => s.exitedAt !== null)) return;
        const t = setTimeout(() => {
            const now = performance.now();
            setScenes((s) => s.filter((sc) => sc.exitedAt === null || now - sc.exitedAt < EXIT_MS));
        }, EXIT_MS);
        return () => clearTimeout(t);
    }, [scenes]);

    // Geometry is in pixels; rebuild the active scene in its settled state after a resize
    useEffect(() => {
        if (!active) return;
        let timer: ReturnType<typeof setTimeout>;
        const onResize = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                const avoid = avoidRef?.current?.getBoundingClientRect() ?? null;
                setScenes((s) => s.map((sc) => (sc.exitedAt === null ? buildScene(nextId.current++, true, avoid) : sc)));
            }, 200);
        };
        window.addEventListener('resize', onResize);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', onResize);
        };
    }, [active, avoidRef]);

    if (!scenes.length) return null;
    return (
        <div aria-hidden="true" className={cn('transition-opacity duration-200', !visible && 'opacity-0 is-hidden')}>
            {scenes.map((scene) => <SceneView key={scene.id} scene={scene} onPop={(i, x, y) => popBalloon(scene.id, i, x, y)} />)}
        </div>
    );
}
