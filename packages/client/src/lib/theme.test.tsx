import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from './theme';

function Probe() {
  const { theme, setTheme, toggle } = useTheme();
  return (
    <div>
      <span data-testid="value">{theme}</span>
      <button onClick={() => setTheme('dark')}>force dark</button>
      <button onClick={() => setTheme('light')}>force light</button>
      <button onClick={toggle}>toggle</button>
    </div>
  );
}

function setMatchMedia(prefersDark: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    matches: prefersDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
    addListener: () => {}, // legacy
    removeListener: () => {}, // legacy
    onchange: null,
    dispatchEvent: () => true,
  };
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
  return {
    set(prefersDark2: boolean) {
      mql.matches = prefersDark2;
      listeners.forEach(cb => cb({ matches: prefersDark2 } as MediaQueryListEvent));
    },
  };
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-transitioning');
  });

  it('reads initial theme from the data-theme attribute', () => {
    setMatchMedia(false);
    document.documentElement.setAttribute('data-theme', 'dark');
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('value').textContent).toBe('dark');
  });

  it('falls back to prefers-color-scheme when no data-theme is set', () => {
    setMatchMedia(true);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('value').textContent).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('persists setTheme() to localStorage and updates the html attribute', async () => {
    setMatchMedia(false);
    const user = userEvent.setup();
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await user.click(screen.getByText('force dark'));
    expect(screen.getByTestId('value').textContent).toBe('dark');
    expect(localStorage.getItem('phog-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggle() flips between light and dark', async () => {
    setMatchMedia(false);
    const user = userEvent.setup();
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('value').textContent).toBe('light');
    await user.click(screen.getByText('toggle'));
    expect(screen.getByTestId('value').textContent).toBe('dark');
    await user.click(screen.getByText('toggle'));
    expect(screen.getByTestId('value').textContent).toBe('light');
  });

  it('follows OS theme changes when the user has not committed manually', () => {
    const mq = setMatchMedia(false);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('value').textContent).toBe('light');
    act(() => mq.set(true));
    expect(screen.getByTestId('value').textContent).toBe('dark');
  });

  it('does NOT follow OS theme changes once the user has set a theme', async () => {
    const mq = setMatchMedia(false);
    const user = userEvent.setup();
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await user.click(screen.getByText('force light'));
    act(() => mq.set(true));
    expect(screen.getByTestId('value').textContent).toBe('light');
  });

  it('sets data-theme-transitioning briefly during a theme change', async () => {
    vi.useFakeTimers();
    setMatchMedia(false);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await user.click(screen.getByText('force dark'));
    // Attribute is set immediately on toggle
    expect(document.documentElement.hasAttribute('data-theme-transitioning')).toBe(true);
    // Removed after ~220ms
    act(() => vi.advanceTimersByTime(230));
    expect(document.documentElement.hasAttribute('data-theme-transitioning')).toBe(false);
    vi.useRealTimers();
  });
});
