import type { SurveillanceIoTAlertingWorkspaceDto } from '@trackmind/shared';
import { surveillanceIoTArchitectureSchemaVersion } from '@trackmind/shared';
import type { SurveillanceIoTWorkspaceDto } from '@trackmind/shared';
import type { AuditGovernanceService } from '../governance/auditGovernanceService.js';
import type { SurveillanceIoTModuleContext } from '../types.js';
import type { TelemetryIngestionService } from '../ingestion/telemetryIngestionService.js';
import { SurveillanceAlertingFrameworkService } from './surveillanceAlertingFrameworkService.js';

export class AlertingService {
  private readonly framework = new SurveillanceAlertingFrameworkService();

  buildAlertingWorkspace(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    telemetry: TelemetryIngestionService,
    governance: AuditGovernanceService,
  ): SurveillanceIoTAlertingWorkspaceDto {
    const ingested = telemetry.listRecent();
    const recentReadings = ingested.length ? ingested : workspace.recentReadings;
    const openAlerts = workspace.openAlerts;
    const framework = this.framework.buildFramework(ctx, workspace, governance);
    return {
      generatedAt: ctx.now,
      schemaVersion: surveillanceIoTArchitectureSchemaVersion,
      organizationId: ctx.scope.organizationId,
      tenantId: ctx.scope.tenantId,
      racetrackId: ctx.scope.racetrackId,
      openAlerts,
      recentReadings,
      alertSummary: {
        open: openAlerts.filter((alert) => alert.alertStatus === 'open').length,
        critical: openAlerts.filter((alert) => alert.severity === 'critical').length,
        acknowledged: openAlerts.filter((alert) => alert.alertStatus === 'acknowledged').length,
      },
      framework,
      mock: false,
    };
  }
}
