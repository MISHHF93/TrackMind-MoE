import type { NotificationInboxDto } from '@trackmind/shared';
import { alertPriorityFromSeverity, normalizeAlertSeverity, type TrackMindAlertPriority, type TrackMindAlertSeverity } from '@trackmind/shared';

const now = () => new Date().toISOString();

type NotificationSeverity = NotificationInboxDto['notifications'][number]['severity'];
type NotificationRecord = NotificationInboxDto['notifications'][number] & {
  id: string;
  priority?: TrackMindAlertPriority;
};

export type NotificationDeliveryChannel = 'in-app' | 'sse' | 'email-stub';

export type NotificationDeliveryResult = {
  channel: NotificationDeliveryChannel;
  delivered: boolean;
  detail?: string;
};

export interface NotificationDeliveryAdapter {
  channel: NotificationDeliveryChannel;
  deliver(record: NotificationRecord): NotificationDeliveryResult;
}

class InAppDeliveryAdapter implements NotificationDeliveryAdapter {
  readonly channel = 'in-app' as const;

  deliver(): NotificationDeliveryResult {
    return { channel: this.channel, delivered: true };
  }
}

class SseDeliveryAdapter implements NotificationDeliveryAdapter {
  readonly channel = 'sse' as const;
  private deliveredCount = 0;

  deliver(record: NotificationRecord): NotificationDeliveryResult {
    this.deliveredCount += 1;
    return {
      channel: this.channel,
      delivered: true,
      detail: `sse:event:${record.id}`,
    };
  }

  count(): number {
    return this.deliveredCount;
  }
}

class EmailStubDeliveryAdapter implements NotificationDeliveryAdapter {
  readonly channel = 'email-stub' as const;
  private queue: string[] = [];

  deliver(record: NotificationRecord): NotificationDeliveryResult {
    this.queue.unshift(record.id);
    return {
      channel: this.channel,
      delivered: true,
      detail: `email-stub:queued:${record.targetRoles.join(',')}`,
    };
  }

  queuedIds(): string[] {
    return [...this.queue];
  }
}

function inboxSeverity(severity: TrackMindAlertSeverity): NotificationSeverity {
  if (severity === 'advisory') return 'info';
  return severity;
}

export class NotificationFramework {
  private notifications: NotificationRecord[] = [];
  private adapters: NotificationDeliveryAdapter[];
  private deliveryLog: NotificationDeliveryResult[] = [];

  constructor(adapters: NotificationDeliveryAdapter[] = [
    new InAppDeliveryAdapter(),
    new SseDeliveryAdapter(),
    new EmailStubDeliveryAdapter(),
  ]) {
    this.adapters = adapters;
  }

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
    for (const adapter of this.adapters) {
      this.deliveryLog.unshift(adapter.deliver(record));
    }
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

  deliveryAdapters(): NotificationDeliveryChannel[] {
    return this.adapters.map((adapter) => adapter.channel);
  }

  deliveryStats(): Array<{ channel: NotificationDeliveryChannel; delivered: number }> {
    const totals = new Map<NotificationDeliveryChannel, number>();
    for (const result of this.deliveryLog) {
      if (!result.delivered) continue;
      totals.set(result.channel, (totals.get(result.channel) ?? 0) + 1);
    }
    return [...totals.entries()].map(([channel, delivered]) => ({ channel, delivered }));
  }
}

export const notificationFramework = new NotificationFramework();
