'use client';

import { useSyncExternalStore } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

type Theme = 'system' | 'light' | 'dark';
const eventName = 'auditsay-theme-change';
const themeKey = 'auditsay-theme';

function preference(): Theme {
  const value = document.documentElement.dataset.themePreference;
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'light';
}

function apply(theme: Theme) {
  document.documentElement.dataset.themePreference = theme;
  document.documentElement.dataset.theme = theme === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;
}

function subscribe(callback: () => void) {
  const media = matchMedia('(prefers-color-scheme: dark)');
  const syncSystem = () => { apply(preference()); callback(); };
  const syncStorage = (event: StorageEvent) => {
    if (event.key !== themeKey && event.key !== null) return;
    apply(event.newValue === 'light' || event.newValue === 'dark' || event.newValue === 'system' ? event.newValue : 'light');
    callback();
  };
  media.addEventListener('change', syncSystem);
  window.addEventListener(eventName, callback);
  window.addEventListener('storage', syncStorage);
  return () => {
    media.removeEventListener('change', syncSystem);
    window.removeEventListener(eventName, callback);
    window.removeEventListener('storage', syncStorage);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme>(subscribe, preference, () => 'light');
  const next: Theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
  const labels = { system: '시스템', light: '라이트', dark: '다크' };
  const Icon = theme === 'system' ? Monitor : theme === 'light' ? Sun : Moon;
  return <button type="button" className="inline-flex size-11 shrink-0 items-center justify-center rounded-control border border-card-border bg-card text-muted hover:text-foreground"
    aria-label={`화면 테마: ${labels[theme]}. ${labels[next]} 모드로 전환`}
    title={`현재 ${labels[theme]} · 클릭하면 ${labels[next]}`}
    onClick={() => {
      apply(next);
      try { localStorage.setItem(themeKey, next); } catch { /* Keep the theme in memory when storage is unavailable. */ }
      window.dispatchEvent(new Event(eventName));
    }}><Icon aria-hidden="true" className="size-4" /></button>;
}
