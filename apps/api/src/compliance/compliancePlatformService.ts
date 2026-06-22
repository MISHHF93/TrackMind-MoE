import type { KPIArtifact, KPIStatus } from '@trackmind/shared';
import {
  ComplianceControlLibrary,
  seededComplianceLibrary,
  type ComplianceFrameworkId,
  type CorrectiveAction,
  type EvidencePackage,
} from '../complianceControlLibrary.js';

export interface ComplianceKpiPanelDto {
  kpiId: string;
  label: string;
  value: number;
  unit: string;
  target: number;
  status: KPIStatus;
  description: string;
}

export interface ComplianceDashboardDto {
  generatedAt: string;
  tenantId: string;
  racetrackId: string;
  readinessScore: number;
  controlsMapped: number;
  controlsEffective: number;
  evidenceCoverage: number;
  openFindings: number;
  overdueActions: number;
  evidencePackages: number;
  accreditationPrograms: number;
  frameworks: ComplianceFrameworkId[];
  kpiPack: ComplianceKpiPanelDto[];
  regulatoryWorkflows: Array<{ id: string; name: string; domain: string; triggerEvents: string[] }>;
  mock: false;
}

export interface ComplianceEvidencePacketRequest {
  id: string;
  title: string;
  controlIds: string[];
  sealed?: boolean;
  frameworkIds?: ComplianceFrameworkId[];
  approvalRequestIds?: string[];
  racetrackId?: string;
}

const regulatoryWorkflows = [
  { id: 'compliance-evidence-review', name: 'Compliance evidence collection and review', domain: 'compliance', triggerEvents: ['compliance.evidence.collected.v1'] },
  { id: 'compliance-corrective-action', name: 'Compliance corrective action and approval', domain: 'compliance', triggerEvents: ['compliance.finding.opened.v1'] },
  { id: 'accreditation-readiness-review', name: 'Internal accreditation readiness review', domain: 'compliance', triggerEvents: ['compliance.accreditation.readiness.updated.v1'] },
];

function kpiStatus(value: number, target: number, direction: 'above' | 'below' = 'above'): KPIStatus {
  if (direction === 'below') return value <= target ? 'nominal' : value <= target * 1.5 ? 'watch' : 'warning';
  if (value >= target) return 'nominal';
  if (value >= target * 0.85) return 'watch';
  return 'warning';
}

export class CompliancePlatformService {
  constructor(readonly library: ComplianceControlLibrary = seededComplianceLibrary('trackmind')) {}

  dashboard(tenantId = 'trackmind', racetrackId = 'main-track', generatedAt = new Date().toISOString()): ComplianceDashboardDto {
    const snapshot = this.library.dashboard();
    const readiness = snapshot.readiness;
    const sealedPackages = snapshot.evidencePackages.filter((pkg) => pkg.sealed).length;
    const accreditationScore = snapshot.accreditationPrograms[0]?.readinessScore ?? readiness.score;
    const evidenceCoveragePct = readiness.evidenceCoverage;
    return {
      generatedAt,
      tenantId,
      racetrackId,
      readinessScore: readiness.score,
      controlsMapped: readiness.totalControls,
      controlsEffective: readiness.effectiveControls,
      evidenceCoverage: evidenceCoveragePct,
      openFindings: readiness.openFindings,
      overdueActions: readiness.overdueActions,
      evidencePackages: snapshot.evidencePackages.length,
      accreditationPrograms: snapshot.accreditationPrograms.length,
      frameworks: snapshot.frameworks.map((framework) => framework.id),
      kpiPack: [
        { kpiId: 'kpi-compliance', label: 'Control mapping readiness', value: readiness.score, unit: 'score', target: 85, status: kpiStatus(readiness.score, 85), description: 'Composite audit readiness from mapped controls and evidence.' },
        { kpiId: 'kpi-compliance-open-findings', label: 'Open findings pressure', value: readiness.openFindings, unit: 'findings', target: 0, status: kpiStatus(readiness.openFindings, 0, 'below'), description: 'Open compliance findings requiring corrective action.' },
        { kpiId: 'kpi-compliance-overdue-actions', label: 'Overdue corrective actions', value: readiness.overdueActions, unit: 'actions', target: 0, status: kpiStatus(readiness.overdueActions, 0, 'below'), description: 'Corrective actions past due date.' },
        { kpiId: 'kpi-compliance-evidence-package-coverage', label: 'Sealed evidence package coverage', value: snapshot.evidencePackages.length ? Math.round(sealedPackages / snapshot.evidencePackages.length * 100) : 0, unit: '%', target: 90, status: kpiStatus(snapshot.evidencePackages.length ? Math.round(sealedPackages / snapshot.evidencePackages.length * 100) : 0, 90), description: 'Percentage of evidence packages sealed for internal review.' },
        { kpiId: 'kpi-compliance-accreditation-readiness', label: 'Accreditation readiness score', value: accreditationScore, unit: 'score', target: 85, status: kpiStatus(accreditationScore, 85), description: 'Internal accreditation readiness; not external certification.' },
      ],
      regulatoryWorkflows,
      mock: false,
    };
  }

  listCorrectiveActions(findingId?: string): CorrectiveAction[] {
    return this.library.listCorrectiveActions(findingId);
  }

  getCorrectiveAction(id: string): CorrectiveAction {
    return this.library.getCorrectiveAction(id);
  }

  createCorrectiveAction(input: { findingId: string; ownerId: string; action: string; dueAt: string; startWorkflow?: boolean; approvalRequestId?: string; actor?: string }) {
    return this.library.createCorrectiveAction(input.findingId, input.ownerId, input.action, input.dueAt, {
      startWorkflow: input.startWorkflow,
      approvalRequestId: input.approvalRequestId,
      now: new Date().toISOString(),
    });
  }

  updateCorrectiveAction(id: string, patch: Partial<Pick<CorrectiveAction, 'ownerId' | 'action' | 'dueAt' | 'status' | 'approvalRequestId'>>, actor: string) {
    return this.library.updateCorrectiveAction(id, patch, actor);
  }

  closeCorrectiveAction(id: string, actor: string) {
    return this.library.closeCorrectiveAction(id, actor);
  }

  deleteCorrectiveAction(id: string, actor: string) {
    return this.library.deleteCorrectiveAction(id, actor);
  }

  policyRegistry() {
    return this.library.policyRegistry();
  }

  generateEvidencePacket(input: ComplianceEvidencePacketRequest): EvidencePackage {
    return this.library.generateEvidencePacket(input);
  }

  syncKpiArtifacts(kpis: KPIArtifact[], generatedAt = new Date().toISOString()): KPIArtifact[] {
    const dashboard = this.dashboard(undefined, undefined, generatedAt);
    const byId = new Map(dashboard.kpiPack.map((panel) => [panel.kpiId, panel]));
    return kpis.map((kpi) => {
      const panel = byId.get(kpi.kpiId);
      if (!panel) return kpi;
      return {
        ...kpi,
        value: panel.value,
        status: panel.status,
        lastCalculatedAt: generatedAt,
        updatedAt: generatedAt,
      };
    });
  }
}

export function createCompliancePlatformService(library?: ComplianceControlLibrary) {
  return new CompliancePlatformService(library ?? seededComplianceLibrary('trackmind'));
}
