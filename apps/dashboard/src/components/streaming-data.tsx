import type { AdapterMode, LiveEventDto, PlatformHealthWorkspaceDto, StreamingConnectionStatusDto, StreamingDataSnapshotDto, StreamingDataSourceDto } from '../types.js';
import { DataFreshness, EventTimeline, KpiTile, MockDataBanner, StatusIndicator } from './nexus-ui.js';

const STALE_AFTER_MS = 5 * 60 * 1000;

function newestTimestamp(events: LiveEventDto[], fallback?: string) {
  const timestamps = events.map((event) => event.timestamp).filter(Boolean).sort();
  return timestamps.at(-1) ?? fallback;
}

function minutesSince(timestamp: string | undefined, observedAt: string) {
  if (!timestamp) return Number.POSITIVE_INFINITY;
  const latest = Date.parse(timestamp);
  const observed = Date.parse(observedAt);
  return Number.isFinite(latest) && Number.isFinite(observed) ? observed - latest : Number.POSITIVE_INFINITY;
}

function connectionStatus(args: { mode: AdapterMode; mock: boolean; stale: boolean; health?: PlatformHealthWorkspaceDto }): StreamingConnectionStatusDto {
  if (args.mock || args.mode === 'mock') return 'mock';
  if (!args.health) return 'connecting';
  if (args.health.eventBus.status === 'critical' || args.health.frontend.status === 'critical') return 'offline';
  if (args.stale) return 'stale';
  if (args.health.eventBus.status === 'degraded' || args.health.frontend.degradedMode || args.health.overallStatus === 'degraded') return 'degraded';
  return 'connected';
}

export function buildStreamingDataSnapshot(args: { source: StreamingDataSourceDto; events: LiveEventDto[]; health?: PlatformHealthWorkspaceDto; observedAt?: string; fallbackUpdatedAt?: string }): StreamingDataSnapshotDto {
  const observedAt = args.observedAt ?? new Date().toISOString();
  const lastUpdatedAt = newestTimestamp(args.events, args.fallbackUpdatedAt);
  const stale = minutesSince(lastUpdatedAt, observedAt) > STALE_AFTER_MS;
  const degraded = Boolean(args.health && (args.health.overallStatus !== 'healthy' || args.health.eventBus.status !== 'healthy' || args.health.frontend.degradedMode));
  const warnings = [
    ...(args.source.mock ? ['MOCK STREAM ACTIVE: safe mock operational stream is visible and read-only.'] : []),
    ...(stale ? ['Stale data warning: no fresh operational stream update inside 5 minutes.'] : []),
    ...(degraded ? ['Degraded service: event bus or frontend health is reporting reduced service.'] : []),
    'Streaming updates are telemetry/events/status only; protected operational state remains backend-owned and approval-gated.',
  ];
  return {
    source: args.source,
    connection: connectionStatus({ mode: args.source.mode, mock: args.source.mock, stale, health: args.health }),
    lastUpdatedAt,
    stale,
    degraded,
    warnings,
    events: args.events,
  };
}

export function StreamingDataStatus({ snapshot, label = 'Streaming operational updates' }: { snapshot: StreamingDataSnapshotDto; label?: string }) {
  const tone = snapshot.connection === 'connected' ? 'ok' : snapshot.connection === 'offline' || snapshot.connection === 'stale' ? 'critical' : snapshot.connection === 'degraded' ? 'warning' : 'info';
  return (
    <section aria-label={label} data-tone={tone} data-connection-state={snapshot.connection} data-stale={snapshot.stale} data-degraded={snapshot.degraded}>
      <h3>{label}</h3>
      <StatusIndicator label={`Connection ${snapshot.connection}`} tone={tone} />
      <DataFreshness label="Streaming data" timestamp={snapshot.lastUpdatedAt} mode={snapshot.source.mode} />
      <p>Source: <code>{snapshot.source.url}</code>. Label: {snapshot.source.label}. Transport: {snapshot.source.transport}. Reconnect: {snapshot.source.reconnectStrategy.backoff} backoff from {snapshot.source.reconnectStrategy.initialDelayMs}ms to {snapshot.source.reconnectStrategy.maxDelayMs}ms.</p>
      <p>State safety: streams update telemetry, event, and status views only; they do not mutate safety-critical operational state.</p>
      <MockDataBanner active={snapshot.source.mock} source={`MOCK STREAM ACTIVE via ${snapshot.source.label}`} />
      {snapshot.degraded && <aside className="state-message" role="alert" aria-label="Streaming degraded service banner" data-state="degraded" data-tone="warning">Degraded service banner: live stream health is reduced; cached read-only telemetry remains visible.</aside>}
      {snapshot.stale && <p className="state-message" role="alert" aria-label="Streaming stale data warning" data-state="stale" data-tone="critical">Stale data warning: last updated {snapshot.lastUpdatedAt ?? 'not reported'}.</p>}
      {snapshot.source.fallbackReason && <p role="note">{snapshot.source.fallbackReason}</p>}
      <button type="button" aria-label="Reconnect streaming data">Reconnect stream</button>
      <div aria-label="Streaming status metrics">
        <KpiTile label="Connection" value={snapshot.connection} trend={snapshot.source.mock ? 'mock stream visibly labeled' : 'live stream descriptor'} tone={tone} />
        <KpiTile label="Last updated" value={snapshot.lastUpdatedAt ?? 'not reported'} trend={snapshot.stale ? 'stale data warning' : 'fresh within threshold'} tone={snapshot.stale ? 'critical' : tone} />
      </div>
      <ul aria-label="Streaming warnings">{snapshot.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
      <EventTimeline label="Streaming event timeline" events={snapshot.events.map((event) => ({ time: event.timestamp, label: `${event.domain}: ${event.summary}`, tone: event.severity }))} />
    </section>
  );
}
