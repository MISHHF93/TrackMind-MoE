export type ThemeName = 'light';

const storageKey = 'trackmind-theme';

export function loadTheme(): ThemeName {
  localStorage.setItem(storageKey, 'light');
  return 'light';
}

export function persistTheme(_theme: ThemeName): void {
  localStorage.setItem(storageKey, 'light');
}

export function applyTheme(_theme: ThemeName): void {
  document.documentElement.setAttribute('data-theme', 'light');
  document.documentElement.style.colorScheme = 'light';
}
