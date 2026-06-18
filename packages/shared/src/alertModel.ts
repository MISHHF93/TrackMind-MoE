export type TrackMindAlertSeverity = 'info' | 'advisory' | 'warning' | 'critical';
export type TrackMindAlertPriority = 'low' | 'medium' | 'high' | 'critical';

const severityRank: Record<TrackMindAlertSeverity, number> = {
  info: 0,
  advisory: 1,
  warning: 2,
  critical: 3,
};

export function normalizeAlertSeverity(value: string | undefined): TrackMindAlertSeverity {
  switch ((value ?? 'info').toLowerCase()) {
    case 'advisory':
      return 'advisory';
    case 'warning':
    case 'watch':
    case 'minor':
      return 'warning';
    case 'critical':
    case 'major':
    case 'high':
      return 'critical';
    default:
      return 'info';
  }
}

export function alertPriorityFromSeverity(severity: TrackMindAlertSeverity): TrackMindAlertPriority {
  if (severity === 'critical') return 'critical';
  if (severity === 'warning') return 'high';
  if (severity === 'advisory') return 'medium';
  return 'low';
}

export function compareAlertSeverity(a: TrackMindAlertSeverity, b: TrackMindAlertSeverity): number {
  return severityRank[a] - severityRank[b];
}

export function incidentSeverityToAlert(severity: string | undefined): TrackMindAlertSeverity {
  switch ((severity ?? 'low').toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'high':
    case 'major':
      return 'warning';
    case 'medium':
      return 'advisory';
    default:
      return 'info';
  }
}

export function approvalPriorityFromAction(action: string): TrackMindAlertPriority {
  if (/race-stop|emergency|track-closure|medication/.test(action)) return 'critical';
  if (/race-start|scratch|payout|security/.test(action)) return 'high';
  if (/draft|review|configuration/.test(action)) return 'medium';
  return 'low';
}
