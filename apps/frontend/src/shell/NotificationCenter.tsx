import { useEffect, useState, type ReactElement } from 'react';
import { getJson } from '@/api/client';
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
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void getJson<{ notifications?: NotificationItem[] }>(`/notifications/inbox?role=${session.role}`)
      .then((result) => {
        if (result.status === 'ready' && result.data) {
          setItems((result.data.notifications ?? []).filter((n) => n.status === 'unread'));
        }
      })
      .catch(() => setItems([]));
  }, [session.role]);

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
