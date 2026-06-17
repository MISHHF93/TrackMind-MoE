import type { IncidentDto } from '@trackmind/shared';
import { createRepository, type KeyValueRepository } from '../repository/index.js';

const now = () => new Date().toISOString();

export class IncidentService {
  readonly incidents: KeyValueRepository<IncidentDto & { id: string }>;

  constructor() {
    this.incidents = createRepository([
      {
        id: 'inc-1',
        tenantId: 'trackmind',
        racetrackId: 'main-track',
        title: 'Loose horse near paddock',
        description: 'Horse broke halter near paddock gate B.',
        severity: 'high',
        status: 'triaged',
        category: 'safety',
        reportedBy: 'security-officer',
        assignedTo: 'incident-commander',
        timeline: [{ at: now(), action: 'reported', actor: 'security-officer' }],
        auditIds: ['audit-inc-1'],
        eventIds: ['event-inc-1'],
        createdAt: now(),
        updatedAt: now(),
        mock: false,
      },
    ]);
  }

  list(): IncidentDto[] {
    return this.incidents.list();
  }

  get(id: string): IncidentDto | undefined {
    return this.incidents.get(id);
  }

  create(input: Omit<IncidentDto, 'id' | 'createdAt' | 'updatedAt' | 'timeline' | 'auditIds' | 'eventIds' | 'mock'>): IncidentDto {
    const id = `inc-${Date.now().toString(36)}`;
    const record: IncidentDto = {
      ...input,
      id,
      timeline: [{ at: now(), action: 'reported', actor: input.reportedBy }],
      auditIds: [`audit-${id}`],
      eventIds: [`event-${id}`],
      createdAt: now(),
      updatedAt: now(),
      mock: false,
    };
    this.incidents.upsert({ ...record, id });
    return record;
  }

  update(id: string, patch: Partial<Pick<IncidentDto, 'status' | 'severity' | 'assignedTo' | 'description'>> & { note?: string; actor?: string }): IncidentDto {
    const existing = this.incidents.get(id);
    if (!existing) throw new Error(`Incident not found: ${id}`);
    const timeline = [...existing.timeline];
    if (patch.status) timeline.push({ at: now(), action: `status:${patch.status}`, actor: patch.actor ?? 'system', note: patch.note });
    const updated: IncidentDto = {
      ...existing,
      ...patch,
      timeline,
      updatedAt: now(),
    };
    this.incidents.upsert({ ...updated, id });
    return updated;
  }
}
