import { useState, type ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getJson } from '@/api/client';
import { apiPaths } from '@/api/paths';
import { useTenantSession } from '@/auth/TenantSessionProvider';

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  severity: string;
  status: string;
};

export function NotificationCenter(): ReactElement {
  const { session } = useTenantSession();
  const [open, setOpen] = useState(false);
  // Live inbox feed: /notifications/inbox
  const inboxPath = `${apiPaths.notifications.inbox}?role=${session.role}`;

  const inboxQuery = useQuery({
    queryKey: ['api', inboxPath, session.sessionKey],
    queryFn: async () => {
      const result = await getJson<{ notifications?: NotificationItem[] }>(inboxPath);
      if (result.status !== 'ready' || !result.data) return [] as NotificationItem[];
      return (result.data.notifications ?? []).filter((notification) => notification.status === 'unread');
    },
    staleTime: 30_000,
    retry: 1,
  });

  const items = inboxQuery.data ?? [];

  return (
    <div className="relative">
      <button
        type="button"
        className="rounded-md border px-3 py-1.5 text-sm"
        aria-label="Notifications"
        onClick={() => setOpen((value) => !value)}
      >
        Notifications {items.length > 0 ? `(${items.length})` : ''}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-md border bg-white p-3 shadow-lg">
          {items.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No unread notifications.</p>
          ) : (
            <ul className="space-y-2">
              {items.slice(0, 5).map((item) => (
                <li key={item.id} className="text-sm">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-[var(--muted-foreground)]">{item.message}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
