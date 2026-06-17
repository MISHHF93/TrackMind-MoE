import type { AuditEventDto } from '@trackmind/shared';
import { getJson } from '../client';
import { apiPaths } from '../paths';
import type { ConsolePayload, OpsPosture, QueueItem } from '../../design/opsTypes';
import { enrichConsoleWithSharedContext, loadSharedContext, postureFromCounts } from './commonContext';
import { liveEventTimeline } from './charts';
import { compactLifecycleLanes, recordsLifecycleLane } from './lifecycle';
import { countMetric, navAction, requireReady } from './util';

function eventPosture(severity: AuditEventDto['severity'] | undefined): OpsPosture {
  if (severity === 'critical') return 'critical';
  if (severity === 'warning') return 'watch';
  return 'advisory';
}

export async function loadAuditConsole(): Promise<ConsolePayload> {
  const [audit, shared] = await Promise.all([
    getJson<AuditEventDto[]>(apiPaths.audit.events),
    loadSharedContext('audit'),
  ]);
  const events = requireReady(audit, 'Audit events');
  const rows = Array.isArray(events) ? events : [];
  const critical = rows.filter((event) => event.severity === 'critical').length;
  const warning = rows.filter((event) => event.severity === 'warning').length;
  const actors = new Set(rows.map((event) => event.actor?.actorId ?? event.actorId ?? 'unknown-actor')).size;
  const posture = postureFromCounts(0, warning, critical);

  const ledgerItems: QueueItem[] = rows.map((event) => {
    const hash = event.integrityReference?.hash ?? event.hash;
    const previousHash = event.integrityReference?.previousHash ?? event.previousHash;
    const evidence = [hash, previousHash, ...(event.evidenceIds ?? [])].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    return {
      id: event.id,
      title: event.action ?? 'Audit event',
      summary: `Immutable audit record for ${event.entity?.entityType ?? event.subjectId ?? 'unknown entity'} with integrity references.`,
      posture: eventPosture(event.severity),
      evidence,
      actions: [
        navAction('Review approval context', '/approvals', 'Review approval records linked to this audit event.', 'primary'),
        navAction(
          'View audit context note',
          `/audit?event=${encodeURIComponent(event.id)}`,
          'Review this audit event with a navigation context note; records are not filtered by this link.',
        ),
      ],
    };
  });

  if (!ledgerItems.length) {
    ledgerItems.push({
      id: 'audit-empty-state',
      title: 'No audit events returned',
      summary: 'The live audit route is reachable and currently returns an empty ledger for this tenant and role.',
      posture: 'watch',
      evidence: ['AuditEventDto[]', apiPaths.audit.events],
      actions: [
        navAction('Review approvals', '/approvals', 'Review approval queue for pending governance actions.'),
        navAction('Review AI guardrails', '/settings', 'Inspect read-only AI guardrail posture.'),
      ],
    });
  }

  const chronologicalEvents = [...rows].sort(
    (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );

  const evidenceLifecycleLane = recordsLifecycleLane(
    'audit-evidence-lifecycle',
    'Audit evidence lifecycle',
    'Recent audit events in chronological order — integrity references, not card queue nodes.',
    chronologicalEvents.slice(0, 12).map((event) => {
      const hash = event.integrityReference?.hash ?? event.hash;
      return {
        id: event.id,
        label: event.action ?? 'Audit event',
        status: event.severity ?? 'info',
        summary: `${event.entity?.entityType ?? event.subjectId ?? 'unknown entity'} · ${event.timestamp}`,
        evidence: [hash, ...(event.evidenceIds ?? [])].filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
        actions: [
          navAction('Review approval context', '/approvals', 'Review approval records linked to this audit event.', 'primary'),
          navAction(
            'View audit context note',
            `/audit?event=${encodeURIComponent(event.id)}`,
            'Review this audit event with a navigation context note; records are not filtered by this link.',
          ),
        ],
      };
    }),
  );

  const base: ConsolePayload = {
    routeId: 'audit',
    title: 'Audit Evidence',
    mission: 'Preserve immutable audit events with hash references, actor linkage, and approval context.',
    posture,
    postureLabel: critical > 0 ? 'Critical audit signals' : rows.length ? 'Ledger active' : 'Ledger empty',
    source: audit.source,
    primaryActions: [
      navAction('Review approvals', '/approvals', 'Clear human approval backlog tied to audit events.', 'primary'),
      navAction('Review AI guardrails', '/settings', 'Inspect read-only AI guardrail and protected-action boundaries.'),
      navAction('View service status', '/admin', 'Review platform health and dependency metadata.'),
    ],
    lifecycleLanes: compactLifecycleLanes([evidenceLifecycleLane]),
    charts: [
      liveEventTimeline(
        chronologicalEvents.slice(0, 6).map((event) => ({
          id: event.id,
          summary: event.action ?? `Audit event for ${event.entity?.entityType ?? event.subjectId ?? 'unknown entity'}`,
          severity: event.severity ?? 'info',
          timestamp: event.timestamp,
        })),
        navAction('Review approvals', '/approvals', 'Clear human approval backlog tied to audit events.'),
      ),
    ],
    queues: [
      {
        id: 'audit-ledger',
        title: 'Audit event ledger',
        description: 'Chronological audit events with integrity references and actor linkage.',
        items: ledgerItems,
      },
    ],
    metrics: [
      countMetric('Audit events', rows.length, 'Audit event records with hash references from /audit/events'),
      countMetric('Critical events', critical, 'Critical audit severity count', critical ? 'critical' : 'ready'),
      countMetric('Actors', actors, 'Distinct actors represented in the audit ledger'),
    ],
  };

  return enrichConsoleWithSharedContext(base, shared, { skipAuditPreview: true });
}
