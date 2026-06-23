import type { SurveillanceIoTZoneMappingWorkspaceDto } from '@trackmind/shared';
import type { SurveillanceIoTWorkspaceDto } from '@trackmind/shared';
import type { SecurityActor } from '../../securityOps.js';
import type { AuditGovernanceService } from '../governance/auditGovernanceService.js';
import type { SurveillanceAdministrationGovernanceService } from '../governance/surveillanceAdministrationGovernanceService.js';
import type { SurveillanceIoTModuleContext } from '../types.js';
import { OperationalZoneMappingService } from './operationalZoneMappingService.js';

export class FacilityZoneMappingService {
  private readonly operationalMapping = new OperationalZoneMappingService();

  buildZoneMappingWorkspace(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    actor: SecurityActor,
  ): SurveillanceIoTZoneMappingWorkspaceDto {
    return this.operationalMapping.buildWorkspace(ctx, workspace, actor);
  }

  getOperationalZone(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    zoneId: string,
    actor: SecurityActor,
  ) {
    return this.operationalMapping.getOperationalZone(ctx, workspace, zoneId, actor);
  }

  updateDeviceZoneAssignment(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    deviceId: string,
    update: Parameters<OperationalZoneMappingService['updateDeviceAssignment']>[3],
    actor: SecurityActor,
    governance: AuditGovernanceService,
    adminGovernance: SurveillanceAdministrationGovernanceService,
  ) {
    return this.operationalMapping.updateDeviceAssignment(ctx, workspace, deviceId, update, actor, governance, adminGovernance);
  }
}
