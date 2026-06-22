import type { DomainEntityKind } from './domainKernel.js';
import type { KPIDomain } from './kpiArtifacts.js';
import type { Role } from './accessControl.js';
import { racingOperatingDomains, type RacingOperatingDomain } from './racingOperatingDomains.js';
import {
  buildRacingOsConvergenceReport,
  normalizeRacingOperatingCapabilities,
  racingOsConvergenceDimensions,
  type RacingOsConvergenceDimension,
} from './racingOsConvergence.js';

export { racingOperatingDomains, type RacingOperatingDomain } from './racingOperatingDomains.js';

export const racingOperatingModelSchemaVersion = 'trackmind.racing-operating-model.v1' as const;

/** Every capability must materialize across these eleven Racing OS convergence dimensions. */
export const technologyArtifactDimensions = racingOsConvergenceDimensions;

export type TechnologyArtifactDimension = RacingOsConvergenceDimension;

export type RacingLifecycleStage =
  | 'planned'
  | 'onboarding'
  | 'configured'
  | 'active'
  | 'in-operation'
  | 'under-review'
  | 'suspended'
  | 'completed'
  | 'archived';

export type ArtifactImplementationStatus =
  | 'implemented'
  | 'partial'
  | 'wired-reference'
  | 'readiness-metadata'
  | 'next-hardening';

export interface RacingLifecycleTransition {
  from: RacingLifecycleStage;
  to: RacingLifecycleStage;
  trigger: string;
  protectedAction?: string;
  eventType?: string;
  approvalRequired: boolean;
}

export interface TechnologyArtifactBinding {
  dimension: TechnologyArtifactDimension;
  status: ArtifactImplementationStatus;
  reference: string;
  description: string;
}

export interface RacingOperatingCapability {
  id: RacingOperatingDomain;
  displayName: string;
  description: string;
  domainEntityKind: DomainEntityKind | DomainEntityKind[];
  lifecycleStages: RacingLifecycleStage[];
  lifecycleTransitions: RacingLifecycleTransition[];
  ownerRole: Role;
  kpiDomain: KPIDomain;
  artifacts: TechnologyArtifactBinding[];
  expansionWave: number;
  dependsOn: RacingOperatingDomain[];
  osBranch: 'operations' | 'safety' | 'compliance' | 'commerce' | 'federation' | 'intelligence';
}

export interface RacingExpansionWave {
  wave: number;
  title: string;
  domains: RacingOperatingDomain[];
  exitCriteria: string[];
  technologyMilestone: string;
}

export interface RacingOperatingModelDto {
  generatedAt: string;
  schemaVersion: typeof racingOperatingModelSchemaVersion;
  principle: string;
  domains: RacingOperatingDomain[];
  artifactDimensions: TechnologyArtifactDimension[];
  capabilities: RacingOperatingCapability[];
  expansionSequence: RacingExpansionWave[];
  coverageSummary: {
    totalCapabilities: number;
    implementedArtifacts: number;
    partialArtifacts: number;
    readinessArtifacts: number;
    coveragePct: number;
  };
  mock: false;
}

const artifact = (
  dimension: TechnologyArtifactDimension,
  status: ArtifactImplementationStatus,
  reference: string,
  description: string,
): TechnologyArtifactBinding => ({ dimension, status, reference, description });

const transition = (
  from: RacingLifecycleStage,
  to: RacingLifecycleStage,
  trigger: string,
  approvalRequired: boolean,
  eventType?: string,
  protectedAction?: string,
): RacingLifecycleTransition => ({ from, to, trigger, approvalRequired, eventType, protectedAction });

const capability = (
  input: Omit<RacingOperatingCapability, 'artifacts'> & { artifacts: TechnologyArtifactBinding[] },
): RacingOperatingCapability => input;

export const rawRacingOperatingCapabilities: readonly RacingOperatingCapability[] = [
  capability({
    id: 'racetrack',
    displayName: 'Racetrack',
    description: 'Physical venue, jurisdiction, sectors, operating calendar, and tenant anchor for all race-day operations.',
    domainEntityKind: 'racetrack',
    lifecycleStages: ['planned', 'onboarding', 'configured', 'active', 'in-operation', 'under-review', 'suspended', 'archived'],
    lifecycleTransitions: [
      transition('planned', 'onboarding', 'tenant provisioning initiated', false, 'racetrack.onboarding.started.v1'),
      transition('onboarding', 'configured', 'track configuration approved', true, 'racetrack.configuration.approved.v1', 'track-closure'),
      transition('configured', 'active', 'commission acceptance recorded', true, 'racetrack.activated.v1'),
      transition('active', 'in-operation', 'race meet opened', false, 'racetrack.operation.started.v1'),
      transition('in-operation', 'under-review', 'incident or audit review opened', false, 'racetrack.review.opened.v1'),
      transition('under-review', 'suspended', 'track closure authorized', true, 'racetrack.suspended.v1', 'track-closure'),
      transition('suspended', 'active', 'track reopen authorized', true, 'racetrack.reopened.v1', 'track-reopen'),
    ],
    ownerRole: 'facilities-manager',
    kpiDomain: 'tenant-operations',
    expansionWave: 1,
    dependsOn: [],
    osBranch: 'operations',
    artifacts: [
      artifact('domain-model', 'implemented', 'domainKernel:RacetrackEntity', 'Canonical racetrack entity with sectors and facilities'),
      artifact('api-contract', 'implemented', 'GET /api/v1/track-configuration/map', 'Track map and configuration workspace'),
      artifact('event-model', 'implemented', 'racetrack.configuration.changed.v1', 'Configuration change events with twin refs'),
      artifact('kpi-artifact', 'partial', 'kpi:tenant-operations:track-readiness', 'Track readiness and configuration KPIs'),
      artifact('audit-artifact', 'implemented', 'audit:track.configuration.changed', 'Immutable audit for configuration mutations'),
      artifact('approval-workflow', 'implemented', 'protected:track-closure,track-reopen', 'Closure and reopen require superintendent approval'),
      artifact('dashboard-view', 'implemented', '/track-configuration', 'Track configuration command-center workspace'),
      artifact('documentation', 'partial', 'report:track-certification-candidate', 'Accreditation readiness scorecard export'),
      artifact('ai-context-source', 'partial', 'ai-context:track-topology', 'Surface and sector context for advisory models'),
    ],
  }),
  capability({
    id: 'race-meeting',
    displayName: 'Race Meeting',
    description: 'Seasonal meet spanning multiple race days with regulatory authority, dates, and meet-level configuration.',
    domainEntityKind: 'race-meet',
    lifecycleStages: ['planned', 'configured', 'active', 'in-operation', 'completed', 'archived'],
    lifecycleTransitions: [
      transition('planned', 'configured', 'meet schedule published', false, 'race-meet.scheduled.v1'),
      transition('configured', 'active', 'meet opened for entries', true, 'race-meet.opened.v1', 'race-office-configuration'),
      transition('active', 'in-operation', 'first race day opened', false, 'race-meet.operation.started.v1'),
      transition('in-operation', 'completed', 'final race day closed', false, 'race-meet.completed.v1'),
    ],
    ownerRole: 'horse-operations-coordinator',
    kpiDomain: 'race-day-operations',
    expansionWave: 2,
    dependsOn: ['racetrack'],
    osBranch: 'operations',
    artifacts: [
      artifact('domain-model', 'implemented', 'domainKernel:RaceMeetEntity', 'Meet entity with season, dates, race days'),
      artifact('api-contract', 'implemented', 'GET /api/v1/race-operations/race-office', 'Race office workspace with meets'),
      artifact('event-model', 'implemented', 'race-meet.opened.v1', 'Meet lifecycle events'),
      artifact('kpi-artifact', 'partial', 'kpi:race-day-operations:meet-readiness', 'Meet readiness blockers and schedule adherence'),
      artifact('audit-artifact', 'implemented', 'audit:race.office.changed', 'Meet configuration audit trail'),
      artifact('approval-workflow', 'implemented', 'protected:race-office-configuration', 'Meet config changes approval-gated'),
      artifact('dashboard-view', 'implemented', '/race-office', 'Race office workspace'),
      artifact('documentation', 'partial', 'report:meet-schedule', 'Meet schedule and condition book export'),
      artifact('ai-context-source', 'readiness-metadata', 'ai-context:meet-calendar', 'Meet calendar for scheduling advisors'),
    ],
  }),
  capability({
    id: 'race-card',
    displayName: 'Race Card',
    description: 'Published card of races for a race day including post times, conditions, and entry windows.',
    domainEntityKind: 'race-card',
    lifecycleStages: ['planned', 'configured', 'active', 'in-operation', 'completed', 'archived'],
    lifecycleTransitions: [
      transition('planned', 'configured', 'card drafted by racing secretary', false, 'race-card.drafted.v1'),
      transition('configured', 'active', 'card published', true, 'race-card.published.v1', 'race-office-configuration'),
      transition('active', 'in-operation', 'first race loading', false, 'race-card.operation.started.v1'),
      transition('in-operation', 'completed', 'card official', true, 'race-card.official.v1', 'official-results'),
    ],
    ownerRole: 'horse-operations-coordinator',
    kpiDomain: 'race-day-operations',
    expansionWave: 3,
    dependsOn: ['race-meeting'],
    osBranch: 'operations',
    artifacts: [
      artifact('domain-model', 'implemented', 'domainKernel:RaceCardEntity', 'Race card entity linked to race day'),
      artifact('api-contract', 'implemented', 'GET /api/v1/racing-data/canonical/race-cards', 'Canonical race card envelopes'),
      artifact('event-model', 'implemented', 'race-card.published.v1', 'Card publication events'),
      artifact('kpi-artifact', 'partial', 'kpi:race-day-operations:card-completeness', 'Entry completeness and scratch rate'),
      artifact('audit-artifact', 'implemented', 'audit:race.card.changed', 'Card mutation audit records'),
      artifact('approval-workflow', 'implemented', 'protected:race-office-configuration', 'Card publication approval-gated'),
      artifact('dashboard-view', 'implemented', '/race-day', 'Race day timeline with card view'),
      artifact('documentation', 'partial', 'report:condition-book', 'Condition book and program export'),
      artifact('ai-context-source', 'partial', 'ai-context:race-card-structure', 'Card structure for race readiness models'),
    ],
  }),
  capability({
    id: 'race',
    displayName: 'Individual Race',
    description: 'Single contest with entries, post positions, lifecycle from scheduled through official results.',
    domainEntityKind: 'race',
    lifecycleStages: ['planned', 'configured', 'active', 'in-operation', 'completed', 'archived'],
    lifecycleTransitions: [
      transition('configured', 'active', 'entries closed', false, 'race.entries.closed.v1'),
      transition('active', 'in-operation', 'race started', true, 'race.started.v1', 'race-start'),
      transition('in-operation', 'under-review', 'inquiry opened', false, 'race.inquiry.opened.v1'),
      transition('under-review', 'completed', 'results declared official', true, 'race.results.official.v1', 'official-results'),
    ],
    ownerRole: 'horse-operations-coordinator',
    kpiDomain: 'race-day-operations',
    expansionWave: 4,
    dependsOn: ['race-card'],
    osBranch: 'operations',
    artifacts: [
      artifact('domain-model', 'implemented', 'domainKernel:RaceEntity', 'Race entity with entries and status'),
      artifact('api-contract', 'implemented', 'POST /api/v1/races/{raceId}/start', 'Approval-gated race commands'),
      artifact('event-model', 'implemented', 'race.start.requested.v1', 'Race lifecycle event catalog'),
      artifact('kpi-artifact', 'implemented', 'kpi:race-day-operations:race-readiness', 'Per-race readiness KPIs'),
      artifact('audit-artifact', 'implemented', 'audit:race.status.transitioned', 'Race command audit chain'),
      artifact('approval-workflow', 'implemented', 'protected:race-start,race-stop,official-results', 'Race commands human-authorized'),
      artifact('dashboard-view', 'implemented', '/race-day', 'Race day command center'),
      artifact('documentation', 'partial', 'report:race-results', 'Official results and chart export'),
      artifact('ai-context-source', 'partial', 'ai-context:race-lifecycle', 'Race state for MoE routing'),
    ],
  }),
  capability({
    id: 'horse',
    displayName: 'Horse',
    description: 'Registered equine athlete with identity, eligibility, barn assignment, and welfare history.',
    domainEntityKind: 'horse',
    lifecycleStages: ['onboarding', 'configured', 'active', 'in-operation', 'under-review', 'suspended', 'archived'],
    lifecycleTransitions: [
      transition('onboarding', 'configured', 'identity verified', false, 'horse.identity.verified.v1'),
      transition('configured', 'active', 'eligible for entry', true, 'horse.eligibility.approved.v1', 'veterinary-clearance'),
      transition('active', 'in-operation', 'entered in race', false, 'horse.entered.v1'),
      transition('in-operation', 'under-review', 'vet flag raised', false, 'horse.vet-flagged.v1'),
      transition('under-review', 'suspended', 'scratched or withdrawn', true, 'horse.scratched.v1', 'scratch-horse'),
    ],
    ownerRole: 'veterinarian',
    kpiDomain: 'equine-welfare',
    expansionWave: 5,
    dependsOn: ['racetrack'],
    osBranch: 'safety',
    artifacts: [
      artifact('domain-model', 'implemented', 'domainKernel:HorseEntity', 'Horse entity with trainer, owner, vet links'),
      artifact('api-contract', 'implemented', 'GET /api/v1/equine-welfare/workspace', 'Equine welfare intelligence workspace'),
      artifact('event-model', 'implemented', 'equine-welfare.observation.recorded.v1', 'Welfare observation events'),
      artifact('kpi-artifact', 'implemented', 'kpi:equine-welfare:intelligence', 'Equine welfare KPI registry'),
      artifact('audit-artifact', 'implemented', 'audit:equine-welfare.operations', 'Immutable welfare audit trail'),
      artifact('approval-workflow', 'implemented', 'protected:veterinary-clearance,clear-vet-flag', 'Veterinary clearances human-authorized'),
      artifact('dashboard-view', 'implemented', '/equine', 'Equine and welfare intelligence workspace'),
      artifact('documentation', 'partial', 'report:horse-eligibility', 'Eligibility and starts export'),
      artifact('ai-context-source', 'implemented', 'ai-context:horse-profile', 'Horse twin and welfare context for experts'),
    ],
  }),
  capability({
    id: 'owner',
    displayName: 'Owner',
    description: 'Horse ownership entity with partnership structures, silks, and financial interest linkage.',
    domainEntityKind: 'owner',
    lifecycleStages: ['onboarding', 'configured', 'active', 'suspended', 'archived'],
    lifecycleTransitions: [
      transition('onboarding', 'configured', 'ownership registered', false, 'owner.registered.v1'),
      transition('configured', 'active', 'licensed for meet', true, 'owner.licensed.v1'),
      transition('active', 'suspended', 'suspension issued', true, 'owner.suspended.v1', 'disciplinary-decision'),
    ],
    ownerRole: 'horse-operations-coordinator',
    kpiDomain: 'race-day-operations',
    expansionWave: 5,
    dependsOn: ['horse'],
    osBranch: 'operations',
    artifacts: [
      artifact('domain-model', 'implemented', 'domainKernel:OwnerEntity', 'Owner entity with horse links'),
      artifact('api-contract', 'partial', 'GET /api/v1/equine-intelligence/horses/{horseId}', 'Owner visible via horse profile'),
      artifact('event-model', 'wired-reference', 'owner.registered.v1', 'Owner registration events'),
      artifact('kpi-artifact', 'readiness-metadata', 'kpi:race-day-operations:owner-compliance', 'Owner license compliance KPI'),
      artifact('audit-artifact', 'partial', 'audit:owner.record.changed', 'Owner record audit'),
      artifact('approval-workflow', 'readiness-metadata', 'protected:disciplinary-decision', 'Suspension approval workflow'),
      artifact('dashboard-view', 'partial', '/equine', 'Owner context in equine workspace'),
      artifact('documentation', 'next-hardening', 'report:owner-registry', 'Owner registry export'),
      artifact('ai-context-source', 'readiness-metadata', 'ai-context:ownership-structure', 'Ownership graph for eligibility'),
    ],
  }),
  capability({
    id: 'trainer',
    displayName: 'Trainer',
    description: 'Licensed conditioner responsible for horse preparation, barn operations, and declarations.',
    domainEntityKind: 'trainer',
    lifecycleStages: ['onboarding', 'configured', 'active', 'suspended', 'archived'],
    lifecycleTransitions: [
      transition('onboarding', 'configured', 'license verified', false, 'trainer.licensed.v1'),
      transition('configured', 'active', 'barn assigned', false, 'trainer.barn-assigned.v1'),
      transition('active', 'suspended', 'license suspended', true, 'trainer.suspended.v1', 'disciplinary-decision'),
    ],
    ownerRole: 'horse-operations-coordinator',
    kpiDomain: 'race-day-operations',
    expansionWave: 5,
    dependsOn: ['horse'],
    osBranch: 'operations',
    artifacts: [
      artifact('domain-model', 'implemented', 'domainKernel:TrainerEntity', 'Trainer with barn assignments'),
      artifact('api-contract', 'implemented', 'GET /api/v1/barn-operations/workspace', 'Barn operations with trainer context'),
      artifact('event-model', 'wired-reference', 'trainer.declaration.submitted.v1', 'Declaration events'),
      artifact('kpi-artifact', 'partial', 'kpi:race-day-operations:trainer-compliance', 'Trainer license and barn KPIs'),
      artifact('audit-artifact', 'partial', 'audit:trainer.record.changed', 'Trainer record audit'),
      artifact('approval-workflow', 'implemented', 'protected:disciplinary-decision', 'Disciplinary actions approval-gated'),
      artifact('dashboard-view', 'implemented', '/equine', 'Trainer assignments in barn workspace'),
      artifact('documentation', 'next-hardening', 'report:trainer-starts', 'Trainer starts and compliance export'),
      artifact('ai-context-source', 'partial', 'ai-context:trainer-barn', 'Barn and trainer context for ops models'),
    ],
  }),
  capability({
    id: 'jockey',
    displayName: 'Jockey',
    description: 'Licensed rider with mount assignments, weight declarations, and steward oversight history.',
    domainEntityKind: 'jockey',
    lifecycleStages: ['onboarding', 'configured', 'active', 'in-operation', 'suspended', 'archived'],
    lifecycleTransitions: [
      transition('onboarding', 'configured', 'license and weigh-in complete', false, 'jockey.licensed.v1'),
      transition('configured', 'active', 'available for mounts', false, 'jockey.available.v1'),
      transition('active', 'in-operation', 'mounted for race', false, 'jockey.mounted.v1'),
      transition('in-operation', 'suspended', 'suspension or injury hold', true, 'jockey.suspended.v1', 'disciplinary-decision'),
    ],
    ownerRole: 'steward',
    kpiDomain: 'stewarding',
    expansionWave: 5,
    dependsOn: ['race'],
    osBranch: 'safety',
    artifacts: [
      artifact('domain-model', 'implemented', 'domainKernel:JockeyEntity', 'Jockey with license and status'),
      artifact('api-contract', 'implemented', 'GET /api/v1/stewarding/inquiries', 'Jockey context in steward center'),
      artifact('event-model', 'wired-reference', 'jockey.mount.assigned.v1', 'Mount assignment events'),
      artifact('kpi-artifact', 'partial', 'kpi:stewarding:jockey-oversight', 'Jockey inquiry and suspension KPIs'),
      artifact('audit-artifact', 'implemented', 'audit:steward.inquiry.opened', 'Steward inquiry audit with jockey refs'),
      artifact('approval-workflow', 'implemented', 'protected:steward-ruling,disciplinary-decision', 'Rulings approval-gated'),
      artifact('dashboard-view', 'implemented', '/stewarding', 'Steward center with jockey involvement'),
      artifact('documentation', 'partial', 'report:jockey-licenses', 'Jockey license and mount export'),
      artifact('ai-context-source', 'partial', 'ai-context:jockey-history', 'Jockey steward history for case support'),
    ],
  }),
  capability({
    id: 'veterinarian',
    displayName: 'Veterinarian',
    description: 'Track veterinary staff with exam authority, clearance workflows, and privacy-scoped records.',
    domainEntityKind: 'veterinarian',
    lifecycleStages: ['onboarding', 'configured', 'active', 'in-operation', 'archived'],
    lifecycleTransitions: [
      transition('onboarding', 'configured', 'license and authority scope verified', false, 'veterinarian.licensed.v1'),
      transition('configured', 'active', 'on-duty for meet', false, 'veterinarian.on-duty.v1'),
      transition('active', 'in-operation', 'exam or clearance recorded', true, 'veterinarian.clearance.recorded.v1', 'veterinary-clearance'),
    ],
    ownerRole: 'veterinarian',
    kpiDomain: 'veterinary-privacy',
    expansionWave: 6,
    dependsOn: ['horse'],
    osBranch: 'safety',
    artifacts: [
      artifact('domain-model', 'implemented', 'domainKernel:VeterinarianEntity', 'Vet with authority scope'),
      artifact('api-contract', 'implemented', 'GET /api/v1/veterinary-operations/workspace', 'Veterinary operations workspace'),
      artifact('event-model', 'implemented', 'vet-check-completed.v1', 'Veterinary exam events'),
      artifact('kpi-artifact', 'implemented', 'kpi:veterinary-privacy:clearance-backlog', 'Vet clearance KPIs with privacy boundaries'),
      artifact('audit-artifact', 'implemented', 'audit:vet.clearance.recorded', 'Privacy-scoped vet audit'),
      artifact('approval-workflow', 'implemented', 'protected:veterinary-clearance,clear-vet-flag', 'Clearances human-authorized'),
      artifact('dashboard-view', 'implemented', '/veterinary-operations', 'Veterinary operations dashboard'),
      artifact('documentation', 'partial', 'report:vet-clearances', 'Regulatory clearance export (restricted)'),
      artifact('ai-context-source', 'partial', 'ai-context:vet-observations', 'De-identified welfare signals for AI'),
    ],
  }),
  capability({
    id: 'steward',
    displayName: 'Steward',
    description: 'Racing official with inquiry, objection, investigation, and ruling authority under commission rules.',
    domainEntityKind: 'steward',
    lifecycleStages: ['onboarding', 'configured', 'active', 'in-operation', 'archived'],
    lifecycleTransitions: [
      transition('onboarding', 'configured', 'steward license and panel assigned', false, 'steward.assigned.v1'),
      transition('configured', 'active', 'on-duty for race day', false, 'steward.on-duty.v1'),
      transition('active', 'in-operation', 'inquiry or ruling in progress', true, 'steward.inquiry.opened.v1', 'steward-ruling'),
    ],
    ownerRole: 'steward',
    kpiDomain: 'stewarding',
    expansionWave: 6,
    dependsOn: ['race'],
    osBranch: 'compliance',
    artifacts: [
      artifact('domain-model', 'implemented', 'domainKernel:StewardEntity', 'Steward with panel role and jurisdiction'),
      artifact('api-contract', 'implemented', 'GET /api/v1/stewarding/inquiries', 'Full steward center workspace'),
      artifact('event-model', 'implemented', 'steward-inquiry-opened.v1', 'Steward inquiry and ruling events'),
      artifact('kpi-artifact', 'implemented', 'kpi:stewarding:open-inquiries', 'Stewarding KPI framework'),
      artifact('audit-artifact', 'implemented', 'audit:steward.ruling.issued', 'Evidence custody and ruling audit'),
      artifact('approval-workflow', 'implemented', 'protected:steward-ruling,official-results', 'Rulings and result changes approval-gated'),
      artifact('dashboard-view', 'implemented', '/stewarding', 'Steward command center'),
      artifact('documentation', 'implemented', 'report:steward-case-package', 'Appeal and evidence package export'),
      artifact('ai-context-source', 'implemented', 'ai-context:steward-case', 'Case evidence for advisory summaries only'),
    ],
  }),
  capability({
    id: 'official',
    displayName: 'Official',
    description: 'Race-day officials including racing secretary, clerk of scales, placing judges, and timers.',
    domainEntityKind: 'official',
    lifecycleStages: ['onboarding', 'configured', 'active', 'in-operation', 'archived'],
    lifecycleTransitions: [
      transition('onboarding', 'configured', 'credential and role assigned', false, 'official.assigned.v1'),
      transition('configured', 'active', 'on-duty for race day', false, 'official.on-duty.v1'),
      transition('active', 'in-operation', 'official action recorded', true, 'official.action.recorded.v1', 'race-office-configuration'),
    ],
    ownerRole: 'horse-operations-coordinator',
    kpiDomain: 'race-day-operations',
    expansionWave: 6,
    dependsOn: ['race-meeting'],
    osBranch: 'operations',
    artifacts: [
      artifact('domain-model', 'implemented', 'domainKernel:OfficialEntity', 'Official with role type and credentials'),
      artifact('api-contract', 'partial', 'GET /api/v1/race-operations/race-office', 'Official config in race office'),
      artifact('event-model', 'wired-reference', 'official.assigned.v1', 'Official assignment events'),
      artifact('kpi-artifact', 'readiness-metadata', 'kpi:race-day-operations:official-coverage', 'Official coverage KPI'),
      artifact('audit-artifact', 'partial', 'audit:official.action.recorded', 'Official action audit'),
      artifact('approval-workflow', 'implemented', 'protected:race-office-configuration', 'Official config changes approval-gated'),
      artifact('dashboard-view', 'partial', '/race-office', 'Official roster in race office'),
      artifact('documentation', 'next-hardening', 'report:official-roster', 'Race day official roster export'),
      artifact('ai-context-source', 'readiness-metadata', 'ai-context:official-assignments', 'Official coverage for readiness models'),
    ],
  }),
  capability({
    id: 'facility',
    displayName: 'Facility',
    description: 'Physical infrastructure including barns, grandstands, paddocks, clinics, and maintenance zones.',
    domainEntityKind: ['facility', 'barn', 'stall'],
    lifecycleStages: ['planned', 'configured', 'active', 'in-operation', 'under-review', 'suspended', 'archived'],
    lifecycleTransitions: [
      transition('planned', 'configured', 'facility registered in asset registry', false, 'facility.registered.v1'),
      transition('configured', 'active', 'inspection passed', true, 'facility.inspected.v1', 'facility-maintenance-execution'),
      transition('active', 'in-operation', 'in use for race day', false, 'facility.in-use.v1'),
      transition('in-operation', 'under-review', 'maintenance or incident review', false, 'facility.review.opened.v1'),
      transition('under-review', 'suspended', 'facility closed', true, 'facility.closed.v1', 'facility-maintenance-execution'),
    ],
    ownerRole: 'facilities-manager',
    kpiDomain: 'facilities',
    expansionWave: 7,
    dependsOn: ['racetrack'],
    osBranch: 'operations',
    artifacts: [
      artifact('domain-model', 'implemented', 'domainKernel:FacilityEntity', 'Facility, barn, and stall entities'),
      artifact('api-contract', 'implemented', 'GET /api/v1/facilities-maintenance/workspace', 'Facilities maintenance workspace'),
      artifact('event-model', 'implemented', 'facility.maintenance.requested.v1', 'Maintenance workflow events'),
      artifact('kpi-artifact', 'implemented', 'kpi:facilities:maintenance-backlog', 'Facilities KPI framework'),
      artifact('audit-artifact', 'implemented', 'audit:facility.maintenance.changed', 'Maintenance audit trail'),
      artifact('approval-workflow', 'implemented', 'protected:facility-maintenance-execution', 'Maintenance execution approval-gated'),
      artifact('dashboard-view', 'implemented', '/facilities', 'Facilities command center'),
      artifact('documentation', 'partial', 'report:facility-inspection', 'Inspection and maintenance export'),
      artifact('ai-context-source', 'partial', 'ai-context:facility-state', 'Facility twin state for maintenance AI'),
    ],
  }),
  capability({
    id: 'fan',
    displayName: 'Fan',
    description: 'Attendee and hospitality guest with ticketing, capacity, and guest services lifecycle.',
    domainEntityKind: 'fan',
    lifecycleStages: ['planned', 'active', 'in-operation', 'completed', 'archived'],
    lifecycleTransitions: [
      transition('planned', 'active', 'ticket purchased or credential issued', false, 'fan.ticket.issued.v1'),
      transition('active', 'in-operation', 'on-site attendance recorded', false, 'fan.arrived.v1'),
      transition('in-operation', 'completed', 'departed or event ended', false, 'fan.departed.v1'),
    ],
    ownerRole: 'ticketing-fan-manager',
    kpiDomain: 'fan-experience',
    expansionWave: 12,
    dependsOn: ['race-meeting'],
    osBranch: 'commerce',
    artifacts: [
      artifact('domain-model', 'implemented', 'domainKernel:FanEntity', 'Fan attendee entity with ticket refs'),
      artifact('api-contract', 'implemented', 'GET /api/v1/fan-experience/workspace', 'Fan experience operations workspace'),
      artifact('api-contract', 'implemented', 'GET /api/v1/fan-experience/dashboard', 'Fan experience KPI dashboard'),
      artifact('event-model', 'wired-reference', 'fan-experience.attendance.recorded.v1', 'Attendance snapshot events'),
      artifact('event-model', 'wired-reference', 'fan-experience.satisfaction.recorded.v1', 'Event satisfaction survey events'),
      artifact('event-model', 'wired-reference', 'fan-experience.requested.v1', 'Guest service request events'),
      artifact('kpi-artifact', 'implemented', 'kpi:fan-experience:readiness', 'Fan experience KPI framework with attendance, hospitality, premium seating, satisfaction, and revenue linkage'),
      artifact('audit-artifact', 'implemented', 'audit:fan-experience.operations', 'Fan experience hash-chained audit trail'),
      artifact('approval-workflow', 'readiness-metadata', 'protected:ticketing:manage', 'Premium hospitality changes'),
      artifact('dashboard-view', 'implemented', '/fan-experience', 'Fan experience workspace'),
      artifact('documentation', 'partial', 'report:attendance-summary', 'Attendance and capacity export'),
      artifact('ai-context-source', 'readiness-metadata', 'ai-context:crowd-density', 'Aggregate crowd signals for ops AI'),
    ],
  }),
  capability({
    id: 'security',
    displayName: 'Security',
    description: 'Physical and logical security operations including access control, zones, and incident response.',
    domainEntityKind: 'security-event',
    lifecycleStages: ['configured', 'active', 'in-operation', 'under-review', 'completed', 'archived'],
    lifecycleTransitions: [
      transition('configured', 'active', 'security posture armed', false, 'security.posture.armed.v1'),
      transition('active', 'in-operation', 'access event or alert', false, 'security.event.recorded.v1'),
      transition('in-operation', 'under-review', 'incident escalated', true, 'security.incident.escalated.v1', 'emergency-action'),
      transition('under-review', 'completed', 'incident resolved', false, 'security.incident.resolved.v1'),
    ],
    ownerRole: 'security-manager',
    kpiDomain: 'security',
    expansionWave: 8,
    dependsOn: ['racetrack', 'facility'],
    osBranch: 'safety',
    artifacts: [
      artifact('domain-model', 'implemented', 'domainKernel:SecurityEventEntity', 'Security event entity with evidence'),
      artifact('api-contract', 'implemented', 'GET /api/v1/security-operations/workspace', 'Security operations workspace'),
      artifact('event-model', 'implemented', 'security.event.recorded.v1', 'Security event catalog'),
      artifact('kpi-artifact', 'implemented', 'kpi:security:alert-backlog', 'Security KPI framework'),
      artifact('audit-artifact', 'implemented', 'audit:security.event.recorded', 'Mandatory security audit binding'),
      artifact('approval-workflow', 'implemented', 'protected:emergency-action', 'Emergency actions approval-gated'),
      artifact('dashboard-view', 'implemented', '/security', 'Security command center'),
      artifact('documentation', 'partial', 'report:security-incidents', 'Security incident export'),
      artifact('ai-context-source', 'partial', 'ai-context:security-posture', 'Zone and alert context for SOC AI'),
    ],
  }),
  capability({
    id: 'compliance',
    displayName: 'Compliance',
    description: 'Regulatory controls, evidence packages, filings, and accreditation readiness across frameworks.',
    domainEntityKind: 'compliance-record',
    lifecycleStages: ['planned', 'configured', 'active', 'under-review', 'completed', 'archived'],
    lifecycleTransitions: [
      transition('planned', 'configured', 'control mapped to framework', false, 'compliance.control.mapped.v1'),
      transition('configured', 'active', 'control effective with evidence', true, 'compliance.control.effective.v1', 'compliance-filing-approval'),
      transition('active', 'under-review', 'finding or audit opened', false, 'compliance.finding.opened.v1'),
      transition('under-review', 'completed', 'remediation verified', true, 'compliance.remediation.verified.v1', 'compliance-filing-approval'),
    ],
    ownerRole: 'compliance-officer',
    kpiDomain: 'compliance',
    expansionWave: 9,
    dependsOn: ['racetrack'],
    osBranch: 'compliance',
    artifacts: [
      artifact('domain-model', 'implemented', 'domainKernel:ComplianceRecordEntity', 'Compliance record with framework mapping'),
      artifact('api-contract', 'implemented', 'GET /api/v1/compliance-command-center/workspace', 'Compliance command center'),
      artifact('event-model', 'implemented', 'compliance.evidence.collected.v1', 'Compliance evidence events'),
      artifact('kpi-artifact', 'implemented', 'kpi:compliance:readiness-score', 'Compliance readiness KPIs'),
      artifact('audit-artifact', 'implemented', 'audit:compliance.filing.submitted', 'Compliance filing audit chain'),
      artifact('approval-workflow', 'implemented', 'protected:compliance-filing-approval', 'Filings approval-gated'),
      artifact('dashboard-view', 'implemented', '/compliance', 'Compliance workspace'),
      artifact('documentation', 'implemented', 'report:compliance-evidence-package', 'Framework evidence export'),
      artifact('ai-context-source', 'partial', 'ai-context:compliance-gaps', 'Control gap analysis for advisory AI'),
    ],
  }),
  capability({
    id: 'finance',
    displayName: 'Finance',
    description: 'Revenue, expenses, budgets, reconciliation, and governed payout workflows.',
    domainEntityKind: 'finance-record',
    lifecycleStages: ['planned', 'configured', 'active', 'in-operation', 'under-review', 'completed', 'archived'],
    lifecycleTransitions: [
      transition('planned', 'configured', 'chart of accounts and budget set', false, 'finance.budget.configured.v1'),
      transition('configured', 'active', 'race day revenue tracking open', false, 'finance.period.opened.v1'),
      transition('active', 'in-operation', 'payout requested', true, 'finance.payout.requested.v1', 'payout'),
      transition('in-operation', 'under-review', 'reconciliation variance', false, 'finance.reconciliation.flagged.v1'),
      transition('under-review', 'completed', 'period closed', true, 'finance.period.closed.v1', 'payout'),
    ],
    ownerRole: 'finance-manager',
    kpiDomain: 'finance',
    expansionWave: 10,
    dependsOn: ['race'],
    osBranch: 'commerce',
    artifacts: [
      artifact('domain-model', 'implemented', 'domainKernel:FinanceRecordEntity', 'Finance record with payout governance'),
      artifact('api-contract', 'implemented', 'GET /api/v1/finance/workspace', 'Racing finance operations workspace'),
      artifact('api-contract', 'implemented', 'GET /api/v1/finance/dashboard', 'Racing finance KPI dashboard'),
      artifact('api-contract', 'implemented', 'GET /api/v1/finance/audit-trail', 'Hash-chained finance audit trail'),
      artifact('event-model', 'wired-reference', 'racing-finance.purse.allocated.v1', 'Purse allocation events'),
      artifact('event-model', 'wired-reference', 'racing-finance.payout.requested.v1', 'Payout request events'),
      artifact('kpi-artifact', 'implemented', 'kpi:finance:readiness', 'Racing finance KPI framework with revenue, expense, and purse metrics'),
      artifact('audit-artifact', 'implemented', 'audit:racing-finance.operations', 'Immutable hash-chained finance audit trail'),
      artifact('approval-workflow', 'implemented', 'protected:payout', 'Payouts dual-control approval-gated'),
      artifact('dashboard-view', 'implemented', '/finance', 'Finance workspace'),
      artifact('documentation', 'partial', 'report:financial-reconciliation', 'Reconciliation export'),
      artifact('ai-context-source', 'readiness-metadata', 'ai-context:revenue-forecast', 'Revenue forecast context'),
    ],
  }),
  capability({
    id: 'data-provider',
    displayName: 'Data Provider',
    description: 'Licensed external racing data feeds with ingestion, normalization, and entity resolution.',
    domainEntityKind: 'data-provider',
    lifecycleStages: ['onboarding', 'configured', 'active', 'in-operation', 'suspended', 'archived'],
    lifecycleTransitions: [
      transition('onboarding', 'configured', 'provider registered with license', false, 'data-provider.registered.v1'),
      transition('configured', 'active', 'ingestion job approved', true, 'data-provider.ingestion.approved.v1'),
      transition('active', 'in-operation', 'canonical artifacts published', false, 'data-provider.canonical.published.v1'),
      transition('in-operation', 'suspended', 'license expired or quality failure', true, 'data-provider.suspended.v1'),
    ],
    ownerRole: 'organization-admin',
    kpiDomain: 'racing-data-hub',
    expansionWave: 11,
    dependsOn: ['racetrack'],
    osBranch: 'intelligence',
    artifacts: [
      artifact('domain-model', 'implemented', 'domainKernel:DataProviderEntity', 'Data provider with license context'),
      artifact('api-contract', 'implemented', 'GET /api/v1/racing-data/providers', 'Racing data hub provider registry'),
      artifact('event-model', 'implemented', 'racing-data.ingestion.completed.v1', 'Ingestion and normalization events'),
      artifact('kpi-artifact', 'implemented', 'kpi:racing-data-hub:data-quality', 'Data quality and freshness KPIs'),
      artifact('audit-artifact', 'implemented', 'audit:racing-data.ingestion', 'Ingestion lineage audit'),
      artifact('approval-workflow', 'partial', 'protected:ingestion-job-approval', 'Ingestion jobs draft-only'),
      artifact('dashboard-view', 'implemented', '/data-hub', 'Racing data hub workspace'),
      artifact('documentation', 'partial', 'report:data-lineage', 'Provider lineage export'),
      artifact('ai-context-source', 'implemented', 'ai-context:canonical-racing-data', 'Normalized data for feature store'),
    ],
  }),
  capability({
    id: 'federation-participant',
    displayName: 'Federation Participant',
    description: 'Multi-track network participant with governed data-sharing, benchmarks, and council governance.',
    domainEntityKind: 'federation-participant',
    lifecycleStages: ['onboarding', 'configured', 'active', 'in-operation', 'suspended', 'archived'],
    lifecycleTransitions: [
      transition('onboarding', 'configured', 'data-sharing policy accepted', true, 'federation.policy.accepted.v1'),
      transition('configured', 'active', 'benchmark cohort joined', false, 'federation.cohort.joined.v1'),
      transition('active', 'in-operation', 'aggregate analytics published', false, 'federation.benchmark.published.v1'),
      transition('in-operation', 'suspended', 'policy violation or withdrawal', true, 'federation.participant.suspended.v1'),
    ],
    ownerRole: 'platform-super-admin',
    kpiDomain: 'multi-track-federation',
    expansionWave: 13,
    dependsOn: ['racetrack', 'compliance'],
    osBranch: 'federation',
    artifacts: [
      artifact('domain-model', 'implemented', 'domainKernel:FederationParticipantEntity', 'Federation participant with policy refs'),
      artifact('api-contract', 'implemented', 'GET /api/v1/federation-intelligence/workspace', 'Legacy federation intelligence projection'),
      artifact('api-contract', 'implemented', 'GET /api/v1/industry-intelligence/workspace', 'Industry intelligence with anonymized benchmarking'),
      artifact('api-contract', 'implemented', 'GET /api/v1/industry-intelligence/dashboard', 'Industry scorecard dashboard'),
      artifact('api-contract', 'implemented', 'GET /api/v1/industry-intelligence/benchmarks', 'Anonymized industry benchmarks'),
      artifact('api-contract', 'implemented', 'GET /api/v1/industry-intelligence/trends', 'Track vs industry trend comparisons'),
      artifact('event-model', 'wired-reference', 'industry-intelligence.aggregate.generated.v1', 'Industry aggregate analytics events'),
      artifact('kpi-artifact', 'implemented', 'kpi:multi-track-federation:cohort-benchmarks', 'Anonymized federation KPIs'),
      artifact('audit-artifact', 'partial', 'audit:federation.policy.changed', 'Federation policy audit'),
      artifact('approval-workflow', 'implemented', 'protected:federation-data-sharing', 'Data-sharing policy approval-gated'),
      artifact('dashboard-view', 'implemented', '/federation', 'Federation workspace'),
      artifact('documentation', 'partial', 'report:federation-benchmark', 'Aggregate benchmark export'),
      artifact('ai-context-source', 'readiness-metadata', 'ai-context:federation-benchmarks', 'De-identified benchmark context'),
    ],
  }),
] as const;

const normalizedOperatingModel = normalizeRacingOperatingCapabilities(rawRacingOperatingCapabilities);

export const racingOperatingCapabilities = normalizedOperatingModel.capabilities;
export const racingOperatingConvergenceInconsistencies = normalizedOperatingModel.inconsistencies;

export const racingExpansionSequence: readonly RacingExpansionWave[] = [
  { wave: 1, title: 'Venue Foundation', domains: ['racetrack'], exitCriteria: ['Racetrack entity validated', 'Track configuration API live', 'Closure/reopen approval workflows wired'], technologyMilestone: 'Domain kernel + track configuration workspace' },
  { wave: 2, title: 'Meet Operations', domains: ['race-meeting'], exitCriteria: ['Meet lifecycle events registered', 'Race office meet management live'], technologyMilestone: 'Race office read model + meet events' },
  { wave: 3, title: 'Card Publishing', domains: ['race-card'], exitCriteria: ['Race card entity in domain kernel', 'Canonical card artifacts normalized'], technologyMilestone: 'Race card domain model + data hub cards' },
  { wave: 4, title: 'Race Execution', domains: ['race'], exitCriteria: ['Race commands approval-gated', 'Race readiness KPIs live'], technologyMilestone: 'Race lifecycle + command center' },
  { wave: 5, title: 'Equine Registry', domains: ['horse', 'owner', 'trainer', 'jockey'], exitCriteria: ['Identity entities linked', 'Equine workspace complete'], technologyMilestone: 'Equine intelligence platform' },
  { wave: 6, title: 'Governance People', domains: ['veterinarian', 'steward', 'official'], exitCriteria: ['Steward center live', 'Vet clearance workflows', 'Official roster modeled'], technologyMilestone: 'Stewarding + vet privacy + officials' },
  { wave: 7, title: 'Physical Infrastructure', domains: ['facility'], exitCriteria: ['Facilities workspace live', 'Maintenance approval workflows'], technologyMilestone: 'RACR + facilities maintenance' },
  { wave: 8, title: 'Security Operations', domains: ['security'], exitCriteria: ['Security events audit-bound', 'Emergency escalation wired'], technologyMilestone: 'Security SOC workspace' },
  { wave: 9, title: 'Compliance Posture', domains: ['compliance'], exitCriteria: ['Control library mapped', 'Evidence packages exportable'], technologyMilestone: 'Compliance command center' },
  { wave: 10, title: 'Financial Governance', domains: ['finance'], exitCriteria: ['Payout dual-control live', 'Finance KPIs registered'], technologyMilestone: 'Finance platform workspace' },
  { wave: 11, title: 'Data Integration', domains: ['data-provider'], exitCriteria: ['Provider registry live', 'Canonical normalization pipeline'], technologyMilestone: 'Racing data API hub' },
  { wave: 12, title: 'Fan Experience', domains: ['fan'], exitCriteria: ['Fan workspace live', 'Attendance KPIs'], technologyMilestone: 'Fan experience + ticketing' },
  { wave: 13, title: 'Federation Network', domains: ['federation-participant'], exitCriteria: ['Aggregate benchmarks only', 'No cross-tenant raw data'], technologyMilestone: 'Federation intelligence workspace' },
];

function countArtifactsByStatus(statuses: ArtifactImplementationStatus[]): number {
  return racingOperatingCapabilities.reduce((sum, cap) => sum + cap.artifacts.filter((a) => statuses.includes(a.status)).length, 0);
}

export function getRacingOperatingCapability(id: RacingOperatingDomain): RacingOperatingCapability | undefined {
  return racingOperatingCapabilities.find((cap) => cap.id === id);
}

export function getRacingOperatingCapabilitiesByWave(wave: number): RacingOperatingCapability[] {
  return racingOperatingCapabilities.filter((cap) => cap.expansionWave === wave);
}

export function buildRacingOperatingModel(timestamp = new Date().toISOString()): RacingOperatingModelDto {
  const totalArtifacts = racingOperatingCapabilities.length * technologyArtifactDimensions.length;
  const implemented = countArtifactsByStatus(['implemented']);
  const partial = countArtifactsByStatus(['partial', 'wired-reference']);
  const readiness = countArtifactsByStatus(['readiness-metadata', 'next-hardening']);
  return {
    generatedAt: timestamp,
    schemaVersion: racingOperatingModelSchemaVersion,
    principle: 'Build from the racing operating model first; converge every domain across eleven technology dimensions into one coherent Racing OS.',
    domains: [...racingOperatingDomains],
    artifactDimensions: [...technologyArtifactDimensions],
    capabilities: [...racingOperatingCapabilities],
    expansionSequence: [...racingExpansionSequence],
    coverageSummary: {
      totalCapabilities: racingOperatingCapabilities.length,
      implementedArtifacts: implemented,
      partialArtifacts: partial,
      readinessArtifacts: readiness,
      coveragePct: Math.round((implemented / totalArtifacts) * 100),
    },
    mock: false,
  };
}

export function validateRacingOperatingModel(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const capabilityIds = new Set<RacingOperatingDomain>();

  for (const cap of racingOperatingCapabilities) {
    if (capabilityIds.has(cap.id)) errors.push(`duplicate capability id: ${cap.id}`);
    capabilityIds.add(cap.id);

    if (!racingOperatingDomains.includes(cap.id)) errors.push(`capability ${cap.id} not in racingOperatingDomains`);

    const dimensions = new Set(cap.artifacts.map((a) => a.dimension));
    for (const dim of technologyArtifactDimensions) {
      if (!dimensions.has(dim)) errors.push(`capability ${cap.id} missing artifact dimension: ${dim}`);
    }
    if (cap.artifacts.length !== technologyArtifactDimensions.length) {
      errors.push(`capability ${cap.id} must have exactly ${technologyArtifactDimensions.length} artifact bindings`);
    }

    for (const dep of cap.dependsOn) {
      if (!racingOperatingDomains.includes(dep)) errors.push(`capability ${cap.id} depends on unknown domain: ${dep}`);
      if (dep === cap.id) errors.push(`capability ${cap.id} cannot depend on itself`);
    }
  }

  for (const domain of racingOperatingDomains) {
    if (!capabilityIds.has(domain)) errors.push(`missing capability definition for domain: ${domain}`);
  }

  for (const wave of racingExpansionSequence) {
    for (const domain of wave.domains) {
      const cap = getRacingOperatingCapability(domain);
      if (cap && cap.expansionWave !== wave.wave) {
        errors.push(`wave ${wave.wave} lists ${domain} but capability expansionWave is ${cap.expansionWave}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function buildRacingOperatingConvergenceReport(timestamp = new Date().toISOString()) {
  return buildRacingOsConvergenceReport(
    racingOperatingCapabilities,
    timestamp,
    racingOperatingConvergenceInconsistencies,
  );
}
