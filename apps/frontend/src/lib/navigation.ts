export function currentPathname(): string {
  return typeof window === 'undefined' ? '/' : window.location.pathname;
}

export function currentSearch(): string {
  return typeof window === 'undefined' ? '' : window.location.search;
}

export function popstate(): Event {
  return typeof PopStateEvent === 'function' ? new PopStateEvent('popstate') : new Event('popstate');
}

export function navigate(path: string): void {
  if (typeof window === 'undefined') return;
  if (!isSafeNavigationTarget(path)) return;
  const destination = new URL(path, window.location.origin);
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const next = `${destination.pathname}${destination.search}${destination.hash}`;
  if (current === next) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(popstate());
}

function isSafeNavigationTarget(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return false;
  try {
    const url = new URL(path, 'https://trackmind.local');
    return url.origin === 'https://trackmind.local';
  } catch {
    return false;
  }
}
