import type { ApprovalDto } from '@trackmind/shared';
import type { CentralizedApprovalService, ControlledActionRequest } from '../approvals.js';
import { createRepository } from '../repository/index.js';

const now = () => new Date().toISOString();

type StoredApproval = ApprovalDto & { id: string };

export class DurableApprovalStore {
  private store = createRepository<StoredApproval>([]);

  constructor(private approvalService: CentralizedApprovalService) {}

  syncFromService(): StoredApproval[] {
    return this.approvalService.allRequests().map((req) => {
      const dto: StoredApproval = {
        id: req.id,
        approvalRequestId: req.id,
        action: req.action,
        target: req.target,
        tenantId: req.tenantId,
        racetrackId: req.racetrackId,
        requestedBy: req.requestedBy,
        status: req.status,
        canonicalStatus: req.status,
        createdAt: req.createdAt,
        expiresAt: req.expiresAt,
        evidence: req.evidence ?? [],
        mock: false,
        approverRoles: req.escalatedToRoles ?? [],
        approvalSteps: [],
        escalation: [],
        auditLinkage: { auditIds: [], eventIds: [], correlationId: req.id },
      };
      this.store.upsert(dto);
      return dto;
    });
  }

  list(): ApprovalDto[] {
    const synced = this.syncFromService();
    const existing = this.store.list();
    const ids = new Set(synced.map((s) => s.id));
    return [...synced, ...existing.filter((e) => !ids.has(e.id))];
  }

  processExpirations(): number {
    const expired = this.list().filter((a) => a.expiresAt && a.expiresAt < now() && a.status === 'pending');
    for (const approval of expired) {
      this.store.upsert({ ...approval, id: approval.id, status: 'expired', canonicalStatus: 'expired' });
    }
    return expired.length;
  }
}
