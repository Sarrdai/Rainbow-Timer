"use client";

import { RainbowWord } from '@/components/rainbow-word';
import { TogglingWord } from '@/components/toggling-word';
import { Footer } from '@/components/footer';
import { ThemeToggle } from '@/components/theme-toggle';
import { RainbowTimer } from '@/components/rainbow-timer';
import { useEffect, useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ConfettiLayer, confetti } from '@/components/confetti';

export default function Home() {
  const [manualFullscreen, setManualFullscreen] = useState(false);
  const [isForcedFullscreen, setIsForcedFullscreen] = useState(false);
  const [isPartyMode, setIsPartyMode] = useState(false);
  
  const titleRef = useRef<HTMLDivElement>(null);
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
    const THRESHOLD = 650; // Height in pixels
    const handleResize = () => {
      setIsForcedFullscreen(window.innerHeight < THRESHOLD);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Check on initial load

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleTitleBurst = (x: number, y: number) => {
    setTitleBangTrigger(Date.now());
    confetti.pointBurst({ x, y });
    setIsPartyMode(p => !p);
    setRainbowKey(k => k + 1);
  };

  const handleTitleClick = (e: React.MouseEvent<HTMLDivElement>) => handleTitleBurst(e.clientX, e.clientY);
  
  const handleInterruptCelebration = useCallback((e: MouseEvent | TouchEvent) => {
    const point = 'touches' in e ? (e.touches[0] ?? e.changedTouches[0]) : e;
    if (point) confetti.pointBurst({ x: point.clientX, y: point.clientY });
    setTitleBangTrigger(Date.now());
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <ConfettiLayer />

      {/* Title: fixed above the viewport-centered dial.
          Dial half-sizes per breakpoint: 160 / 175 / 195 / 215 / 230 px
          Gap between title and dial: 24 / 32 / 32 / 40 / 40 px
          +1 RainbowWord line-height: text-4xl=40px (default/sm), text-5xl=48px (md+) */}
      <div className={cn(
        "fixed left-0 right-0 z-[45] flex justify-center text-center transition-opacity duration-200",
        "bottom-[calc(50%+224px)] sm:bottom-[calc(50%+247px)] md:bottom-[calc(50%+275px)] lg:bottom-[calc(50%+303px)] xl:bottom-[calc(50%+318px)]",
        !isTitleAndFooterVisible && "pointer-events-none opacity-0"
      )}>
        <div
          ref={titleRef}
          role="button"
          tabIndex={0}
          aria-label={isPartyMode ? 'Rainbow Party – switch to timer mode' : 'Rainbow Timer – switch to party mode'}
          aria-pressed={isPartyMode}
          className="relative flex cursor-pointer select-none items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={handleTitleClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              handleTitleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
            }
          }}
        >
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl font-headline flex flex-col items-center justify-center">
            <RainbowWord key={rainbowKey} />
            <TogglingWord isPartyMode={isPartyMode} />
          </h1>
        </div>
      </div>

      <RainbowTimer
        isFullscreen={isTimerInFullscreen}
        onFullscreenChange={setManualFullscreen}
        isPartyMode={isPartyMode}
        isForcedFullscreen={isForcedFullscreen}
        titleBangTrigger={titleBangTrigger}
        onInterruptCelebration={handleInterruptCelebration}
        titleRef={titleRef}
      />

      <ThemeToggle
        className={cn(
          "fixed right-4 top-4 z-[55] transition-opacity duration-200",
          !isTitleAndFooterVisible && !isForcedFullscreen && "pointer-events-none opacity-0"
        )}
      />

      <div className={cn("fixed bottom-4 left-1/2 -translate-x-1/2 w-full transition-opacity duration-200", !isTitleAndFooterVisible && "pointer-events-none opacity-0")}>
        <Footer />
      </div>
    </main>
  );
}
