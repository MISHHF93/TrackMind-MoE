import assert from 'node:assert/strict';
import test from 'node:test';
import { createRealtimeService } from '../dist/api/realtime.js';
import { freshnessFor, withRetry } from '../dist/api/requestPolicy.js';

const source = {
  url: '/api/v1/events/stream',
  mode: 'live',
  transport: 'server-sent-events',
  label: 'Live TrackMind event stream',
  mock: false,
  safeForStateMutation: false,
  reconnectStrategy: { initialDelayMs: 1000, maxDelayMs: 30000, backoff: 'exponential' },
};

class FakeEventSource {
  static instances = [];
  onopen = null;
  onmessage = null;
  onerror = null;
  closed = false;
  constructor(url) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
  }
}

test('request policy retries and records stale metadata', async () => {
  let attempts = 0;
  const value = await withRetry(async () => {
    attempts += 1;
    if (attempts < 2) throw new Error('transient');
    return 'loaded';
  }, { retries: 2, retryDelayMs: 1 });
  assert.equal(value, 'loaded');
  assert.equal(attempts, 2);

  const freshness = freshnessFor('live', '2026-06-14T00:00:00.000Z', { staleAfterMs: 1000 });
  assert.equal(freshness.source, 'live');
  assert.equal(freshness.staleAt, '2026-06-14T00:00:01.000Z');
});

test('realtime service supports EventSource injection, event delivery, and reconnect state', () => {
  FakeEventSource.instances = [];
  const events = [];
  const snapshots = [];
  const service = createRealtimeService(source, { staleAfterMs: 60 * 60 * 1000, eventSourceFactory: (url) => new FakeEventSource(url) });
  service.subscribe((snapshot) => snapshots.push(snapshot));
  service.subscribeToEvents((event) => events.push(event));
  service.connect();

  const first = FakeEventSource.instances[0];
  assert.equal(first.url, '/api/v1/events/stream');
  first.onopen?.({});
  first.onmessage?.({ data: JSON.stringify({ id: 'evt-1', timestamp: new Date().toISOString(), type: 'surface.reading.updated', domain: 'surface', summary: 'Far Turn moisture changed.', severity: 'warning', source: 'event-stream' }) });

  assert.equal(events.length, 1);
  assert.equal(events[0].id, 'evt-1');
  assert.equal(service.snapshot().connection, 'connected');
  assert.equal(service.snapshot().stale, false);

  service.reconnect();
  assert.equal(first.closed, true);
  assert.equal(service.snapshot().reconnectAttempts, 1);
  assert.equal(FakeEventSource.instances.length, 2);
  assert.ok(snapshots.length >= 3);
});

test('mock realtime source stays visibly labelled and read-only', () => {
  const mock = createRealtimeService({ ...source, url: '/mock/events/stream', mode: 'mock', mock: true });
  mock.connect();
  const snapshot = mock.snapshot();
  assert.equal(snapshot.connection, 'mock');
  assert.equal(snapshot.degraded, false);
  assert.match(snapshot.warnings.join(' '), /MOCK STREAM ACTIVE/);
  assert.match(snapshot.warnings.join(' '), /protected operational state remains backend-owned/);
});
