import type { RaceDayEventType } from '@trackmind/shared';

export interface RaceDayEvent<T = unknown> {
  id: string;
  type: RaceDayEventType;
  occurredAt: string;
  payload: T;
  correlationId?: string;
}

type Handler<T = unknown> = (event: RaceDayEvent<T>) => void | Promise<void>;

export class InMemoryEventBus {
  private readonly handlers = new Map<RaceDayEventType, Handler[]>();
  private readonly history: RaceDayEvent[] = [];

  subscribe(type: RaceDayEventType, handler: Handler): () => void {
    const handlers = [...(this.handlers.get(type) ?? []), handler];
    this.handlers.set(type, handlers);
    return () => this.handlers.set(type, (this.handlers.get(type) ?? []).filter((candidate) => candidate !== handler));
  }

  async publish(event: RaceDayEvent): Promise<void> {
    this.history.push(event);
    for (const handler of this.handlers.get(event.type) ?? []) {
      await handler(event);
    }
  }

  events(type?: RaceDayEventType): RaceDayEvent[] {
    return type ? this.history.filter((event) => event.type === type) : [...this.history];
  }
}
