import type { IncidentDto } from '@trackmind/shared';
import {
  buildPlatformIncidentFromIntake,
  parseEvidenceRefs,
  parseInvolvedEntities,
  type IncidentIntakeMode,
  type UnifiedIncidentType,
} from '@trackmind/shared';
import type { IncidentService } from './platform/incidentService.js';

export interface IncidentIntakeScope {
  tenantId: string;
  racetrackId: string;
  actorId: string;
}

export interface IncidentIntakeDomainDeps {
  reportFacilitiesIncident?: (input: Record<string, unknown>, actor: string) => unknown;
  reportPaddockIncident?: (input: Record<string, unknown>, actor: string) => unknown;
  recordWelfareObservation?: (input: Record<string, unknown>, actor: string) => unknown;
  openStewardInquiry?: (input: Record<string, unknown>, actor: string) => unknown;
}

export interface IncidentIntakeResult {
  incident: IncidentDto;
  domainRecordId?: string;
  message: string;
}

export class IncidentIntakeService {
  constructor(
    private readonly incidents: IncidentService,
    private readonly domain: IncidentIntakeDomainDeps = {},
  ) {}

  intake(scope: IncidentIntakeScope, values: Record<string, unknown>): IncidentIntakeResult {
    const mode = (values.intakeMode as IncidentIntakeMode | undefined) ?? 'triage';
    const incident = this.incidents.create(buildPlatformIncidentFromIntake(scope, values, mode));
    const domainRecordId = this.routeDomainExtension(incident, values, scope.actorId);
    return {
      incident,
      domainRecordId,
      message: domainRecordId
        ? `Incident ${incident.id} recorded and linked to domain record ${domainRecordId}.`
        : `Incident ${incident.id} recorded on platform timeline with audit linkage.`,
    };
  }

  updateIntake(id: string, scope: IncidentIntakeScope, values: Record<string, unknown>): IncidentIntakeResult {
    const mode = (values.intakeMode as IncidentIntakeMode | undefined) ?? 'full';
    const involvedEntities = parseInvolvedEntities(values.involvedEntities);
    const evidenceRefs = parseEvidenceRefs(values.evidenceRefs);
    const incident = this.incidents.update(id, {
      severity: values.severity as IncidentDto['severity'] | undefined,
      description: values.detailedNotes ? String(values.detailedNotes) : values.summary ? String(values.summary) : undefined,
      note: String(values.reason ?? 'Incident intake update'),
      actor: scope.actorId,
      incidentType: values.incidentType ? String(values.incidentType) : undefined,
      intakeMode: mode,
      location: values.location ? String(values.location) : undefined,
      summary: values.summary ? String(values.summary) : undefined,
      detailedNotes: values.detailedNotes ? String(values.detailedNotes) : undefined,
      involvedEntities,
      evidenceRefs,
      recommendedNextAction: values.recommendedNextAction ? String(values.recommendedNextAction) : undefined,
      approvalRequired: values.approvalRequired === true,
      subjectKind: values.subjectKind ? String(values.subjectKind) : undefined,
      subjectId: values.subjectId ? String(values.subjectId) : undefined,
    });
    return {
      incident,
      message: `Incident ${incident.id} updated. Changes audit-linked — no emergency or disciplinary actions executed.`,
    };
  }

  private routeDomainExtension(incident: IncidentDto, values: Record<string, unknown>, actor: string): string | undefined {
    const type = String(values.incidentType ?? incident.incidentType ?? '') as UnifiedIncidentType;
    const summary = String(values.summary ?? incident.summary ?? incident.title);
    const evidence = parseEvidenceRefs(values.evidenceRefs);
    const involved = parseInvolvedEntities(values.involvedEntities);
    const horse = involved.find((entity) => entity.kind === 'horse');

    try {
      if (type === 'facilities' && this.domain.reportFacilitiesIncident) {
        const result = this.domain.reportFacilitiesIncident({
          assetId: values.location ?? incident.location,
          title: incident.title,
          severity: incident.severity,
          description: summary,
          evidence: evidence.length ? evidence : [`platform-incident:${incident.id}`],
          reportedBy: actor,
        }, actor) as { incidentId?: string; id?: string };
        return String(result?.incidentId ?? result?.id ?? `facilities:${incident.id}`);
      }
      if (type === 'operational-disruption' && this.domain.reportPaddockIncident) {
        const result = this.domain.reportPaddockIncident({
          raceId: involved.find((entity) => entity.kind === 'race')?.id,
          horseId: horse?.id,
          severity: incident.severity,
          title: incident.title,
          summary,
          zoneId: incident.location,
          evidence: evidence.length ? evidence : [`platform-incident:${incident.id}`],
          reportedBy: actor,
        }, actor) as { incidentId?: string; id?: string };
        return String(result?.incidentId ?? result?.id ?? `paddock:${incident.id}`);
      }
      if (type === 'equine-welfare' && this.domain.recordWelfareObservation && horse) {
        const result = this.domain.recordWelfareObservation({
          horseId: horse.id,
          category: 'welfare-incident',
          score: incident.severity === 'critical' ? 40 : incident.severity === 'high' ? 55 : 70,
          notes: summary,
          evidence: evidence.length ? evidence : [`platform-incident:${incident.id}`],
          observerId: actor,
          role: 'welfare-officer',
        }, actor) as { observationId?: string };
        return String(result?.observationId ?? `welfare:${incident.id}`);
      }
      if (type === 'steward' && this.domain.openStewardInquiry) {
        const result = this.domain.openStewardInquiry({
          raceId: involved.find((entity) => entity.kind === 'race')?.id ?? 'race-7',
          involvedHorses: involved.filter((entity) => entity.kind === 'horse').map((entity) => entity.id),
          involvedJockeys: involved.filter((entity) => entity.kind === 'jockey').map((entity) => entity.id),
          evidenceReferences: evidence.length ? evidence : [`platform-incident:${incident.id}`],
          incidentsUnderReview: [incident.id],
        }, actor) as { id?: string; inquiryId?: string };
        return String(result?.inquiryId ?? result?.id ?? `steward:${incident.id}`);
      }
    } catch {
      return undefined;
    }
    return undefined;
  }
}
