import type { FinanceTicketingWorkspaceDto } from '@trackmind/shared';
import { getJson } from '../client';
import { apiPaths } from '../paths';
import type { ConsolePayload } from '../../design/opsTypes';
import { countBarChart } from './charts';
import { loadSharedContext } from './commonContext';
import { compactLifecycleLanes, recordsLifecycleLane } from './lifecycle';
import { countMetric, formatCurrency, navAction, requireReady, textMetric } from './util';

export async function loadFinanceConsole(): Promise<ConsolePayload> {
  const [finance, shared] = await Promise.all([
    getJson<FinanceTicketingWorkspaceDto>(apiPaths.finance.ticketing),
    loadSharedContext(),
  ]);
  const data = requireReady(finance, 'Finance workspace');
  const payouts = data.payouts ?? [];
  const posture = payouts.some((p) => p.status === 'pending') ? 'watch' : 'ready';
  const payoutStatusCounts: Record<string, number> = {};
  for (const payout of payouts) {
    payoutStatusCounts[payout.status] = (payoutStatusCounts[payout.status] ?? 0) + 1;
  }

  const payoutLifecycleLane = recordsLifecycleLane(
    'payout-workflow-lifecycle',
    'Payout workflow lifecycle',
    'Payout records mapped by release status — dual-control review only.',
    payouts.slice(0, 12).map((payout) => ({
      id: payout.payoutId,
      label: `Payout ${payout.payoutId}`,
      status: payout.status,
      summary: `${formatCurrency(payout.amountCents)} · dual ${(payout.dualControl ?? []).join(' + ') || 'n/a'}`,
      evidence: ['FinanceTicketingWorkspaceDto', payout.payoutId],
      actions: [
        navAction('Review approvals', '/approvals', 'Payout approval context.', 'primary'),
        navAction('Audit note', `/audit?payout=${encodeURIComponent(payout.payoutId)}`, 'Payout audit context.'),
      ],
    })),
  );

  return {
    routeId: 'finance',
    title: 'Finance & Payout Review',
    mission: 'Dual-control payout review — no release without steward and finance approval in backend workflows.',
    posture,
    postureLabel: data.payoutApproval ?? 'Dual control required',
    generatedAt: data.generatedAt,
    source: finance.source,
    primaryActions: [
      navAction('Approval queue', '/approvals', 'Payout approval backlog.', 'primary'),
      navAction('Ticketing desk', '/ticketing', 'Ticket face value context.'),
      navAction('Audit evidence', '/audit', 'Payout audit trail.'),
    ],
    lifecycleLanes: compactLifecycleLanes([payoutLifecycleLane]),
    charts: [
      countBarChart(
        'payout-status-bar',
        'Payout status',
        'Payout records grouped by release status.',
        Object.entries(payoutStatusCounts).map(([label, value]) => ({
          id: `payout-${label}`,
          label,
          value,
          posture: label === 'pending' ? 'watch' : label === 'released' ? 'ready' : 'advisory',
        })),
        'payouts',
        navAction('Approval queue', '/approvals', 'Payout approval backlog.', 'primary'),
      ),
    ],
    queues: [{
      id: 'payout-queue',
      title: 'Payout records',
      items: payouts.slice(0, 12).map((payout) => ({
        id: payout.payoutId,
        title: `Payout ${payout.payoutId}`,
        summary: `${payout.status} · ${formatCurrency(payout.amountCents)} · dual ${(payout.dualControl ?? []).join(' + ') || 'n/a'}`,
        posture: payout.status === 'released' ? 'watch' : 'ready',
        evidence: ['FinanceTicketingWorkspaceDto', payout.payoutId],
        actions: [
          navAction('Review approvals', '/approvals', 'Payout approval context.', 'primary'),
          navAction('Audit note', `/audit?payout=${encodeURIComponent(payout.payoutId)}`, 'Payout audit context.'),
        ],
      })),
    }],
    metrics: [
      countMetric('Payout records', payouts.length, 'Released/pending payout read model', payouts.length ? 'watch' : 'ready'),
      textMetric('Ticket value', formatCurrency(data.summary.grossTicketRevenueCents), 'Active ticket face value under review', 'ready'),
      textMetric('Execution', 'Blocked', 'Payout release is not a frontend action', 'critical'),
    ],
    advisories: shared.advisories,
    contextDegraded: shared.contextDegraded,
  };
}
