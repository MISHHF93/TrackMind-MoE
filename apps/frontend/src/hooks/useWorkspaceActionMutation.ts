import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  acknowledgeNotification,
  completeEmergencyChecklistItem,
  dispatchNotification,
  generateComplianceEvidencePacket,
  reportFacilitiesIncident,
  simulateApprovalEscalation,
  syncDigitalTwinState,
  completeWorkforceTask,
} from '@/api/mutations';
import type { WorkspaceAction } from '@/design/components/workspace';

export function useWorkspaceActionMutation() {
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['workspace'] });

  const mutation = useMutation({
    mutationFn: async (action: WorkspaceAction) => {
      switch (action.actionKind) {
        case 'escalation-simulate':
          return simulateApprovalEscalation();
        case 'compliance-evidence-packet':
          return generateComplianceEvidencePacket();
        case 'facilities-incident-report':
          return reportFacilitiesIncident({
            id: `fac-inc-${Date.now()}`,
            assetId: 'GATE_MAIN_01',
            severity: 'major',
            summary: 'Operator-reported facility incident from ActionDock',
            reportedBy: 'facilities-operator',
          });
        case 'workforce-task-complete':
          return completeWorkforceTask();
        case 'digital-twin-sync':
          return syncDigitalTwinState();
        case 'notification-dispatch':
          return dispatchNotification({
            title: 'Fan experience alert',
            message: 'Operator dispatch from TrackMind console',
            category: 'operational',
          });
        case 'notification-acknowledge':
          return acknowledgeNotification();
        default:
          throw new Error(`Unsupported action kind: ${action.actionKind ?? 'unknown'}`);
      }
    },
    onSuccess: invalidate,
  });

  return mutation;
}
