"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { RAINBOW_COLORS } from './confetti';

const HAT_HEIGHT = 75;
const HAT_GAP = 2;
const HAT_STRIPE_HEIGHT = (HAT_HEIGHT - (RAINBOW_COLORS.length - 1) * HAT_GAP) / RAINBOW_COLORS.length;

const PartyHat = () => (
    <svg width="28" height="32" viewBox="0 0 75 85" fill="none" aria-hidden="true" className="absolute -top-4 -left-2 -rotate-[15deg]">
        <defs>
            <clipPath id="hat-clip-path">
                <path d="M37.5 5L70 80H5L37.5 5Z" />
            </clipPath>
        </defs>
        <g clipPath="url(#hat-clip-path)">
            {RAINBOW_COLORS.map((color, i) => (
                <rect key={color} x="0" y={5 + i * (HAT_STRIPE_HEIGHT + HAT_GAP)} width="75" height={HAT_STRIPE_HEIGHT} fill={color} />
            ))}
        </g>
        <circle cx="37.5" cy="5" r="5" fill="#faeb36" />
    </svg>
);

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
