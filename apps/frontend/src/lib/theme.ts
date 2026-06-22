import type { OperatorThemePreference } from '@trackmind/shared';

export type ThemeName = 'light' | 'dark';

const storageKey = 'trackmind-theme';

function systemTheme(): ThemeName {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(preference: OperatorThemePreference = 'system'): ThemeName {
  if (preference === 'system') return systemTheme();
  return preference;
}

export function loadTheme(preference: OperatorThemePreference = 'system'): ThemeName {
  const stored = localStorage.getItem(storageKey);
  if (stored === 'light' || stored === 'dark') return stored;
  return resolveTheme(preference);
}

export function persistTheme(theme: ThemeName): void {
  localStorage.setItem(storageKey, theme);
}

export function applyTheme(theme: ThemeName): void {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
}

export function applyThemePreference(preference: OperatorThemePreference): void {
  applyTheme(resolveTheme(preference));
}

export function applyLocalePreference(locale: string): void {
  document.documentElement.lang = locale.split('-')[0] || 'en';
}
