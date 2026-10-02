"use client";

import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { applyTheme, THEME_STORAGE_KEY, type ThemePreference } from '@/lib/theme';

const NEXT: Record<ThemePreference, ThemePreference> = { system: 'light', light: 'dark', dark: 'system' };
const LABELS: Record<ThemePreference, string> = { system: 'System theme', light: 'Light theme', dark: 'Dark theme' };
const ICONS = { system: Monitor, light: Sun, dark: Moon };

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  return 'system';
}

export function ThemeToggle({ className }: { className?: string }) {
  // null until mounted: the stored preference is unknown during static prerendering
  const [preference, setPreference] = useState<ThemePreference | null>(null);

  useEffect(() => setPreference(readPreference()), []);

  useEffect(() => {
    if (!preference) return;
    applyTheme();
    if (preference !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [preference]);

  const handleClick = () => {
    if (!preference) return;
    const next = NEXT[preference];
    try {
      if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
    setPreference(next);
  };

  const Icon = ICONS[preference ?? 'system'];
  const label = preference ? `${LABELS[preference]} – switch to ${LABELS[NEXT[preference]].toLowerCase()}` : 'Theme';

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-full shadow-[0_4px_14px_var(--control-shadow)] transition-[transform,opacity] duration-150 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        !preference && "opacity-0",
        className,
      )}
      style={{ background: 'var(--control-bg)', color: 'var(--control-icon)' }}
    >
      <Icon className="h-[20px] w-[20px]" />
    </button>
  );
}
