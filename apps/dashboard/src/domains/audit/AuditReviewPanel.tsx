import { AuditEventRow, EvidenceList, EventTimeline, FilterBar, MetricStrip, RecordSourceLabel, RiskBadge, WorkspaceFrame } from '../../components/nexus-ui.js';
import type { AuditEventDto } from '../../types.js';

function eventRisk(event: AuditEventDto): 'low' | 'medium' | 'high' | 'critical' {
  if (event.severity === 'critical') return 'critical';
  if (event.severity === 'warning') return 'high';
  return 'low';
}

function eventExportFields(event: AuditEventDto) {
  return event.exportFields ?? ['id', 'type', 'actor', 'timestamp', 'subjectId', 'hash', 'previousHash', 'correlationId'];
}

export function AuditReviewPanel({ events }: { events: AuditEventDto[] }) {
  const correlations = new Set(events.map((event) => event.correlationId).filter(Boolean));
  const criticalEvents = events.filter((event) => event.severity === 'critical');
  const exportFields = Array.from(new Set(events.flatMap(eventExportFields)));

  return (
    <WorkspaceFrame
      title="Immutable Audit Ledger"
      label="Audit review panel"
      eyebrow="Read-only audit context"
      description="Read-only hash-chained audit ledger. Rows expose actor, timestamp, correlation, evidence, retention, and export fields without edit controls."
      mock={events.some((event) => event.mock)}
      operationalSummary={<MetricStrip items={[
        { label: 'Audit rows', value: String(events.length), detail: 'Immutable records in current view' },
        { label: 'Correlation IDs', value: String(correlations.size), detail: 'Traceable cross-domain workflows' },
        { label: 'Critical events', value: String(criticalEvents.length), detail: 'Critical ledger entries' },
      ]} />}
      evidenceDetailPanel={<><p>Evidence IDs are surfaced from immutable ledger rows; exports remain read-only.</p><EvidenceList items={Array.from(new Set(events.flatMap((event) => event.evidenceIds ?? []))).slice(0, 10)} empty="No evidence IDs linked in this DTO." label="Audit workspace evidence records" /></>}
      eventTimeline={<EventTimeline events={events.map((event) => ({ time: event.timestamp, label: `${event.correlationId ?? event.id}: ${event.type} by ${event.actor}`, tone: event.severity }))} label="Audit workspace event timeline" />}
      approvalContext={<p>Approval handoff is correlation-based; approval decisions must be recorded by backend workflows before audit append events appear here.</p>}
      auditContext={<p>Ledger export fields <code>{exportFields.join(',')}</code>. Previous/current hashes are rendered per row and never editable.</p>}
      digitalTwinContext={<p>Digital Twin and asset references: {events.flatMap((event) => event.affectedAssets ?? (event.subjectId ? [event.subjectId] : [])).join(', ') || 'No affected asset linked.'}</p>}
      primary={<>
      <FilterBar label="Audit ledger filters" summary="Live filtering should query the audit API; the ledger remains immutable and read-only in the frontend." filters={['severity', 'actor', 'type', 'correlationId', 'asset', 'timestamp'].map((filter) => ({ id: filter, label: filter }))} />
      <section aria-label="Audit correlation and export panel">
        <h3>Correlation IDs and export layout</h3>
        <p>Correlation IDs {Array.from(correlations).join(', ') || 'none linked'}.</p>
        <p>Ledger export fields <code>{exportFields.join(',')}</code>.</p>
        <p>Immutable rows are append-only; export panels never expose edit controls.</p>
      </section>
      <section aria-label="Immutable audit event rows">
        {events.map((event) => (
          <article key={event.id} aria-label={`Immutable audit event ${event.id}`} data-hash={event.hash} data-previous-hash={event.previousHash}>
            <header>
              <RiskBadge level={eventRisk(event)} />
              <RecordSourceLabel mock={event.mock} label="ledger record" />
              <AuditEventRow event={event} />
              <p>Actor {event.actorDetails?.displayName ?? event.actor} ({event.actorDetails?.role ?? 'unknown role'}; {event.actorDetails?.actorType ?? 'actor'}) at <time>{event.timestamp}</time>.</p>
              <p>Correlation ID <code>{event.correlationId ?? 'unlinked'}</code>{event.workflowId ? <>; workflow <code>{event.workflowId}</code></> : null}</p>
            </header>
            <section aria-label={`Audit evidence for ${event.id}`}>
              <h3>Evidence</h3>
              <EvidenceList items={event.evidenceIds ?? []} empty="No evidence IDs linked in this DTO." label={`Audit evidence records for ${event.id}`} />
            </section>
            <section aria-label={`Audit affected assets for ${event.id}`}>
              <h3>Affected assets</h3>
              <p>{(event.affectedAssets ?? (event.subjectId ? [event.subjectId] : [])).join(', ') || 'No affected asset linked.'}</p>
            </section>
            <section aria-label={`Audit chain details for ${event.id}`}>
              <h3>Chain details</h3>
              <p>Previous hash <code>{event.previousHash}</code>; current hash <code>{event.hash}</code>; retained until {event.retainedUntil ?? 'policy default'}.</p>
            </section>
            <section aria-label={`Audit export view for ${event.id}`}>
              <h3>Export-ready fields</h3>
              <code>{eventExportFields(event).join(',')}</code>
            </section>
          </article>
        ))}
      </section>
      <section aria-label="Audit correlation timeline">
        <h3>Correlation timeline</h3>
        <EventTimeline events={events.map((event) => ({ time: event.timestamp, label: `${event.correlationId ?? event.id}: ${event.type} by ${event.actor}`, tone: event.severity }))} />
      </section>
      </>}
    />
  );
}
