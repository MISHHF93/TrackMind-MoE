import type { NotificationInboxDto } from '@trackmind/shared';

const now = () => new Date().toISOString();

type NotificationRecord = NotificationInboxDto['notifications'][number] & { id: string };

export class NotificationFramework {
  private notifications: NotificationRecord[] = [];

  publish(input: Omit<NotificationRecord, 'id' | 'createdAt' | 'status'>): NotificationRecord {
    const record: NotificationRecord = {
      ...input,
      id: `notif-${Date.now().toString(36)}`,
      status: 'unread',
      createdAt: now(),
    };
    this.notifications.unshift(record);
    return record;
  }

  inbox(targetRole?: string): NotificationInboxDto {
    const filtered = targetRole
      ? this.notifications.filter((n) => n.targetRoles.includes(targetRole) || n.targetRoles.includes('*'))
      : this.notifications;
    return { generatedAt: now(), notifications: filtered.slice(0, 50), mock: false };
  }

  acknowledge(id: string): boolean {
    const n = this.notifications.find((item) => item.id === id);
    if (!n) return false;
    n.status = 'acknowledged';
    return true;
  }
}

export const notificationFramework = new NotificationFramework();
