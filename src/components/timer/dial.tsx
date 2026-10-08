"use client";

import React, { memo } from 'react';
import { cn } from '@/lib/utils';
import {
    CENTER, DIAL_RADIUS, HUB_RADIUS, KNOB_ACTIVE_RADIUS, KNOB_RADIUS, LABEL_RADIUS, RING_RADII,
    TICK_END_RADIUS, TICK_START_RADIUS, BAND_WIDTH, labelColor, polarToCartesian, ringColor,
} from './geometry';

export interface Particle {
    key: string;
    startX: number; startY: number;
    dx: number; dy: number;
    color: string; r: number;
    duration: number; beginTimeSec: number;
}

export type HubContent =
    | { kind: 'empty' }
    | { kind: 'set'; value: string; unit: string }
    | { kind: 'clock'; value: string; paused: boolean }
    | { kind: 'hint' };

/** First-run hint: a ghost handle sweeps clockwise while the numbers pulse, once. */
export type DialHint = 'play' | 'none';

const INK = 'var(--dial-ink)';
const RING_CIRCUMFERENCES = RING_RADII.map(r => 2 * Math.PI * r);
const NO_POINTER: React.CSSProperties = { pointerEvents: 'none' };

interface MarkingsProps {
    secModeProgress: number;
    hrModeProgress: number;
    waveHint: boolean;
    onQuickSet: (e: React.MouseEvent | React.TouchEvent, minValue: number) => void;
}

/** Static dial face: background, ticks and numbers. Only re-renders on mode transitions. */
const DialMarkings = memo(function DialMarkings({ secModeProgress, hrModeProgress, waveHint, onQuickSet }: MarkingsProps) {
    return (
        <>
            <circle cx={CENTER} cy={CENTER} r={DIAL_RADIUS} style={{ fill: 'var(--dial-face)', pointerEvents: 'none' }} />

            {/* Small min/sec ticks (shrink toward outer edge in hr mode) */}
            {hrModeProgress < 1 && Array.from({ length: 60 }).map((_, i) => {
                if ((i + 1) % 5 === 0) return null;
                const tickAngle = (i + 1) * 6;
                const baseInner = DIAL_RADIUS - 5 - 2.5 * secModeProgress;
                const innerRadius = baseInner + (TICK_END_RADIUS - baseInner) * hrModeProgress;
                const start = polarToCartesian(innerRadius, tickAngle);
                const end = polarToCartesian(TICK_END_RADIUS, tickAngle);
                return <line key={`minute-tick-${i}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={INK} strokeWidth="1" style={NO_POINTER} />;
            })}

            {/* 12 major ticks with quick-set labels, cross-fading between min and hr mode */}
            {Array.from({ length: 12 }).map((_, i) => {
                const tickAngle = (i + 1) * 30;
                const minValue = (i + 1) * 5;
                const innerRadius = TICK_START_RADIUS - 4 * secModeProgress * (1 - hrModeProgress);
                const start = polarToCartesian(innerRadius, tickAngle);
                const end = polarToCartesian(TICK_END_RADIUS, tickAngle);
                const labelPos = polarToCartesian(LABEL_RADIUS, tickAngle);
                const labelStyle: React.CSSProperties = { transformBox: 'fill-box', transformOrigin: 'center' };
                return (
                    <g key={`major-tick-${i}`}
                        onMouseDown={(e) => onQuickSet(e, minValue)}
                        onTouchStart={(e) => onQuickSet(e, minValue)}
                        style={{ cursor: 'pointer' }}
                        className="group"
                    >
                        {/* Larger invisible hit area for the label */}
                        <circle cx={labelPos.x} cy={labelPos.y} r="13" fill="transparent" />
                        <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={INK} strokeWidth={2 + 1.5 * hrModeProgress} />
                        <text
                            x={labelPos.x} y={labelPos.y}
                            textAnchor="middle" dominantBaseline="middle"
                            fontWeight="bold" fontSize="14"
                            opacity={1 - hrModeProgress}
                            className={cn("transition-transform duration-150 ease-in-out group-hover:scale-125 group-active:scale-90", waveHint && "dial-hint-wave")}
                            style={waveHint ? { ...labelStyle, animationDelay: `${(i + 1) * 0.14}s` } : labelStyle}
                        >
                            {minValue === 60 ? (
                                <>
                                    <tspan style={{ fill: labelColor(12) }}>6</tspan>
                                    <tspan style={{ fill: labelColor(0) }}>0</tspan>
                                </>
                            ) : (
                                <tspan style={{ fill: labelColor(i + 1) }}>{minValue}</tspan>
                            )}
                        </text>
                        {hrModeProgress > 0 && (
                            <text
                                x={labelPos.x} y={labelPos.y}
                                textAnchor="middle" dominantBaseline="middle"
                                fontWeight="bold" fontSize="14"
                                opacity={hrModeProgress}
                                className="transition-transform duration-150 ease-in-out group-hover:scale-125 group-active:scale-90"
                                style={{ ...labelStyle, fill: labelColor(i) }}
                            >
                                {i + 1}
                            </text>
                        )}
                    </g>
                );
            })}

            {/* Half-second dot markers (sec mode) */}
            {secModeProgress > 0 && hrModeProgress < 1 && Array.from({ length: 60 }).map((_, i) => {
                const baseRadius = DIAL_RADIUS - (5 + 2.5 * secModeProgress) / 2;
                const dotRadius = baseRadius + (DIAL_RADIUS - baseRadius) * hrModeProgress;
                const dotPos = polarToCartesian(dotRadius, 3 + i * 6);
                return <circle key={`half-sec-dot-${i}`} cx={dotPos.x} cy={dotPos.y} r={1.125 * secModeProgress * (1 - hrModeProgress)} fill={INK} style={NO_POINTER} />;
            })}

            {/* Hr mode micro-ticks (2.5°, skipping 7.5° positions) */}
            {hrModeProgress > 0 && Array.from({ length: 144 }).map((_, i) => {
                if ((i + 1) % 3 === 0) return null;
                const tickAngle = (i + 1) * 2.5;
                const start = polarToCartesian(DIAL_RADIUS - 3 * hrModeProgress, tickAngle);
                const end = polarToCartesian(DIAL_RADIUS, tickAngle);
                return <line key={`hr-micro-${i}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={INK} strokeWidth="0.75" opacity="0.35" style={NO_POINTER} />;
            })}

            {/* Hr mode quarter-hour ticks (skipping hour positions) */}
            {hrModeProgress > 0 && Array.from({ length: 48 }).map((_, j) => {
                if ((j + 1) % 4 === 0) return null;
                const tickAngle = (j + 1) * 7.5;
                const start = polarToCartesian(DIAL_RADIUS - 5 * hrModeProgress, tickAngle);
                const end = polarToCartesian(DIAL_RADIUS, tickAngle);
                return <line key={`hr-quarter-${j}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={INK} strokeWidth="1" style={NO_POINTER} />;
            })}
        </>
    );
});

const ExplosionParticles = memo(function ExplosionParticles({ particles }: { particles: Particle[] }) {
    return (
        <>
            {particles.map((p) => (
                <circle key={p.key} cx={p.startX} cy={p.startY} r={p.r} fill={p.color} style={NO_POINTER}>
                    <animateTransform attributeName="transform" type="translate"
                        from="0 0" to={`${p.dx} ${p.dy}`}
                        dur={`${p.duration}ms`} begin={`${p.beginTimeSec}s`} fill="freeze"
                        calcMode="spline" keySplines="0.25 0.1 0.25 1" keyTimes="0;1" />
                    <animate attributeName="opacity" from="1" to="0"
                        dur={`${p.duration}ms`} begin={`${p.beginTimeSec}s`} fill="freeze" />
                </circle>
            ))}
        </>
    );
});

/** Rainbow arcs. `elapsed` draws the elapsed part instead (auto-sec countdown). */
function RainbowArcs({ angle, elapsed }: { angle: number; elapsed: boolean }) {
    if (elapsed ? angle >= 360 : angle <= 0) return null;
    const visible = elapsed ? 360 - angle : angle;
    const rotation = elapsed ? angle - 90 : -90;
    return (
        <g transform={`rotate(${rotation} ${CENTER} ${CENTER})`} style={NO_POINTER}>
            {RING_RADII.map((radius, i) => {
                const circumference = RING_CIRCUMFERENCES[i];
                const length = (circumference * visible) / 360;
                return (
                    <circle
                        key={i}
                        cx={CENTER} cy={CENTER} r={radius}
                        fill="none"
                        style={{ stroke: ringColor(i) }}
                        strokeWidth={BAND_WIDTH + 0.5}
                        strokeDasharray={`${length} ${circumference}`}
                    />
                );
            })}
        </g>
    );
}

/** Ghost handle and faint rainbow sweeping clockwise from 12 o'clock (one play, then gone). */
const GhostHint = memo(function GhostHint() {
    const top = polarToCartesian(DIAL_RADIUS, 0);
    const chevron = polarToCartesian(DIAL_RADIUS, 9);
    return (
        <g style={NO_POINTER}>
            <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
                {RING_RADII.map((radius, i) => (
                    <circle key={i} cx={CENTER} cy={CENTER} r={radius} fill="none" pathLength={100}
                        className="dial-hint-sweep" style={{ stroke: ringColor(i) }}
                        strokeWidth={BAND_WIDTH + 0.5} strokeDasharray="0 100" />
                ))}
            </g>
            <g className="dial-hint-invite">
                <circle cx={top.x} cy={top.y} r={KNOB_RADIUS} fill="none" className="dial-hint-ripple" style={{ stroke: 'var(--knob-stroke)' }} strokeWidth="2" />
                <HandleHitArea x={top.x} y={top.y} />
                <g className="dial-hint-breathe">
                    <circle cx={top.x} cy={top.y + 1.5} r={KNOB_RADIUS + 1} style={{ fill: 'var(--dial-shadow)' }} />
                    <circle cx={top.x} cy={top.y} r={KNOB_RADIUS} style={{ fill: 'var(--knob-fill)', stroke: 'var(--knob-stroke)' }} strokeWidth="2.5" />
                </g>
            </g>
            <g className="dial-hint-ghost" style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}>
                <circle cx={top.x} cy={top.y} r={KNOB_RADIUS} style={{ fill: 'var(--knob-fill)', stroke: 'var(--knob-stroke)' }} strokeWidth="2.5" opacity="0.7" />
                <path d={`M${chevron.x - 3} ${chevron.y - 5} L${chevron.x + 3} ${chevron.y} L${chevron.x - 3} ${chevron.y + 5}`}
                    fill="none" style={{ stroke: 'var(--knob-stroke)' }} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                    transform={`rotate(9 ${chevron.x} ${chevron.y})`} opacity="0.7" />
            </g>
        </g>
    );
});

/**
 * Transparent pointer target for a handle. Handles are drawn above the number labels, so a press
 * anywhere on (or just around) a handle starts a drag instead of hitting the label behind it.
 */
function HandleHitArea({ x, y }: { x: number; y: number }) {
    return <circle cx={x} cy={y} r={KNOB_ACTIVE_RADIUS} fill="transparent" style={{ pointerEvents: 'all' }} />;
}

/** Handle shown at 12 o'clock while an idle dial is hovered (CSS, hover-capable pointers only). */
function HoverHandle() {
    const { x, y } = polarToCartesian(DIAL_RADIUS, 0);
    return (
        <g className="dial-hover-handle">
            <HandleHitArea x={x} y={y} />
            <circle cx={x} cy={y + 1.5} r={KNOB_RADIUS + 1} style={{ fill: 'var(--dial-shadow)' }} />
            <circle cx={x} cy={y} r={KNOB_RADIUS} style={{ fill: 'var(--knob-fill)', stroke: 'var(--knob-stroke)' }} strokeWidth="2.5" />
        </g>
    );
}

function Knob({ angle, active }: { angle: number; active: boolean }) {
    const { x, y } = polarToCartesian(DIAL_RADIUS, angle);
    const r = active ? KNOB_ACTIVE_RADIUS : KNOB_RADIUS;
    // Shadow is a plain offset circle: a filter here would be re-rasterized every frame
    return (
        <g>
            <HandleHitArea x={x} y={y} />
            {active && <circle cx={x} cy={y} r={15} style={{ fill: 'var(--knob-stroke)' }} opacity={0.14} />}
            <circle cx={x} cy={y + 1.5} r={r + 1} style={{ fill: 'var(--dial-shadow)' }} />
            <circle cx={x} cy={y} r={r} style={{ fill: 'var(--knob-fill)', stroke: 'var(--knob-stroke)' }} strokeWidth={active ? 3 : 2.5} />
        </g>
    );
}

interface HubProps {
    content: HubContent;
    interactive: boolean;
    onActivate: () => void;
}

// Clockwise arrow in the hub: arc from 300° over 12 o'clock to 150°, head along the tangent at its end
const HINT_ARROW = (() => {
    const cx = CENTER, cy = CENTER - 8, r = 11;
    const at = (deg: number) => ({ x: cx + r * Math.sin((deg * Math.PI) / 180), y: cy - r * Math.cos((deg * Math.PI) / 180) });
    const from = at(-60), to = at(150);
    const tangent = ((150 + 90) * Math.PI) / 180;
    const wing = (off: number) => ({ x: to.x - 5 * Math.sin(tangent + off), y: to.y + 5 * Math.cos(tangent + off) });
    const w1 = wing(0.7), w2 = wing(-0.7);
    return {
        arc: `M${from.x} ${from.y} A${r} ${r} 0 1 1 ${to.x} ${to.y}`,
        head: `M${w1.x} ${w1.y} L${to.x} ${to.y} L${w2.x} ${w2.y}`,
    };
})();
const HINT_ARROW_ARC = HINT_ARROW.arc;
const HINT_ARROW_HEAD = HINT_ARROW.head;

// Pointer target only; keyboard users toggle pause via Enter/Space on the dial slider
function Hub({ content, interactive, onActivate }: HubProps) {
    return (
        <g
            {...(interactive
                ? { 'data-dial-container-child': true, onClick: onActivate, style: { cursor: 'pointer' } }
                : { style: NO_POINTER })}
        >
            <circle cx={CENTER} cy={CENTER} r={HUB_RADIUS} filter="url(#hub-shadow)" style={{ fill: 'var(--hub)' }} />
            {content.kind === 'set' && (
                <>
                    <text x={CENTER} y={CENTER - 5} textAnchor="middle" dominantBaseline="middle" fontSize={content.value.length > 3 ? 18 : 22} fontWeight="bold" style={{ fill: 'var(--hub-text)' }}>{content.value}</text>
                    <text x={CENTER} y={CENTER + 15} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="bold" style={{ fill: 'var(--hub-subtle)' }}>{content.unit}</text>
                </>
            )}
            {content.kind === 'clock' && (
                <>
                    <text x={CENTER} y={CENTER - 4} textAnchor="middle" dominantBaseline="middle" fontSize={content.value.length > 5 ? 15 : 18} fontWeight="bold" style={{ fill: 'var(--hub-text)', fontVariantNumeric: 'tabular-nums' }}>{content.value}</text>
                    <g style={{ fill: 'var(--hub-subtle)' }}>
                        {content.paused
                            ? <path d={`M${CENTER - 3} ${CENTER + 8} L${CENTER + 5} ${CENTER + 12.5} L${CENTER - 3} ${CENTER + 17} Z`} />
                            : <>
                                <rect x={CENTER - 5} y={CENTER + 8} width="3" height="9" rx="1" />
                                <rect x={CENTER + 2} y={CENTER + 8} width="3" height="9" rx="1" />
                            </>}
                    </g>
                </>
            )}
            {content.kind === 'hint' && (
                <g className="dial-hint-hub" style={{ fill: 'var(--hub-subtle)' }}>
                    {/* Clockwise arrow */}
                    <path d={HINT_ARROW_ARC} fill="none" style={{ stroke: 'var(--hub-subtle)' }} strokeWidth="2.25" strokeLinecap="round" />
                    <path d={HINT_ARROW_HEAD} fill="none" style={{ stroke: 'var(--hub-subtle)' }} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
                    <text x={CENTER} y={CENTER + 17} textAnchor="middle" dominantBaseline="middle" fontSize="10.5" fontWeight="bold">Drag or tap</text>
                </g>
            )}
        </g>
    );
}

export interface DialProps {
    angle: number;
    secModeProgress: number;
    hrModeProgress: number;
    /** Auto-sec countdown: rainbow covers the elapsed part */
    showElapsed: boolean;
    hideRainbow: boolean;
    /** First-run hint animation (only passed while the dial is idle) */
    hint: DialHint;
    /** Show the handle at 12 o'clock on hover (idle dial) */
    hoverHandle: boolean;
    isDragging: boolean;
    particles: Particle[];
    hub: HubContent;
    hubInteractive: boolean;
    onHubActivate: () => void;
    onQuickSet: (e: React.MouseEvent | React.TouchEvent, minValue: number) => void;
    svgRef: React.RefObject<SVGSVGElement | null>;
}

export const Dial = memo(function Dial(props: DialProps) {
    const { angle, secModeProgress, hrModeProgress, showElapsed, hideRainbow, hint, hoverHandle, isDragging, particles, hub, hubInteractive, onHubActivate, onQuickSet, svgRef } = props;
    const showKnob = !hideRainbow && (isDragging || (angle > 0.5 && angle < 359.5));
    return (
        <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${CENTER * 2} ${CENTER * 2}`} aria-hidden="true" className="overflow-visible">
            <defs>
                <filter id="hub-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" style={{ floodColor: 'var(--dial-shadow)' }} />
                </filter>
            </defs>
            <DialMarkings secModeProgress={secModeProgress} hrModeProgress={hrModeProgress} waveHint={hint === 'play'} onQuickSet={onQuickSet} />
            <ExplosionParticles particles={particles} />
            {!hideRainbow && <RainbowArcs angle={angle} elapsed={showElapsed} />}
            {hint === 'play' && <GhostHint />}
            {showKnob && <Knob angle={angle} active={isDragging} />}
            {hoverHandle && !showKnob && hint !== 'play' && <HoverHandle />}
            <Hub content={hub} interactive={hubInteractive} onActivate={onHubActivate} />
        </svg>
    );
});
