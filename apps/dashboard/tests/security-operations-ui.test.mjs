import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { CommandCenter, loadCommandCenter } from '../dist/App.js';
import { createLiveClient, createMockClient } from '../dist/api/client.js';

function textFrom(node) { if (node == null || typeof node === 'boolean') return ''; if (typeof node === 'string' || typeof node === 'number') return String(node); if (Array.isArray(node)) return node.map(textFrom).join(' '); if (React.isValidElement(node)) return textFrom(node.props.children); return ''; }
function collect(node, predicate, out = []) { if (node == null || typeof node === 'boolean') return out; if (Array.isArray(node)) { node.forEach((child) => collect(child, predicate, out)); return out; } if (React.isValidElement(node)) { if (predicate(node)) out.push(node); collect(node.props.children, predicate, out); } return out; }

test('Security Operations frontend renders incident workflow end to end', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/security' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  for (const required of ['Security Operations workspace','Security dashboard widgets','Restricted zones','Access-control events','Camera assets','Security incidents','Incident timeline widget','Investigation queue widget','Watchlist placeholders','Visitor logs','Credential checks','Escalation workflows','Security audit records','Security approval gates']) assert.ok(labels.includes(required), `missing ${required}`);
  const text = textFrom(tree);
  assert.match(text, /Denied access at medication storage/);
  assert.match(text, /credential\s+••••/);
  assert.match(text, /Reveal sensitive fields requires permission/);
});

test('Security Operations live client uses workspace endpoint contract', async () => {
  const original = globalThis.fetch;
  let requestUrl;
  globalThis.fetch = async (url) => { requestUrl = url; return { ok: true, json: async () => ({ restrictedZones: [], cameras: [], accessEvents: [], incidents: [], investigations: [], watchlistPlaceholders: [], visitorLogs: [], credentialChecks: [], escalations: [], auditRecords: [], dashboard: { activeAlerts: 0, restrictedZoneEvents: 0, cameraHealth: { online: 0, degraded: 0, offline: 0 }, incidentTimeline: [], investigationQueue: 0 }, mock: false }) }; };
  await createLiveClient('https://api.example.test/api/v1').getSecurityOperations();
  assert.equal(requestUrl, 'https://api.example.test/api/v1/security-operations/workspace');
  globalThis.fetch = original;
});

test('Emergency Operations frontend renders command view with override guardrails', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = CommandCenter({ data, roles: ['admin'], authenticated: true, path: '/emergency' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  for (const required of ['Emergency Operations command view','Emergency plans','Incident command roles','Emergency resource map','Medical fire and severe weather response','Evacuation zones','Checklist progress','Communication log','Drills and after-action reports','Emergency event stream','Emergency audit timeline']) assert.ok(labels.includes(required), `missing ${required}`);
  const text = textFrom(tree);
  assert.match(text, /AI cannot block emergency actions/);
  assert.match(text, /critical fire-incident/);
  assert.match(text, /human override\s+true/i);
});

test('Emergency Operations live client uses workspace endpoint contract', async () => {
  const original = globalThis.fetch;
  let requestUrl;
  globalThis.fetch = async (url) => { requestUrl = url; return { ok: true, json: async () => ({ activeEmergencyStatus: 'none', plans: [], commandRoles: [], resources: [], resourceMap: [], medicalResponse: { lead: '', checklist: [], humanOverrideSupported: true, aiMayBlock: false }, fireResponse: { lead: '', checklist: [], humanOverrideSupported: true, aiMayBlock: false }, severeWeatherResponse: { lead: '', checklist: [], humanOverrideSupported: true, aiMayBlock: false }, evacuationZones: [], checklist: [], communicationLog: [], drills: [], afterActionReports: [], auditTimeline: [], events: [], emergencyActions: { humanOverrideSupported: true, aiMayBlock: false, reason: '' }, mock: false }) }; };
  await createLiveClient('https://api.example.test/api/v1').getEmergencyOperations();
  assert.equal(requestUrl, 'https://api.example.test/api/v1/emergency-operations/workspace');
  globalThis.fetch = original;
});
