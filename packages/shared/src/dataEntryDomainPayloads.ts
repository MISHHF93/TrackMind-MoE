import type { Role } from './accessControl.js';
import type { DataEntryEntityKind, DataEntryFormMode } from './dataEntryFramework.js';
import { buildApprovalComposerSubmitPayload } from './approvalRequestComposer.js';
import { buildAdministrativeRecordPayload } from './administrativeRecordEntry.js';
import { buildFederationMetadataIntakePayload } from './federationMetadataEntry.js';
import { buildComplianceEvidenceIntakePayload } from './complianceEvidenceEntry.js';
import type { ComplianceEvidenceEntryMode } from './complianceEvidenceEntry.js';
import {
  buildFacilitiesInspectionPayload,
  buildFacilitiesMaintenancePayload,
  buildFacilitiesIncidentPayload,
} from './facilitiesEntryWorkflows.js';
import type { FacilitiesEntryMode } from './facilitiesEntryWorkflows.js';
import {
  buildVeterinaryObservationPayload,
  buildWelfareObservationPayload,
  type EquineObservationEntryMode,
} from './equineObservationForms.js';
import { parseInvolvedEntities, parseEvidenceRefs } from './incidentIntake.js';
import {
  buildOperationalNoteEditPayload,
  buildOperationalNoteIntakePayload,
} from './operationalNotesEntry.js';
import type { OperationalNoteEntryMode } from './operationalNotesEntry.js';
import { buildSecurityEventIntakePayload } from './securityEventEntry.js';
import type { SecurityEventEntryMode } from './securityEventEntry.js';

export interface DataEntryDomainPayloadContext {
  actorId: string;
  role: Role;
  recordId?: string;
}

function lines(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value.trim()) {
    return value.split('\n').map((line) => line.trim()).filter(Boolean);
  }
  return [];
}

function evidenceFromSource(values: Record<string, unknown>): string[] {
  const source = values.dataSource ? String(values.dataSource) : 'manual-entry';
  const auditReason = values.reason ? String(values.reason) : undefined;
  return [source, ...(auditReason ? [`audit:${auditReason.slice(0, 64)}`] : [])];
}

export function buildHorseDomainPayload(
  entityKind: DataEntryEntityKind,
  mode: DataEntryFormMode,
  values: Record<string, unknown>,
  context: DataEntryDomainPayloadContext,
): Record<string, unknown> {
  const horseId = String(values.horseId ?? context.recordId ?? '');

  switch (entityKind) {
    case 'horse':
      if (mode === 'edit') {
        return {
          identity: {
            name: values.name,
            microchipId: values.microchipId,
            foaled: values.foaled,
            sex: values.sex,
            breed: values.breed,
            color: values.color,
          },
          dataSource: values.dataSource,
          reason: values.reason,
        };
      }
      return {
        name: values.name,
        microchipId: values.microchipId,
        foaled: values.foaled,
        sex: values.sex,
        breed: values.breed,
        color: values.color,
        lifecycleStatus: 'active',
        dataSource: values.dataSource,
        reason: values.reason,
      };

    case 'horse-ownership':
      return {
        horseId,
        ownerId: values.ownerId,
        ownerName: values.ownerName,
        effectiveFrom: values.effectiveFrom,
        percentage: values.percentage,
        dataSource: values.dataSource,
        reason: values.reason,
        evidence: evidenceFromSource(values),
      };

    case 'trainer-assignment':
      return {
        horseId,
        trainer: {
          trainerId: values.trainerId,
          trainerName: values.trainerName,
          effectiveFrom: values.effectiveFrom,
          licenseStatus: values.licenseStatus,
          evidence: evidenceFromSource(values),
        },
        reason: values.reason,
      };

    case 'stable-assignment':
      return {
        horseId,
        barnId: values.barnId,
        stallId: values.stallId,
        assignedAt: values.assignedAt,
        evidence: evidenceFromSource(values),
        reason: values.reason,
      };

    case 'race-eligibility':
      return {
        horseId,
        scratchStatus: values.scratchStatus,
        hisaCompliance: values.hisaCompliance,
        eligibilityFlags: lines(values.eligibilityFlags),
        raceRestrictions: lines(values.raceRestrictions),
        dataSource: values.dataSource,
        reason: values.reason,
      };

    case 'transport-record':
      return {
        horseId,
        from: values.from,
        to: values.to,
        departedAt: values.departedAt,
        arrivedAt: values.arrivedAt,
        transporter: values.transporter,
        welfareChecks: lines(values.welfareChecks),
        dataSource: values.dataSource,
        reason: values.reason,
      };

    case 'workout-record':
      return {
        horseId,
        date: values.date,
        trackId: values.trackId,
        distanceFurlongs: values.distanceFurlongs,
        timeSeconds: values.timeSeconds,
        surface: values.surface,
        dataSource: values.dataSource,
        reason: values.reason,
      };

    case 'retirement-record':
      return {
        horseId,
        retiredAt: values.retiredAt,
        reason: values.retirementReason,
        destination: values.destination,
        aftercareContact: values.aftercareContact,
        evidence: evidenceFromSource(values),
        auditReason: values.reason,
      };

    case 'welfare-observation':
      return buildWelfareObservationPayload(
        { actorId: context.actorId, role: context.role },
        values,
        (values.entryMode as EquineObservationEntryMode | undefined) ?? 'quick',
      );

    case 'veterinary-observation':
      return buildVeterinaryObservationPayload(
        { actorId: context.actorId, role: context.role },
        values,
        (values.entryMode as EquineObservationEntryMode | undefined) ?? 'quick',
      );

    default:
      return values;
  }
}

export function buildRaceCardDomainPayload(
  entityKind: DataEntryEntityKind,
  mode: DataEntryFormMode,
  values: Record<string, unknown>,
  context: DataEntryDomainPayloadContext,
): Record<string, unknown> {
  void mode;
  void context;

  switch (entityKind) {
    case 'race-card':
      return {
        raceDayId: values.raceDayId,
        raceDate: values.raceDate,
        raceNumber: values.raceNumber,
        scheduledPostTime: values.scheduledPostTime,
        conditions: {
          surface: values.surface,
          distanceFurlongs: values.distanceFurlongs,
        },
        classification: {
          classLevel: values.classLevel,
          stakesGrade: values.stakesGrade ?? 'allowance',
        },
        purse: {
          basePurse: values.basePurse,
          currency: values.currency ?? 'USD',
        },
        reason: values.reason,
      };

    case 'race-card-conditions':
      return {
        conditions: {
          surface: values.surface,
          distanceFurlongs: values.distanceFurlongs,
          trackCondition: values.trackCondition,
          ageRestriction: values.ageRestriction,
          sexRestriction: values.sexRestriction,
          eligibility: lines(values.eligibility),
          medicationRules: lines(values.medicationRules),
        },
        reason: values.reason,
      };

    case 'race-card-classification':
      return {
        classification: {
          classLevel: values.classLevel,
          stakesGrade: values.stakesGrade,
          claimingPrice: values.claimingPrice,
          division: values.division,
          restrictionType: values.restrictionType,
        },
        reason: values.reason,
      };

    case 'race-card-purse':
      return {
        purse: {
          basePurse: values.basePurse,
          currency: values.currency ?? 'USD',
          starterBonus: values.starterBonus,
          breederAwards: values.breederAwards,
        },
        reason: values.reason,
      };

    case 'race-card-entry':
      return {
        horseId: values.horseId,
        trainerId: values.trainerId,
        ownerIds: [String(values.ownerId ?? 'owner-unknown')],
        programNumber: values.programNumber,
        weightLbs: values.weightLbs,
        reason: values.reason,
      };

    case 'race-card-entry-trainer':
      return {
        trainerId: values.trainerId,
        reason: values.reason,
      };

    case 'race-card-post-position':
      return {
        postPosition: values.postPosition,
        reason: values.reason,
      };

    case 'jockey-assignment':
      return {
        jockeyId: values.jockeyId,
        reason: values.reason,
      };

    case 'race-card-lifecycle':
      return {
        toStatus: values.toStatus,
        reason: String(values.transitionReason ?? values.reason ?? ''),
      };

    default:
      return values;
  }
}

export function buildUnifiedIncidentDomainPayload(
  entityKind: DataEntryEntityKind,
  mode: DataEntryFormMode,
  values: Record<string, unknown>,
): Record<string, unknown> {
  if (entityKind !== 'unified-incident') return values;

  return {
    incidentType: values.incidentType,
    intakeMode: values.intakeMode ?? 'triage',
    severity: values.severity,
    location: values.location,
    summary: values.summary,
    detailedNotes: values.detailedNotes,
    involvedEntities: parseInvolvedEntities(values.involvedEntities),
    evidenceRefs: parseEvidenceRefs(values.evidenceRefs),
    recommendedNextAction: values.recommendedNextAction,
    approvalRequired: values.approvalRequired === true,
    subjectKind: values.subjectKind,
    subjectId: values.subjectId,
    reason: values.reason,
    ...(mode === 'edit' ? { note: values.reason } : {}),
  };
}

export function buildKpiThresholdDraftDomainPayload(values: Record<string, unknown>): Record<string, unknown> {
  return {
    kpiId: String(values.kpiId ?? ''),
    warning: values.warning != null && String(values.warning).trim() ? Number(values.warning) : undefined,
    critical: values.critical != null && String(values.critical).trim() ? Number(values.critical) : undefined,
    targetDirection: (values.targetDirection as 'above' | 'below' | 'within-band') ?? 'above',
    description: String(values.description ?? ''),
    reason: String(values.reason ?? 'KPI threshold change requested from analytics workspace'),
    evidence: ['kpi-threshold-draft-ui', 'data-entry-framework'],
  };
}

export function raceCardSubmitPathParams(
  entityKind: DataEntryEntityKind,
  values: Record<string, unknown>,
  recordId?: string,
): Record<string, string> {
  const raceCardId = String(values.raceCardId ?? recordId ?? '');
  return {
    recordId: raceCardId,
    raceCardId,
    entryId: String(values.entryId ?? ''),
  };
}

export function buildDataEntryDomainPayload(
  entityKind: DataEntryEntityKind,
  mode: DataEntryFormMode,
  values: Record<string, unknown>,
  context: DataEntryDomainPayloadContext,
): Record<string, unknown> {
  switch (entityKind) {
    case 'horse':
    case 'horse-ownership':
    case 'trainer-assignment':
    case 'stable-assignment':
    case 'race-eligibility':
    case 'transport-record':
    case 'workout-record':
    case 'retirement-record':
    case 'veterinary-observation':
    case 'welfare-observation':
      return buildHorseDomainPayload(entityKind, mode, values, context);

    case 'race-card':
    case 'race-card-conditions':
    case 'race-card-classification':
    case 'race-card-purse':
    case 'race-card-entry':
    case 'race-card-entry-trainer':
    case 'race-card-post-position':
    case 'race-card-lifecycle':
    case 'jockey-assignment':
      return buildRaceCardDomainPayload(entityKind, mode, values, context);

    case 'unified-incident':
      return buildUnifiedIncidentDomainPayload(entityKind, mode, values);

    case 'approval-request-composer':
      return buildApprovalComposerSubmitPayload(values, context.role);

    case 'facilities-inspection':
      return buildFacilitiesInspectionPayload(
        { actorId: context.actorId },
        values,
        (values.entryMode as FacilitiesEntryMode | undefined) ?? 'quick',
      );

    case 'facilities-maintenance':
      return buildFacilitiesMaintenancePayload(
        { actorId: context.actorId },
        values,
        (values.entryMode as FacilitiesEntryMode | undefined) ?? 'quick',
      );

    case 'facilities-incident':
      return buildFacilitiesIncidentPayload({ actorId: context.actorId }, values);

    case 'security-event-entry':
      return { ...buildSecurityEventIntakePayload(
        { actorId: context.actorId },
        values,
        (values.entryMode as SecurityEventEntryMode | undefined) ?? 'quick',
      ) };

    case 'compliance-evidence':
      return { ...buildComplianceEvidenceIntakePayload(
        { actorId: context.actorId },
        values,
        (values.entryMode as ComplianceEvidenceEntryMode | undefined) ?? 'quick',
      ) };

    case 'operational-note':
      if (mode === 'edit') return buildOperationalNoteEditPayload({ actorId: context.actorId }, values);
      return { ...buildOperationalNoteIntakePayload(
        { actorId: context.actorId },
        values,
        (values.entryMode as OperationalNoteEntryMode | undefined) ?? 'flash',
      ) };

    case 'kpi-definition':
      return buildKpiThresholdDraftDomainPayload(values);

    case 'administrative-record':
      return buildAdministrativeRecordPayload(values, mode);

    case 'federation-metadata':
      return buildFederationMetadataIntakePayload(
        {
          actorId: context.actorId,
          tenantId: String(values.tenantId ?? 'trackmind'),
          racetrackId: String(values.racetrackId ?? 'main-track'),
        },
        values,
      );

    default:
      return values;
  }
}
