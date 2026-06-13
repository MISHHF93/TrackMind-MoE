export interface SecurityEvent {
  id: string;
  type: 'access-control' | 'restricted-zone-alert' | 'camera-health' | 'emergency-button' | 'suspicious-activity' | 'lost-and-found' | 'banned-person-watchlist-placeholder';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'new' | 'triaged' | 'escalated' | 'closed';
  location?: string;
  evidenceUris?: string[];
}

export interface EscalationRecord {
  eventId: string;
  escalatedTo: string;
  reason: string;
  timestamp: string;
}

export function escalate(event: SecurityEvent, escalatedTo = 'security-supervisor'): { event: SecurityEvent; escalation: EscalationRecord } {
  return {
    event: { ...event, status: 'escalated' },
    escalation: { eventId: event.id, escalatedTo, reason: `${event.severity} ${event.type}`, timestamp: new Date().toISOString() },
  };
}
