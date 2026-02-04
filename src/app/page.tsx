"use client";

import { RainbowWord } from '@/components/rainbow-word';
import { TogglingWord } from '@/components/toggling-word';
import { Footer } from '@/components/footer';
import { RainbowTimer } from '@/components/rainbow-timer';
import { useEffect, useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

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

const TitleConfetti = ({ onComplete, origin }: { onComplete: () => void; origin: { x: number; y: number } }) => {
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
// --- End of TitleConfetti component logic ---


const translations = {
  en: "Drag the dial to set a visual timer.",
  de: "Ziehe am Rad, um einen visuellen Timer einzustellen."
};

export default function Home() {
  const [subtitle, setSubtitle] = useState(translations.en);
  const [manualFullscreen, setManualFullscreen] = useState(false);
  const [isForcedFullscreen, setIsForcedFullscreen] = useState(false);
  const [isPartyMode, setIsPartyMode] = useState(false);
  
  const titleRef = useRef<HTMLDivElement>(null);
  const [confettiBursts, setConfettiBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [rainbowKey, setRainbowKey] = useState(0);
  const [titleBangTrigger, setTitleBangTrigger] = useState(0);

  const [isTitleAndFooterVisible, setIsTitleAndFooterVisible] = useState(true);
  const [isTimerInFullscreen, setIsTimerInFullscreen] = useState(false);
  const desiredFullscreen = manualFullscreen || isForcedFullscreen;

  useEffect(() => {
    // This effect orchestrates the two-step animation for entering and exiting
    // fullscreen mode. It is triggered only by a change in `desiredFullscreen`.
    if (desiredFullscreen) {
      // --- Enter Fullscreen Sequence ---
      if (!isTimerInFullscreen) {
        // 1. Fade out title and footer.
        setIsTitleAndFooterVisible(false);
        
        // 2. After a short delay, expand the timer.
        const timer = setTimeout(() => {
            setIsTimerInFullscreen(true);
        }, 200);
        return () => clearTimeout(timer);
      }
    } else {
      // --- Exit Fullscreen Sequence ---
      if (isTimerInFullscreen) {
        // 1. Shrink the timer.
        setIsTimerInFullscreen(false);

        // 2. After the shrink animation finishes, fade in the title and footer.
        const timer = setTimeout(() => {
            setIsTitleAndFooterVisible(true);
        }, 400);
        return () => clearTimeout(timer);
      }
    }
    // `isTimerInFullscreen` is intentionally omitted from the dependency array
    // to prevent the effect from cancelling its own timeout mid-sequence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desiredFullscreen]);


  useEffect(() => {
    if (navigator.language.startsWith('de')) {
      setSubtitle(translations.de);
    }
  }, []);

  useEffect(() => {
    const THRESHOLD = 650; // Height in pixels
    const handleResize = () => {
      setIsForcedFullscreen(window.innerHeight < THRESHOLD);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Check on initial load

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleTitleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    setTitleBangTrigger(Date.now());
    setConfettiBursts(bursts => [...bursts, { id: Date.now(), x: e.clientX, y: e.clientY }]);
    setIsPartyMode(p => !p);
    setRainbowKey(k => k + 1);
  };
  
  const handleInterruptCelebration = (e: MouseEvent | TouchEvent) => {
    const clientX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
    const clientY = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;
    setConfettiBursts(bursts => [...bursts, { id: Date.now(), x: clientX, y: clientY }]);
    setTitleBangTrigger(Date.now());
  };

  return (
    <main className="relative h-screen w-full flex flex-col items-center justify-center p-4 text-center overflow-hidden">
      {confettiBursts.map(burst => (
          <TitleConfetti 
              key={burst.id} 
              origin={{ x: burst.x, y: burst.y }}
              onComplete={() => {
                  setConfettiBursts(currentBursts => currentBursts.filter(b => b.id !== burst.id));
              }} 
          />
      ))}
      <div className={cn(
        "absolute top-12 left-1/2 -translate-x-1/2 w-full transition-opacity duration-200",
        !isTitleAndFooterVisible && "pointer-events-none opacity-0"
      )}>
        <div 
          ref={titleRef}
          className="relative flex cursor-pointer items-center justify-center gap-x-3"
          onClick={handleTitleClick}
        >
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl font-headline flex items-center justify-center gap-x-3">
            <RainbowWord key={rainbowKey} />
            <TogglingWord isPartyMode={isPartyMode} />
          </h1>
        </div>
        <p className="mt-2 text-muted-foreground">
          {subtitle}
        </p>
      </div>
      
      <RainbowTimer 
        isFullscreen={isTimerInFullscreen} 
        onFullscreenChange={setManualFullscreen}
        isPartyMode={isPartyMode} 
        isForcedFullscreen={isForcedFullscreen}
        titleBangTrigger={titleBangTrigger}
        onInterruptCelebration={handleInterruptCelebration}
        isUIVisible={isTitleAndFooterVisible}
      />
      
      <div className={cn("absolute bottom-4 left-1/2 -translate-x-1/2 w-full transition-opacity duration-200", !isTitleAndFooterVisible && "pointer-events-none opacity-0")}>
        <Footer />
      </div>
    </main>
  );
}
