import { routeForPathname } from './routes';

export function currentPathname(): string {
  return typeof window === 'undefined' ? '/' : window.location.pathname;
}

export function currentSearch(): string {
  return typeof window === 'undefined' ? '' : window.location.search;
}

export function navigate(path: string): void {
  if (typeof window === 'undefined') return;
  if (!isSafeNavigationTarget(path)) return;
  const destination = new URL(path, window.location.origin);
  const current = `${window.location.pathname}${window.location.search}`;
  const next = `${destination.pathname}${destination.search}`;
  if (current === next) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(popStateEvent());
}

function popStateEvent(): Event {
  return typeof PopStateEvent === 'function' ? new PopStateEvent('popstate') : new Event('popstate');
}

function isSafeNavigationTarget(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return false;
  try {
    const url = new URL(path, 'https://trackmind.local');
    return url.origin === 'https://trackmind.local' && Boolean(routeForPathname(url.pathname));
  } catch {
    return false;
  }
}
