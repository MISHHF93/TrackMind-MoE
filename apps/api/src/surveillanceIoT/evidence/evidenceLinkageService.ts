import type { SurveillanceIoTEvidenceWorkspaceDto, VideoEvidenceReferenceDto } from '@trackmind/shared';
import { surveillanceIoTArchitectureSchemaVersion } from '@trackmind/shared';
import type { SurveillanceIoTWorkspaceDto } from '@trackmind/shared';
import type { SurveillanceAdapterRegistry } from '@trackmind/shared';
import type { SurveillanceIoTModuleContext } from '../types.js';
import { auditIds } from '../types.js';

export class EvidenceLinkageService {
  buildEvidenceWorkspace(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    adapterRegistry: SurveillanceAdapterRegistry,
  ): SurveillanceIoTEvidenceWorkspaceDto {
    const videoEvidence: VideoEvidenceReferenceDto[] = adapterRegistry.nvrAdapters().flatMap((adapter) =>
      adapter.listEvidenceClips(ctx.now).map((clip) => {
        const envelope = auditIds(ctx.now, `evidence:${clip.externalClipId}`);
        return {
          kind: 'video-evidence-reference',
          id: clip.externalClipId,
          organizationId: ctx.scope.organizationId,
          tenantId: ctx.scope.tenantId,
          racetrackId: ctx.scope.racetrackId,
          displayName: `Evidence clip ${clip.externalClipId}`,
          status: 'online',
          health: 'healthy',
          lastSeenAt: clip.clipEndAt,
          createdAt: ctx.now,
          updatedAt: ctx.now,
          domainScope: 'security-soc',
          cameraId: clip.externalCameraId,
          clipStartAt: clip.clipStartAt,
          clipEndAt: clip.clipEndAt,
          storageUri: clip.storageUri,
          checksum: clip.checksum,
          privacyMasked: clip.privacyMasked,
          legalHold: false,
          audit: envelope.audit,
          mock: false,
        };
      }),
    );

    return {
      generatedAt: ctx.now,
      schemaVersion: surveillanceIoTArchitectureSchemaVersion,
      organizationId: ctx.scope.organizationId,
      tenantId: ctx.scope.tenantId,
      racetrackId: ctx.scope.racetrackId,
      incidentReferences: workspace.incidentReferences,
      videoEvidence: videoEvidence.length ? videoEvidence : workspace.videoEvidence,
      retentionPolicies: workspace.retentionPolicies,
      mock: false,
    };
  }
}
