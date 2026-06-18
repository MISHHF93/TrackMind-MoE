import type { CentralizedApprovalService } from '../approvals.js';
import { ImmutableAuditLog } from '../auditLog.js';
import type { ImmutableAuditLog as AuditLogType } from '../auditLog.js';
import { createCommandCenterContractSnapshot } from '../commandCenterV1.js';
import { seededComplianceLibrary } from '../complianceControlLibrary.js';
import { DigitalTwinRuntime } from '../digitalTwinRuntime.js';
import { createFacilitiesMaintenanceService } from '../facilitiesMaintenance.js';
import { createFederationWorkspace } from '../federation.js';
import { PlatformObservabilityService } from '../platformObservability.js';
import { createAIModelCardRegistry } from './aiRegistryService.js';
import { createEquineIntelligencePrivacyService } from '../services/equine/service.js';
import { SecurityOperationsService } from '../securityOps.js';
import { WorkflowOrchestrationEngine } from '../workflowEngine.js';

export interface NexusPlatformStateSlice {
  auditLedger?: AuditLogType;
  approvalService?: CentralizedApprovalService;
  racingData?: { providers?: unknown[] };
}

function resolveAuditLog(options: {
  auditLog?: AuditLogType;
  platformState?: NexusPlatformStateSlice;
}): AuditLogType {
  const candidate = options.auditLog ?? options.platformState?.auditLedger;
  if (candidate && typeof candidate.all === 'function') return candidate;
  return new ImmutableAuditLog();
}

/** Canonical domain services — single source of truth for nexus workspace projections (prompts 05–20). */
export interface NexusPlatformCanonicalDeps {
  commandCenterSnapshot: () => import('../commandCenterV1.js').CommandCenterContractSnapshot;
  digitalTwinRuntime: DigitalTwinRuntime;
  complianceLibrary: ReturnType<typeof seededComplianceLibrary>;
  facilitiesMaintenance: ReturnType<typeof createFacilitiesMaintenanceService>;
  securityOperations: SecurityOperationsService;
  workflowEngine: WorkflowOrchestrationEngine;
  platformObservability: PlatformObservabilityService;
  federationWorkspace: typeof createFederationWorkspace;
  equineService: ReturnType<typeof createEquineIntelligencePrivacyService>;
  aiModelRegistry: typeof createAIModelCardRegistry;
  racingDataProviderCount: () => number;
}

export function createNexusPlatformCanonicalDeps(options: {
  platformState?: NexusPlatformStateSlice;
  approvalService?: CentralizedApprovalService;
  auditLog?: AuditLogType;
} = {}): NexusPlatformCanonicalDeps {
  const auditLog = resolveAuditLog(options);
  const approvals = options.approvalService ?? options.platformState?.approvalService;
  const digitalTwinRuntime = new DigitalTwinRuntime({ auditLog, approvals });
  const workflowEngine = new WorkflowOrchestrationEngine({ approvalService: approvals, auditLog });
  const complianceLibrary = seededComplianceLibrary('trackmind');
  const facilitiesMaintenance = createFacilitiesMaintenanceService();
  const securityOperations = new SecurityOperationsService();
  const platformObservability = new PlatformObservabilityService({
    auditLog,
    approvals,
    twins: digitalTwinRuntime,
    workflows: workflowEngine,
  });

  return {
    commandCenterSnapshot: () => createCommandCenterContractSnapshot(),
    digitalTwinRuntime,
    complianceLibrary,
    facilitiesMaintenance,
    securityOperations,
    workflowEngine,
    platformObservability,
    federationWorkspace: createFederationWorkspace,
    equineService: createEquineIntelligencePrivacyService(),
    aiModelRegistry: createAIModelCardRegistry,
    racingDataProviderCount: () => options.platformState?.racingData?.providers?.length ?? 0,
  };
}
