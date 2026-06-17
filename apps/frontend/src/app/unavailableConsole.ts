import type { AppRoute } from '../routes/routes';
import type { ConsolePayload } from '../design/opsTypes';
import { navAction } from '../api/loaders/util';

export function createUnavailableConsole(route: AppRoute, message: string): ConsolePayload {
  return {
    routeId: route.id,
    title: route.label,
    mission: route.dataSource,
    posture: 'critical',
    postureLabel: 'Backend unavailable',
    source: 'documented-stub',
    primaryActions: [
      navAction('Command center', '/dashboard', 'Return to command center.'),
      navAction('Service status', '/admin', 'Check platform health metadata.'),
    ],
    queues: [{
      id: 'availability',
      title: 'Connection status',
      items: [{
        id: 'backend-unavailable',
        title: 'Backend connection unavailable',
        summary: message,
        posture: 'critical',
        evidence: route.backendPaths.slice(0, 4),
        actions: [navAction('Retry navigation', route.path, 'Reload this console after backend is reachable.')],
      }],
    }],
    metrics: [{
      label: 'API status',
      value: 'Unavailable',
      detail: 'Set VITE_TRACKMIND_API_BASE_URL or start the API on port 4000.',
      posture: 'critical',
    }],
    contextDegraded: [message],
  };
}
