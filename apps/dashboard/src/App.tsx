const raceOpsPanels = [
  { title: 'Race lifecycle', detail: 'Schedule, entries, declarations, scratches, post draw, readiness, running, and official transitions.' },
  { title: 'Readiness command', detail: 'Approvals, telemetry health, surface conditions, starting gate, staffing, and active declared runners.' },
  { title: 'Gate and posts', detail: 'Post positions, gate assignments, loading progress, starter signals, and exception alerts.' },
  { title: 'Staffing assignments', detail: 'Stewards, veterinarians, gate crew, outriders, maintenance, security, check-in, and release status.' },
  { title: 'Resource allocations', detail: 'Starting gates, ambulances, tractors, harrows, cameras, sensors, tote systems, and security posts.' },
  { title: 'Execution tracking', detail: 'Loaded, off, fractions, incidents, objections, finish, official result, evidence, and severity timeline.' },
  { title: 'Event backbone', detail: 'Race activity events correlated to workflows, audit records, approvals, and Digital Twin state patches.' },
];
const supportPanels = ['Horse readiness','Vet status','Track condition','Weather','Incidents','Steward inquiries','Security alerts','Ticketing metrics','AI recommendations','Emergency command','Continuity plans','Evacuation routes','Disaster recovery','Simulation exercises','After-action reports'];
export function App(){return <main><h1>TrackMind Race-Day Command</h1><section aria-label="Race operations dashboards">{raceOpsPanels.map(p=><article key={p.title}><h2>{p.title}</h2><p>{p.detail}</p></article>)}</section><section aria-label="Supporting operations">{supportPanels.map(p=><article key={p}><h2>{p}</h2><p>Operational panel placeholder</p></article>)}</section></main>}
