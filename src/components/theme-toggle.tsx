"use client";

import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Theme, applyTheme, getStoredTheme, getSystemTheme, storeTheme } from '@/lib/theme';

/** Light/dark switch. Follows the system theme until the user picks one. */
export function ThemeToggle({ className }: { className?: string }) {
    const [theme, setTheme] = useState<Theme | null>(null);

    useEffect(() => {
        const initial = getStoredTheme() ?? getSystemTheme();
        setTheme(initial);
        applyTheme(initial);

        // Without an explicit choice, keep following system changes
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            if (getStoredTheme()) return;
            const next = getSystemTheme();
            setTheme(next);
            applyTheme(next);
        };
        media.addEventListener('change', handleChange);
        return () => media.removeEventListener('change', handleChange);
    }, []);

    const toggle = () => {
        const next: Theme = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        applyTheme(next);
        storeTheme(next);
    };

    // Rendered after mount only: the theme is unknown during static prerendering
    if (!theme) return null;

    const isDark = theme === 'dark';
    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full shadow-[0_4px_14px_var(--control-shadow)] transition-transform duration-150 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                className
            )}
            style={{ background: 'var(--control-bg)', color: 'var(--control-icon)' }}
        >
            {/* Icons cross-fade and rotate on opacity/transform only */}
            <span className="relative h-[22px] w-[22px]">
                <Moon className={cn("absolute inset-0 h-[22px] w-[22px] transition-[opacity,transform] duration-300 motion-reduce:transition-none", isDark ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100")} />
                <Sun className={cn("absolute inset-0 h-[22px] w-[22px] transition-[opacity,transform] duration-300 motion-reduce:transition-none", isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0")} />
            </span>
        </button>
    );
}
