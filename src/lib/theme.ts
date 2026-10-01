export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'rainbowTimerTheme';
const THEME_COLORS: Record<Theme, string> = { light: '#f8def8', dark: '#15122a' };

/**
 * Runs inline in <head> before first paint: applies the stored choice or the system theme,
 * so there is no light flash when dark mode is active.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}})()`;

export const getStoredTheme = (): Theme | null => {
    try {
        const t = localStorage.getItem(THEME_STORAGE_KEY);
        return t === 'light' || t === 'dark' ? t : null;
    } catch {
        return null;
    }
};

export const getSystemTheme = (): Theme =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

export const applyTheme = (theme: Theme) => {
    document.documentElement.dataset.theme = theme;
    // Keep the browser / status bar color in sync with the chosen theme
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', THEME_COLORS[theme]));
};

export const storeTheme = (theme: Theme) => {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
};
