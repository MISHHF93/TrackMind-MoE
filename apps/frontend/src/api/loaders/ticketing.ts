import type { FinanceTicketingWorkspaceDto } from '@trackmind/shared';
import { getJson } from '../client';
import { apiPaths } from '../paths';
import type { ConsolePayload } from '../../design/opsTypes';
import { countBarChart } from './charts';
import { loadSharedContext } from './commonContext';
import { compactLifecycleLanes, recordsLifecycleLane } from './lifecycle';
import { countMetric, formatCurrency, navAction, requireReady, textMetric } from './util';

export async function loadTicketingConsole(): Promise<ConsolePayload> {
  const [ticketing, shared] = await Promise.all([
    getJson<FinanceTicketingWorkspaceDto>(apiPaths.finance.ticketing),
    loadSharedContext(),
  ]);
  const data = requireReady(ticketing, 'Ticketing workspace');
  const summary = data.summary;
  const tickets = data.tickets ?? [];
  const ticketStatusCounts: Record<string, number> = {};
  for (const ticket of tickets) {
    ticketStatusCounts[ticket.status] = (ticketStatusCounts[ticket.status] ?? 0) + 1;
  }

  const ticketLifecycleLane = recordsLifecycleLane(
    'ticket-readiness-lifecycle',
    'Ticket readiness lifecycle',
    'Ticket ledger mapped by status — payment capture stays backend-governed.',
    (data.tickets ?? []).slice(0, 12).map((ticket) => ({
      id: ticket.ticketId,
      label: `Ticket ${ticket.ticketId}`,
      status: ticket.status,
      summary: `${formatCurrency(ticket.priceCents)} · ${ticket.raceDayId}`,
      evidence: ['FinanceTicketingWorkspaceDto', ticket.ticketId],
      actions: [navAction('Audit note', `/audit?ticket=${encodeURIComponent(ticket.ticketId)}`, 'Ticket context in audit console.')],
    })),
  );

  return {
    routeId: 'ticketing',
    title: 'Ticketing Desk',
    mission: 'Review ticket ledger and race-day coverage — payment capture never runs from this console.',
    posture: summary.activeTickets > 0 ? 'ready' : 'advisory',
    postureLabel: `${summary.activeTickets} active tickets`,
    generatedAt: data.generatedAt,
    source: ticketing.source,
    primaryActions: [
      navAction('Finance review', '/finance', 'Payout and dual-control lane.', 'primary'),
      navAction('Audit evidence', '/audit', 'Ticket audit trail.'),
    ],
    lifecycleLanes: compactLifecycleLanes([ticketLifecycleLane]),
    charts: [
      countBarChart(
        'ticket-status-bar',
        'Ticket status',
        'Ticket ledger grouped by status.',
        Object.entries(ticketStatusCounts).map(([label, value]) => ({
          id: `ticket-${label}`,
          label,
          value,
          posture: label === 'active' ? 'ready' : 'advisory',
        })),
        'tickets',
        navAction('Audit evidence', '/audit', 'Ticket audit trail.'),
      ),
    ],
    queues: [{
      id: 'ticket-ledger',
      title: 'Ticket ledger',
      items: (data.tickets ?? []).slice(0, 12).map((ticket) => ({
        id: ticket.ticketId,
        title: `Ticket ${ticket.ticketId}`,
        summary: `${ticket.status} · ${formatCurrency(ticket.priceCents)} · ${ticket.raceDayId}`,
        posture: ticket.status === 'active' ? 'ready' : 'advisory',
        evidence: ['FinanceTicketingWorkspaceDto', ticket.ticketId],
        actions: [navAction('Audit note', `/audit?ticket=${encodeURIComponent(ticket.ticketId)}`, 'Ticket context in audit console.')],
      })),
    }],
    metrics: [
      countMetric('Active tickets', summary.activeTickets, 'Live ticket count', 'ready'),
      textMetric('Face value', formatCurrency(summary.grossTicketRevenueCents), 'Not captured payment revenue', 'ready'),
      countMetric('Race days', summary.raceDayIds.length, 'Race days on ledger', 'ready'),
    ],
    advisories: shared.advisories,
    contextDegraded: shared.contextDegraded,
  };
}
