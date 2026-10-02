"use client";

import { useEffect, useRef, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { applyTheme, THEME_STORAGE_KEY, type ThemePreference } from '@/lib/theme';

const HOLD_TO_SYSTEM_MS = 1000;
const ICONS = { system: Monitor, light: Sun, dark: Moon };

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  return 'system';
}

function storePreference(pref: ThemePreference) {
  try {
    if (pref === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {}
}

/** Click toggles light/dark (starting from what is shown); holding for 1s switches to the system theme. */
export function ThemeToggle({ className }: { className?: string }) {
  // null until mounted: the stored preference is unknown during static prerendering
  const [preference, setPreference] = useState<ThemePreference | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const holdCompleted = useRef(false);

  useEffect(() => setPreference(readPreference()), []);

  useEffect(() => {
    if (!preference) return;
    applyTheme();
    if (preference !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [preference]);

  useEffect(() => () => clearTimeout(holdTimer.current), []);

  const select = (pref: ThemePreference) => {
    storePreference(pref);
    setPreference(pref);
  };

  const startHold = (e: React.PointerEvent) => {
    if (!preference || e.button !== 0) return;
    holdCompleted.current = false;
    setIsHolding(true);
    holdTimer.current = setTimeout(() => {
      holdCompleted.current = true;
      setIsHolding(false);
      select('system');
    }, HOLD_TO_SYSTEM_MS);
  };

  const cancelHold = () => {
    clearTimeout(holdTimer.current);
    setIsHolding(false);
  };

  const handleClick = () => {
    // A completed hold also ends in a click event, which must not toggle again
    if (holdCompleted.current) {
      holdCompleted.current = false;
      return;
    }
    if (!preference) return;
    select(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  };

  const Icon = ICONS[preference ?? 'system'];
  const label = preference === 'system'
    ? 'System theme – click to toggle light/dark'
    : `${preference === 'dark' ? 'Dark' : 'Light'} theme – click to toggle, hold to follow system`;

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={label}
      title={label}
      className={cn(
        "relative flex h-11 w-11 select-none touch-manipulation items-center justify-center overflow-hidden rounded-full shadow-[0_4px_14px_var(--control-shadow)] transition-[transform,opacity] duration-150 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]",
        !preference && "opacity-0",
        className,
      )}
      style={{ background: 'var(--control-bg)', color: 'var(--control-icon)' }}
    >
      {/* Hold progress: fills from the center outwards, snaps back quickly on early release */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full bg-current opacity-25"
        style={{
          transform: `scale(${isHolding ? 1 : 0})`,
          transition: `transform ${isHolding ? `${HOLD_TO_SYSTEM_MS}ms cubic-bezier(0.3, 0, 0.7, 1)` : '150ms ease-out'}`,
        }}
      />
      <Icon className="relative h-[20px] w-[20px]" />
    </button>
  );
}
