import type { AuditEventDto } from '../../types.js';
export function AuditReviewPanel({ events }: { events: AuditEventDto[] }) { return <section aria-label="Audit review panel"><h2>Immutable Audit Review</h2><ul>{events.map(e=><li key={e.id}>{e.timestamp} · {e.type} · {e.actor} · {e.hash} {e.mock?'(MOCK)':''}</li>)}</ul></section>; }
