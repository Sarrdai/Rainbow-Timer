"use client";

import React, { useEffect, useRef } from 'react';

// Common settings
const GRAVITY = 0.125;
const TERMINAL_VELOCITY = 8;
const DRAG = 0.075;

// Base Confetti Piece Type
type ConfettiPiece = {
  id: number;
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
  baseOpacity: number;
  fadeEndFactor: number;
};

// Canvas drawing function for a piece
const drawPiece = (ctx: CanvasRenderingContext2D, piece: ConfettiPiece) => {
    ctx.save();
    ctx.fillStyle = piece.color;
    ctx.globalAlpha = piece.opacity;
    ctx.translate(piece.x, piece.y);
    ctx.rotate(piece.rotation * Math.PI / 180);
    ctx.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
    ctx.restore();
};


// --- Confetti Burst Component (Canvas) ---
const NUM_CONFETTI_BURST = 150;
const RAINBOW_INNER_RADIUS = 60;
const RAINBOW_OUTER_RADIUS = 126.5;

type ConfettiProps = {
  colors: string[];
  interruptionTime: number | null;
  onComplete: () => void;
  origin?: { x: number; y: number };
};

const createBurstPiece = (i: number, colors: string[], origin: { x: number; y: number }): Omit<ConfettiPiece, 'id'> => {
    const angle = Math.random() * Math.PI * 2;
    const radius = RAINBOW_INNER_RADIUS + Math.random() * (RAINBOW_OUTER_RADIUS - RAINBOW_INNER_RADIUS);
    const initialVelocity = Math.random() * 6 + 6;
    const sizeFactor = Math.random() * 0.7 + 0.5;
    const baseOpacity = sizeFactor > 1 ? 1 : sizeFactor;

    return {
      color: colors[i % colors.length],
      x: origin.x + Math.cos(angle) * radius,
      y: origin.y + Math.sin(angle) * radius,
      vx: Math.cos(angle) * initialVelocity,
      vy: Math.sin(angle) * initialVelocity,
      rotation: Math.random() * 360,
      rotationSpeed: Math.random() * 10 - 5,
      opacity: baseOpacity,
      width: 8 * sizeFactor,
      height: 12 * sizeFactor,
      baseOpacity: baseOpacity,
      fadeEndFactor: Math.random() * (0.98 - 0.85) + 0.85,
    };
};

export function Confetti({ colors, interruptionTime, onComplete, origin = { x: 160, y: 160 } }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const piecesRef = useRef<ConfettiPiece[]>([]);
  const animationFrameId = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    piecesRef.current = Array.from({ length: NUM_CONFETTI_BURST }).map((_, i) => ({
      id: i,
      ...createBurstPiece(i, colors, origin)
    }));
  }, [colors, origin]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = window.innerWidth;
    const canvasHeight = window.innerHeight;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    ctx.scale(dpr, dpr);

    let animationCompleted = false;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const viewportHeight = canvasHeight;

      let burnOffY: number | null = null;
      if (interruptionTime) {
          const elapsed = Date.now() - interruptionTime;
          burnOffY = (elapsed / 1500) * viewportHeight;
      }

      piecesRef.current = piecesRef.current.map(p => {
        p.vy += GRAVITY;
        p.vy = Math.min(p.vy, TERMINAL_VELOCITY);
        p.vx *= (1 - DRAG);
        p.vy *= (1 - DRAG);
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        
        const fadeStartHeight = viewportHeight * 0.8;
        if (p.y > fadeStartHeight) {
            const fadeEndHeight = viewportHeight * p.fadeEndFactor;
            const range = fadeEndHeight - fadeStartHeight;
            p.opacity = p.baseOpacity * (1 - Math.min(1, (p.y - fadeStartHeight) / Math.max(1, range)));
        }

        drawPiece(ctx, p);
        return p;
      }).filter(p => {
        if (burnOffY !== null && p.y < burnOffY) {
            return false;
        }
        return p.opacity > 0.01 && p.y < viewportHeight;
      });

      if (piecesRef.current.length === 0 && !animationCompleted) {
        animationCompleted = true;
        onCompleteRef.current();
      } else {
        animationFrameId.current = requestAnimationFrame(animate);
      }
    };
  
    animationFrameId.current = requestAnimationFrame(animate);
  
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [interruptionTime, colors]); // Rerun setup if colors change

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50 w-full h-full" />;
}


// --- Confetti Rain Component (Canvas) ---
const NUM_RAIN_CONFETTI_PER_TICK = 0.25;

type ConfettiRainProps = {
  colors: string[];
  isRaining: boolean;
  interruptionTime: number | null;
};

const createRainPiece = (id: number, colors: string[], viewportWidth: number): ConfettiPiece => {
    const sizeFactor = Math.random() * 0.7 + 0.5;
    const baseOpacity = sizeFactor > 1 ? 1 : sizeFactor;
    return {
        id,
        color: colors[Math.floor(Math.random() * colors.length)],
        x: Math.random() * viewportWidth,
        y: -20,
        vx: Math.random() * 4 - 2,
        vy: Math.random() * 2 + 2,
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 6 - 3,
        opacity: baseOpacity,
        width: 8 * sizeFactor,
        height: 12 * sizeFactor,
        baseOpacity: baseOpacity,
        fadeEndFactor: Math.random() * (0.98 - 0.85) + 0.85
    };
};

export function ConfettiRain({ colors, isRaining, interruptionTime }: ConfettiRainProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const piecesRef = useRef<ConfettiPiece[]>([]);
    const animationFrameId = useRef<number | null>(null);
    const pieceIdCounter = useRef(0);
    const isRainingRef = useRef(isRaining);
    isRainingRef.current = isRaining;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        let dpr = 1;

        const resizeCanvas = () => {
            if (canvas && ctx) {
                dpr = window.devicePixelRatio || 1;
                canvas.width = canvas.offsetWidth * dpr;
                canvas.height = canvas.offsetHeight * dpr;
                ctx.scale(dpr, dpr);
            }
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);


        const animate = () => {
            if (!canvas || !ctx) return;
            const canvasWidth = canvas.offsetWidth;
            const canvasHeight = canvas.offsetHeight;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            let burnOffY: number | null = null;
            if (interruptionTime) {
                const elapsed = Date.now() - interruptionTime;
                burnOffY = (elapsed / 1500) * canvasHeight;
            }

            if (isRainingRef.current && !interruptionTime) {
                for (let i = 0; i < NUM_RAIN_CONFETTI_PER_TICK; i++) {
                    pieceIdCounter.current++;
                    piecesRef.current.push(createRainPiece(pieceIdCounter.current, colors, canvasWidth));
                }
            }
            
            piecesRef.current = piecesRef.current.map(p => {
                p.vy += GRAVITY;
                p.vy = Math.min(p.vy, TERMINAL_VELOCITY);
                p.vx *= (1 - DRAG);
                p.vy *= (1 - DRAG);
                p.x += p.vx;
                p.y += p.vy;
                p.rotation += p.rotationSpeed;
                
                const fadeStartHeight = canvasHeight * 0.8;
                if (p.y > fadeStartHeight) {
                    const fadeEndHeight = canvasHeight * p.fadeEndFactor;
                    const range = fadeEndHeight - fadeStartHeight;
                    p.opacity = p.baseOpacity * (1 - Math.min(1, (p.y - fadeStartHeight) / Math.max(1, range)));
                }
                
                drawPiece(ctx, p);
                return p;
            }).filter(p => {
                if (burnOffY !== null && p.y < burnOffY) {
                    return false;
                }
                return p.opacity > 0.01 && p.y < canvasHeight;
            });
            
            animationFrameId.current = requestAnimationFrame(animate);
        };
        
        animationFrameId.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
            window.removeEventListener('resize', resizeCanvas);
        };
    }, [colors, interruptionTime]);

    return (
        <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none overflow-hidden z-50 w-full h-full" />
    );
}
