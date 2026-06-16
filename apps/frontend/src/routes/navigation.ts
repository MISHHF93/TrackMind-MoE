export function currentPathname(): string {
  return typeof window === 'undefined' ? '/' : window.location.pathname;
}

export function currentSearch(): string {
  return typeof window === 'undefined' ? '' : window.location.search;
}

export function navigate(path: string): void {
  if (typeof window === 'undefined') return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(popStateEvent());
}

function popStateEvent(): Event {
  return typeof PopStateEvent === 'function' ? new PopStateEvent('popstate') : new Event('popstate');
}
