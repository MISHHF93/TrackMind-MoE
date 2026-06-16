export type ThemeName = 'light' | 'dark';

const themeStorageKey = 'trackmind-theme';

export function loadTheme(): ThemeName {
  const storedTheme = readStoredTheme();
  return storedTheme ?? 'light';
}

export function applyTheme(theme: ThemeName): void {
  const normalizedTheme = normalizeTheme(theme) ?? 'light';
  if (typeof document === 'undefined' || !document.documentElement) return;
  document.documentElement.dataset.theme = normalizedTheme;
  document.documentElement.style.colorScheme = normalizedTheme;
}

export function persistTheme(theme: ThemeName): void {
  const normalizedTheme = normalizeTheme(theme);
  if (!normalizedTheme || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(themeStorageKey, normalizedTheme);
  } catch {
    // Browsers can disable storage; keep the in-memory theme active.
  }
}

export function toggleThemeName(theme: ThemeName): ThemeName {
  return theme === 'dark' ? 'light' : 'dark';
}

function readStoredTheme(): ThemeName | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const value = window.localStorage.getItem(themeStorageKey);
    return normalizeTheme(value);
  } catch {
    return undefined;
  }
}

function normalizeTheme(value: unknown): ThemeName | undefined {
  return value === 'light' || value === 'dark' ? value : undefined;
}
