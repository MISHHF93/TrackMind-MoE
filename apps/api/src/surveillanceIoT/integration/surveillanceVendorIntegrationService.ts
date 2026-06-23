import { buildSurveillanceVendorIntegrationWorkspace } from '@trackmind/shared';
import type { SurveillanceVendorIntegrationWorkspaceDto } from '@trackmind/shared';
import type { SurveillanceIoTModuleContext } from '../types.js';

export class SurveillanceVendorIntegrationService {
  buildWorkspace(ctx: SurveillanceIoTModuleContext): SurveillanceVendorIntegrationWorkspaceDto {
    return buildSurveillanceVendorIntegrationWorkspace({
      generatedAt: ctx.now,
      organizationId: ctx.scope.organizationId,
      tenantId: ctx.scope.tenantId,
      racetrackId: ctx.scope.racetrackId,
      providerConfigs: [],
      mock: false,
    });
  }
}
