import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'phog-theme';
const TRANSITION_MS = 220;

function readInitial(): { theme: Theme; manual: boolean } {
  const attr = document.documentElement.getAttribute('data-theme');
  const stored = (() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  })();

  if (stored === 'light' || stored === 'dark') {
    return { theme: stored, manual: true };
  }
  if (attr === 'light' || attr === 'dark') {
    return { theme: attr, manual: false };
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return { theme: prefersDark ? 'dark' : 'light', manual: false };
}

function beginTransition(timeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) {
  document.documentElement.setAttribute('data-theme-transitioning', '');
  if (timeoutRef.current) clearTimeout(timeoutRef.current);
  timeoutRef.current = setTimeout(() => {
    document.documentElement.removeAttribute('data-theme-transitioning');
    timeoutRef.current = null;
  }, TRANSITION_MS);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const initial = useRef(readInitial()).current;
  const [state, setState] = useState(initial);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  // Apply the theme to <html> whenever it changes (skip the initial mount —
  // the anti-flash script in index.html already set the attribute).
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      document.documentElement.setAttribute('data-theme', state.theme);
      return;
    }
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  // Follow OS preference live, but only while the user hasn't committed.
  useEffect(() => {
    if (state.manual) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      setState(prev => {
        if (prev.manual) return prev;
        beginTransition(transitionTimeoutRef);
        return { theme: e.matches ? 'dark' : 'light', manual: false };
      });
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [state.manual]);

  const setTheme = useCallback((t: Theme) => {
    try { localStorage.setItem(STORAGE_KEY, t); } catch {}
    beginTransition(transitionTimeoutRef);
    setState({ theme: t, manual: true });
  }, []);

  const toggle = useCallback(() => {
    setState(prev => {
      const next: Theme = prev.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(STORAGE_KEY, next); } catch {}
      beginTransition(transitionTimeoutRef);
      return { theme: next, manual: true };
    });
  }, []);

  // Clear any pending transition timeout on unmount.
  useEffect(() => () => {
    if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
  }, []);

  const value = useMemo(
    () => ({ theme: state.theme, setTheme, toggle }),
    [state.theme, setTheme, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
