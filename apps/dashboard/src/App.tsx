const raceOpsPanels = [
  { title: 'Operations command', detail: 'Race readiness, incidents, emergency posture, telemetry health, and event-stream correlation.' },
  { title: 'Race office', detail: 'Schedule, entries, declarations, scratches, post draw, official transitions, and protected-action approvals.' },
  { title: 'Surface intelligence', detail: 'Moisture, compaction, weather, maintenance forecasts, Digital Twin state, and human-approved work orders.' },
  { title: 'Starting-gate control', detail: 'Gate assignments, lock/readiness telemetry, stall state, movement recommendations, and human-only release controls.' },
  { title: 'Asset registry', detail: 'Racetrack assets, owners, risk, sensors, controls, maintenance, approvals, and Digital Twin references.' },
  { title: 'Approvals workbench', detail: 'AI recommendations, protected action chains, expiring approvals, delegation, escalation, and evidence requirements.' },
  { title: 'Audit review', detail: 'Immutable ledger search for every user, service, workflow, API, AI, and asset action.' },
];
const supportPanels = ['Horse readiness','Vet status','Steward inquiries','Security alerts','Ticketing metrics','AI recommendations','Continuity plans','Simulation exercises'];
export function App(){return <main><h1>TrackMind Nexus</h1><p>Azure-first, safety-critical racetrack intelligence foundation.</p><section aria-label="Nexus control dashboards">{raceOpsPanels.map(p=><article key={p.title}><h2>{p.title}</h2><p>{p.detail}</p></article>)}</section><section aria-label="Supporting operations">{supportPanels.map(p=><article key={p}><h2>{p}</h2><p>Operational panel placeholder wired for events, audits, approvals, and Digital Twins.</p></article>)}</section></main>}
