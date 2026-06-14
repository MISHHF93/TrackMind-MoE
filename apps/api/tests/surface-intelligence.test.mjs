import test from 'node:test';
import assert from 'node:assert/strict';
import { runSurfaceIntelligenceSystem, analyzeSurfaceSection, buildSurfaceHeatmap, runSurfaceManagementDomain, buildSurfaceIntelligenceWorkspace, requestSurfaceOperationalAction } from '../dist/index.js';

const input = {
  trackId: 'track-a',
  generatedAt: '2026-06-13T12:00:00Z',
  telemetry: [
    { id: 't1', sectionId: 'turn-1', surfaceType: 'dirt', latitude: 38.1, longitude: -77.1, moisture: 27, compaction: 276, drainageRate: 6, cushionDepth: 2.8, temperature: 82, rainfall: 3, observedAt: '2026-06-13T11:00:00Z' },
    { id: 't2', sectionId: 'turn-1', surfaceType: 'dirt', latitude: 38.10003, longitude: -77.10003, moisture: 25, compaction: 268, drainageRate: 7, cushionDepth: 2.9, temperature: 82, rainfall: 3, observedAt: '2026-06-13T11:10:00Z' },
    { id: 't3', sectionId: 'stretch', surfaceType: 'synthetic', latitude: 38.2, longitude: -77.2, moisture: 12, compaction: 212, drainageRate: 13, cushionDepth: 3.1, temperature: 80, rainfall: 1, observedAt: '2026-06-13T11:05:00Z' },
  ],
  inspections: [{ id: 'i1', sectionId: 'turn-1', inspectedAt: '2026-06-13T11:30:00Z', inspector: 'chief-maintainer', surfaceType: 'dirt', footingUniformity: 72, divots: 4, standingWater: true, railWear: 3, observations: ['standing water near inside lane'] }],
  weather: { observedAt: '2026-06-13T11:45:00Z', rainfallMm: 5, forecastRainMm: 14, temperature: 83, windMph: 12 },
  maintenanceRecords: [{ id: 'm1', sectionId: 'turn-1', completedAt: '2026-06-13T08:00:00Z', action: 'harrow', effectiveness: 6, notes: 'partial improvement' }],
  observations: [{ id: 'o1', sectionId: 'turn-1', observedAt: '2026-06-13T11:40:00Z', role: 'jockey', severity: 4, note: 'uneven footing on turn' }],
};

test('surface intelligence scores track sections and requires human approval', () => {
  const report = runSurfaceIntelligenceSystem(input);
  assert.equal(report.trackId, 'track-a');
  assert.equal(report.humanApprovalRequired, true);
  assert.equal(report.approvalState, 'required');
  assert.equal(report.sections.length, 2);
  assert.ok(report.sections.find((section) => section.sectionId === 'turn-1').conditionScore < 70);
  assert.ok(report.maintenanceRecommendations.every((item) => item.requiresHumanApproval));
  assert.ok(report.riskForecast.find((forecast) => forecast.sectionId === 'turn-1').drivers.includes('drainage'));
  assert.equal(report.digitalTwinUpdates[0].patch.approvalState, 'required');
  assert.ok(report.explainableAnalytics[0].factors.length >= 5);
});

test('surface intelligence supports section analysis and geospatial heatmaps', () => {
  const section = analyzeSurfaceSection('stretch', input);
  assert.equal(section.surfaceType, 'synthetic');
  assert.equal(section.riskLevel, 'low');
  const heatmap = buildSurfaceHeatmap(input.telemetry);
  assert.ok(heatmap.some((cell) => cell.riskIndex > 0));
});

test('surface management domain ingests all sources and gates operational actions', () => {
  const domain = runSurfaceManagementDomain(input);
  assert.ok(domain.measurements.some((item) => item.kind === 'moisture'));
  assert.ok(domain.measurements.some((item) => item.kind === 'compaction'));
  assert.ok(domain.measurements.some((item) => item.kind === 'cushion-depth'));
  assert.ok(domain.measurements.some((item) => item.kind === 'weather'));
  assert.ok(domain.measurements.some((item) => item.kind === 'drainage'));
  assert.ok(domain.measurements.some((item) => item.kind === 'maintenance-activity'));
  assert.ok(domain.measurements.some((item) => item.kind === 'inspection'));
  assert.ok(domain.measurements.some((item) => item.kind === 'manual-observation'));
  assert.ok(domain.anomalies.length > 0);
  assert.ok(domain.forecasts.length >= 3);
  assert.ok(domain.digitalTwinSync.every((sync) => sync.status === 'queued-for-human-approved-sync'));
  assert.ok(domain.maintenanceRecommendations.every((item) => item.requiresHumanApproval && item.executionState === 'approval-required'));
  assert.ok(domain.events.length >= domain.measurements.length + domain.digitalTwinSync.length);
  assert.ok(domain.auditRecords.length >= domain.events.length);
  assert.equal(domain.operationalActionsRequireHumanApproval, true);
});

test('surface intelligence workspace exposes heatmap-ready UI data and approval-gated action drafts', () => {
  const workspace = buildSurfaceIntelligenceWorkspace(input);
  assert.equal(workspace.operationalActionsRequireHumanApproval, true);
  assert.ok(workspace.statusCards.length >= 4);
  assert.ok(workspace.timeline.every((point) => point.eventId && point.auditId));
  assert.ok(workspace.heatmap.every((cell) => typeof cell.latitude === 'number' && typeof cell.riskIndex === 'number'));
  assert.ok(workspace.recommendations.every((item) => item.requiresHumanApproval && item.executionState === 'approval-required'));
  assert.ok(workspace.digitalTwinSync.every((sync) => sync.status === 'queued-for-human-approved-sync'));
  for (const action of ['irrigation', 'harrowing', 'rolling', 'track-closure-recommendation', 'surface-configuration-change']) {
    const draft = requestSurfaceOperationalAction({ action, trackId: 'track-a', sectionId: 'turn-1', requestedBy: 'superintendent', reason: 'test', requestedAt: input.generatedAt });
    assert.equal(draft.approvalState, 'approval-required');
    assert.equal(draft.executionAllowed, false);
    assert.equal(draft.event.requiresHumanApproval, true);
  }
});
