import type { NotificationInboxDto } from '@trackmind/shared';
import { alertPriorityFromSeverity, normalizeAlertSeverity, type TrackMindAlertPriority, type TrackMindAlertSeverity } from '@trackmind/shared';

const now = () => new Date().toISOString();

type NotificationSeverity = NotificationInboxDto['notifications'][number]['severity'];
type NotificationRecord = NotificationInboxDto['notifications'][number] & {
  id: string;
  priority?: TrackMindAlertPriority;
};

export type NotificationDeliveryChannel = 'in-app' | 'email-stub' | 'webhook-stub';

export type NotificationDeliveryResult = {
  channel: NotificationDeliveryChannel;
  delivered: boolean;
  detail?: string;
};

export type NotificationDeliveryAuditEntry = NotificationDeliveryResult & {
  notificationId: string;
  dispatchedAt: string;
};

export type NotificationDispatchInput = {
  category: NotificationRecord['category'];
  title: string;
  message: string;
  targetRoles: string[];
  severity?: TrackMindAlertSeverity | NotificationSeverity | string;
  priority?: TrackMindAlertPriority;
  correlationId?: string;
  channels?: NotificationDeliveryChannel[];
};

export type NotificationDispatchResult = {
  notification: NotificationRecord;
  delivery: NotificationDeliveryAuditEntry[];
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

class WebhookStubDeliveryAdapter implements NotificationDeliveryAdapter {
  readonly channel = 'webhook-stub' as const;
  private payloads: Array<{ notificationId: string; endpoint: string }> = [];

  deliver(record: NotificationRecord): NotificationDeliveryResult {
    const endpoint = `/api/v1/notifications/webhooks/delivery-stub/${record.category}`;
    this.payloads.unshift({ notificationId: record.id, endpoint });
    return {
      channel: this.channel,
      delivered: true,
      detail: `webhook-stub:POST:${endpoint}`,
    };
  }

  postedPayloads(): Array<{ notificationId: string; endpoint: string }> {
    return [...this.payloads];
  }
}

function inboxSeverity(severity: TrackMindAlertSeverity): NotificationSeverity {
  if (severity === 'advisory') return 'info';
  return severity;
}

export class NotificationFramework {
  private notifications: NotificationRecord[] = [];
  private adapters: NotificationDeliveryAdapter[];
  private deliveryAudit: NotificationDeliveryAuditEntry[] = [];

  constructor(adapters: NotificationDeliveryAdapter[] = [
    new InAppDeliveryAdapter(),
    new EmailStubDeliveryAdapter(),
    new WebhookStubDeliveryAdapter(),
  ]) {
    this.adapters = adapters;
  }

  dispatch(input: NotificationDispatchInput): NotificationDispatchResult {
    const record = this.createRecord(input);
    this.notifications.unshift(record);
    const delivery = this.deliverRecord(record, input.channels);
    return { notification: record, delivery };
  }

  publish(input: Omit<NotificationRecord, 'id' | 'createdAt' | 'status'>): NotificationRecord {
    return this.dispatch({
      category: input.category,
      title: input.title,
      message: input.message,
      targetRoles: input.targetRoles,
      severity: input.severity,
      priority: input.priority,
    }).notification;
  }

  publishOperational(input: {
    category: NotificationRecord['category'];
    title: string;
    message: string;
    targetRoles: string[];
    severity?: TrackMindAlertSeverity | string;
    priority?: TrackMindAlertPriority;
    correlationId?: string;
    channels?: NotificationDeliveryChannel[];
  }): NotificationRecord {
    return this.dispatch({
      category: input.category,
      title: input.title,
      message: input.message,
      targetRoles: input.targetRoles,
      severity: input.severity,
      priority: input.priority,
      correlationId: input.correlationId,
      channels: input.channels,
    }).notification;
  }

  redispatch(notificationId: string, channels?: NotificationDeliveryChannel[]): NotificationDeliveryAuditEntry[] | undefined {
    const record = this.notifications.find((item) => item.id === notificationId);
    if (!record) return undefined;
    return this.deliverRecord(record, channels);
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
    for (const entry of this.deliveryAudit) {
      if (!entry.delivered) continue;
      totals.set(entry.channel, (totals.get(entry.channel) ?? 0) + 1);
    }
    return [...totals.entries()].map(([channel, delivered]) => ({ channel, delivered }));
  }

  deliveryAuditTrail(notificationId?: string): NotificationDeliveryAuditEntry[] {
    const filtered = notificationId
      ? this.deliveryAudit.filter((entry) => entry.notificationId === notificationId)
      : this.deliveryAudit;
    return filtered.slice(0, 100);
  }

  private createRecord(input: NotificationDispatchInput): NotificationRecord {
    const normalized = normalizeAlertSeverity(input.severity);
    return {
      category: input.category,
      title: input.title,
      message: input.message,
      targetRoles: input.targetRoles,
      severity: inboxSeverity(normalized),
      priority: input.priority ?? alertPriorityFromSeverity(normalized),
      id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'unread',
      createdAt: now(),
    };
  }

  private deliverRecord(record: NotificationRecord, channels?: NotificationDeliveryChannel[]): NotificationDeliveryAuditEntry[] {
    const selected = channels?.length
      ? this.adapters.filter((adapter) => channels.includes(adapter.channel))
      : this.adapters;
    const delivery: NotificationDeliveryAuditEntry[] = [];
    for (const adapter of selected) {
      const result = adapter.deliver(record);
      const entry: NotificationDeliveryAuditEntry = {
        ...result,
        notificationId: record.id,
        dispatchedAt: now(),
      };
      this.deliveryAudit.unshift(entry);
      delivery.push(entry);
    }
    return delivery;
  }
}

export const notificationFramework = new NotificationFramework();
