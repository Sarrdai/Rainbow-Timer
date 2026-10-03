"use client";

import React, { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { BALLOON_COLORS, CLASSIC_BALLOON, SHAPED_BALLOONS, type BalloonShape } from './balloon-shapes';
import { DECO_SETS, type DecoLayout, type DecoTheme, type DecoVariant } from './decoration';

const ALL_SHAPES = [CLASSIC_BALLOON, ...SHAPED_BALLOONS];
/** Longest exit animation: lights going out one after another, then the garland falling */
const EXIT_MS = 2200;
/** Entrance delays are shifted by this when a scene is rebuilt after a resize, so it appears settled */
const SETTLED_OFFSET_S = -5;
/** Time from a click-pop until the replacement balloon starts floating in */
const RESPAWN_MS = 600;
/** Fade-out of the old decoration after a theme switch (party-fade-out) */
const FADE_MS = 500;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];
const shuffle = <T,>(list: readonly T[]) => [...list].sort(() => Math.random() - 0.5);

interface Balloon { x: number; y: number; w: number; color: string; shape: BalloonShape; delay: number; tilt: number; sway: number; bob: number; pop: number; shards: number[]; gen: number; popping?: boolean; fresh?: boolean }

/** Garland and corner decoration in the variants of one theme */
interface Deco {
    id: number;
    theme: DecoTheme;
    Garland: DecoVariant;
    Corner: DecoVariant;
    layout: DecoLayout;
    /** Set when a theme switch replaced this decoration; it fades out */
    fadedAt: number | null;
}

interface Scene {
    id: number;
    /** The current decoration last; earlier ones are fading out */
    decos: Deco[];
    balloons: Balloon[];
    exitedAt: number | null;
}

const readTheme = (): DecoTheme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

/** Picks a random garland and corner decoration for the theme, or keeps those of `keep` (rebuild after a resize) */
function buildDeco(id: number, theme: DecoTheme, settled: boolean, avoid: DOMRect | null, keep?: Deco): Deco {
    const W = window.innerWidth;
    const set = DECO_SETS[theme];
    return {
        id,
        theme,
        Garland: keep?.Garland ?? pick(set.garlands),
        Corner: keep?.Corner ?? pick(set.corners),
        layout: {
            width: W,
            height: window.innerHeight,
            small: W < 600,
            base: settled ? SETTLED_OFFSET_S : 0,
            avoid,
            seed: keep?.layout.seed ?? Math.floor(Math.random() * 2 ** 31),
        },
        fadedAt: null,
    };
}

const makeShards = () => Array.from({ length: 8 }, (_, s) => s * 45 + rand(-10, 10));

/** Replacement for a balloon popped by a click: same spot, a shape not on screen yet, new color; floats in from below. */
function respawnBalloon(b: Balloon, shown: Balloon[]): Balloon {
    return {
        ...b,
        w: b.w * rand(0.92, 1.08),
        color: pick(BALLOON_COLORS.filter((c) => c !== b.color)),
        shape: pick(ALL_SHAPES.filter((s) => !shown.some((o) => o.shape === s))),
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
    const popOrder = shuffle(spots.map((_, i) => i));
    // One classic round balloon per party, the other spots get distinct shapes
    const shapes = shuffle([CLASSIC_BALLOON, ...shuffle(SHAPED_BALLOONS).slice(0, spots.length - 1)]);
    return spots.map(([fx, fy], i) => ({
        x: fx * W,
        y: fy * H,
        w: w * rand(0.85, 1.15),
        color: BALLOON_COLORS[i % BALLOON_COLORS.length],
        shape: shapes[i],
        delay: base + 0.2 + i * 0.09,
        tilt: rand(-20, 20),
        sway: -rand(0, 3),
        bob: rand(2.8, 3.8),
        pop: 0.06 + popOrder[i] * rand(0.07, 0.11),
        shards: makeShards(),
        gen: 0,
    }));
}

function buildScene(sceneId: number, deco: Deco, settled: boolean): Scene {
    const base = settled ? SETTLED_OFFSET_S : 0;
    return { id: sceneId, decos: [deco], balloons: buildBalloons(window.innerWidth, window.innerHeight, base), exitedAt: null };
}

const vars = (v: Record<string, string | number>) => v as CSSProperties;

/** Memoized, so popping a balloon does not redraw the decoration */
const DecoView = memo(function DecoView({ deco, exiting }: { deco: Deco; exiting: boolean }) {
    const { width: W, height: H } = deco.layout;
    return (
        <svg className={cn('party-deco fixed inset-0 z-[40]', exiting && 'is-exiting', deco.fadedAt !== null && 'is-faded')} width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
            <deco.Corner layout={deco.layout} />
            <deco.Garland layout={deco.layout} />
        </svg>
    );
});

function SceneView({ scene, onPop }: { scene: Scene; onPop: (index: number, x: number, y: number) => void }) {
    const exiting = scene.exitedAt !== null;
    return (
        <>
            {/* Garland and corner decoration hang behind the title */}
            {scene.decos.map((deco) => <DecoView key={deco.id} deco={deco} exiting={exiting} />)}
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
                                <path className="party-balloon-string" d={b.shape.string} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={1.6} opacity={0.7} />
                                <g className="party-balloon-body" onPointerDown={(e) => {
                                    if (exiting || b.popping) return;
                                    const r = e.currentTarget.getBoundingClientRect();
                                    onPop(i, r.left + r.width / 2, r.top + r.height / 2);
                                }}>
                                    <b.shape.Body color={b.color} />
                                </g>
                            </svg>
                            {(exiting || b.popping) && b.shards.map((a, s) => (
                                <span key={s} className="party-shard" style={vars({ '--a': `${a}deg`, '--c': b.shape.fixedColor ?? b.color })} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

/**
 * Party decoration around the whole window: a garland, decoration in the top corners and balloons.
 * Every party picks a random garland and corner variant that fits the theme: fabric and paper in light mode,
 * lights in dark mode. Entering party mode builds a new scene that unfolds into place; leaving it switches the
 * lights off, pops the balloons and drops everything else to the floor. Scenes are independent, so fast
 * toggling overlaps cleanly.
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

    const updateBalloon = (sceneId: number, index: number, update: (b: Balloon, all: Balloon[]) => Balloon) =>
        setScenes((s) => s.map((sc) => (sc.id === sceneId && sc.exitedAt === null
            ? { ...sc, balloons: sc.balloons.map((b, i) => (i === index ? update(b, sc.balloons) : b)) }
            : sc)));

    // A clicked balloon bursts, then a new one floats into its place
    const popBalloon = (sceneId: number, index: number, x: number, y: number) => {
        onBalloonPop?.(x, y);
        updateBalloon(sceneId, index, (b) => ({ ...b, popping: true }));
        const t = setTimeout(() => {
            respawnTimers.current.delete(t);
            updateBalloon(sceneId, index, (b, all) => (b.popping ? respawnBalloon(b, all) : b));
        }, RESPAWN_MS);
        respawnTimers.current.add(t);
    };

    useEffect(() => {
        if (active) {
            const deco = buildDeco(nextId.current++, readTheme(), false, avoidRef?.current?.getBoundingClientRect() ?? null);
            const scene = buildScene(nextId.current++, deco, false);
            setScenes((s) => [...s, scene]);
        } else {
            const now = performance.now();
            setScenes((s) => s.map((sc) => (sc.exitedAt === null ? { ...sc, exitedAt: now } : sc)));
        }
    }, [active, avoidRef]);

    // A theme switch during the party fades the decoration over to variants of the new theme; the balloons stay
    useEffect(() => {
        if (!active) return;
        const observer = new MutationObserver(() => {
            const theme = readTheme();
            const deco = buildDeco(nextId.current++, theme, false, avoidRef?.current?.getBoundingClientRect() ?? null);
            const now = performance.now();
            setScenes((s) => s.map((sc) => {
                if (sc.exitedAt !== null || sc.decos[sc.decos.length - 1].theme === theme) return sc;
                return { ...sc, decos: [...sc.decos.map((d) => (d.fadedAt === null ? { ...d, fadedAt: now } : d)), deco] };
            }));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        return () => observer.disconnect();
    }, [active, avoidRef]);

    // Drop scenes once their exit animation has finished, and replaced decorations once they have faded out
    useEffect(() => {
        if (!scenes.some((s) => s.exitedAt !== null || s.decos.length > 1)) return;
        const t = setTimeout(() => {
            const now = performance.now();
            setScenes((s) => s
                .filter((sc) => sc.exitedAt === null || now - sc.exitedAt < EXIT_MS)
                .map((sc) => {
                    const decos = sc.decos.filter((d) => d.fadedAt === null || now - d.fadedAt < FADE_MS);
                    return decos.length === sc.decos.length ? sc : { ...sc, decos };
                }));
        }, EXIT_MS);
        return () => clearTimeout(t);
    }, [scenes]);

    // Geometry is in pixels; rebuild the active scene in its settled state after a resize, with the same variants
    useEffect(() => {
        if (!active) return;
        let timer: ReturnType<typeof setTimeout>;
        const onResize = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                const avoid = avoidRef?.current?.getBoundingClientRect() ?? null;
                const [sceneId, decoId] = [nextId.current++, nextId.current++];
                setScenes((s) => s.map((sc) => {
                    if (sc.exitedAt !== null) return sc;
                    const current = sc.decos[sc.decos.length - 1];
                    return buildScene(sceneId, buildDeco(decoId, current.theme, true, avoid, current), true);
                }));
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
