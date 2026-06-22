const devJsonStorageKey = 'trackmind-dev-mode';

export function isDevJsonEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return localStorage.getItem(devJsonStorageKey) === 'true';
  } catch {
    return false;
  }
}

export function setDevJsonEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(devJsonStorageKey, enabled ? 'true' : 'false');
  } catch {
    // ignore storage failures
  }
}

export function toggleDevJsonEnabled(): boolean {
  const next = !isDevJsonEnabled();
  setDevJsonEnabled(next);
  return next;
}
