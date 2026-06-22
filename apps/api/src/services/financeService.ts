import type { ApprovalToken } from '../approvals.js';
import { ApexApprovalGateway, type ApexMutationContext, type ApprovalEvidencePackage, type ApprovalRequiredActionRecord } from './approvalGateway.js';
import type { FinanceTicketingWorkspaceDto } from '@trackmind/shared';

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

type FinancePayoutRecord = FinanceTicketingWorkspaceDto['payouts'][number];

export class FinanceService {
  private readonly tickets = new Map<string, TicketRecord>([
    ['ticket-1', { ticketId: 'ticket-1', raceDayId: 'race-day-1', status: 'active', priceCents: 2500 }],
    ['ticket-2', { ticketId: 'ticket-2', raceDayId: 'race-day-1', status: 'active', priceCents: 4500 }],
    ['ticket-3', { ticketId: 'ticket-3', raceDayId: 'race-day-2', status: 'refunded', priceCents: 3200 }],
  ]);
  private readonly payouts = new Map<string, FinancePayoutRecord>();

  constructor(private readonly approvals: ApexApprovalGateway) {}

  ticketingState(generatedAt = new Date().toISOString()): FinanceTicketingWorkspaceDto {
    const tickets = [...this.tickets.values()].map((ticket) => ({ ...ticket }));
    const payouts = [...this.payouts.values()].map((payout) => ({ ...payout, dualControl: [...payout.dualControl] }));
    return {
      generatedAt,
      tickets,
      payouts,
      summary: {
        activeTickets: tickets.filter((ticket) => ticket.status === 'active').length,
        refundedTickets: tickets.filter((ticket) => ticket.status === 'refunded').length,
        voidTickets: tickets.filter((ticket) => ticket.status === 'void').length,
        grossTicketRevenueCents: tickets.filter((ticket) => ticket.status === 'active').reduce((sum, ticket) => sum + ticket.priceCents, 0),
        protectedPayouts: payouts.length,
        raceDayIds: [...new Set(tickets.map((ticket) => ticket.raceDayId))],
      },
      payoutApproval: 'dual-control steward + finance',
      protectedActions: ['payout'],
      evidence: ['finance-service:ticketing-state', 'approval-gateway:payout'],
      mock: false,
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
        const result: FinancePayoutRecord = { payoutId: input.payoutId, amountCents: input.amountCents, recipientId: input.recipientId, status: 'released', dualControl: ['steward', 'finance-manager'] };
        this.payouts.set(input.payoutId, result);
        return result;
      },
    });
  }
}

export function createFinanceService(gateway = new ApexApprovalGateway()) {
  return new FinanceService(gateway);
}
