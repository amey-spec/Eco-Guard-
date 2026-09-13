import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

const STORAGE_KEY = 'ecoguard_theme';

/** The three supported appearance preferences, in menu order. */
export const THEME_VALUES = ['light', 'dark', 'system'];

const THEME_SET = new Set(THEME_VALUES);

/** Allowed preferences — `system` follows the OS setting. */
function getInitialTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return THEME_SET.has(saved) ? saved : 'system';
}

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

const APP_THEME_COLORS = { light: '#fbfaf6', dark: '#0c110d' };

export const ThemeProvider = ({ children }) => {
  // The user's choice ("light" | "dark" | "system"); the OS signal that
  // drives the resolved theme while following the system.
  const [theme, setTheme] = useState(getInitialTheme);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // Keep the OS signal fresh so "system" reacts live to OS changes.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setSystemDark(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange); // older Safari
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  const isDark = theme === 'system' ? systemDark : theme === 'dark';

  // Paint: class + native UI + browser chrome colour. While the theme is
  // actually changing, a short-lived `theme-transition` class lets CSS ease
  // every colour property instead of snapping (see index.css).
  const firstPaint = useRef(true);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    root.style.colorScheme = isDark ? 'dark' : 'light';
    const content = APP_THEME_COLORS[isDark ? 'dark' : 'light'];
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.removeAttribute('media');
      meta.setAttribute('content', content);
    });

    // No animation on first paint or when the app merely boots into a theme.
    if (firstPaint.current) {
      firstPaint.current = false;
      return undefined;
    }
    root.classList.add('theme-transition');
    const timer = setTimeout(() => root.classList.remove('theme-transition'), 450);
    return () => {
      clearTimeout(timer);
      root.classList.remove('theme-transition');
    };
  }, [isDark]);

  // Remember the preference (never the derived state).
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setThemePreference = useCallback((next) => {
    if (THEME_SET.has(next)) setTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    // A plain toggle flips between day and night from wherever we are now,
    // "leaving" system mode for an explicit light/dark choice.
    setTheme((prev) => {
      const nowDark = prev === 'system' ? systemPrefersDark() : prev === 'dark';
      return nowDark ? 'light' : 'dark';
    });
  }, []);

  const value = {
    theme, // preference: 'light' | 'dark' | 'system'
    isDark, // resolved state actually on screen
    setTheme: setThemePreference,
    toggleTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
