"use client";

import React from 'react';

export const RainbowWord = () => {
    const colors = ['#e81416', '#ffa500', '#faeb36', '#79c314', '#487de7', '#4b369d', '#70369d'];
    const text = "Rainbow";
    
    const SVG_WIDTH = 200;
    const SVG_HEIGHT = 60;
    const STRIPE_WIDTH = 25; 
    const TOTAL_STRIPES_WIDTH = colors.length * STRIPE_WIDTH;

    return (
        <div className="relative" style={{ width: SVG_WIDTH, height: SVG_HEIGHT }}>
            <svg width={SVG_WIDTH} height={SVG_HEIGHT} viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="rainbow-word-svg">
                <defs>
                    <clipPath id="rainbow-text-clip-path">
                        <text
                            x="50%"
                            y="50%"
                            dy="0.32em"
                            textAnchor="middle"
                            className="rainbow-word-text"
                        >
                            {text}
                        </text>
                    </clipPath>
                </defs>
                
                <g clipPath="url(#rainbow-text-clip-path)" transform="translate(0 0.5)">
                    <g className="rainbow-stripes-container">
                        {colors.map((color, i) => (
                            <rect
                                key={i}
                                x={(i * STRIPE_WIDTH) + 25}
                                y={-TOTAL_STRIPES_WIDTH / 2}
                                width={STRIPE_WIDTH}
                                height={TOTAL_STRIPES_WIDTH * 2}
                                fill={color}
                                className="rainbow-stripe"
                                style={{
                                    animationDelay: `${i * 0.08}s`,
                                }}
                            />
                        ))}
                    </g>
                </g>
            </svg>
        </div>
    );
};

RainbowWord.displayName = "RainbowWord";
