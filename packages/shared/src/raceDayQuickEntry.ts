export const raceDayQuickEntrySchemaVersion = 'trackmind.race-day-quick-entry.v1' as const;

export type RaceDayQuickAction =
  | 'paddock-check-in'
  | 'horse-arrival'
  | 'readiness-update'
  | 'incident-report'
  | 'steward-note'
  | 'gate-delay'
  | 'surface-observation'
  | 'compliance-flag'
  | 'approval-request';

export type QuickStatusTone = 'nominal' | 'watch' | 'warning' | 'critical' | 'neutral';

export interface QuickStatusOption {
  value: string;
  label: string;
  shortLabel?: string;
  tone: QuickStatusTone;
  /** Submit immediately when tapped (no confirm). */
  oneTap?: boolean;
  payload?: Record<string, unknown>;
}

export interface RaceDayQuickActionDefinition {
  action: RaceDayQuickAction;
  label: string;
  shortLabel: string;
  description: string;
  icon?: string;
  requiresHorse?: boolean;
  requiresRace?: boolean;
  optionalNote?: boolean;
  keyboardShortcut?: string;
  statusOptions: QuickStatusOption[];
  defaultNotePlaceholder?: string;
}

export const raceDayQuickActions: Record<RaceDayQuickAction, RaceDayQuickActionDefinition> = {
  'paddock-check-in': {
    action: 'paddock-check-in',
    label: 'Paddock check-in',
    shortLabel: 'Check-in',
    description: 'Update paddock assignment status for the selected horse.',
    requiresHorse: true,
    requiresRace: true,
    keyboardShortcut: '1',
    statusOptions: [
      { value: 'arrived', label: 'Arrived', shortLabel: 'ARR', tone: 'nominal', oneTap: true },
      { value: 'saddled', label: 'Saddled', shortLabel: 'SAD', tone: 'nominal', oneTap: true },
      { value: 'parade-ready', label: 'Parade ready', shortLabel: 'PRD', tone: 'nominal', oneTap: true },
      { value: 'on-track', label: 'On track', shortLabel: 'TRK', tone: 'watch', oneTap: true },
      { value: 'scratched', label: 'Scratched', shortLabel: 'SCR', tone: 'critical', oneTap: false },
    ],
  },
  'horse-arrival': {
    action: 'horse-arrival',
    label: 'Horse arrival',
    shortLabel: 'Arrival',
    description: 'Record barn-to-paddock arrival.',
    requiresHorse: true,
    requiresRace: true,
    keyboardShortcut: '2',
    statusOptions: [
      { value: 'arrived', label: 'Arrived', tone: 'nominal', oneTap: true, payload: { fromLocation: 'barn' } },
      { value: 'in-transit', label: 'In transit', tone: 'watch', oneTap: true, payload: { fromLocation: 'barn' } },
      { value: 'late', label: 'Late', tone: 'warning', oneTap: true, payload: { fromLocation: 'barn' } },
      { value: 'no-show', label: 'No show', tone: 'critical', oneTap: false, payload: { fromLocation: 'barn' } },
    ],
  },
  'readiness-update': {
    action: 'readiness-update',
    label: 'Readiness update',
    shortLabel: 'Ready',
    description: 'Post paddock or gate readiness check.',
    requiresHorse: false,
    requiresRace: true,
    keyboardShortcut: '3',
    statusOptions: [
      { value: 'ready', label: 'Ready', tone: 'nominal', oneTap: true, payload: { domain: 'horse', score: 95 } },
      { value: 'watch', label: 'Watch', tone: 'watch', oneTap: true, payload: { domain: 'horse', score: 75 } },
      { value: 'blocked', label: 'Blocked', tone: 'critical', oneTap: false, payload: { domain: 'horse', score: 40 } },
      { value: 'gate-ready', label: 'Gate ready', tone: 'nominal', oneTap: true, payload: { domain: 'gate', score: 95 } },
      { value: 'parade-ready', label: 'Parade ready', tone: 'nominal', oneTap: true, payload: { domain: 'parade', score: 90 } },
    ],
  },
  'incident-report': {
    action: 'incident-report',
    label: 'Incident report',
    shortLabel: 'Incident',
    description: 'Report paddock or race-day incident.',
    requiresHorse: false,
    requiresRace: true,
    optionalNote: true,
    keyboardShortcut: '4',
    defaultNotePlaceholder: 'Optional one-line detail…',
    statusOptions: [
      { value: 'low', label: 'Low', tone: 'neutral', oneTap: true },
      { value: 'medium', label: 'Medium', tone: 'watch', oneTap: true },
      { value: 'high', label: 'High', tone: 'warning', oneTap: false },
      { value: 'critical', label: 'Critical', tone: 'critical', oneTap: false },
    ],
  },
  'steward-note': {
    action: 'steward-note',
    label: 'Steward note',
    shortLabel: 'Steward',
    description: 'Quick steward field note linked to race-day context.',
    requiresHorse: false,
    requiresRace: true,
    optionalNote: true,
    keyboardShortcut: '5',
    defaultNotePlaceholder: 'Steward observation (required for save)…',
    statusOptions: [
      { value: 'observation', label: 'Observation', tone: 'neutral', oneTap: false },
      { value: 'inquiry', label: 'Open inquiry', tone: 'watch', oneTap: false },
      { value: 'ruling-pending', label: 'Ruling pending', tone: 'warning', oneTap: false },
    ],
  },
  'gate-delay': {
    action: 'gate-delay',
    label: 'Gate delay',
    shortLabel: 'Delay',
    description: 'Report starting-gate delay.',
    requiresHorse: false,
    requiresRace: true,
    keyboardShortcut: '6',
    statusOptions: [
      { value: 'loading', label: 'Loading delay', tone: 'watch', oneTap: true, payload: { reason: 'Loading delay', estimatedMinutes: 3 } },
      { value: 'equipment', label: 'Equipment', tone: 'warning', oneTap: true, payload: { reason: 'Gate equipment issue', estimatedMinutes: 10 } },
      { value: 'vet', label: 'Vet hold', tone: 'warning', oneTap: true, payload: { reason: 'Veterinary hold', estimatedMinutes: 5 } },
      { value: 'weather', label: 'Weather', tone: 'watch', oneTap: true, payload: { reason: 'Weather delay', estimatedMinutes: 15 } },
      { value: 'other', label: 'Other', tone: 'neutral', oneTap: false, payload: { estimatedMinutes: 5 } },
    ],
  },
  'surface-observation': {
    action: 'surface-observation',
    label: 'Surface observation',
    shortLabel: 'Surface',
    description: 'Record track surface condition note.',
    requiresHorse: false,
    requiresRace: false,
    optionalNote: true,
    keyboardShortcut: '7',
    defaultNotePlaceholder: 'Optional footing detail…',
    statusOptions: [
      { value: 'fast', label: 'Fast', tone: 'nominal', oneTap: true, payload: { severity: 1, note: 'Fast footing' } },
      { value: 'good', label: 'Good', tone: 'nominal', oneTap: true, payload: { severity: 2, note: 'Good footing' } },
      { value: 'yielding', label: 'Yielding', tone: 'watch', oneTap: true, payload: { severity: 3, note: 'Yielding footing' } },
      { value: 'muddy', label: 'Muddy', tone: 'warning', oneTap: true, payload: { severity: 4, note: 'Muddy footing' } },
      { value: 'unsafe', label: 'Unsafe', tone: 'critical', oneTap: false, payload: { severity: 5, note: 'Unsafe footing — review required' } },
    ],
  },
  'compliance-flag': {
    action: 'compliance-flag',
    label: 'Compliance flag',
    shortLabel: 'Flag',
    description: 'Flag medication, equipment, or eligibility concern.',
    requiresHorse: true,
    requiresRace: true,
    optionalNote: true,
    keyboardShortcut: '8',
    defaultNotePlaceholder: 'Flag detail…',
    statusOptions: [
      { value: 'medication', label: 'Medication', tone: 'warning', oneTap: true, payload: { inspectionType: 'medication', status: 'failed' } },
      { value: 'equipment', label: 'Equipment', tone: 'warning', oneTap: true, payload: { inspectionType: 'equipment', status: 'failed' } },
      { value: 'identity', label: 'Identity', tone: 'critical', oneTap: false, payload: { inspectionType: 'identity', status: 'failed' } },
      { value: 'eligibility', label: 'Eligibility', tone: 'critical', oneTap: false, payload: { inspectionType: 'general', status: 'failed' } },
    ],
  },
  'approval-request': {
    action: 'approval-request',
    label: 'Approval request',
    shortLabel: 'Approve',
    description: 'Request governed approval for race-day action.',
    requiresHorse: false,
    requiresRace: true,
    optionalNote: true,
    keyboardShortcut: '9',
    defaultNotePlaceholder: 'Justification (required)…',
    statusOptions: [
      { value: 'race-start', label: 'Race start', tone: 'watch', oneTap: false, payload: { protectedAction: 'race-start' } },
      { value: 'scratch', label: 'Scratch', tone: 'warning', oneTap: false, payload: { protectedAction: 'horse-scratch' } },
      { value: 'surface-action', label: 'Surface action', tone: 'watch', oneTap: false, payload: { protectedAction: 'surface-operational-action' } },
    ],
  },
};

export const raceDayQuickActionList = Object.values(raceDayQuickActions);

export function getRaceDayQuickAction(action: RaceDayQuickAction): RaceDayQuickActionDefinition {
  return raceDayQuickActions[action];
}

export interface RaceDayQuickEntryContext {
  horseId?: string;
  horseName?: string;
  raceId: string;
  raceCardId?: string;
  entryId?: string;
  saddleCloth?: number;
  postPosition?: number;
}

export interface RaceDayQuickEntryPayload {
  action: RaceDayQuickAction;
  status: string;
  context: RaceDayQuickEntryContext;
  note?: string;
  optionPayload?: Record<string, unknown>;
}

export interface RaceDayQuickEntryResult {
  accepted: boolean;
  message: string;
  auditId?: string;
  approvalRequired?: boolean;
  approvalRequestId?: string;
}
