"use client";

import { useEffect, useRef, useState } from 'react';

const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Animates a value towards `target` over `durationMs` (ease-in-out), continuing from the current value. */
export function useAnimatedProgress(target: number, durationMs: number) {
    const [progress, setProgress] = useState(target);
    const progressRef = useRef(target);

    useEffect(() => {
        if (progressRef.current === target) return;
        const start = progressRef.current;
        let startTime: number | null = null;
        let frameId = 0;

        const animate = (now: number) => {
            if (startTime === null) startTime = now;
            const t = Math.min((now - startTime) / durationMs, 1);
            const value = start + (target - start) * easeInOutQuad(t);
            progressRef.current = value;
            setProgress(value);
            if (t < 1) frameId = requestAnimationFrame(animate);
        };

        frameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frameId);
    }, [target, durationMs]);

    return progress;
}
