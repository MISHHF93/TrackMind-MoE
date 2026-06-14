import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { CommandCenter, loadCommandCenter } from '../dist/App.js';
import { createLiveClient, createMockClient } from '../dist/api/client.js';

function textFrom(node) { if (node == null || typeof node === 'boolean') return ''; if (typeof node === 'string' || typeof node === 'number') return String(node); if (Array.isArray(node)) return node.map(textFrom).join(' '); if (React.isValidElement(node)) { if (typeof node.type === 'function') return textFrom(node.type(node.props)); return textFrom(node.props.children); } return ''; }
function collect(node, predicate, out = []) { if (node == null || typeof node === 'boolean') return out; if (Array.isArray(node)) { node.forEach((child) => collect(child, predicate, out)); return out; } if (React.isValidElement(node)) { if (predicate(node)) out.push(node); if (typeof node.type === 'function') collect(node.type(node.props), predicate, out); collect(node.props.children, predicate, out); } return out; }

test('Safety Center renders read-only overview links without exposing sensitive workspaces', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['read-only-auditor'], authenticated: true, path: '/safety' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  for (const required of ['Safety Center overview workspace','Safety overview status','Safety workspace links','Safety signal summary','Safety authority guardrails','Safety overview locked controls']) assert.ok(labels.includes(required), `missing ${required}`);
  const text = textFrom(tree);
  assert.match(text, /Read-only safety overview/);
  assert.match(text, /Open Security Operations/);
  assert.match(text, /Open Emergency Ops/);
  assert.match(text, /Open Steward Center/);
  assert.match(text, /Open Approvals/);
  assert.match(text, /Emergency personnel authority always wins/);
  assert.match(text, /Credential names are intentionally not displayed/);
  assert.doesNotMatch(text, /veterinary-security/);
  assert.doesNotMatch(text, /paddock-credential/);
  assert.equal(labels.includes('Security Operations workspace'), false);
  assert.equal(labels.includes('Emergency Operations command view'), false);
  const gated = collect(tree, (node) => node.type === 'button' && ['Request safety security handoff', 'Request emergency evidence capture', 'Request steward safety review'].includes(node.props?.['aria-label']));
  assert.ok(gated.length >= 3);
  assert.ok(gated.every((button) => button.props.disabled === true));
});

test('Security Operations frontend renders incident workflow end to end', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/security' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  for (const required of ['Security Operations workspace','Security dashboard widgets','Security emergency coordination view','Active security and emergency alerts','Restricted zone emergency posture','Camera health emergency coverage','Investigations and incident command handoffs','Emergency plans and resources coordination','Evacuation workflow coordination','Communications drills and after actions','Restricted zones','Access-control events','Camera assets','Security incidents','Incident timeline widget','Investigation queue widget','Watchlist placeholders','Visitor logs','Credential checks','Escalation workflows','Security audit records','Security shared audit records','Security event stream','Security Digital Twin updates','Security asset registry links','Security observability signals','Security approval gates']) assert.ok(labels.includes(required), `missing ${required}`);
  const text = textFrom(tree);
  assert.match(text, /Denied access at medication storage/);
  assert.match(text, /restricted zones/i);
  assert.match(text, /security\.access\.checked/);
  assert.match(text, /SEC-CAMERA-CAM-MED-1/);
  assert.match(text, /Human emergency authority is always prioritized/);
  assert.match(text, /security operations approved mock adapter/i);
  assert.match(text, /Restricted zone roster/);
  assert.match(text, /Critical security actions are approval\/audit\/event aware backend requests only/i);
  const gated = collect(tree, (node) => node.type === 'button' && ['Escalate security incident', 'Open security investigation', 'Reveal sensitive security fields'].includes(node.props?.['aria-label']));
  assert.ok(gated.length >= 3);
  assert.ok(gated.every((button) => button.props.disabled === true));
});

test('Security Operations masks sensitive evidence for unauthorized roles', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['read-only-auditor'], authenticated: true, path: '/security' });
  const text = textFrom(tree);
  assert.match(text, /Permission denied for this workspace/);
  assert.doesNotMatch(text, /video:\/\//);
  assert.doesNotMatch(text, /Placeholder\/mock label: watchlist data is intentionally redacted/);
});

test('Security Operations live client uses workspace endpoint contract', async () => {
  const original = globalThis.fetch;
  let requestUrl;
  globalThis.fetch = async (url) => { requestUrl = url; return { ok: true, json: async () => ({ restrictedZones: [], cameras: [], accessEvents: [], incidents: [], investigations: [], watchlistPlaceholders: [], visitorLogs: [], credentialChecks: [], escalations: [], auditRecords: [], dashboard: { activeAlerts: 0, restrictedZoneEvents: 0, cameraHealth: { online: 0, degraded: 0, offline: 0 }, incidentTimeline: [], investigationQueue: 0 }, mock: false }) }; };
  try {
    await createLiveClient('https://api.example.test/api/v1').getSecurityOperations();
    assert.equal(requestUrl, 'https://api.example.test/api/v1/security-operations/workspace');
  } finally {
    globalThis.fetch = original;
  }
});

test('Emergency Operations frontend renders command view with override guardrails', async () => {
  const data = await loadCommandCenter(createMockClient());
  assert.ok(data.emergencyOperations.workflowIntegrations.some((integration) => integration.status === 'started'));
  assert.ok(data.emergencyOperations.digitalTwinPatches.some((patch) => patch.patch.aiMayBlock === false));
  assert.equal(data.emergencyOperations.approvalPosture.emergencyPersonnelAuthority, true);
  assert.equal(data.emergencyOperations.observability.serviceId, 'emergency-operations');
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/emergency' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  for (const required of ['Emergency Operations command view','Security emergency coordination view','Active security and emergency alerts','Emergency plans and resources coordination','Emergency resources roster','Emergency plans','Incident command roles','Emergency resource map','Medical fire and severe weather response','Evacuation procedure workflow','Emergency workflow integrations','Emergency approval posture','Emergency Digital Twin patches','Emergency observability','Evacuation zones','Checklist progress','Communication log','Drills and after-action reports','Emergency event stream','Emergency audit timeline']) assert.ok(labels.includes(required), `missing ${required}`);
  const text = textFrom(tree);
  assert.match(text, /AI cannot block emergency actions/);
  assert.match(text, /critical fire-incident/);
  assert.match(text, /workflow-orchestration/);
  assert.match(text, /twin:barn:2/);
  assert.match(text, /human override\s+true/i);
  assert.match(text, /Human emergency authority prioritized; AI may block personnel:\s+false/);
  assert.match(text, /emergency operations approved mock adapter/i);
  assert.match(text, /Severe weather/);
  assert.match(text, /controlled re-entry/i);
  assert.match(text, /post-action evidence/i);
  const gated = collect(tree, (node) => node.type === 'button' && ['Request emergency workflow evidence capture', 'Request controlled re-entry approval', 'Request after-action corrective action approval'].includes(node.props?.['aria-label']));
  assert.ok(gated.length >= 3);
  assert.ok(gated.every((button) => button.props.disabled === true));
});

test('Emergency Operations live client uses workspace endpoint contract', async () => {
  const original = globalThis.fetch;
  let requestUrl;
  globalThis.fetch = async (url) => { requestUrl = url; return { ok: true, json: async () => ({ activeEmergencyStatus: 'none', plans: [], commandRoles: [], resources: [], resourceMap: [], medicalResponse: { lead: '', checklist: [], humanOverrideSupported: true, aiMayBlock: false }, fireResponse: { lead: '', checklist: [], humanOverrideSupported: true, aiMayBlock: false }, severeWeatherResponse: { lead: '', checklist: [], humanOverrideSupported: true, aiMayBlock: false }, evacuationZones: [], checklist: [], communicationLog: [], drills: [], afterActionReports: [], auditTimeline: [], events: [], emergencyActions: { humanOverrideSupported: true, aiMayBlock: false, reason: '' }, mock: false }) }; };
  try {
    await createLiveClient('https://api.example.test/api/v1').getEmergencyOperations();
    assert.equal(requestUrl, 'https://api.example.test/api/v1/emergency-operations/workspace');
  } finally {
    globalThis.fetch = original;
  }
});
