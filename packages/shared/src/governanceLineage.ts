import type { CanonicalApprovalAuditLinkage } from './accessControl.js';
import type { KPIArtifact } from './kpiArtifacts.js';
import { alertPriorityFromSeverity, normalizeAlertSeverity, type TrackMindAlertPriority, type TrackMindAlertSeverity } from './alertModel.js';

export interface DomainOwnershipEntryDto {
  domainId: string;
  domainName: string;
  ownerTeam: string;
  ownerRole: string;
  serviceId?: string;
  apiPrefix?: string;
  workflowIds: string[];
  kpiIds: string[];
  status: 'implemented' | 'partial' | 'planned';
}

export interface DomainOwnershipRegistryDto {
  generatedAt: string;
  entries: DomainOwnershipEntryDto[];
  mock: boolean;
}

export interface LineageValidationFindingDto {
  category: 'event' | 'recommendation' | 'approval' | 'audit' | 'kpi' | 'notification';
  subjectId: string;
  valid: boolean;
  issue?: string;
}

export interface LineageValidationReportDto {
  generatedAt: string;
  summary: { total: number; valid: number; invalid: number };
  events: LineageValidationFindingDto[];
  recommendations: LineageValidationFindingDto[];
  approvals: LineageValidationFindingDto[];
  audit: LineageValidationFindingDto[];
  kpis: LineageValidationFindingDto[];
  notifications: LineageValidationFindingDto[];
  mock: boolean;
}

export interface ReadinessIndicatorDto {
  label: string;
  value: string | number;
  status: 'ready' | 'watch' | 'blocked' | 'readiness-only';
}

export interface DomainReadinessScorecardDto {
  domain: string;
  score: number;
  status: 'ready' | 'watch' | 'blocked' | 'readiness-only';
  indicators: ReadinessIndicatorDto[];
  sourceEvents: string[];
  ownerRole: string;
}

export interface ReadinessScorecardsDto {
  generatedAt: string;
  operational: DomainReadinessScorecardDto;
  equine: DomainReadinessScorecardDto;
  compliance: DomainReadinessScorecardDto;
  facilities: DomainReadinessScorecardDto;
  security: DomainReadinessScorecardDto;
  mock: boolean;
}

export interface ExecutiveScorecardDto {
  generatedAt: string;
  safety: number;
  compliance: number;
  operations: number;
  adoption: number;
  overall: number;
  kpis: Array<{ kpiId: string; label: string; value: number; domain: string; status: string }>;
  mock: boolean;
}

export interface WorkflowHealthDto {
  generatedAt: string;
  active: number;
  completed: number;
  failed: number;
  bottlenecks: Array<{ workflowId: string; domain: string; pendingSteps: number; severity: TrackMindAlertSeverity; priority: TrackMindAlertPriority }>;
  mock: boolean;
}

export interface PlatformMaturityDimensionDto {
  dimension: string;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  score: number;
  findings: string[];
  recommendations: string[];
}

export interface PlatformMaturityReportDto {
  generatedAt: string;
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  overallScore: number;
  dimensions: PlatformMaturityDimensionDto[];
  mock: boolean;
}

export interface GovernedArtifactSummaryDto {
  artifactId: string;
  artifactType: string;
  domain: string;
  ownerRole: string;
  lineageComplete: boolean;
  auditRefs: string[];
  eventRefs: string[];
}

export interface GovernedArtifactRegistryDto {
  generatedAt: string;
  artifacts: GovernedArtifactSummaryDto[];
  mock: boolean;
}

export function normalizeAuditIds(input: { auditEventIds?: string[]; auditIds?: string[] } | undefined): string[] {
  if (!input) return [];
  return [...(input.auditEventIds ?? []), ...(input.auditIds ?? [])].filter(Boolean);
}

export function validateKpiLineage(kpi: KPIArtifact): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!kpi.sourceEvents?.length) issues.push('missing sourceEvents');
  if (!kpi.sourceEntities?.length) issues.push('missing sourceEntities');
  const auditIds = normalizeAuditIds(kpi.auditReference);
  if (!auditIds.length) issues.push('missing auditReference.auditEventIds');
  if (!kpi.auditReference?.eventIds?.length) issues.push('missing auditReference.eventIds');
  if (!kpi.auditReference?.correlationId) issues.push('missing auditReference.correlationId');
  if (!kpi.auditReference?.calculationRunId) issues.push('missing auditReference.calculationRunId');
  return { valid: issues.length === 0, issues };
}

export function validateApprovalLineage(linkage: CanonicalApprovalAuditLinkage | undefined, requestId: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!linkage) {
    issues.push('missing auditLinkage');
    return { valid: false, issues };
  }
  if (!linkage.auditIds?.length) issues.push('missing auditIds');
  if (!linkage.eventIds?.length) issues.push('missing eventIds');
  if (!linkage.correlationId && !requestId) issues.push('missing correlationId');
  return { valid: issues.length === 0, issues };
}

export function validateRecommendationLineage(input: {
  recommendationId: string;
  confidence?: { raw?: number };
  evidencePackage?: { evidence?: unknown[] };
  approvalRequirement?: { required?: boolean };
  auditReference?: { auditIds?: string[] };
}): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!input.recommendationId) issues.push('missing recommendationId');
  if (input.confidence?.raw == null) issues.push('missing confidence');
  if (!input.evidencePackage?.evidence?.length) issues.push('missing evidence package');
  if (typeof input.approvalRequirement?.required !== 'boolean') issues.push('missing approvalRequirement');
  if (!input.auditReference?.auditIds?.length) issues.push('missing auditReference.auditIds');
  return { valid: issues.length === 0, issues };
}

export function validateAuditLineage(input: {
  id: string;
  action?: string;
  subjectId?: string;
  correlationId?: string;
}): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!input.id) issues.push('missing id');
  if (!input.action) issues.push('missing action');
  if (!input.subjectId && !input.correlationId) issues.push('missing subjectId or correlationId');
  return { valid: issues.length === 0, issues };
}

export function validateEventLineage(input: {
  id?: string;
  type?: string;
  subject?: { id?: string };
  auditRef?: string;
  correlationId?: string;
}): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!input.id) issues.push('missing id');
  if (!input.type) issues.push('missing type');
  if (!input.subject?.id) issues.push('missing subject.id');
  return { valid: issues.length === 0, issues };
}

export function scoreToGrade(score: number): PlatformMaturityDimensionDto['grade'] {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export function readinessStatusFromScore(score: number): DomainReadinessScorecardDto['status'] {
  if (score >= 90) return 'ready';
  if (score >= 70) return 'watch';
  if (score <= 0) return 'readiness-only';
  return score >= 50 ? 'watch' : 'blocked';
}

export function notificationSeverityFromCategory(category: string, severity?: string): TrackMindAlertSeverity {
  if (severity) return normalizeAlertSeverity(severity);
  if (/approval|emergency|incident|security/.test(category)) return 'warning';
  return 'info';
}
