import type { SecurityActor } from '../securityOps.js';

export interface SurveillanceIoTScope {
  organizationId: string;
  tenantId: string;
  racetrackId: string;
}

export interface SurveillanceIoTModuleContext {
  scope: SurveillanceIoTScope;
  actor: SecurityActor;
  now: string;
}

export const defaultSurveillanceIoTScope = (): SurveillanceIoTScope => ({
  organizationId: 'org-trackmind-network',
  tenantId: 'trackmind',
  racetrackId: 'main-track',
});

export function resolveScope(
  base: SurveillanceIoTScope,
  actor: SecurityActor,
): SurveillanceIoTScope {
  return {
    organizationId: base.organizationId,
    tenantId: actor.tenantId ?? base.tenantId,
    racetrackId: base.racetrackId,
  };
}

export function auditIds(now: string, suffix: string) {
  const auditId = `audit:surveillance-iot:${suffix}`;
  const eventId = `evt:surveillance-iot:${suffix}`;
  return {
    auditId,
    eventId,
    audit: {
      auditId,
      eventId,
      createdAt: now,
      updatedAt: now,
      createdBy: 'surveillance-iot-module',
      updatedBy: 'surveillance-iot-module',
    },
  };
}
