"use client";

import React, { useId } from 'react';
import { cn } from '@/lib/utils';
import { RAINBOW_COLORS } from './confetti';

const HAT_STRIPE = 11;

/** Rainbow party hat worn on the top-left corner of the "P". Sized in em so it scales with the title. */
const PartyHat = () => {
    const id = useId();
    const cone = `${id}-cone`;
    const shade = `${id}-shade`;
    return (
        <svg
            viewBox="-16 -4 80 84"
            aria-hidden="true"
            className="pointer-events-none absolute -left-[0.34em] -top-[0.2em] h-[0.74em] w-[0.7em] -rotate-[33deg] drop-shadow-[0_0.04em_0.03em_rgba(20,10,40,0.45)]"
        >
            <defs>
                <clipPath id={cone}><path d="M32 8 L55 68 Q32 81 9 68 Z" /></clipPath>
                <linearGradient id={shade} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
                    <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
                    <stop offset="1" stopColor="#2b1f4a" stopOpacity="0.22" />
                </linearGradient>
            </defs>
            {/* Diagonal rainbow stripes, clipped to the cone, with soft side shading */}
            <g clipPath={`url(#${cone})`}>
                <g transform="rotate(-28 32 40)">
                    {Array.from({ length: 10 }, (_, i) => (
                        <rect key={i} x="-30" y={-12 + i * HAT_STRIPE} width="124" height={HAT_STRIPE} fill={RAINBOW_COLORS[i % RAINBOW_COLORS.length]} />
                    ))}
                </g>
                <rect x="0" y="0" width="64" height="80" fill={`url(#${shade})`} />
            </g>
            {/* Trim with dots */}
            <path d="M9 68 Q32 81 55 68" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" />
            <circle cx="17" cy="71.6" r="1.6" fill="#e81416" />
            <circle cx="27" cy="74.1" r="1.6" fill="#487de7" />
            <circle cx="37" cy="74.1" r="1.6" fill="#79c314" />
            <circle cx="47" cy="71.6" r="1.6" fill="#ffa500" />
            {/* Fluffy pom-pom */}
            <circle cx="32" cy="7" r="7" fill="#ffd23f" />
            <circle cx="26.5" cy="9" r="4" fill="#ffd23f" />
            <circle cx="37.5" cy="9" r="4" fill="#ffd23f" />
            <circle cx="32" cy="2.5" r="4" fill="#ffe27a" />
            <circle cx="29.5" cy="4.5" r="2" fill="#ffffff" opacity="0.7" />
            {/* Confetti specks */}
            <rect x="-12" y="14" width="5" height="2.5" rx="1" fill="#487de7" transform="rotate(30 -10 15)" />
            <rect x="0" y="0" width="5" height="2.5" rx="1" fill="#e81416" transform="rotate(-25 2 1)" />
            <circle cx="-6" cy="30" r="1.8" fill="#79c314" />
        </svg>
    );
};

// Both words stay mounted and swap with a flip-up transition on opacity/transform only,
// so the change is compositor-driven and never causes layout or repaint of the title.
const wordClass = "absolute inset-0 flex items-center justify-center transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none";

export function TogglingWord({ isPartyMode }: { isPartyMode: boolean }) {
    return (
        <span className="relative block h-[48px] w-[110px]" aria-live="polite">
            <span
                aria-hidden={isPartyMode}
                className={cn(wordClass, isPartyMode ? "-translate-y-1/2 scale-75 opacity-0" : "translate-y-0 scale-100 opacity-100")}
            >
                Timer
            </span>
            <span
                aria-hidden={!isPartyMode}
                className={cn(wordClass, isPartyMode ? "translate-y-0 scale-100 opacity-100" : "translate-y-1/2 scale-75 opacity-0")}
            >
                <span className="relative">
                    <PartyHat />
                    Party
                </span>
            </span>
        </span>
    );
}
