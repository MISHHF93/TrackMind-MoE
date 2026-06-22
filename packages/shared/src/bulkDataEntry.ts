import type { Permission, Role } from './accessControl.js';
import { normalizeRole } from './accessControl.js';
import type { DataEntryEntityKind, DataEntryFormMode } from './dataEntryFramework.js';
import {
  assertDataEntryTenantScope,
  canAccessForm,
  enrichPayloadWithScope,
  getDataEntryFormDefinition,
  validateDataEntryForm,
  type DataEntryScope,
  type DataEntryValidationResult,
} from './dataEntryFramework.js';
import {
  runDataQualityValidation,
  validateDataEntryWithQuality,
  type DataQualityReferenceCatalog,
  type DataQualityValidationContext,
} from './dataQualityValidation.js';

export const bulkDataEntrySchemaVersion = 'trackmind.bulk-data-entry.v1' as const;

export type BulkOperationId =
  | 'horse-import'
  | 'race-entries'
  | 'trainer-assignments'
  | 'jockey-assignments'
  | 'status-updates'
  | 'inspection-scheduling'
  | 'notification-targets'
  | 'kpi-thresholds';

export interface BulkColumnDefinition {
  key: string;
  label: string;
  required?: boolean;
  helpText?: string;
  example?: string;
}

export interface BulkOperationDefinition {
  id: BulkOperationId;
  label: string;
  description: string;
  entityKind: DataEntryEntityKind | 'notification-target';
  mode: DataEntryFormMode;
  columns: readonly BulkColumnDefinition[];
  defaultValues?: Record<string, unknown>;
  maxRows: number;
  requiredPermission: Permission;
  allowedRoles: readonly Role[];
  auditAction: string;
}

export interface BulkRowInput {
  rowIndex: number;
  values: Record<string, unknown>;
}

export interface BulkRowPreviewResult {
  rowIndex: number;
  valid: boolean;
  errors: string[];
  normalizedValues: Record<string, unknown>;
  entityKind: DataEntryEntityKind | 'notification-target';
  mode: DataEntryFormMode;
}

export interface BulkPreviewResult {
  schemaVersion: typeof bulkDataEntrySchemaVersion;
  operationId: BulkOperationId;
  totalRows: number;
  validCount: number;
  invalidCount: number;
  rows: BulkRowPreviewResult[];
  canCommit: boolean;
  message: string;
}

export interface BulkRowCommitResult {
  rowIndex: number;
  accepted: boolean;
  errors: string[];
  auditId?: string;
  recordId?: string;
  message?: string;
}

export interface BulkCommitResult {
  schemaVersion: typeof bulkDataEntrySchemaVersion;
  operationId: BulkOperationId;
  batchAuditId: string;
  totalRows: number;
  acceptedCount: number;
  failedCount: number;
  skippedCount: number;
  rows: BulkRowCommitResult[];
  message: string;
}

const bulkOperations: Record<BulkOperationId, BulkOperationDefinition> = {
  'horse-import': {
    id: 'horse-import',
    label: 'Horse import',
    description: 'Bulk register horse identity records from CSV or pasted rows.',
    entityKind: 'horse',
    mode: 'create',
    maxRows: 200,
    requiredPermission: 'identity:write',
    allowedRoles: ['platform-super-admin', 'horse-operations-coordinator', 'compliance-officer'],
    auditAction: 'bulk.horse-import.committed',
    columns: [
      { key: 'name', label: 'Registered name', required: true, example: 'Star Runner' },
      { key: 'microchipId', label: 'Microchip ID', example: '982000123456789' },
      { key: 'foaled', label: 'Foaling date', example: '2020-03-15' },
      { key: 'sex', label: 'Sex', example: 'colt' },
      { key: 'breed', label: 'Breed', example: 'TB' },
      { key: 'color', label: 'Color', example: 'bay' },
      { key: 'dataSource', label: 'Data source', example: 'import-csv' },
      { key: 'reason', label: 'Audit reason', required: true, example: 'Bulk horse import batch' },
    ],
    defaultValues: { dataSource: 'registry-import', lifecycleStatus: 'active' },
  },
  'race-entries': {
    id: 'race-entries',
    label: 'Race entries',
    description: 'Bulk add horses to a race card with trainer and owner linkage.',
    entityKind: 'race-card-entry',
    mode: 'create',
    maxRows: 30,
    requiredPermission: 'race:request-start',
    allowedRoles: ['platform-super-admin', 'horse-operations-coordinator'],
    auditAction: 'bulk.race-entries.committed',
    columns: [
      { key: 'raceCardId', label: 'Race card ID', required: true, example: 'rc-race-7' },
      { key: 'horseId', label: 'Horse ID', required: true, example: 'horse-1' },
      { key: 'trainerId', label: 'Trainer ID', required: true, example: 'trainer-1' },
      { key: 'ownerId', label: 'Owner ID', required: true, example: 'owner-1' },
      { key: 'programNumber', label: 'Program number', example: '4' },
      { key: 'weightLbs', label: 'Weight (lbs)', example: '118' },
      { key: 'reason', label: 'Audit reason', required: true, example: 'Bulk race entry import' },
    ],
  },
  'trainer-assignments': {
    id: 'trainer-assignments',
    label: 'Trainer assignments',
    description: 'Bulk assign trainers to horses with effective dates.',
    entityKind: 'trainer-assignment',
    mode: 'create',
    maxRows: 100,
    requiredPermission: 'identity:write',
    allowedRoles: ['platform-super-admin', 'horse-operations-coordinator'],
    auditAction: 'bulk.trainer-assignments.committed',
    columns: [
      { key: 'horseId', label: 'Horse ID', required: true, example: 'horse-1' },
      { key: 'trainerId', label: 'Trainer ID', required: true, example: 'trainer-1' },
      { key: 'trainerName', label: 'Trainer name', required: true, example: 'Jane Smith' },
      { key: 'effectiveFrom', label: 'Effective from', required: true, example: '2026-06-22' },
      { key: 'licenseStatus', label: 'License status', example: 'active' },
      { key: 'dataSource', label: 'Data source', example: 'bulk-import' },
      { key: 'reason', label: 'Audit reason', required: true, example: 'Bulk trainer assignment' },
    ],
    defaultValues: { licenseStatus: 'active', dataSource: 'registry-import' },
  },
  'jockey-assignments': {
    id: 'jockey-assignments',
    label: 'Jockey assignments',
    description: 'Bulk assign jockeys to race card entries.',
    entityKind: 'jockey-assignment',
    mode: 'create',
    maxRows: 30,
    requiredPermission: 'race:request-start',
    allowedRoles: ['platform-super-admin', 'horse-operations-coordinator'],
    auditAction: 'bulk.jockey-assignments.committed',
    columns: [
      { key: 'raceCardId', label: 'Race card ID', required: true, example: 'rc-race-7' },
      { key: 'entryId', label: 'Entry ID', required: true, example: 'entry-1' },
      { key: 'jockeyId', label: 'Jockey ID', required: true, example: 'jockey-1' },
      { key: 'weightLbs', label: 'Weight (lbs)', example: '118' },
      { key: 'reason', label: 'Audit reason', required: true, example: 'Bulk jockey assignment' },
    ],
  },
  'status-updates': {
    id: 'status-updates',
    label: 'Status updates',
    description: 'Bulk update paddock assignment or race eligibility status for horses.',
    entityKind: 'paddock-record',
    mode: 'create',
    maxRows: 100,
    requiredPermission: 'track:readings',
    allowedRoles: ['platform-super-admin', 'horse-operations-coordinator', 'facilities-manager', 'steward'],
    auditAction: 'bulk.status-updates.committed',
    columns: [
      { key: 'statusTarget', label: 'Target (paddock|eligibility)', required: true, example: 'paddock' },
      { key: 'horseId', label: 'Horse ID', required: true, example: 'horse-1' },
      { key: 'status', label: 'Status / scratch status', required: true, example: 'complete' },
      { key: 'assignmentType', label: 'Paddock assignment type', example: 'readiness' },
      { key: 'scratchStatus', label: 'Eligibility scratch status', example: 'active' },
      { key: 'hisaCompliance', label: 'HISA compliance', example: 'compliant' },
      { key: 'notes', label: 'Notes', example: 'Bulk status update' },
      { key: 'reason', label: 'Audit reason', required: true, example: 'Race-day status bulk update' },
    ],
    defaultValues: { assignmentType: 'readiness', scratchStatus: 'active', hisaCompliance: 'compliant' },
  },
  'inspection-scheduling': {
    id: 'inspection-scheduling',
    label: 'Inspection scheduling',
    description: 'Bulk schedule facility inspections with next due dates.',
    entityKind: 'facilities-inspection',
    mode: 'create',
    maxRows: 50,
    requiredPermission: 'track:readings',
    allowedRoles: ['platform-super-admin', 'facilities-manager', 'organization-admin'],
    auditAction: 'bulk.inspection-scheduling.committed',
    columns: [
      { key: 'assetId', label: 'Asset ID', required: true, example: 'GRANDSTAND_HVAC_01' },
      { key: 'inspectionType', label: 'Inspection type', required: true, example: 'routine' },
      { key: 'conditionRating', label: 'Condition rating', required: true, example: '85' },
      { key: 'nextInspectionAt', label: 'Next inspection at', required: true, example: '2026-07-01T09:00' },
      { key: 'facilityCategory', label: 'Facility area', example: 'utilities' },
      { key: 'urgency', label: 'Urgency', example: 'normal' },
      { key: 'notes', label: 'Notes', required: true, example: 'Scheduled walkthrough' },
      { key: 'maintenanceOwner', label: 'Maintenance owner', example: 'facilities-supervisor' },
      { key: 'reason', label: 'Audit reason', required: true, example: 'Bulk inspection schedule' },
    ],
    defaultValues: {
      entryMode: 'quick',
      facilityCategory: 'utilities',
      urgency: 'normal',
      conditionRating: 85,
    },
  },
  'notification-targets': {
    id: 'notification-targets',
    label: 'Notification targets',
    description: 'Bulk configure notification routing targets by role, zone, or user.',
    entityKind: 'notification-target',
    mode: 'create',
    maxRows: 100,
    requiredPermission: 'read:any',
    allowedRoles: ['platform-super-admin', 'organization-admin'],
    auditAction: 'bulk.notification-targets.committed',
    columns: [
      { key: 'targetKind', label: 'Target kind (role|zone|user)', required: true, example: 'role' },
      { key: 'targetId', label: 'Target ID', required: true, example: 'horse-operations-coordinator' },
      { key: 'channel', label: 'Channel (in-app|email|sms)', required: true, example: 'in-app' },
      { key: 'enabled', label: 'Enabled (true|false)', example: 'true' },
      { key: 'reason', label: 'Audit reason', required: true, example: 'Bulk notification target update' },
    ],
    defaultValues: { enabled: true, channel: 'in-app' },
  },
  'kpi-thresholds': {
    id: 'kpi-thresholds',
    label: 'KPI thresholds',
    description: 'Bulk submit KPI threshold draft requests — approval-governed.',
    entityKind: 'kpi-definition',
    mode: 'create',
    maxRows: 25,
    requiredPermission: 'kpi:admin',
    allowedRoles: ['platform-super-admin', 'organization-admin'],
    auditAction: 'bulk.kpi-thresholds.committed',
    columns: [
      { key: 'kpiId', label: 'KPI ID', required: true, example: 'kpi-readiness' },
      { key: 'warning', label: 'Warning threshold', example: '80' },
      { key: 'critical', label: 'Critical threshold', example: '65' },
      { key: 'targetDirection', label: 'Target direction', example: 'above' },
      { key: 'description', label: 'Description', required: true, example: 'Readiness score thresholds' },
      { key: 'reason', label: 'Justification', required: true, example: 'Season threshold adjustment' },
    ],
    defaultValues: { targetDirection: 'above' },
  },
};

export function listBulkOperations(): BulkOperationDefinition[] {
  return Object.values(bulkOperations);
}

export function getBulkOperation(id: BulkOperationId): BulkOperationDefinition {
  const operation = bulkOperations[id];
  if (!operation) throw new Error(`Unknown bulk operation ${id}`);
  return operation;
}

export function isBulkOperationId(value: string): value is BulkOperationId {
  return value in bulkOperations;
}

export function canAccessBulkOperation(operationId: BulkOperationId, role: Role): boolean {
  const canonical = normalizeRole(role);
  if (!canonical) return false;
  const operation = getBulkOperation(operationId);
  if (!operation.allowedRoles.includes(canonical)) return false;
  if (operation.entityKind === 'notification-target') return true;
  try {
    const definition = getDataEntryFormDefinition(operation.entityKind, operation.mode);
    return canAccessForm(definition, canonical);
  } catch {
    return false;
  }
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

export function parseBulkPaste(
  operationId: BulkOperationId,
  text: string,
): BulkRowInput[] {
  const operation = getBulkOperation(operationId);
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) throw new Error('JSON bulk input must be an array of row objects');
    return parsed.map((entry, rowIndex) => ({
      rowIndex,
      values: typeof entry === 'object' && entry !== null ? entry as Record<string, unknown> : {},
    }));
  }

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const headerCells = parseCsvLine(lines[0]).map((cell) => cell.toLowerCase().replace(/\s+/g, ''));
  const knownKeys = operation.columns.map((column) => column.key.toLowerCase());
  const hasHeader = headerCells.some((cell) => knownKeys.includes(cell));
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const headers = hasHeader
    ? parseCsvLine(lines[0]).map((cell, index) => operation.columns.find((column) => column.key.toLowerCase() === headerCells[index])?.key ?? parseCsvLine(lines[0])[index])
    : operation.columns.map((column) => column.key);

  return dataLines.map((line, rowIndex) => {
    const cells = parseCsvLine(line);
    const values: Record<string, unknown> = { ...(operation.defaultValues ?? {}) };
    headers.forEach((key, columnIndex) => {
      if (!key || cells[columnIndex] === undefined || cells[columnIndex] === '') return;
      const raw = cells[columnIndex];
      if (raw === 'true' || raw === 'false') values[key] = raw === 'true';
      else if (/^\d+(\.\d+)?$/.test(raw)) values[key] = Number(raw);
      else values[key] = raw;
    });
    return { rowIndex, values };
  });
}

function resolveStatusUpdateEntity(row: Record<string, unknown>): {
  entityKind: DataEntryEntityKind;
  mode: DataEntryFormMode;
  values: Record<string, unknown>;
} {
  const target = String(row.statusTarget ?? 'paddock').toLowerCase();
  if (target === 'eligibility') {
    return {
      entityKind: 'race-eligibility',
      mode: 'edit',
      values: {
        horseId: row.horseId,
        scratchStatus: row.scratchStatus ?? row.status,
        hisaCompliance: row.hisaCompliance ?? 'compliant',
        reason: row.reason,
        dataSource: 'registry-import',
        confirmOverwrite: true,
      },
    };
  }
  return {
    entityKind: 'paddock-record',
    mode: 'create',
    values: {
      horseId: row.horseId,
      assignmentType: row.assignmentType ?? 'readiness',
      status: row.status,
      notes: row.notes,
      reason: row.reason,
    },
  };
}

function validateNotificationTargetRow(values: Record<string, unknown>): DataEntryValidationResult {
  const errors: string[] = [];
  const targetKind = String(values.targetKind ?? '');
  if (!['role', 'zone', 'user'].includes(targetKind)) errors.push('targetKind must be role, zone, or user');
  if (!values.targetId) errors.push('targetId is required');
  const channel = String(values.channel ?? '');
  if (!['in-app', 'email', 'sms'].includes(channel)) errors.push('channel must be in-app, email, or sms');
  if (!values.reason || String(values.reason).trim().length < 8) errors.push('reason must be at least 8 characters');
  return {
    valid: errors.length === 0,
    errors,
    normalizedValues: {
      targetKind,
      targetId: String(values.targetId ?? ''),
      channel,
      enabled: values.enabled !== false,
      reason: String(values.reason ?? ''),
    },
  };
}

function validateBulkRow(
  operation: BulkOperationDefinition,
  row: BulkRowInput,
  scope: DataEntryScope,
  quality?: Pick<DataQualityValidationContext, 'references' | 'baseline' | 'batchValues' | 'staleReferenceMaxAgeHours'>,
): BulkRowPreviewResult {
  if (operation.id === 'notification-targets') {
    const scoped = enrichPayloadWithScope(scope, row.values);
    const validation = validateNotificationTargetRow(scoped);
    return {
      rowIndex: row.rowIndex,
      valid: validation.valid,
      errors: validation.errors,
      normalizedValues: validation.normalizedValues,
      entityKind: 'notification-target',
      mode: 'create',
    };
  }

  let entityKind = operation.entityKind as DataEntryEntityKind;
  let mode = operation.mode;
  let values = { ...(operation.defaultValues ?? {}), ...row.values };

  if (operation.id === 'status-updates') {
    const resolved = resolveStatusUpdateEntity(values);
    entityKind = resolved.entityKind;
    mode = resolved.mode;
    values = resolved.values;
  }

  const scoped = enrichPayloadWithScope(scope, values);
  const scopeCheck = assertDataEntryTenantScope(scope, scoped);
  if (!scopeCheck.valid) {
    return {
      rowIndex: row.rowIndex,
      valid: false,
      errors: scopeCheck.errors,
      normalizedValues: {},
      entityKind,
      mode,
    };
  }

  const validation = quality?.references
    ? validateDataEntryWithQuality(entityKind, scoped, {
        scope,
        mode,
        role: scope.role,
        references: quality.references,
        baseline: quality.baseline,
        batchValues: quality.batchValues,
        batchRowIndex: row.rowIndex,
        staleReferenceMaxAgeHours: quality.staleReferenceMaxAgeHours,
      })
    : validateDataEntryForm(entityKind, scoped, { mode, role: scope.role });

  const qualityOnly = !quality?.references
    ? runDataQualityValidation(entityKind, scoped, {
        scope,
        mode,
        role: scope.role,
        batchValues: quality?.batchValues,
        batchRowIndex: row.rowIndex,
      })
    : [];

  const mergedErrors = [
    ...validation.errors,
    ...qualityOnly.filter((issue) => issue.severity === 'error').map((issue) => issue.message),
  ];

  return {
    rowIndex: row.rowIndex,
    valid: validation.valid && qualityOnly.filter((issue) => issue.severity === 'error').length === 0,
    errors: [...new Set(mergedErrors)],
    normalizedValues: validation.normalizedValues,
    entityKind,
    mode,
  };
}

export function previewBulkOperation(
  operationId: BulkOperationId,
  rows: BulkRowInput[],
  scope: DataEntryScope,
  quality?: {
    references?: DataQualityReferenceCatalog;
    baseline?: Record<string, unknown>;
    staleReferenceMaxAgeHours?: number;
  },
): BulkPreviewResult {
  const operation = getBulkOperation(operationId);
  if (!canAccessBulkOperation(operationId, scope.role)) {
    throw new Error(`Role ${scope.role} cannot preview bulk operation ${operationId}`);
  }
  if (rows.length > operation.maxRows) {
    throw new Error(`Bulk operation ${operationId} allows at most ${operation.maxRows} rows`);
  }

  const batchValues = rows.map((row) => row.values);
  const previewRows = rows.map((row) => validateBulkRow(operation, row, scope, {
    references: quality?.references,
    baseline: quality?.baseline,
    batchValues,
    staleReferenceMaxAgeHours: quality?.staleReferenceMaxAgeHours,
  }));
  const validCount = previewRows.filter((row) => row.valid).length;
  const invalidCount = previewRows.length - validCount;

  return {
    schemaVersion: bulkDataEntrySchemaVersion,
    operationId,
    totalRows: previewRows.length,
    validCount,
    invalidCount,
    rows: previewRows,
    canCommit: validCount > 0,
    message: invalidCount > 0
      ? `${validCount} of ${previewRows.length} rows passed validation — invalid rows will be skipped on partial commit.`
      : `All ${validCount} rows passed validation and are ready to commit.`,
  };
}

export function selectBulkCommitRows(
  preview: BulkPreviewResult,
  options: { commitValidOnly?: boolean; rowIndices?: number[] } = {},
): BulkRowPreviewResult[] {
  let rows = preview.rows;
  if (options.rowIndices?.length) {
    const allowed = new Set(options.rowIndices);
    rows = rows.filter((row) => allowed.has(row.rowIndex));
  }
  if (options.commitValidOnly !== false) {
    rows = rows.filter((row) => row.valid);
  }
  return rows;
}
