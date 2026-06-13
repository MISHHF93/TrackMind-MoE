import test from 'node:test';
import assert from 'node:assert/strict';
import { SecurityOperationsSafetyPlatform } from '../dist/index.js';

test('security operations and safety platform correlates physical, cyber, safety, and compliance signals', () => {
  const platform = new SecurityOperationsSafetyPlatform();

  const restricted = platform.ingest({
    id: 'sig-1',
    type: 'restricted-area',
    source: 'access-controller-7',
    subject: 'contractor-42',
    location: 'backstretch-vet-pharmacy',
    observedAt: '2026-06-13T12:00:00Z',
    description: 'Badge denied followed by door forced alarm in medication storage corridor',
    severity: 'high',
    confidence: 0.96,
    restrictedArea: true,
    evidenceUris: ['video://cam-17/clip-1', 'access://panel-7/event-99'],
    controls: ['restricted-area-access', 'chain-of-custody'],
  });

  platform.ingest({
    id: 'sig-2',
    type: 'cybersecurity-telemetry',
    source: 'siem',
    subject: 'contractor-42',
    location: 'backstretch-vet-pharmacy',
    observedAt: '2026-06-13T12:02:00Z',
    description: 'Impossible travel login and privilege escalation attempt against camera VMS',
    severity: 'critical',
    confidence: 0.91,
    cyberTactics: ['credential-access', 'privilege-escalation'],
    evidenceUris: ['siem://case-123'],
    controls: ['MFA', 'least-privilege'],
  });

  platform.ingest({
    id: 'sig-3',
    type: 'workforce-safety',
    source: 'safety-observation-app',
    subject: 'maintenance-team',
    location: 'paddock',
    observedAt: '2026-06-13T12:03:00Z',
    description: 'Slip hazard reported near temporary power run',
    severity: 'medium',
    confidence: 0.88,
    controls: ['OSHA-walking-working-surfaces'],
  });

  platform.ingest({
    id: 'sig-4',
    type: 'compliance',
    source: 'audit-workbench',
    subject: 'enterprise',
    location: 'soc',
    observedAt: '2026-06-13T12:04:00Z',
    description: 'Quarterly access review exception remains open for VMS administrators',
    severity: 'medium',
    confidence: 1,
    evidenceUris: ['grc://finding-88'],
    controls: ['ISO27001-A.5.15', 'SOC2-CC6'],
  });

  assert.equal(restricted.alerts[0].priority, 'critical');
  assert.equal(restricted.twinUpdate.patch.restrictedArea, true);
  assert.equal(platform.incidentTimeline('contractor-42').length, 2);

  const dashboard = platform.operationalDashboard();
  assert.equal(dashboard.totalSignals, 4);
  assert.equal(dashboard.criticalAlerts, 2);
  assert.equal(dashboard.cyberIndicators, 1);
  assert.equal(dashboard.workforceSafetyItems, 1);
  assert.equal(dashboard.hotLocations[0].location, 'backstretch-vet-pharmacy');

  const risk = platform.assessRisk('backstretch-vet-pharmacy');
  assert.equal(risk.level, 'critical');
  assert.ok(risk.recommendedActions.includes('activate incident command'));
  assert.ok(risk.recommendedActions.includes('isolate affected systems and enrich indicators'));

  const report = platform.complianceReport(['ISO 27001', 'ISO 45001']);
  assert.equal(report.frameworks.length, 2);
  assert.equal(report.reportableIncidents, 2);
  assert.ok(report.controlCoverage > 0.5);
  assert.equal(platform.digitalTwinUpdates().length, 4);
});
