"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const INFO_SEEN_KEY = 'rainbowTimerInfoSeen';

const STEPS = [
  ['Drag', 'the handle clockwise around the dial.'],
  ['Let go', 'and the timer starts.'],
  ['Tap the center', 'to pause or resume.'],
] as const;

/** Info button with a small how-to popover. A dot marks it until it was opened once. */
export function InfoButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  // Assume seen until storage was read, so the dot never flashes for returning users
  const [seen, setSeen] = useState(true);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { setSeen(localStorage.getItem(INFO_SEEN_KEY) === '1'); } catch {}
  }, []);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') close(true); };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!popoverRef.current?.contains(target) && !buttonRef.current?.contains(target)) close(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, close]);

  const toggle = () => {
    if (!open && !seen) {
      setSeen(true);
      try { localStorage.setItem(INFO_SEEN_KEY, '1'); } catch {}
    }
    setOpen(!open);
  };

  return (
    <div className={className}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label="How to use the timer"
        aria-expanded={open}
        aria-controls="info-popover"
        className={cn(
          "relative flex h-11 w-11 select-none touch-manipulation items-center justify-center rounded-full shadow-[0_4px_14px_var(--control-shadow)] transition-transform duration-150 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [-webkit-tap-highlight-color:transparent]",
        )}
        style={{ background: open ? 'var(--segment-bg)' : 'var(--control-bg)', color: 'var(--control-icon)' }}
      >
        <Info className="h-[20px] w-[20px]" />
        {!seen && (
          <span aria-hidden className="absolute right-2 top-2 h-2 w-2 rounded-full border border-[var(--control-bg)] bg-[var(--ring-6)]" />
        )}
      </button>
      <div
        ref={popoverRef}
        id="info-popover"
        role="dialog"
        aria-label="How to use the timer"
        hidden={!open}
        className="absolute left-0 top-14 w-[min(300px,calc(100vw-2rem))] rounded-2xl border bg-card p-4 text-card-foreground shadow-[0_14px_36px_var(--control-shadow)]"
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[15px] font-bold">How it works</h2>
          <button
            type="button"
            onClick={() => close(true)}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ol className="grid gap-2 text-sm leading-snug">
          {STEPS.map(([strong, rest], i) => (
            <li key={strong} className="flex items-start gap-2.5">
              <span
                aria-hidden
                className="mt-px flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs font-bold"
                style={{ background: 'var(--segment-bg)', color: 'var(--segment-active-text)' }}
              >
                {i + 1}
              </span>
              <span><b className="font-bold">{strong}</b> {rest}</span>
            </li>
          ))}
        </ol>
        <div className="mt-3 grid gap-0.5 border-t pt-3 text-[13px] text-muted-foreground">
          <span>Tap a number to jump straight to it.</span>
          <span>Switch hr / min / sec below the dial.</span>
        </div>
      </div>
    </div>
  );
}
