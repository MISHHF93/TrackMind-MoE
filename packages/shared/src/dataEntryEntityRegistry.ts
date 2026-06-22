import type { Permission, Role } from './accessControl.js';
import { protectedActions, roles } from './accessControl.js';
import type { ContractRule } from './apiContracts.js';
import type {
  DataEntryAutosavePolicy,
  DataEntryDraftPolicy,
  DataEntryEntityKind,
  DataEntryFieldDefinition,
  DataEntryFieldOption,
  DataEntryFormDefinition,
  DataEntryFormMode,
  DataEntrySubmitBinding,
} from './dataEntryFramework.js';

const severityOptions: DataEntryFieldOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const privacyScopeOptions: DataEntryFieldOption[] = [
  { value: 'public', label: 'Public summary' },
  { value: 'racing-officials', label: 'Racing officials' },
  { value: 'care-team', label: 'Care team' },
  { value: 'regulator', label: 'Regulator' },
  { value: 'veterinary-confidential', label: 'Veterinary confidential' },
];

const clearanceStateOptions: DataEntryFieldOption[] = [
  { value: 'none', label: 'No clearance change' },
  { value: 'pending-review', label: 'Pending review' },
  { value: 'cleared', label: 'Cleared' },
  { value: 'restricted', label: 'Restricted' },
  { value: 'vet-hold', label: 'Veterinary hold' },
  { value: 'denied', label: 'Denied' },
];

const raceDayImpactOptions: DataEntryFieldOption[] = [
  { value: 'none', label: 'No race-day impact' },
  { value: 'monitor-only', label: 'Monitor only' },
  { value: 'paddock-hold', label: 'Paddock hold' },
  { value: 'gate-delay', label: 'Gate delay' },
  { value: 'scratch-recommended', label: 'Scratch recommended' },
  { value: 'eligibility-hold', label: 'Eligibility hold' },
];

const equineObservationTypeOptions: DataEntryFieldOption[] = [
  { value: 'lameness', label: 'Lameness / gait' },
  { value: 'behavior', label: 'Behavior' },
  { value: 'body-condition', label: 'Body condition' },
  { value: 'hydration', label: 'Hydration' },
  { value: 'respiratory', label: 'Respiratory' },
  { value: 'medication', label: 'Medication / treatment' },
  { value: 'injury', label: 'Injury sign' },
  { value: 'transport-stress', label: 'Transport stress' },
  { value: 'general-exam', label: 'General exam' },
  { value: 'other', label: 'Other' },
];

const priorityOptions: DataEntryFieldOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const surfaceOptions: DataEntryFieldOption[] = [
  { value: 'dirt', label: 'Dirt' },
  { value: 'turf', label: 'Turf' },
  { value: 'synthetic', label: 'Synthetic' },
];

const dataSourceOptions: DataEntryFieldOption[] = [
  { value: 'manual-entry', label: 'Manual entry' },
  { value: 'registry-import', label: 'Registry import' },
  { value: 'steward-report', label: 'Steward report' },
  { value: 'vet-system', label: 'Veterinary system' },
  { value: 'barn-operations', label: 'Barn operations' },
  { value: 'clocker-report', label: 'Clocker report' },
];

function dataSourceField(): DataEntryFieldDefinition {
  return field('dataSource', 'Data source', 'select', {
    required: true,
    defaultValue: 'manual-entry',
    options: dataSourceOptions,
    helpText: 'Origin of this record for audit and lineage.',
  });
}

function auditReasonField(minLength = 8): DataEntryFieldDefinition {
  return field('reason', 'Audit reason', 'textarea', { required: true, minLength, rows: 2 });
}

function field(
  path: string,
  label: string,
  type: DataEntryFieldDefinition['type'],
  options: Partial<DataEntryFieldDefinition> = {},
): DataEntryFieldDefinition {
  return { path, label, type, ...options };
}

function form(
  entityKind: DataEntryEntityKind,
  displayName: string,
  modes: DataEntryFormMode[],
  fields: DataEntryFieldDefinition[],
  submit: DataEntrySubmitBinding,
  options: {
    requiredPermission: Permission;
    allowedRoles: Role[];
    draft?: DataEntryDraftPolicy;
    autosave?: DataEntryAutosavePolicy;
    auditAction: string;
    description?: string;
  },
): DataEntryFormDefinition {
  return {
    entityKind,
    displayName,
    schemaVersion: 'trackmind.data-entry.v1',
    modes,
    fields,
    submit,
    requiredPermission: options.requiredPermission,
    allowedRoles: options.allowedRoles,
    draft: options.draft ?? { enabled: true, storage: 'server' },
    autosave: options.autosave ?? { enabled: false, debounceMs: 0 },
    auditAction: options.auditAction,
    description: options.description,
  };
}

export const dataEntryEntityForms: Record<DataEntryEntityKind, DataEntryFormDefinition> = {
  horse: form(
    'horse',
    'Horse profile',
    ['create', 'edit'],
    [
      field('name', 'Registered name', 'text', { required: true, maxLength: 120 }),
      field('microchipId', 'Microchip ID', 'text', { maxLength: 64 }),
      field('foaled', 'Foaling date', 'date'),
      field('sex', 'Sex', 'select', {
        options: [
          { value: 'colt', label: 'Colt' },
          { value: 'filly', label: 'Filly' },
          { value: 'gelding', label: 'Gelding' },
          { value: 'mare', label: 'Mare' },
          { value: 'stallion', label: 'Stallion' },
        ],
      }),
      field('breed', 'Breed', 'text'),
      field('color', 'Color', 'text'),
      dataSourceField(),
      field('confirmOverwrite', 'Confirm identity update', 'checkbox', {
        helpText: 'Required when editing registered identity fields.',
      }),
      auditReasonField(),
    ],
    { createPath: '/horse-registry/horses', editPath: '/horse-registry/horses/{recordId}/identity', method: 'POST' },
    {
      requiredPermission: 'identity:write',
      allowedRoles: ['platform-super-admin', 'horse-operations-coordinator', 'compliance-officer'],
      draft: { enabled: true, storage: 'both', retentionDays: 14, warnOnDiscard: true },
      autosave: { enabled: true, debounceMs: 5000 },
      auditAction: 'horse-registry.registered',
      description: 'Identity-only registration and updates. Operational status is managed separately.',
    },
  ),

  'horse-ownership': form(
    'horse-ownership',
    'Ownership details',
    ['create'],
    [
      field('horseId', 'Horse ID', 'text', { required: true }),
      field('ownerId', 'Owner ID', 'text', { required: true }),
      field('ownerName', 'Owner name', 'text', { required: true, maxLength: 120 }),
      field('effectiveFrom', 'Effective from', 'date', { required: true }),
      field('percentage', 'Ownership %', 'number', { required: true, min: 1, max: 100, defaultValue: 100 }),
      dataSourceField(),
      auditReasonField(),
    ],
    { createPath: '/horse-registry/horses/{horseId}/ownership', method: 'POST' },
    {
      requiredPermission: 'identity:write',
      allowedRoles: ['platform-super-admin', 'horse-operations-coordinator', 'compliance-officer'],
      draft: { enabled: true, storage: 'server' },
      auditAction: 'horse-registry.ownership.updated',
      description: 'Append ownership history entry — does not overwrite prior owners.',
    },
  ),

  'stable-assignment': form(
    'stable-assignment',
    'Stable assignment',
    ['create'],
    [
      field('horseId', 'Horse ID', 'text', { required: true }),
      field('barnId', 'Barn ID', 'text', { required: true }),
      field('stallId', 'Stall ID', 'text'),
      field('assignedAt', 'Assigned at', 'datetime-local', { required: true }),
      dataSourceField(),
      auditReasonField(),
    ],
    { createPath: '/horse-registry/horses/{horseId}/stable', method: 'POST' },
    {
      requiredPermission: 'identity:write',
      allowedRoles: ['platform-super-admin', 'horse-operations-coordinator', 'facilities-manager'],
      auditAction: 'horse-registry.stable.assigned',
      description: 'Assign barn and stall; prior assignment is closed automatically.',
    },
  ),

  'race-eligibility': form(
    'race-eligibility',
    'Race eligibility',
    ['create', 'edit'],
    [
      field('horseId', 'Horse ID', 'text', { required: true }),
      field('scratchStatus', 'Scratch status', 'select', {
        required: true,
        defaultValue: 'active',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'vet-scratch', label: 'Vet scratch' },
          { value: 'steward-scratch', label: 'Steward scratch' },
          { value: 'trainer-scratch', label: 'Trainer scratch' },
        ],
      }),
      field('hisaCompliance', 'HISA compliance', 'select', {
        required: true,
        defaultValue: 'compliant',
        options: [
          { value: 'compliant', label: 'Compliant' },
          { value: 'under-review', label: 'Under review' },
          { value: 'non-compliant', label: 'Non-compliant' },
        ],
      }),
      field('eligibilityFlags', 'Eligibility flags', 'textarea', {
        placeholder: 'One flag per line',
        rows: 2,
        helpText: 'Optional steward flags (e.g. medication hold, equipment review).',
      }),
      field('raceRestrictions', 'Race restrictions', 'textarea', {
        placeholder: 'One restriction per line',
        rows: 2,
      }),
      dataSourceField(),
      field('confirmOverwrite', 'Confirm eligibility update', 'checkbox', {
        helpText: 'Required when changing eligibility posture on an existing record.',
      }),
      auditReasonField(12),
    ],
    { createPath: '/horses/{horseId}/eligibility', editPath: '/horses/{horseId}/eligibility', method: 'POST' },
    {
      requiredPermission: 'race:request-start',
      allowedRoles: ['platform-super-admin', 'horse-operations-coordinator', 'steward', 'compliance-officer'],
      draft: { enabled: true, storage: 'server' },
      auditAction: 'equine.eligibility.updated',
      description: 'Steward-managed race eligibility posture.',
    },
  ),

  'transport-record': form(
    'transport-record',
    'Transport record',
    ['create'],
    [
      field('horseId', 'Horse ID', 'text', { required: true }),
      field('from', 'From location', 'text', { required: true }),
      field('to', 'To location', 'text', { required: true }),
      field('departedAt', 'Departed at', 'datetime-local', { required: true }),
      field('arrivedAt', 'Arrived at', 'datetime-local'),
      field('transporter', 'Transporter', 'text', { required: true }),
      field('welfareChecks', 'Welfare checks', 'textarea', {
        placeholder: 'One check per line (e.g. water offered, temperature checked)',
        rows: 2,
      }),
      dataSourceField(),
      auditReasonField(),
    ],
    { createPath: '/equine-intelligence/horses/{horseId}/transport', method: 'POST' },
    {
      requiredPermission: 'track:readings',
      allowedRoles: ['platform-super-admin', 'horse-operations-coordinator', 'facilities-manager'],
      auditAction: 'equine.transport.recorded',
      description: 'Log horse movement with welfare checks.',
    },
  ),

  'workout-record': form(
    'workout-record',
    'Workout record',
    ['create'],
    [
      field('horseId', 'Horse ID', 'text', { required: true }),
      field('date', 'Workout date', 'date', { required: true }),
      field('trackId', 'Track ID', 'text', { required: true, defaultValue: 'main-track' }),
      field('distanceFurlongs', 'Distance (furlongs)', 'number', { required: true, min: 1, max: 20 }),
      field('timeSeconds', 'Time (seconds)', 'number', { required: true, min: 1 }),
      field('surface', 'Surface', 'select', { required: true, options: surfaceOptions, defaultValue: 'dirt' }),
      dataSourceField(),
      auditReasonField(),
    ],
    { createPath: '/equine-intelligence/horses/{horseId}/workouts', method: 'POST' },
    {
      requiredPermission: 'track:readings',
      allowedRoles: ['platform-super-admin', 'horse-operations-coordinator'],
      auditAction: 'equine.workout.recorded',
      description: 'Record timed workout from clocker or manual entry.',
    },
  ),

  'retirement-record': form(
    'retirement-record',
    'Retirement status',
    ['create'],
    [
      field('horseId', 'Horse ID', 'text', { required: true }),
      field('retiredAt', 'Retired at', 'datetime-local', { required: true }),
      field('retirementReason', 'Retirement reason', 'textarea', { required: true, minLength: 12, rows: 3 }),
      field('destination', 'Destination', 'text', { required: true }),
      field('aftercareContact', 'Aftercare contact', 'text'),
      dataSourceField(),
      field('confirmRetirement', 'Confirm irreversible retirement', 'checkbox', {
        required: true,
        helpText: 'Retirement changes lifecycle status permanently.',
      }),
      auditReasonField(12),
    ],
    { createPath: '/horse-registry/horses/{horseId}/retirement', method: 'POST' },
    {
      requiredPermission: 'identity:write',
      allowedRoles: ['platform-super-admin', 'horse-operations-coordinator', 'compliance-officer', 'veterinarian'],
      draft: { enabled: true, storage: 'server' },
      auditAction: 'horse-registry.retired',
      description: 'Formal retirement with aftercare destination.',
    },
  ),

  race: form(
    'race',
    'Race schedule entry',
    ['create', 'edit'],
    [
      field('raceNumber', 'Race number', 'number', { required: true, min: 1 }),
      field('surface', 'Surface', 'select', { required: true, options: surfaceOptions, defaultValue: 'dirt' }),
      field('postTime', 'Post time', 'datetime-local', { required: true }),
      field('distanceMeters', 'Distance (m)', 'number', { min: 400 }),
      field('reason', 'Audit reason', 'textarea', { required: true, minLength: 8, rows: 2 }),
    ],
    { createPath: '/racing-calendar/schedules/draft-requests', editPath: '/racing-calendar/schedules/draft-requests', method: 'POST' },
    {
      requiredPermission: 'race:request-start',
      allowedRoles: ['platform-super-admin', 'horse-operations-coordinator'],
      draft: { enabled: true, storage: 'both' },
      autosave: { enabled: true, debounceMs: 4000 },
      auditAction: 'calendar.schedule.draft.requested',
    },
  ),

  'race-card': form(
    'race-card',
    'Create race card',
    ['create'],
    [
      field('raceDayId', 'Race day ID', 'text', { required: true }),
      field('raceDate', 'Race date', 'date', { required: true }),
      field('raceNumber', 'Race number', 'number', { required: true, min: 1 }),
      field('scheduledPostTime', 'Scheduled post time', 'datetime-local', { required: true }),
      field('surface', 'Surface', 'select', { required: true, options: surfaceOptions, defaultValue: 'dirt' }),
      field('distanceFurlongs', 'Distance (furlongs)', 'number', { required: true, min: 1, max: 20, defaultValue: 6 }),
      field('classLevel', 'Class level', 'text', { required: true, defaultValue: 'Open' }),
      field('basePurse', 'Base purse', 'number', { required: true, min: 0, defaultValue: 0 }),
      auditReasonField(),
    ],
    { createPath: '/race-cards', method: 'POST' },
    {
      requiredPermission: 'race:request-start',
      allowedRoles: ['platform-super-admin', 'horse-operations-coordinator'],
      draft: { enabled: true, storage: 'both', retentionDays: 14, warnOnDiscard: true },
      autosave: { enabled: true, debounceMs: 5000 },
      auditAction: 'race-card.created',
      description: 'Create a draft race card shell with initial conditions.',
    },
  ),

  'race-card-conditions': form(
    'race-card-conditions',
    'Race conditions',
    ['create', 'edit'],
    [
      field('raceCardId', 'Race card ID', 'text', { required: true }),
      field('surface', 'Surface', 'select', { required: true, options: surfaceOptions }),
      field('distanceFurlongs', 'Distance (furlongs)', 'number', { required: true, min: 1, max: 20 }),
      field('trackCondition', 'Track condition', 'text', { placeholder: 'e.g. fast, good, yielding' }),
      field('ageRestriction', 'Age restriction', 'text'),
      field('sexRestriction', 'Sex restriction', 'text'),
      field('eligibility', 'Eligibility rules', 'textarea', { placeholder: 'One rule per line', rows: 2 }),
      field('medicationRules', 'Medication rules', 'textarea', { placeholder: 'One rule per line', rows: 2 }),
      auditReasonField(),
    ],
    { createPath: '/race-cards/{recordId}/conditions', editPath: '/race-cards/{recordId}/conditions', method: 'POST' },
    {
      requiredPermission: 'race:request-start',
      allowedRoles: ['platform-super-admin', 'horse-operations-coordinator', 'steward'],
      draft: { enabled: true, storage: 'server' },
      autosave: { enabled: true, debounceMs: 4000 },
      auditAction: 'race-card.conditions.updated',
    },
  ),

  'race-card-classification': form(
    'race-card-classification',
    'Race classification',
    ['create', 'edit'],
    [
      field('raceCardId', 'Race card ID', 'text', { required: true }),
      field('classLevel', 'Class level', 'text', { required: true }),
      field('stakesGrade', 'Stakes grade', 'select', {
        required: true,
        defaultValue: 'allowance',
        options: [
          { value: 'graded-1', label: 'Grade 1' },
          { value: 'graded-2', label: 'Grade 2' },
          { value: 'graded-3', label: 'Grade 3' },
          { value: 'listed', label: 'Listed' },
          { value: 'stakes', label: 'Stakes' },
          { value: 'allowance', label: 'Allowance' },
          { value: 'claiming', label: 'Claiming' },
          { value: 'maiden', label: 'Maiden' },
          { value: 'other', label: 'Other' },
        ],
      }),
      field('claimingPrice', 'Claiming price', 'number', { min: 0 }),
      field('division', 'Division', 'text'),
      field('restrictionType', 'Restriction type', 'text'),
      auditReasonField(),
    ],
    { createPath: '/race-cards/{recordId}/classification', editPath: '/race-cards/{recordId}/classification', method: 'POST' },
    {
      requiredPermission: 'race:request-start',
      allowedRoles: ['platform-super-admin', 'horse-operations-coordinator'],
      draft: { enabled: true, storage: 'server' },
      auditAction: 'race-card.classification.updated',
    },
  ),

  'race-card-purse': form(
    'race-card-purse',
    'Purse data',
    ['create', 'edit'],
    [
      field('raceCardId', 'Race card ID', 'text', { required: true }),
      field('basePurse', 'Base purse', 'number', { required: true, min: 0 }),
      field('currency', 'Currency', 'text', { required: true, defaultValue: 'USD' }),
      field('starterBonus', 'Starter bonus', 'number', { min: 0 }),
      field('breederAwards', 'Breeder awards', 'number', { min: 0 }),
      auditReasonField(),
    ],
    { createPath: '/race-cards/{recordId}/purse', editPath: '/race-cards/{recordId}/purse', method: 'POST' },
    {
      requiredPermission: 'race:request-start',
      allowedRoles: ['platform-super-admin', 'horse-operations-coordinator'],
      draft: { enabled: true, storage: 'server' },
      auditAction: 'race-card.purse.updated',
    },
  ),

  'race-card-entry': form(
    'race-card-entry',
    'Horse entry',
    ['create'],
    [
      field('raceCardId', 'Race card ID', 'text', { required: true }),
      field('horseId', 'Horse ID', 'text', { required: true }),
      field('trainerId', 'Trainer ID', 'text', { required: true }),
      field('ownerId', 'Owner ID', 'text', { required: true }),
      field('programNumber', 'Program number', 'text'),
      field('weightLbs', 'Weight (lbs)', 'number', { min: 100, max: 140 }),
      auditReasonField(),
    ],
    { createPath: '/race-cards/{recordId}/entries', method: 'POST' },
    {
      requiredPermission: 'race:request-start',
      allowedRoles: ['platform-super-admin', 'horse-operations-coordinator'],
      auditAction: 'race-card.entry.added',
      description: 'Add horse to race card — duplicate horses are rejected.',
    },
  ),

  'race-card-entry-trainer': form(
    'race-card-entry-trainer',
    'Entry trainer assignment',
    ['create', 'edit'],
    [
      field('raceCardId', 'Race card ID', 'text', { required: true }),
      field('entryId', 'Entry ID', 'text', { required: true }),
      field('trainerId', 'Trainer ID', 'text', { required: true }),
      auditReasonField(),
    ],
    { createPath: '/race-cards/{raceCardId}/entries/{entryId}/trainer', editPath: '/race-cards/{raceCardId}/entries/{entryId}/trainer', method: 'POST' },
    {
      requiredPermission: 'race:request-start',
      allowedRoles: ['platform-super-admin', 'horse-operations-coordinator'],
      auditAction: 'race-card.trainer.assigned',
    },
  ),

  'race-card-post-position': form(
    'race-card-post-position',
    'Post position',
    ['create', 'edit'],
    [
      field('raceCardId', 'Race card ID', 'text', { required: true }),
      field('entryId', 'Entry ID', 'text', { required: true }),
      field('postPosition', 'Post position', 'number', { required: true, min: 1, max: 30 }),
      auditReasonField(),
    ],
    { createPath: '/race-cards/{raceCardId}/entries/{entryId}/post-position', editPath: '/race-cards/{raceCardId}/entries/{entryId}/post-position', method: 'POST' },
    {
      requiredPermission: 'race:request-start',
      allowedRoles: ['platform-super-admin', 'horse-operations-coordinator'],
      auditAction: 'race-card.post-position.assigned',
    },
  ),

  'race-card-lifecycle': form(
    'race-card-lifecycle',
    'Race card status change',
    ['create'],
    [
      field('raceCardId', 'Race card ID', 'text', { required: true }),
      field('toStatus', 'Target status', 'select', {
        required: true,
        options: [
          { value: 'review', label: 'Submit for review' },
          { value: 'draft', label: 'Return to draft' },
          { value: 'approved', label: 'Mark approved' },
          { value: 'published', label: 'Publish' },
          { value: 'completed', label: 'Mark completed' },
          { value: 'archived', label: 'Archive' },
        ],
      }),
      field('transitionReason', 'Transition reason', 'textarea', { required: true, minLength: 12, rows: 3 }),
      auditReasonField(12),
    ],
    { createPath: '/race-cards/{recordId}/lifecycle-transitions', method: 'POST' },
    {
      requiredPermission: 'race:request-start',
      allowedRoles: ['platform-super-admin', 'horse-operations-coordinator', 'steward'],
      auditAction: 'race-card.lifecycle.transitioned',
      description: 'Governed lifecycle transition — approval may be required for approve/publish.',
    },
  ),

  'unified-incident': form(
    'unified-incident',
    'Unified incident intake',
    ['create', 'edit'],
    [
      field('incidentType', 'Incident type', 'select', {
        required: true,
        defaultValue: 'operational-disruption',
        options: [
          { value: 'safety', label: 'Safety incident' },
          { value: 'steward', label: 'Steward incident' },
          { value: 'equine-welfare', label: 'Equine welfare incident' },
          { value: 'facilities', label: 'Facilities incident' },
          { value: 'security-manager', label: 'Security incident' },
          { value: 'operational-disruption', label: 'Operational disruption' },
        ],
      }),
      field('intakeMode', 'Intake mode', 'select', {
        required: true,
        defaultValue: 'triage',
        options: [
          { value: 'triage', label: 'Triage (fast)' },
          { value: 'full', label: 'Full detail' },
        ],
      }),
      field('severity', 'Severity', 'select', { required: true, options: severityOptions, defaultValue: 'medium' }),
      field('location', 'Location', 'text', { required: true, placeholder: 'Zone, barn, race, or asset reference' }),
      field('summary', 'Summary', 'textarea', { required: true, minLength: 8, rows: 2, helpText: 'One-line triage summary for command board.' }),
      field('detailedNotes', 'Detailed notes', 'textarea', { minLength: 12, rows: 5, helpText: 'Required in full-detail mode.' }),
      field('involvedEntities', 'Involved entities', 'textarea', {
        placeholder: 'One per line: kind:id:label (e.g. horse:horse-1:Star Runner)',
        rows: 3,
      }),
      field('evidenceRefs', 'Attachments / evidence', 'textarea', { placeholder: 'One reference per line', rows: 2 }),
      field('recommendedNextAction', 'Recommended next action', 'textarea', {
        rows: 2,
        helpText: 'Advisory routing only — does not execute emergency or disciplinary action.',
      }),
      field('approvalRequired', 'Approval required', 'checkbox', { defaultValue: false }),
      field('subjectKind', 'Primary subject kind', 'text'),
      field('subjectId', 'Primary subject ID', 'text'),
      auditReasonField(),
    ],
    { createPath: '/incidents/intake', editPath: '/incidents/{recordId}', method: 'POST' },
    {
      requiredPermission: 'incident:manage',
      allowedRoles: ['platform-super-admin', 'steward', 'security-manager', 'facilities-manager', 'organization-admin', 'veterinarian', 'compliance-officer'],
      draft: { enabled: true, storage: 'both', retentionDays: 14, warnOnDiscard: true },
      autosave: { enabled: true, debounceMs: 3000 },
      auditAction: 'incident.intake.recorded',
      description: 'Unified incident intake — records and routes only; no emergency or disciplinary execution.',
    },
  ),

  incident: form(
    'incident',
    'Operational incident',
    ['create', 'edit'],
    [
      field('title', 'Title', 'text', { required: true, maxLength: 200 }),
      field('severity', 'Severity', 'select', { required: true, options: severityOptions, defaultValue: 'medium' }),
      field('description', 'Description', 'textarea', { required: true, minLength: 12, rows: 4 }),
      field('subjectKind', 'Subject kind', 'text'),
      field('subjectId', 'Subject ID', 'text'),
      field('reason', 'Audit reason', 'textarea', { required: true, minLength: 8, rows: 2 }),
    ],
    { createPath: '/incidents', editPath: '/incidents/{recordId}', method: 'POST' },
    {
      requiredPermission: 'incident:manage',
      allowedRoles: ['platform-super-admin', 'steward', 'security-manager', 'facilities-manager', 'organization-admin'],
      draft: { enabled: true, storage: 'both', retentionDays: 14 },
      autosave: { enabled: true, debounceMs: 3000 },
      auditAction: 'incident.created',
    },
  ),

  approval: form(
    'approval',
    'Approval request',
    ['create'],
    [
      field('protectedAction', 'Protected action', 'text', { required: true, readOnly: true }),
      field('target', 'Target', 'text', { required: true }),
      field('reason', 'Justification', 'textarea', { required: true, minLength: 12, rows: 4 }),
      field('evidence', 'Evidence references', 'textarea', { placeholder: 'One reference per line', rows: 2 }),
    ],
    { createPath: '/approvals/controlled-actions', method: 'POST' },
    {
      requiredPermission: 'workflow:execute',
      allowedRoles: ['platform-super-admin', 'steward', 'organization-admin', 'compliance-officer'],
      draft: { enabled: true, storage: 'local' },
      auditAction: 'approval.requested',
    },
  ),

  'approval-request-composer': form(
    'approval-request-composer',
    'Approval request composer',
    ['create'],
    [
      field('composeMode', 'Compose mode', 'select', {
        required: true,
        defaultValue: 'quick',
        options: [
          { value: 'quick', label: 'Quick compose' },
          { value: 'full', label: 'Full compose' },
        ],
      }),
      field('sourceDomain', 'Domain', 'select', {
        required: true,
        defaultValue: 'race-day-action',
        options: [
          { value: 'ai-recommendation', label: 'AI recommendation' },
          { value: 'incident-action', label: 'Incident action' },
          { value: 'race-day-action', label: 'Race-day action' },
          { value: 'compliance-action', label: 'Compliance action' },
          { value: 'security-action', label: 'Security action' },
          { value: 'finance-action', label: 'Finance action' },
          { value: 'administrative-change', label: 'Administrative change' },
        ],
      }),
      field('requestTitle', 'Request title', 'text', { required: true, minLength: 6, placeholder: 'Short title for approvers' }),
      field('requestedAction', 'Requested action', 'select', {
        required: true,
        options: protectedActions.map((action) => ({ value: action, label: action.replace(/-/g, ' ') })),
      }),
      field('reason', 'Reason', 'textarea', { required: true, minLength: 12, rows: 3 }),
      field('riskLevel', 'Risk level', 'select', { required: true, defaultValue: 'medium', options: severityOptions }),
      field('requestedApproverRole', 'Requested approver role', 'select', {
        required: true,
        defaultValue: 'steward',
        options: roles.map((role) => ({ value: role, label: role.replace(/-/g, ' ') })),
      }),
      field('supportingEvidence', 'Supporting evidence', 'textarea', {
        placeholder: 'One reference per line (audit IDs, attachments, links)',
        rows: 3,
        helpText: 'Required in full compose mode.',
      }),
      field('expiresAt', 'Expiration', 'datetime-local', { helpText: 'Optional — defaults to policy SLA when omitted.' }),
      field('relatedEntityKind', 'Related entity kind', 'text', { placeholder: 'horse, race, asset, …' }),
      field('relatedEntityId', 'Related entity ID', 'text'),
      field('relatedIncidentId', 'Related incident', 'text', { placeholder: 'incident-…' }),
      field('relatedRecommendationId', 'Related recommendation', 'text', { placeholder: 'rec-…' }),
    ],
    { createPath: '/approvals/composer', method: 'POST' },
    {
      requiredPermission: 'workflow:execute',
      allowedRoles: ['platform-super-admin', 'steward', 'horse-operations-coordinator', 'facilities-manager', 'veterinarian', 'security-manager', 'finance-manager', 'compliance-officer', 'organization-admin'],
      draft: { enabled: true, storage: 'local' },
      auditAction: 'approval.requested',
      description: 'Guided approval submission — faster and clearer than raw controlled-action records.',
    },
  ),

  'audit-note': form(
    'audit-note',
    'Audit note',
    ['create'],
    [
      field('entityKind', 'Entity kind', 'select', {
        required: true,
        defaultValue: 'horse',
        options: [
          { value: 'horse', label: 'Horse' },
          { value: 'race', label: 'Race' },
          { value: 'race-day', label: 'Race day' },
          { value: 'incident', label: 'Incident' },
          { value: 'approval', label: 'Approval' },
          { value: 'facility', label: 'Facility' },
          { value: 'compliance', label: 'Compliance policy' },
          { value: 'security-event', label: 'Security event' },
          { value: 'user', label: 'User' },
          { value: 'trainer', label: 'Trainer' },
          { value: 'jockey', label: 'Jockey' },
        ],
      }),
      field('entityId', 'Entity ID', 'text', { required: true, helpText: 'Searchable picker when entity kind is selected.' }),
      field('note', 'Note', 'textarea', { required: true, minLength: 8, rows: 4 }),
      field('classification', 'Classification', 'select', {
        required: true,
        defaultValue: 'internal',
        options: [
          { value: 'public', label: 'Public' },
          { value: 'internal', label: 'Internal' },
          { value: 'confidential', label: 'Confidential' },
          { value: 'restricted', label: 'Restricted' },
        ],
      }),
      field('reason', 'Audit reason', 'textarea', { required: true, minLength: 8, rows: 2 }),
    ],
    { createPath: '/data-entry/submit/audit-note', method: 'POST' },
    {
      requiredPermission: 'workflow:execute',
      allowedRoles: ['platform-super-admin', 'compliance-officer', 'read-only-auditor', 'steward'],
      auditAction: 'audit.note.recorded',
    },
  ),

  'operational-note': form(
    'operational-note',
    'Operational note',
    ['create', 'edit'],
    [
      field('entryMode', 'Entry mode', 'select', {
        required: true,
        defaultValue: 'flash',
        options: [
          { value: 'flash', label: 'Flash entry (keyboard-friendly)' },
          { value: 'full', label: 'Full journal record' },
        ],
      }),
      field('noteId', 'Note ID', 'text', { helpText: 'Required when editing an existing note.' }),
      field('subjectKind', 'Subject', 'select', {
        required: true,
        defaultValue: 'race-day-log',
        options: [
          { value: 'horse', label: 'Horse' },
          { value: 'race', label: 'Race' },
          { value: 'incident', label: 'Incident' },
          { value: 'approval', label: 'Approval' },
          { value: 'facilities', label: 'Facilities' },
          { value: 'security-event', label: 'Security event' },
          { value: 'compliance', label: 'Compliance' },
          { value: 'meeting', label: 'Meeting' },
          { value: 'race-day-log', label: 'Race-day log' },
        ],
      }),
      field('entityId', 'Related entity ID', 'text', { required: true }),
      field('entityLabel', 'Related entity label', 'text'),
      field('body', 'Note body', 'textarea', { required: true, minLength: 4, rows: 4, helpText: 'Primary journal content.' }),
      field('author', 'Author', 'text', { readOnly: true }),
      field('authoredAt', 'Authored at', 'datetime-local'),
      field('tags', 'Tags', 'text', { placeholder: 'comma or newline separated', helpText: 'e.g. follow-up, gate, surface' }),
      field('visibilityScope', 'Visibility scope', 'select', {
        defaultValue: 'team',
        options: [
          { value: 'team', label: 'Team (workspace)' },
          { value: 'role-scoped', label: 'Role-scoped' },
          { value: 'internal', label: 'Internal' },
          { value: 'confidential', label: 'Confidential' },
          { value: 'restricted', label: 'Restricted' },
        ],
      }),
      field('visibleToRoles', 'Visible to roles', 'textarea', { rows: 2, placeholder: 'security\nsteward', helpText: 'Optional when visibility is role-scoped.' }),
      field('followUpRequired', 'Follow-up required', 'checkbox', { defaultValue: false }),
      field('auditAware', 'Audit-linked', 'checkbox', { defaultValue: true, helpText: 'Record immutable audit trail for this note.' }),
      field('editReason', 'Edit reason', 'textarea', { rows: 2, helpText: 'Required context when revising an editable note.' }),
      field('reason', 'Audit reason', 'textarea', { required: true, minLength: 4, rows: 2 }),
    ],
    { createPath: '/operational-notes/intake', editPath: '/operational-notes/revisions', method: 'POST' },
    {
      requiredPermission: 'read:any',
      allowedRoles: ['platform-super-admin', 'organization-admin', 'facilities-manager', 'steward', 'security-manager', 'compliance-officer', 'veterinarian'],
      autosave: { enabled: true, debounceMs: 1500 },
      auditAction: 'operational-note.recorded',
      description: 'Unified operational journal with tags, visibility, follow-up flags, and edit history.',
    },
  ),

  'veterinary-observation': form(
    'veterinary-observation',
    'Veterinary observation',
    ['create'],
    [
      field('entryMode', 'Entry mode', 'select', {
        required: true,
        defaultValue: 'quick',
        options: [
          { value: 'quick', label: 'Quick note' },
          { value: 'professional', label: 'Professional detail' },
        ],
      }),
      field('horseId', 'Horse', 'text', { required: true }),
      field('observationType', 'Observation type', 'select', {
        required: true,
        options: equineObservationTypeOptions.filter((option) => !['body-condition', 'transport-stress'].includes(option.value)),
      }),
      field('observedAt', 'Observation time', 'datetime-local', { required: true }),
      field('observedBy', 'Observed by', 'text', { required: true, helpText: 'Observer ID — defaults to current actor.' }),
      field('observerRole', 'Observer role', 'select', {
        required: true,
        defaultValue: 'veterinarian',
        options: roles.map((role) => ({ value: role, label: role.replace(/-/g, ' ') })),
        visibleToRoles: ['platform-super-admin', 'veterinarian', 'compliance-officer', 'steward'],
      }),
      field('severity', 'Severity', 'select', { required: true, options: severityOptions, defaultValue: 'medium' }),
      field('notes', 'Clinical notes', 'textarea', {
        required: true,
        minLength: 8,
        rows: 4,
        classification: 'restricted',
        visibleToRoles: ['platform-super-admin', 'veterinarian', 'compliance-officer'],
      }),
      field('followUpNeeded', 'Follow-up needed', 'checkbox', { defaultValue: false }),
      field('clearanceState', 'Clearance / restriction state', 'select', {
        defaultValue: 'none',
        options: clearanceStateOptions,
        visibleToRoles: ['platform-super-admin', 'veterinarian', 'steward', 'horse-operations-coordinator', 'compliance-officer'],
      }),
      field('restrictions', 'Active restrictions', 'textarea', {
        placeholder: 'One restriction per line',
        rows: 2,
        classification: 'restricted',
        visibleToRoles: ['platform-super-admin', 'veterinarian', 'steward', 'compliance-officer'],
      }),
      field('privacyScope', 'Privacy scope', 'select', {
        required: true,
        defaultValue: 'veterinary-confidential',
        options: privacyScopeOptions,
        visibleToRoles: ['platform-super-admin', 'veterinarian', 'compliance-officer'],
      }),
      field('raceDayImpact', 'Linked race-day impact', 'select', {
        defaultValue: 'none',
        options: raceDayImpactOptions,
        visibleToRoles: ['platform-super-admin', 'veterinarian', 'steward', 'horse-operations-coordinator'],
      }),
      dataSourceField(),
      auditReasonField(8),
    ],
    {
      createPath: '/veterinary-operations/horses/{horseId}/observations',
      method: 'POST',
    },
    {
      requiredPermission: 'vet:review',
      allowedRoles: ['platform-super-admin', 'veterinarian', 'steward', 'facilities-manager'],
      draft: { enabled: true, storage: 'both', retentionDays: 14, warnOnDiscard: true },
      autosave: { enabled: true, debounceMs: 4000 },
      auditAction: 'veterinary.observation.recorded',
      description: 'Immutable clinical observation — append-only history with privacy scope enforcement.',
    },
  ),

  'welfare-observation': form(
    'welfare-observation',
    'Welfare observation',
    ['create'],
    [
      field('entryMode', 'Entry mode', 'select', {
        required: true,
        defaultValue: 'quick',
        options: [
          { value: 'quick', label: 'Quick note' },
          { value: 'professional', label: 'Professional detail' },
        ],
      }),
      field('horseId', 'Horse', 'text', { required: true }),
      field('observationType', 'Observation type', 'select', {
        required: true,
        options: equineObservationTypeOptions,
      }),
      field('observedAt', 'Observation time', 'datetime-local', { required: true }),
      field('observedBy', 'Observed by', 'text', { required: true }),
      field('role', 'Observer role', 'select', {
        required: true,
        defaultValue: 'equine-welfare-officer',
        options: [
          { value: 'equine-welfare-officer', label: 'Equine welfare officer' },
          { value: 'welfare-officer', label: 'Welfare officer (legacy)' },
          { value: 'veterinarian', label: 'Veterinarian' },
          { value: 'trainer', label: 'Trainer' },
          { value: 'groom', label: 'Groom' },
          { value: 'steward', label: 'Steward' },
        ],
      }),
      field('severity', 'Severity', 'select', { required: true, options: severityOptions, defaultValue: 'medium' }),
      field('score', 'Welfare score (1–100)', 'number', { min: 1, max: 100, helpText: 'Optional in quick mode — inferred from severity when omitted.' }),
      field('notes', 'Observation notes', 'textarea', { required: true, minLength: 8, rows: 4 }),
      field('followUpNeeded', 'Follow-up needed', 'checkbox', { defaultValue: false }),
      field('clearanceState', 'Clearance / restriction state', 'select', {
        defaultValue: 'none',
        options: clearanceStateOptions,
        visibleToRoles: ['platform-super-admin', 'veterinarian', 'steward', 'horse-operations-coordinator'],
      }),
      field('restrictions', 'Active restrictions', 'textarea', {
        placeholder: 'One restriction per line',
        rows: 2,
        visibleToRoles: ['platform-super-admin', 'veterinarian', 'steward', 'horse-operations-coordinator'],
      }),
      field('privacyScope', 'Privacy scope', 'select', {
        defaultValue: 'care-team',
        options: privacyScopeOptions.filter((option) => option.value !== 'veterinary-confidential'),
        visibleToRoles: ['platform-super-admin', 'veterinarian', 'steward', 'compliance-officer'],
      }),
      field('raceDayImpact', 'Linked race-day impact', 'select', {
        defaultValue: 'none',
        options: raceDayImpactOptions,
      }),
      field('interventions', 'Interventions', 'textarea', { placeholder: 'One per line', rows: 2 }),
      dataSourceField(),
      auditReasonField(8),
    ],
    { createPath: '/equine-welfare/observations', method: 'POST' },
    {
      requiredPermission: 'vet:review',
      allowedRoles: ['platform-super-admin', 'veterinarian', 'steward', 'horse-operations-coordinator', 'facilities-manager'],
      draft: { enabled: true, storage: 'both', retentionDays: 14, warnOnDiscard: true },
      autosave: { enabled: true, debounceMs: 4000 },
      auditAction: 'welfare.observation.recorded',
      description: 'Immutable welfare observation — field staff quick entry with optional race-day linkage.',
    },
  ),

  'trainer-assignment': form(
    'trainer-assignment',
    'Trainer assignment',
    ['create', 'edit'],
    [
      field('horseId', 'Horse ID', 'text', { required: true }),
      field('trainerId', 'Trainer ID', 'text', { required: true }),
      field('trainerName', 'Trainer name', 'text', { required: true }),
      field('effectiveFrom', 'Effective from', 'date', { required: true }),
      field('licenseStatus', 'License status', 'select', {
        required: true,
        defaultValue: 'active',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'expired', label: 'Expired' },
          { value: 'suspended', label: 'Suspended' },
        ],
      }),
      dataSourceField(),
      auditReasonField(),
    ],
    { createPath: '/horse-registry/horses/{horseId}/trainer', editPath: '/horse-registry/horses/{horseId}/trainer', method: 'POST' },
    {
      requiredPermission: 'identity:write',
      allowedRoles: ['platform-super-admin', 'horse-operations-coordinator'],
      auditAction: 'horse-registry.trainer.assigned',
    },
  ),

  'jockey-assignment': form(
    'jockey-assignment',
    'Jockey assignment',
    ['create', 'edit'],
    [
      field('raceCardId', 'Race card ID', 'text', { required: true }),
      field('entryId', 'Entry ID', 'text', { required: true }),
      field('jockeyId', 'Jockey ID', 'text', { required: true }),
      field('weightLbs', 'Assigned weight (lbs)', 'number', { min: 100, max: 140 }),
      field('reason', 'Audit reason', 'textarea', { required: true, minLength: 8, rows: 2 }),
    ],
    {
      createPath: '/race-cards/{raceCardId}/entries/{entryId}/jockey',
      editPath: '/race-cards/{raceCardId}/entries/{entryId}/jockey',
      method: 'POST',
    },
    {
      requiredPermission: 'race:request-start',
      allowedRoles: ['platform-super-admin', 'horse-operations-coordinator'],
      auditAction: 'race-card.jockey.assigned',
    },
  ),

  'paddock-record': form(
    'paddock-record',
    'Paddock record',
    ['create', 'edit'],
    [
      field('horseId', 'Horse ID', 'text', { required: true }),
      field('assignmentType', 'Assignment type', 'select', {
        required: true,
        options: [
          { value: 'arrival', label: 'Arrival' },
          { value: 'inspection', label: 'Inspection' },
          { value: 'readiness', label: 'Readiness check' },
          { value: 'departure', label: 'Departure' },
        ],
      }),
      field('status', 'Status', 'select', {
        required: true,
        defaultValue: 'scheduled',
        options: [
          { value: 'scheduled', label: 'Scheduled' },
          { value: 'in-progress', label: 'In progress' },
          { value: 'complete', label: 'Complete' },
          { value: 'blocked', label: 'Blocked' },
        ],
      }),
      field('notes', 'Notes', 'textarea', { rows: 3 }),
      field('reason', 'Audit reason', 'textarea', { required: true, minLength: 8, rows: 2 }),
    ],
    { createPath: '/paddock-operations/assignments', editPath: '/paddock-operations/assignments/{recordId}', method: 'POST' },
    {
      requiredPermission: 'track:readings',
      allowedRoles: ['platform-super-admin', 'horse-operations-coordinator', 'facilities-manager'],
      autosave: { enabled: true, debounceMs: 5000 },
      auditAction: 'paddock.record.recorded',
    },
  ),

  'security-incident': form(
    'security-incident',
    'Security incident',
    ['create', 'edit'],
    [
      field('title', 'Title', 'text', { required: true, maxLength: 200 }),
      field('severity', 'Severity', 'select', { required: true, options: severityOptions, defaultValue: 'high' }),
      field('zoneId', 'Zone ID', 'text'),
      field('description', 'Description', 'textarea', { required: true, minLength: 12, rows: 4 }),
      field('sensitiveDetails', 'Sensitive details', 'textarea', {
        rows: 3,
        visibleToRoles: ['platform-super-admin', 'security-manager'],
        requiredPermission: 'security:sensitive-read',
      }),
      field('reason', 'Audit reason', 'textarea', { required: true, minLength: 8, rows: 2 }),
    ],
    { createPath: '/data-entry/submit/security-incident', editPath: '/data-entry/submit/security-incident', method: 'POST' },
    {
      requiredPermission: 'security:manage',
      allowedRoles: ['platform-super-admin', 'security-manager', 'organization-admin'],
      autosave: { enabled: true, debounceMs: 3000 },
      auditAction: 'security.incident.reported',
    },
  ),

  'security-event-entry': form(
    'security-event-entry',
    'Security event entry',
    ['create'],
    [
      field('entryMode', 'Entry mode', 'select', {
        required: true,
        defaultValue: 'quick',
        options: [
          { value: 'quick', label: 'Quick report' },
          { value: 'full', label: 'Full detail' },
        ],
      }),
      field('eventType', 'Event type', 'select', {
        required: true,
        defaultValue: 'access-issue',
        options: [
          { value: 'restricted-zone', label: 'Restricted zone event' },
          { value: 'access-issue', label: 'Access issue' },
          { value: 'suspicious-activity', label: 'Suspicious activity' },
          { value: 'security-incident', label: 'Security incident report' },
          { value: 'personnel-event', label: 'Personnel-related event' },
          { value: 'escalation-request', label: 'Escalation request' },
        ],
      }),
      field('severity', 'Severity', 'select', { required: true, options: severityOptions, defaultValue: 'medium' }),
      field('zoneId', 'Zone', 'select', {
        defaultValue: 'zone-paddock',
        options: [
          { value: 'zone-backstretch-medication', label: 'Backstretch medication (critical)' },
          { value: 'zone-paddock', label: 'Paddock restricted gate' },
          { value: 'zone-grandstand', label: 'Grandstand concourse' },
        ],
        helpText: 'Required for zone and access events.',
      }),
      field('summary', 'Summary', 'textarea', { required: true, minLength: 8, rows: 2, helpText: 'One-line description for audit trail and follow-up.' }),
      field('detailedNotes', 'Detailed notes', 'textarea', { minLength: 12, rows: 4 }),
      field('personDisplayName', 'Person (display)', 'text', { helpText: 'Subject display name — avoid legal name in quick mode when possible.' }),
      field('personLegalName', 'Person (legal name)', 'text', {
        visibleToRoles: ['platform-super-admin', 'security-manager'],
        requiredPermission: 'security:sensitive-read',
      }),
      field('credentialId', 'Credential ID', 'text', {
        visibleToRoles: ['platform-super-admin', 'security-manager'],
        requiredPermission: 'security:sensitive-read',
      }),
      field('accessDecision', 'Access decision', 'select', {
        defaultValue: 'denied',
        options: [
          { value: 'granted', label: 'Granted' },
          { value: 'denied', label: 'Denied' },
          { value: 'review', label: 'Needs review' },
        ],
      }),
      field('accessReason', 'Access reason', 'text'),
      field('cameraId', 'Camera ID', 'text', { placeholder: 'cam-pad-1' }),
      field('host', 'Host / escort', 'text', { helpText: 'For visitor or personnel events.' }),
      field('credentialStatus', 'Credential status', 'select', {
        defaultValue: 'unknown',
        options: [
          { value: 'valid', label: 'Valid' },
          { value: 'expired', label: 'Expired' },
          { value: 'revoked', label: 'Revoked' },
          { value: 'unknown', label: 'Unknown' },
        ],
      }),
      field('relatedIncidentId', 'Related incident ID', 'text', { helpText: 'Required for escalation when linking to an open incident.' }),
      field('escalationRoute', 'Escalation route', 'textarea', {
        rows: 2,
        helpText: 'One recipient per line (e.g. security-supervisor).',
        defaultValue: 'security-supervisor\nincident-command',
      }),
      field('requestInvestigation', 'Open investigation', 'checkbox', { defaultValue: false }),
      field('followUpOwner', 'Follow-up owner', 'text'),
      field('evidenceRefs', 'Evidence refs', 'textarea', { rows: 2, helpText: 'One URI or reference per line.' }),
      field('occurredAt', 'Occurred at', 'datetime-local'),
      field('sensitiveDetails', 'Sensitive details', 'textarea', {
        rows: 3,
        visibleToRoles: ['platform-super-admin', 'security-manager'],
        requiredPermission: 'security:sensitive-read',
      }),
      field('reportedBy', 'Reported by', 'text', { readOnly: true }),
      field('reason', 'Audit reason', 'textarea', { required: true, minLength: 8, rows: 2 }),
    ],
    { createPath: '/security-operations/events', method: 'POST' },
    {
      requiredPermission: 'security:manage',
      allowedRoles: ['platform-super-admin', 'security-manager', 'organization-admin'],
      autosave: { enabled: true, debounceMs: 2500 },
      auditAction: 'security.event.recorded',
    },
  ),

  'facilities-inspection': form(
    'facilities-inspection',
    'Facilities inspection',
    ['create'],
    [
      field('entryMode', 'Entry mode', 'select', {
        required: true,
        defaultValue: 'quick',
        options: [
          { value: 'quick', label: 'Quick walkthrough' },
          { value: 'full', label: 'Full inspection' },
        ],
      }),
      field('facilityCategory', 'Facility area', 'select', {
        defaultValue: 'utilities',
        options: [
          { value: 'barn', label: 'Barn & backstretch' },
          { value: 'paddock', label: 'Paddock & saddling' },
          { value: 'track-surface', label: 'Track surface' },
          { value: 'gate', label: 'Starting gate' },
          { value: 'utilities', label: 'Utilities' },
          { value: 'venue-infrastructure', label: 'Venue infrastructure' },
        ],
      }),
      field('assetId', 'Asset / facility', 'text', { required: true, helpText: 'RACR asset ID — select from map or preset.' }),
      field('inspectionType', 'Inspection type', 'select', {
        required: true,
        defaultValue: 'routine',
        options: [
          { value: 'routine', label: 'Routine walkthrough' },
          { value: 'safety', label: 'Safety inspection' },
          { value: 'regulatory', label: 'Regulatory / compliance' },
          { value: 'pre-race', label: 'Pre-race readiness' },
          { value: 'follow-up', label: 'Follow-up verification' },
          { value: 'weather-event', label: 'Post weather event' },
        ],
      }),
      field('conditionRating', 'Condition rating (0–100)', 'number', { required: true, min: 0, max: 100, defaultValue: 85 }),
      field('notes', 'Notes', 'textarea', { required: true, minLength: 8, rows: 3 }),
      field('issuesFound', 'Issues found', 'textarea', { placeholder: 'One issue per line', rows: 3 }),
      field('urgency', 'Urgency', 'select', { defaultValue: 'normal', options: priorityOptions }),
      field('triggerWorkOrder', 'Trigger work order', 'checkbox', { defaultValue: false, helpText: 'Creates a work order when issues are listed.' }),
      field('attachmentRefs', 'Attachments / photos', 'textarea', { placeholder: 'Photo or file reference per line', rows: 2 }),
      field('nextInspectionAt', 'Next inspection date', 'datetime-local'),
      field('maintenanceOwner', 'Maintenance owner', 'text', { placeholder: 'Facilities supervisor or crew lead' }),
      field('inspectedBy', 'Inspected by', 'text', { helpText: 'Defaults to current actor on submit.' }),
      auditReasonField(8),
    ],
    { createPath: '/facilities-maintenance/inspections', method: 'POST' },
    {
      requiredPermission: 'track:readings',
      allowedRoles: ['platform-super-admin', 'facilities-manager', 'organization-admin'],
      draft: { enabled: true, storage: 'server', retentionDays: 14 },
      autosave: { enabled: true, debounceMs: 4000 },
      auditAction: 'facilities.inspection.recorded',
      description: 'Append-only facility inspection with optional work-order trigger and audit linkage.',
    },
  ),

  'compliance-evidence': form(
    'compliance-evidence',
    'Compliance evidence',
    ['create'],
    [
      field('entryMode', 'Entry mode', 'select', {
        required: true,
        defaultValue: 'quick',
        options: [
          { value: 'quick', label: 'Quick capture' },
          { value: 'full', label: 'Full evidence record' },
        ],
      }),
      field('title', 'Evidence title', 'text', { required: true, maxLength: 200, helpText: 'Human-readable title for audit and review workflows.' }),
      field('controlId', 'Control ID', 'text', { required: true, helpText: 'Primary control mapping — evidence links to control library.' }),
      field('frameworkIds', 'Framework mapping', 'textarea', {
        rows: 2,
        placeholder: 'ISO-27001\nSOC-2',
        helpText: 'One framework ID per line.',
      }),
      field('policyCitation', 'Policy / obligation citation', 'text', { helpText: 'Optional policy or obligation reference.' }),
      field('domain', 'Domain', 'select', {
        required: true,
        defaultValue: 'governance',
        options: [
          { value: 'governance', label: 'Governance & compliance' },
          { value: 'security', label: 'Security operations' },
          { value: 'operations', label: 'Race-day operations' },
          { value: 'equine-welfare', label: 'Equine welfare' },
          { value: 'facilities', label: 'Facilities & maintenance' },
          { value: 'finance', label: 'Finance & payments' },
          { value: 'racing-integrity', label: 'Racing integrity' },
          { value: 'ai-governance', label: 'AI governance' },
          { value: 'regulatory', label: 'Regulatory filing' },
        ],
      }),
      field('evidenceType', 'Evidence type', 'select', {
        required: true,
        defaultValue: 'document',
        options: [
          { value: 'document', label: 'Document / report' },
          { value: 'screenshot', label: 'Screenshot / capture' },
          { value: 'log-export', label: 'Log export' },
          { value: 'approval-record', label: 'Approval record' },
          { value: 'audit-trail', label: 'Audit trail extract' },
          { value: 'sensor-capture', label: 'Sensor / telemetry capture' },
          { value: 'policy-attestation', label: 'Policy attestation' },
          { value: 'workflow-artifact', label: 'Workflow artifact' },
          { value: 'other', label: 'Other structured evidence' },
        ],
      }),
      field('source', 'Source system / origin', 'text', { required: true, helpText: 'Where the evidence was captured (system, export job, manual upload).' }),
      field('linkTargets', 'Link targets', 'textarea', {
        rows: 3,
        placeholder: 'incident:inc-1\napproval:approval-race-start\naudit:audit-incident-1',
        helpText: 'One per line: kind:id or kind:id:label — incident, approval, control, audit, kpi-definition, regulatory-workflow.',
      }),
      field('notes', 'Notes', 'textarea', { required: true, minLength: 8, rows: 3 }),
      field('reviewStatus', 'Review status', 'select', {
        defaultValue: 'submitted',
        options: [
          { value: 'draft', label: 'Draft' },
          { value: 'submitted', label: 'Submitted' },
          { value: 'pending-review', label: 'Pending review' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
          { value: 'archived', label: 'Archived' },
        ],
      }),
      field('approvalRequestId', 'Approval linkage', 'text', { helpText: 'Optional approval request ID cross-reference.' }),
      field('auditRecordId', 'Audit linkage', 'text', { helpText: 'Optional existing audit record ID to attach.' }),
      field('retentionPolicy', 'Retention policy', 'text', { defaultValue: 'regulated-records-7y' }),
      field('retainedUntil', 'Retained until', 'date'),
      field('legalHold', 'Legal hold', 'checkbox', { defaultValue: false }),
      field('evidenceRefs', 'Evidence URIs / refs', 'textarea', { rows: 2, placeholder: 'One URI per line' }),
      field('uri', 'Primary evidence URI', 'text'),
      field('startReviewWorkflow', 'Start review workflow', 'checkbox', { defaultValue: true }),
      field('reportedBy', 'Reported by', 'text', { readOnly: true }),
      field('reason', 'Audit reason', 'textarea', { required: true, minLength: 8, rows: 2 }),
    ],
    { createPath: '/compliance/evidence/intake', method: 'POST' },
    {
      requiredPermission: 'compliance:audit',
      allowedRoles: ['platform-super-admin', 'compliance-officer'],
      draft: { enabled: true, storage: 'server', retentionDays: 14, warnOnDiscard: true },
      autosave: { enabled: true, debounceMs: 3000 },
      auditAction: 'compliance.evidence.collected',
      description: 'Structured compliance evidence with control mapping, link targets, retention, and audit linkage.',
    },
  ),

  'kpi-definition': form(
    'kpi-definition',
    'KPI threshold change',
    ['create', 'edit'],
    [
      field('kpiId', 'KPI', 'text', { required: true }),
      field('warning', 'Warning threshold', 'number'),
      field('critical', 'Critical threshold', 'number'),
      field('targetDirection', 'Target direction', 'select', {
        required: true,
        defaultValue: 'above',
        options: [
          { value: 'above', label: 'Above' },
          { value: 'below', label: 'Below' },
          { value: 'within-band', label: 'Within band' },
        ],
      }),
      field('description', 'Description', 'textarea', { required: true, minLength: 8, rows: 2 }),
      field('reason', 'Justification', 'textarea', { required: true, minLength: 12, rows: 3 }),
    ],
    { createPath: '/kpis/thresholds/draft-requests', method: 'POST' },
    {
      requiredPermission: 'kpi:admin',
      allowedRoles: ['platform-super-admin', 'organization-admin'],
      draft: { enabled: true, storage: 'both' },
      autosave: { enabled: true, debounceMs: 4000 },
      auditAction: 'kpi.threshold.draft.requested',
    },
  ),

  'administrative-record': form(
    'administrative-record',
    'Administrative record',
    ['create', 'edit'],
    [
      field('recordId', 'Record ID', 'text', { helpText: 'Required when editing an existing administrative record.' }),
      field('recordType', 'Record type', 'select', {
        required: true,
        options: [
          { value: 'organization', label: 'Organization' },
          { value: 'tenant', label: 'Tenant' },
          { value: 'racetrack', label: 'Racetrack' },
          { value: 'user', label: 'User' },
          { value: 'role-assignment', label: 'Role assignment' },
        ],
      }),
      field('displayName', 'Display name', 'text', { required: true, maxLength: 120 }),
      field('referenceId', 'Reference ID', 'text'),
      field('notes', 'Administrative notes', 'textarea', { rows: 3 }),
      field('reason', 'Audit reason', 'textarea', { required: true, minLength: 8, rows: 2 }),
    ],
    { createPath: '/data-entry/submit/administrative-record', editPath: '/data-entry/submit/administrative-record', method: 'POST' },
    {
      requiredPermission: 'tenant:admin',
      allowedRoles: ['platform-super-admin', 'organization-admin'],
      draft: { enabled: true, storage: 'server', retentionDays: 30 },
      autosave: { enabled: true, debounceMs: 5000 },
      auditAction: 'platform.administrative.recorded',
    },
  ),

  'federation-metadata': form(
    'federation-metadata',
    'Federation metadata change',
    ['create', 'edit'],
    [
      field('recordId', 'Policy record ID', 'text', { helpText: 'Required when revising an existing federation metadata record.' }),
      field('changeType', 'Change type', 'select', {
        required: true,
        defaultValue: 'sharing-scope',
        options: [
          { value: 'sharing-scope', label: 'Data sharing scope' },
          { value: 'cohort-enrollment', label: 'Cohort enrollment' },
          { value: 'benchmark-publication', label: 'Benchmark publication' },
          { value: 'policy-attestation', label: 'Policy attestation' },
        ],
      }),
      field('sharingScope', 'Sharing scope', 'select', {
        required: true,
        defaultValue: 'tenant-only',
        options: [
          { value: 'tenant-only', label: 'Tenant only' },
          { value: 'federation-aggregate', label: 'Federation aggregate' },
          { value: 'industry-anonymized', label: 'Industry anonymized' },
        ],
      }),
      field('policyId', 'Data sharing policy ID', 'text', { required: true, defaultValue: 'federation-data-sharing-v1' }),
      field('cohortId', 'Cohort ID', 'text', { helpText: 'Required for cohort enrollment changes.' }),
      field('benchmarkOptIn', 'Benchmark opt-in', 'checkbox', { defaultValue: false }),
      field('consentAttested', 'Consent attested', 'checkbox', { defaultValue: false, helpText: 'Confirm tenant consent for aggregate sharing.' }),
      field('approvalRequired', 'Approval acknowledged', 'checkbox', { required: true, defaultValue: true, helpText: 'Federation metadata changes require governance approval.' }),
      auditReasonField(12),
    ],
    { createPath: '/data-entry/submit/federation-metadata', editPath: '/data-entry/submit/federation-metadata', method: 'POST' },
    {
      requiredPermission: 'compliance:report',
      allowedRoles: ['platform-super-admin', 'compliance-officer', 'organization-admin'],
      draft: { enabled: true, storage: 'both', retentionDays: 30, warnOnDiscard: true },
      autosave: { enabled: true, debounceMs: 5000 },
      auditAction: 'federation.policy.updated',
      description: 'Governed federation metadata intake — approval required before sharing scope changes take effect.',
    },
  ),

  'facilities-incident': form(
    'facilities-incident',
    'Facility incident',
    ['create'],
    [
      field('assetId', 'Asset', 'text'),
      field('title', 'Title', 'text', { required: true, maxLength: 200 }),
      field('severity', 'Severity', 'select', { required: true, options: severityOptions, defaultValue: 'medium' }),
      field('description', 'Description', 'textarea', { required: true, minLength: 12, rows: 4 }),
      field('reason', 'Audit reason', 'textarea', { required: true, minLength: 8, rows: 2 }),
    ],
    { createPath: '/facilities-maintenance/incidents', method: 'POST' },
    {
      requiredPermission: 'track:readings',
      allowedRoles: ['platform-super-admin', 'facilities-manager'],
      autosave: { enabled: true, debounceMs: 3000 },
      auditAction: 'facilities.incident.reported',
    },
  ),

  'facilities-maintenance': form(
    'facilities-maintenance',
    'Maintenance entry',
    ['create'],
    [
      field('entryMode', 'Entry mode', 'select', {
        required: true,
        defaultValue: 'quick',
        options: [
          { value: 'quick', label: 'Quick entry' },
          { value: 'full', label: 'Full maintenance request' },
        ],
      }),
      field('facilityCategory', 'Facility area', 'select', {
        defaultValue: 'utilities',
        options: [
          { value: 'barn', label: 'Barn & backstretch' },
          { value: 'paddock', label: 'Paddock & saddling' },
          { value: 'track-surface', label: 'Track surface' },
          { value: 'gate', label: 'Starting gate' },
          { value: 'utilities', label: 'Utilities' },
          { value: 'venue-infrastructure', label: 'Venue infrastructure' },
        ],
      }),
      field('assetId', 'Asset / facility', 'text', { required: true }),
      field('title', 'Work title', 'text', { required: true, defaultValue: 'Scheduled facility maintenance' }),
      field('urgency', 'Urgency', 'select', { required: true, options: priorityOptions, defaultValue: 'normal' }),
      field('notes', 'Notes', 'textarea', { required: true, minLength: 8, rows: 3 }),
      field('issuesFound', 'Issues / tasks', 'textarea', { placeholder: 'One line per issue or task', rows: 3 }),
      field('attachmentRefs', 'Attachments / photos', 'textarea', { placeholder: 'Photo or file reference per line', rows: 2 }),
      field('scheduledFor', 'Scheduled for', 'datetime-local'),
      field('dueAt', 'Due at', 'datetime-local'),
      field('maintenanceOwner', 'Maintenance owner', 'text', { required: true, placeholder: 'Facilities supervisor or crew lead' }),
      auditReasonField(8),
    ],
    { createPath: '/facilities-maintenance/maintenance-schedules', method: 'POST' },
    {
      requiredPermission: 'track:readings',
      allowedRoles: ['platform-super-admin', 'facilities-manager', 'organization-admin'],
      autosave: { enabled: true, debounceMs: 4000 },
      auditAction: 'facilities.maintenance-schedule.requested',
      description: 'Approval-gated maintenance schedule — operational impact requires authorization.',
    },
  ),
};

export function fieldRulesFromDefinition(definition: DataEntryFormDefinition): readonly ContractRule[] {
  return definition.fields.flatMap((fieldDef) => {
    const rules: ContractRule[] = [];
    if (fieldDef.required) rules.push({ path: fieldDef.path, required: true, type: fieldTypeToContract(fieldDef.type) });
    if (fieldDef.min !== undefined && fieldDef.type === 'number') rules.push({ path: fieldDef.path, type: 'number', min: fieldDef.min });
    if (fieldDef.max !== undefined && fieldDef.type === 'number') rules.push({ path: fieldDef.path, type: 'number', max: fieldDef.max });
    if (fieldDef.minLength !== undefined && (fieldDef.type === 'text' || fieldDef.type === 'textarea')) {
      rules.push({ path: fieldDef.path, type: 'string', min: fieldDef.minLength });
    }
    if (fieldDef.maxLength !== undefined) rules.push({ path: fieldDef.path, type: 'string', max: fieldDef.maxLength });
    return rules;
  });
}

function fieldTypeToContract(type: DataEntryFieldDefinition['type']): ContractRule['type'] {
  if (type === 'number') return 'number';
  if (type === 'checkbox') return 'boolean';
  return 'string';
}
