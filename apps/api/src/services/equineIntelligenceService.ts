import type { ApprovalToken } from '../approvals.js';
import { ApexApprovalGateway, type ApexMutationContext, type ApprovalEvidencePackage, type ApprovalRequiredActionRecord } from './approvalGateway.js';

export interface HorseLifecycleRecord {
  horseId: string;
  name: string;
  lifecycleStatus: 'active' | 'scratched' | 'retired' | 'under-review';
  veterinaryNotes: string;
  privacyClass: 'public' | 'veterinary-private';
}

export interface ScratchDecisionInput {
  horseId: string;
  reason: string;
  evidence: ApprovalEvidencePackage;
  context: ApexMutationContext;
}

export interface MedicationApprovalInput {
  horseId: string;
  medication: string;
  reason: string;
  evidence: ApprovalEvidencePackage;
  context: ApexMutationContext;
}

export class EquineIntelligenceService {
  private readonly horses = new Map<string, HorseLifecycleRecord>([
    ['horse-1', { horseId: 'horse-1', name: 'Safety First', lifecycleStatus: 'active', veterinaryNotes: 'Private vet notes: mild soreness watch.', privacyClass: 'veterinary-private' }],
  ]);

  constructor(private readonly approvals: ApexApprovalGateway) {}

  horseProfile(horseId: string, roles: string[] = []) {
    const horse = this.requireHorse(horseId);
    const canViewVetPrivate = roles.includes('veterinarian') || roles.includes('steward') || roles.includes('platform-super-admin');
    return {
      ...horse,
      veterinaryNotes: canViewVetPrivate ? horse.veterinaryNotes : 'redacted-veterinary-privacy',
      privacyFiltered: !canViewVetPrivate,
    };
  }

  async requestScratchDecision(input: ScratchDecisionInput): Promise<ApprovalRequiredActionRecord> {
    this.requireHorse(input.horseId);
    return this.approvals.requestProtectedMutation({
      service: 'equine-intelligence',
      operation: 'scratch_decision',
      action: 'scratch-horse',
      target: input.horseId,
      payload: { reason: input.reason },
      context: input.context,
      evidence: input.evidence,
      execute: (_token: ApprovalToken) => {
        const horse = this.requireHorse(input.horseId);
        horse.lifecycleStatus = 'scratched';
        return { horseId: horse.horseId, lifecycleStatus: horse.lifecycleStatus, dualControl: ['veterinarian', 'steward'] };
      },
    });
  }

  async requestMedicationApproval(input: MedicationApprovalInput): Promise<ApprovalRequiredActionRecord> {
    this.requireHorse(input.horseId);
    return this.approvals.requestProtectedMutation({
      service: 'equine-intelligence',
      operation: 'medication_approval',
      action: 'medication-decision',
      target: input.horseId,
      payload: { medication: input.medication, reason: input.reason },
      context: input.context,
      evidence: input.evidence,
      execute: (_token: ApprovalToken) => ({ horseId: input.horseId, medication: input.medication, approved: true, dualControl: ['veterinarian', 'steward'] }),
    });
  }

  private requireHorse(horseId: string): HorseLifecycleRecord {
    const horse = this.horses.get(horseId);
    if (!horse) throw new Error(`Unknown horse ${horseId}`);
    return horse;
  }
}

export function createEquineIntelligenceService(gateway = new ApexApprovalGateway()) {
  return new EquineIntelligenceService(gateway);
}
