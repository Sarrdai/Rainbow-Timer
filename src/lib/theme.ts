export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'rainbowTimerTheme';
export const THEME_COLORS = { light: '#f8def8', dark: '#15122a' } as const;

// Runs before first paint (inlined in <head>) so the stored theme is applied without a flash.
// Must stay self-contained: it is serialized as a string.
function applyStoredTheme(storageKey: string, colors: typeof THEME_COLORS) {
  let pref: string | null = null;
  try { pref = localStorage.getItem(storageKey); } catch {}
  const dark = pref === 'dark' || (pref !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', colors[theme]));
}

export const themeInitScript =
  `(${applyStoredTheme.toString()})(${JSON.stringify(THEME_STORAGE_KEY)}, ${JSON.stringify(THEME_COLORS)});`;

export function applyTheme() {
  applyStoredTheme(THEME_STORAGE_KEY, THEME_COLORS);
}
