"use client";

import { useRef, useEffect } from 'react';

// --- Start of TitleConfetti component logic ---
const NUM_CONFETTI = 150;
const GRAVITY = 0.08;
const TERMINAL_VELOCITY = 6;
const DRAG = 0.02;

type ConfettiPiece = {
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  width: number;
  height: number;
};

const createConfetti = (colors: string[], centerX: number, centerY: number): ConfettiPiece[] => {
    return Array.from({ length: NUM_CONFETTI }).map((_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const initialVelocity = Math.random() * 6 + 5;
        const sizeFactor = Math.random() * 0.7 + 0.5;

        return {
            color: colors[i % colors.length],
            x: centerX,
            y: centerY,
            vx: Math.cos(angle) * initialVelocity,
            vy: Math.sin(angle) * initialVelocity,
            rotation: Math.random() * 360,
            rotationSpeed: Math.random() * 10 - 5,
            opacity: 1,
            width: 8 * sizeFactor,
            height: 12 * sizeFactor,
        };
    });
};

export const TitleConfetti = ({ onComplete, origin }: { onComplete: () => void; origin: { x: number; y: number } }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const piecesRef = useRef<ConfettiPiece[]>([]);
    const animationFrameId = useRef<number | null>(null);
    const onCompleteRef = useRef(onComplete);
    onCompleteRef.current = onComplete;

    const ringColors = ['#e81416', '#ffa500', '#faeb36', '#79c314', '#487de7', '#4b369d', '#70369d'].reverse();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        ctx.scale(dpr, dpr);
        
        const centerX = origin.x;
        const centerY = origin.y;

        piecesRef.current = createConfetti(ringColors, centerX, centerY);

        let animationCompleted = false;

        const animate = () => {
            if (!ctx || !canvas) return;
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

            piecesRef.current = piecesRef.current.map(p => {
                p.vy += GRAVITY;
                p.vy = Math.min(p.vy, TERMINAL_VELOCITY);
                p.vx *= (1 - DRAG);
                p.x += p.vx;
                p.y += p.vy;
                p.rotation += p.rotationSpeed;
                p.opacity *= 0.98;

                ctx.save();
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.opacity;
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation * Math.PI / 180);
                ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
                ctx.restore();
                
                return p;
            }).filter(p => p.opacity > 0.05);

            if (piecesRef.current.length === 0) {
                if (!animationCompleted) {
                    animationCompleted = true;
                    onCompleteRef.current();
                }
            } else {
                animationFrameId.current = requestAnimationFrame(animate);
            }
        };

        animationFrameId.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-50"
        />
    );
};
