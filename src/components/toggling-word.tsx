"use client";

import React from 'react';

export function TogglingWord({ isPartyMode }: { isPartyMode: boolean }) {
    
    const PartyHat = () => {
        const colors = ['#e81416', '#ffa500', '#faeb36', '#79c314', '#487de7', '#4b369d', '#70369d'];
        const totalStripes = colors.length;
        const hatHeight = 75;
        const gapHeight = 2;
        const totalGapsHeight = (totalStripes - 1) * gapHeight;
        const stripeHeight = (hatHeight - totalGapsHeight) / totalStripes;

        return (
            // Positioned the hat slightly lower and to the left to sit on the 'P'
            <svg width="28" height="32" viewBox="0 0 75 85" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute -top-4 -left-2 transform -rotate-[15deg]">
                <defs>
                    <clipPath id="hat-clip-path">
                        {/* The triangular shape of the hat */}
                        <path d="M37.5 5L70 80H5L37.5 5Z" />
                    </clipPath>
                </defs>
                {/* The group of stripes is clipped by the triangular path */}
                <g clipPath="url(#hat-clip-path)">
                    {colors.map((color, i) => (
                        <rect
                            key={color}
                            x="0"
                            // Position each stripe with a gap in between
                            y={5 + i * (stripeHeight + gapHeight)}
                            width="75"
                            height={stripeHeight}
                            fill={color}
                        />
                    ))}
                </g>
                {/* The pom-pom at the top */}
                <circle cx="37.5" cy="5" r="5" fill="#faeb36"/>
            </svg>
        );
    };

    const word = isPartyMode ? (
        <span className="relative">
            <PartyHat />
            Party
        </span>
    ) : (
        'Timer'
    );

    return (
        <div className="relative w-[110px] h-[48px]">
            <div className="absolute inset-0 flex items-center justify-center">
                <span>
                    {word}
                </span>
            </div>
        </div>
    );
}
