import type { ApprovalToken } from '../approvals.js';
import { ApexApprovalGateway, type ApexMutationContext, type ApprovalEvidencePackage, type ApprovalRequiredActionRecord } from './approvalGateway.js';

export interface TicketRecord {
  ticketId: string;
  raceDayId: string;
  status: 'active' | 'refunded' | 'void';
  priceCents: number;
}

export interface PayoutRequestInput {
  payoutId: string;
  amountCents: number;
  recipientId: string;
  evidence: ApprovalEvidencePackage;
  context: ApexMutationContext;
}

export class FinanceService {
  private readonly tickets = new Map<string, TicketRecord>([
    ['ticket-1', { ticketId: 'ticket-1', raceDayId: 'race-day-1', status: 'active', priceCents: 2500 }],
  ]);
  private readonly payouts = new Map<string, unknown>();

  constructor(private readonly approvals: ApexApprovalGateway) {}

  ticketingState() {
    return {
      tickets: [...this.tickets.values()].map((ticket) => ({ ...ticket })),
      payouts: [...this.payouts.values()],
      payoutApproval: 'dual-control steward + finance',
    };
  }

  async requestPayout(input: PayoutRequestInput): Promise<ApprovalRequiredActionRecord> {
    return this.approvals.requestProtectedMutation({
      service: 'finance',
      operation: 'payout',
      action: 'payout',
      target: input.payoutId,
      payload: { amountCents: input.amountCents, recipientId: input.recipientId },
      context: input.context,
      evidence: input.evidence,
      execute: (_token: ApprovalToken) => {
        const result = { payoutId: input.payoutId, amountCents: input.amountCents, recipientId: input.recipientId, status: 'released', dualControl: ['steward', 'finance'] };
        this.payouts.set(input.payoutId, result);
        return result;
      },
    });
  }
}

export function createFinanceService(gateway = new ApexApprovalGateway()) {
  return new FinanceService(gateway);
}
