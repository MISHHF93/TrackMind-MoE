/**
 * Contract-only read model for emergency operations workspace projection.
 * Runtime delegation lives in apps/api/src/services/safetyEmergencyBoundary.ts.
 */
export type EmergencyApprovalPostureMode = 'post-action-evidence' | 'approval-request-created';

export interface EmergencyOperationsWorkspaceReadModel {
  activeEmergencyStatus: string;
  approvalPosture: {
    mode: EmergencyApprovalPostureMode;
    action: 'emergency-action';
    target: string;
    aiMayBlock: false;
    emergencyPersonnelAuthority: true;
    reason: string;
    approvalRequestId?: string;
  };
  emergencyActions: {
    humanOverrideSupported: true;
    aiMayBlock: false;
    reason: string;
  };
  observability: {
    serviceId: 'emergency-operations';
    healthSignal: 'healthy' | 'degraded' | 'critical';
    activeWorkflows: number;
    openIncidents: number;
    criticalIncidents: number;
    communicationsPending: number;
    lastSignalAt: string;
    traceIds: string[];
  };
  mock: boolean;
}

export interface SafetyEmergencyOperationsReadModelDelegate {
  emergencyOperationsWorkspace(): EmergencyOperationsWorkspaceReadModel;
}
