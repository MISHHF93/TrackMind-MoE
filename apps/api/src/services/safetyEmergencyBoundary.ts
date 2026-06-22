import type { EmergencyOperationsWorkspace } from '../emergencyOperations.js';
import type { EmergencyOperationsService } from '../emergencyOperationsService.js';
import type { SafetyService } from './safetyService.js';

export interface SafetyEmergencyBoundaryOptions {
  emergencyOperations: EmergencyOperationsService;
  safety: SafetyService;
}

/**
 * Safety bounded-context boundary for emergency operations.
 * Read models delegate to EmergencyOperationsPlatform; mutations preserve
 * incident-commander enforcement and post-action evidence via SafetyService.
 */
export class SafetyEmergencyOperationsBoundary {
  constructor(private readonly options: SafetyEmergencyBoundaryOptions) {}

  workspace(): EmergencyOperationsWorkspace {
    return this.options.emergencyOperations.workspace() as unknown as EmergencyOperationsWorkspace;
  }

  get emergencyOperations() {
    return this.options.emergencyOperations;
  }

  get safety() {
    return this.options.safety;
  }
}

export function createSafetyEmergencyOperationsBoundary(options: SafetyEmergencyBoundaryOptions) {
  return new SafetyEmergencyOperationsBoundary(options);
}
