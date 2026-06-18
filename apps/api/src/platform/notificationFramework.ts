import type { NotificationInboxDto } from '@trackmind/shared';
import { alertPriorityFromSeverity, normalizeAlertSeverity, type TrackMindAlertPriority, type TrackMindAlertSeverity } from '@trackmind/shared';

const now = () => new Date().toISOString();

type NotificationSeverity = NotificationInboxDto['notifications'][number]['severity'];
type NotificationRecord = NotificationInboxDto['notifications'][number] & {
  id: string;
  priority?: TrackMindAlertPriority;
};

function inboxSeverity(severity: TrackMindAlertSeverity): NotificationSeverity {
  if (severity === 'advisory') return 'info';
  return severity;
}

export class NotificationFramework {
  private notifications: NotificationRecord[] = [];

  publish(input: Omit<NotificationRecord, 'id' | 'createdAt' | 'status'>): NotificationRecord {
    const normalized = normalizeAlertSeverity(input.severity);
    const record: NotificationRecord = {
      ...input,
      severity: inboxSeverity(normalized),
      priority: input.priority ?? alertPriorityFromSeverity(normalized),
      id: `notif-${Date.now().toString(36)}`,
      status: 'unread',
      createdAt: now(),
    };
    this.notifications.unshift(record);
    return record;
  }

  publishOperational(input: {
    category: NotificationRecord['category'];
    title: string;
    message: string;
    targetRoles: string[];
    severity?: TrackMindAlertSeverity | string;
    priority?: TrackMindAlertPriority;
    correlationId?: string;
  }): NotificationRecord {
    return this.publish({
      category: input.category,
      title: input.title,
      message: input.message,
      targetRoles: input.targetRoles,
      severity: inboxSeverity(normalizeAlertSeverity(input.severity)),
      priority: input.priority,
    });
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

  count(): number {
    return this.notifications.length;
  }
}

export const notificationFramework = new NotificationFramework();
