import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';

const STORAGE_KEY = 'gai.theme';
const CHANGE_EVENT = 'gai-theme-change';
let memoryPreference: ThemePreference = 'system';

function preference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch { return memoryPreference; }
}
function resolve(value: ThemePreference): Theme {
  return value === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : value;
}
function snapshot() { const value = preference(); return `${value}:${resolve(value)}`; }
function applyTheme() {
  const theme = resolve(preference());
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#000d20' : '#f9fafb');
}
function subscribe(notify: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const update = () => { applyTheme(); notify(); };
  const storage = (event: StorageEvent) => { if (event.key === STORAGE_KEY || event.key === null) update(); };
  window.addEventListener(CHANGE_EVENT, update);
  window.addEventListener('storage', storage);
  media.addEventListener('change', update);
  applyTheme();
  return () => {
    window.removeEventListener(CHANGE_EVENT, update);
    window.removeEventListener('storage', storage);
    media.removeEventListener('change', update);
  };
}
function setTheme(value: ThemePreference) {
  memoryPreference = value;
  try { localStorage.setItem(STORAGE_KEY, value); } catch { /* Applies for this session if persistence is unavailable. */ }
  applyTheme();
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
export function useTheme() {
  const state = useSyncExternalStore(subscribe, snapshot, () => 'system:light');
  const [themePreference, theme] = state.split(':') as [ThemePreference, Theme];
  return { theme, preference: themePreference, setTheme, toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark') };
}
