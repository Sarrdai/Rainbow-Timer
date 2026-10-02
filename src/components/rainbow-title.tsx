"use client";

import React, { useLayoutEffect, useRef, type CSSProperties } from 'react';

const RAINBOW = [..."Rainbow"];
const TIMER = [..."Timer"];
const PARTY = [..."Party"];

const delayStyle = (i: number) => ({ '--d': i }) as CSSProperties;

/**
 * "Rainbow Timer / Party" title.
 * - "Rainbow" is clipped from diagonal stripes; in party mode the letters wave and the stripes drift,
 *   in timer mode a shimmer passes over it from time to time.
 * - "Timer" ⇄ "Party" flip letter by letter like a split-flap display (both words have five letters).
 * All animation is CSS-driven (see globals.css), so mode changes never re-render more than this component.
 */
export function RainbowTitle({ isPartyMode }: { isPartyMode: boolean }) {
    const ref = useRef<HTMLSpanElement>(null);

    useLayoutEffect(() => {
        const root = ref.current;
        if (!root) return;
        const measure = () => {
            // Offset each letter's background so the stripes stay continuous across letters
            root.querySelectorAll<HTMLElement>('.rainbow-letter').forEach((s) => {
                s.style.setProperty('--x', `${s.offsetLeft}px`);
            });
            // Each flap cell takes the width of its visible letter, so neither word looks letter-spaced
            root.querySelectorAll<HTMLElement>('.flap-cell').forEach((cell) => {
                const [front, back] = cell.querySelectorAll<HTMLElement>('.flap-face');
                cell.style.setProperty('--wa', `${front.scrollWidth}px`);
                cell.style.setProperty('--wb', `${back.scrollWidth}px`);
            });
        };
        measure();
        let cancelled = false;
        document.fonts?.ready.then(() => { if (!cancelled) measure(); });
        window.addEventListener('resize', measure);
        return () => {
            cancelled = true;
            window.removeEventListener('resize', measure);
        };
    }, []);

    return (
        <span ref={ref} className="rainbow-title" data-mode={isPartyMode ? 'party' : 'timer'}>
            <span className="sr-only" aria-live="polite">{isPartyMode ? 'Rainbow Party' : 'Rainbow Timer'}</span>
            <span className="rainbow-word" aria-hidden="true">
                {RAINBOW.map((ch, i) => (
                    <span key={i} className="rainbow-letter" style={delayStyle(i)}>{ch}</span>
                ))}
            </span>
            <span className="flap-word" aria-hidden="true">
                {TIMER.map((ch, i) => (
                    <span key={i} className="flap-cell" style={delayStyle(i)}>
                        <span className="flap-card">
                            <span className="flap-face">{ch}</span>
                            <span className="flap-face flap-back">{PARTY[i]}</span>
                        </span>
                    </span>
                ))}
            </span>
        </span>
    );
}
