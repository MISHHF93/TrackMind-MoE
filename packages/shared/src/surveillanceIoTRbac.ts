import type { Permission, Role } from './accessControl.js';
import { hasPermission, roles } from './accessControl.js';
import type { SurveillanceIoTDomainScope } from './surveillanceIoT.js';
import type { SurveillanceOperationalZoneSensitivity } from './surveillanceIoTArchitecture.js';

export const surveillanceCapabilities = [
  'view-surveillance-health',
  'view-live-surveillance',
  'view-recorded-media',
  'export-media',
  'manage-devices',
  'view-facility-scoped-devices',
  'view-security-scoped-devices',
  'link-devices-to-incidents',
  'edit-alert-rules',
  'export-surveillance-audit',
  'access-sensitive-surveillance-metadata',
] as const;

export type SurveillanceCapability = typeof surveillanceCapabilities[number];

/** Permissions governing CCTV and IoT surfaces — assigned per role in accessControl.rolePermissions. */
export const surveillancePermissions = [
  'surveillance:health-read',
  'surveillance:device-read',
  'surveillance:device-manage',
  'surveillance:facility-read',
  'surveillance:security-read',
  'surveillance:incident-link',
  'surveillance:alert-rule-edit',
  'surveillance:audit-export',
  'surveillance:sensitive-read',
  'surveillance:governance-read',
  'surveillance:admin-read',
  'surveillance:live-view',
  'surveillance:playback',
  'surveillance:media-export',
  'surveillance:media-snapshot',
] as const satisfies readonly Permission[];

export type SurveillancePermission = typeof surveillancePermissions[number];

export const surveillanceCapabilityRegistry: Record<
  SurveillanceCapability,
  { description: string; permissions: readonly SurveillancePermission[] }
> = {
  'view-surveillance-health': {
    description: 'Read surveillance health, monitoring, and readiness workspaces.',
    permissions: ['surveillance:health-read'],
  },
  'view-live-surveillance': {
    description: 'Use the in-house CCTV viewer for governed live stream and preview tiles.',
    permissions: ['surveillance:live-view'],
  },
  'view-recorded-media': {
    description: 'Play recorded clips from CCTV, steward, and incident evidence in the media viewer.',
    permissions: ['surveillance:playback'],
  },
  'export-media': {
    description: 'Export, share, or snapshot governed media from the viewer.',
    permissions: ['surveillance:media-export', 'surveillance:media-snapshot'],
  },
  'manage-devices': {
    description: 'Create or mutate camera and IoT device registry records within authorized domain scope.',
    permissions: ['surveillance:device-manage'],
  },
  'view-facility-scoped-devices': {
    description: 'Read facility and barn IoT devices, utilities telemetry, and facilities monitoring embeds.',
    permissions: ['surveillance:facility-read', 'surveillance:device-read'],
  },
  'view-security-scoped-devices': {
    description: 'Read security SOC cameras, restricted zones, and security integration embeds.',
    permissions: ['surveillance:security-read', 'surveillance:device-read'],
  },
  'link-devices-to-incidents': {
    description: 'Link surveillance evidence and device context to incidents.',
    permissions: ['surveillance:incident-link'],
  },
  'edit-alert-rules': {
    description: 'Submit or approve surveillance alert rule and policy changes.',
    permissions: ['surveillance:alert-rule-edit'],
  },
  'export-surveillance-audit': {
    description: 'Export surveillance governance and administration audit records.',
    permissions: ['surveillance:audit-export', 'surveillance:governance-read'],
  },
  'access-sensitive-surveillance-metadata': {
    description: 'Read retention policies, privileged configuration, restricted zone metadata, and adapter credentials placeholders.',
    permissions: ['surveillance:sensitive-read'],
  },
};

const allSurveillancePermissions = surveillancePermissions;

const platformAdminSurveillance: SurveillancePermission[] = [...allSurveillancePermissions];

const organizationAdminSurveillance: SurveillancePermission[] = [
  'surveillance:health-read',
  'surveillance:device-read',
  'surveillance:device-manage',
  'surveillance:facility-read',
  'surveillance:security-read',
  'surveillance:incident-link',
  'surveillance:alert-rule-edit',
  'surveillance:audit-export',
  'surveillance:sensitive-read',
  'surveillance:governance-read',
  'surveillance:admin-read',
];

const racetrackAdminSurveillance: SurveillancePermission[] = [
  'surveillance:health-read',
  'surveillance:device-read',
  'surveillance:device-manage',
  'surveillance:facility-read',
  'surveillance:security-read',
  'surveillance:incident-link',
  'surveillance:audit-export',
  'surveillance:sensitive-read',
  'surveillance:governance-read',
  'surveillance:admin-read',
];

const securityManagerSurveillance: SurveillancePermission[] = [
  'surveillance:health-read',
  'surveillance:device-read',
  'surveillance:device-manage',
  'surveillance:facility-read',
  'surveillance:security-read',
  'surveillance:incident-link',
  'surveillance:alert-rule-edit',
  'surveillance:audit-export',
  'surveillance:sensitive-read',
  'surveillance:governance-read',
  'surveillance:admin-read',
];

const facilitiesManagerSurveillance: SurveillancePermission[] = [
  'surveillance:health-read',
  'surveillance:device-read',
  'surveillance:device-manage',
  'surveillance:facility-read',
  'surveillance:incident-link',
];

const raceDayOperationsSurveillance: SurveillancePermission[] = [
  'surveillance:health-read',
  'surveillance:device-read',
  'surveillance:facility-read',
  'surveillance:security-read',
  'surveillance:incident-link',
];

const stewardSurveillance: SurveillancePermission[] = [
  'surveillance:security-read',
  'surveillance:incident-link',
];

const complianceOfficerSurveillance: SurveillancePermission[] = [
  'surveillance:health-read',
  'surveillance:device-read',
  'surveillance:facility-read',
  'surveillance:security-read',
  'surveillance:incident-link',
  'surveillance:audit-export',
  'surveillance:sensitive-read',
  'surveillance:governance-read',
];

const auditorSurveillance: SurveillancePermission[] = [
  'surveillance:health-read',
  'surveillance:device-read',
  'surveillance:audit-export',
  'surveillance:governance-read',
  'surveillance:sensitive-read',
];

/** Explicit surveillance permission grants by role — merged into accessControl.rolePermissions. */
export const surveillancePermissionsByRole: Partial<Record<Role, SurveillancePermission[]>> = {
  'platform-super-admin': platformAdminSurveillance,
  'organization-admin': organizationAdminSurveillance,
  'racetrack-admin': racetrackAdminSurveillance,
  'security-manager': securityManagerSurveillance,
  'facilities-manager': facilitiesManagerSurveillance,
  'race-day-operations-manager': raceDayOperationsSurveillance,
  steward: stewardSurveillance,
  'compliance-officer': complianceOfficerSurveillance,
  'read-only-auditor': auditorSurveillance,
};

export function surveillancePermissionsForRole(role: Role): SurveillancePermission[] {
  return surveillancePermissionsByRole[role] ?? [];
}

export function canRolePerformSurveillanceCapability(role: Role, capability: SurveillanceCapability): boolean {
  const required = surveillanceCapabilityRegistry[capability].permissions;
  return required.every((permission) => hasPermission(role, permission));
}

export function rolesWithSurveillanceCapability(capability: SurveillanceCapability): Role[] {
  return roles.filter((role) => canRolePerformSurveillanceCapability(role, capability));
}

export function canRoleViewSurveillanceDomain(role: Role, domain: SurveillanceIoTDomainScope): boolean {
  if (hasPermission(role, 'surveillance:admin-read')) return true;
  if (domain === 'shared') {
    return hasPermission(role, 'surveillance:facility-read') || hasPermission(role, 'surveillance:security-read');
  }
  if (domain === 'facilities-iot') {
    return hasPermission(role, 'surveillance:facility-read');
  }
  if (domain === 'security-soc' || domain === 'operations') {
    return hasPermission(role, 'surveillance:security-read');
  }
  return hasPermission(role, 'surveillance:device-read');
}

export function canRoleManageSurveillanceDevice(role: Role, domain: SurveillanceIoTDomainScope): boolean {
  if (!hasPermission(role, 'surveillance:device-manage')) return false;
  if (hasPermission(role, 'surveillance:admin-read')) return true;
  if (role === 'security-manager') {
    return domain === 'security-soc' || domain === 'shared' || domain === 'operations';
  }
  if (role === 'facilities-manager') {
    return domain === 'facilities-iot' || domain === 'shared';
  }
  if (role === 'organization-admin' || role === 'racetrack-admin') {
    return true;
  }
  return role === 'platform-super-admin';
}

export function canRoleEditSurveillanceZoneMapping(
  role: Role,
  sensitivity: SurveillanceOperationalZoneSensitivity,
): boolean {
  if (!hasPermission(role, 'surveillance:device-manage')) return false;
  if (hasPermission(role, 'surveillance:admin-read')) return true;
  if (role === 'security-manager') {
    return sensitivity === 'restricted' || sensitivity === 'security-sensitive' || sensitivity === 'operational' || sensitivity === 'public';
  }
  if (role === 'facilities-manager') {
    return sensitivity === 'operational' || sensitivity === 'public';
  }
  if (role === 'organization-admin' || role === 'racetrack-admin') {
    return sensitivity !== 'security-sensitive' || hasPermission(role, 'surveillance:sensitive-read');
  }
  return false;
}

const surveillanceHealthViewRoles: Role[] = [
  'platform-super-admin',
  'organization-admin',
  'racetrack-admin',
  'security-manager',
  'facilities-manager',
  'race-day-operations-manager',
  'compliance-officer',
  'read-only-auditor',
];

const surveillanceDeviceReadRoles: Role[] = [
  'platform-super-admin',
  'organization-admin',
  'racetrack-admin',
  'security-manager',
  'facilities-manager',
  'race-day-operations-manager',
  'compliance-officer',
  'read-only-auditor',
];

const surveillanceDeviceManageRoles: Role[] = [
  'platform-super-admin',
  'organization-admin',
  'racetrack-admin',
  'security-manager',
  'facilities-manager',
];

const surveillanceGovernanceRoles: Role[] = [
  'platform-super-admin',
  'security-manager',
  'compliance-officer',
  'read-only-auditor',
  'organization-admin',
  'racetrack-admin',
];

const surveillanceIncidentLinkRoles: Role[] = [
  'platform-super-admin',
  'organization-admin',
  'racetrack-admin',
  'security-manager',
  'race-day-operations-manager',
  'steward',
  'compliance-officer',
];

const surveillanceAlertRuleRoles: Role[] = [
  'platform-super-admin',
  'organization-admin',
  'security-manager',
];

const surveillanceSensitiveRoles: Role[] = [
  'platform-super-admin',
  'organization-admin',
  'racetrack-admin',
  'security-manager',
  'compliance-officer',
  'read-only-auditor',
];

const surveillanceAdminWorkspaceRoles: Role[] = [
  'platform-super-admin',
  'organization-admin',
  'racetrack-admin',
  'security-manager',
];

/** Contract role allow-lists keyed by surveillance API operationId. */
export const surveillanceApiOperationRoles: Record<string, readonly Role[]> = {
  getSurveillanceIoTWorkspace: surveillanceAdminWorkspaceRoles,
  getSurveillanceIoTReadiness: surveillanceHealthViewRoles,
  getSurveillanceIoTAdministrationWorkspace: surveillanceAdminWorkspaceRoles,
  getSurveillanceIoTMonitoringWorkspace: surveillanceHealthViewRoles,
  getSurveillanceIoTEvidenceWorkspace: [...new Set([...surveillanceGovernanceRoles, ...surveillanceIncidentLinkRoles])],
  getSurveillanceIoTAlertingWorkspace: surveillanceDeviceReadRoles,
  getSurveillanceIoTZoneMapping: surveillanceDeviceReadRoles,
  getSurveillanceOperationalZone: surveillanceDeviceReadRoles,
  patchSurveillanceDeviceZoneAssignment: surveillanceDeviceManageRoles,
  getSurveillanceHealthWorkspace: surveillanceHealthViewRoles,
  getSurveillanceIoTGovernanceWorkspace: surveillanceGovernanceRoles,
  getSurveillanceAdministrationGovernanceWorkspace: surveillanceGovernanceRoles,
  getSurveillanceIoTKpiPack: [
    'platform-super-admin',
    'organization-admin',
    'racetrack-admin',
    'security-manager',
    'facilities-manager',
    'compliance-officer',
    'read-only-auditor',
    'executive',
  ],
  getSurveillanceVendorIntegrationWorkspace: [
    'platform-super-admin',
    'organization-admin',
    'racetrack-admin',
    'security-manager',
    'facilities-manager',
    'compliance-officer',
    'read-only-auditor',
  ],
  getSurveillanceMediaViewerWorkspace: [
    'platform-super-admin',
    'organization-admin',
    'racetrack-admin',
    'security-manager',
    'race-day-operations-manager',
    'steward',
    'compliance-officer',
  ],
  getSurveillanceMediaViewerPlayback: [
    'platform-super-admin',
    'organization-admin',
    'racetrack-admin',
    'security-manager',
    'race-day-operations-manager',
    'steward',
    'compliance-officer',
  ],
  createSurveillanceMediaSnapshot: ['platform-super-admin', 'organization-admin', 'racetrack-admin', 'security-manager'],
  createSurveillanceMediaExport: ['platform-super-admin', 'organization-admin', 'security-manager', 'compliance-officer'],
  createSurveillanceMediaShareLink: ['platform-super-admin', 'organization-admin', 'security-manager', 'compliance-officer'],
  getSurveillanceCctvViewerWorkspace: [
    'platform-super-admin',
    'organization-admin',
    'racetrack-admin',
    'security-manager',
    'race-day-operations-manager',
  ],
  createSurveillanceAdministrationDevice: surveillanceDeviceManageRoles,
  requestSurveillanceRetentionPolicyChange: ['platform-super-admin', 'security-manager', 'compliance-officer'],
  requestSurveillanceAlertRuleChange: surveillanceAlertRuleRoles,
  applySurveillanceHealthOverride: surveillanceDeviceManageRoles,
  changeSurveillanceMaintenanceStatus: surveillanceDeviceManageRoles,
  linkSurveillanceEvidence: surveillanceIncidentLinkRoles,
  recordSurveillancePrivilegedConfigAccess: surveillanceSensitiveRoles,
  decideSurveillanceAdministrationApproval: ['platform-super-admin', 'security-manager', 'compliance-officer'],
  ingestSurveillanceIoTTelemetry: ['platform-super-admin', 'security-manager', 'facilities-manager'],
  getCctvCameraRegistry: surveillanceDeviceReadRoles,
  getCctvCameraRegistryEntry: surveillanceDeviceReadRoles,
  getCctvCameraDetailWorkspace: surveillanceDeviceReadRoles,
  patchCctvCameraRegistryEntry: surveillanceDeviceManageRoles,
  getIoTDeviceRegistry: surveillanceDeviceReadRoles,
  getIoTDeviceRegistryEntry: surveillanceDeviceReadRoles,
  getIoTDeviceDetailWorkspace: surveillanceDeviceReadRoles,
  patchIoTDeviceRegistryEntry: surveillanceDeviceManageRoles,
};

export function surveillanceApiRolesForOperation(operationId: string): readonly Role[] | undefined {
  return surveillanceApiOperationRoles[operationId];
}

export function permissionForSurveillanceApi(input: {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  operationId: string;
}): Permission | undefined {
  if (!input.path.includes('/surveillance-iot/')) return undefined;

  if (input.operationId === 'linkSurveillanceEvidence') return 'surveillance:incident-link';
  if (input.operationId === 'requestSurveillanceAlertRuleChange') return 'surveillance:alert-rule-edit';
  if (
    input.operationId === 'getSurveillanceIoTGovernanceWorkspace'
    || input.operationId === 'getSurveillanceAdministrationGovernanceWorkspace'
    || input.operationId === 'decideSurveillanceAdministrationApproval'
  ) {
    return input.method === 'GET' ? 'surveillance:governance-read' : 'surveillance:governance-read';
  }
  if (
    input.operationId === 'requestSurveillanceRetentionPolicyChange'
    || input.operationId === 'recordSurveillancePrivilegedConfigAccess'
  ) {
    return 'surveillance:sensitive-read';
  }
  if (
    input.operationId === 'getSurveillanceIoTAdministrationWorkspace'
    || input.operationId === 'getSurveillanceIoTWorkspace'
  ) {
    return 'surveillance:admin-read';
  }
  if (input.operationId === 'getSurveillanceIoTEvidenceWorkspace') {
    return 'surveillance:governance-read';
  }
  if (input.path.includes('/governance/') && input.method === 'GET') {
    return 'surveillance:governance-read';
  }
  if (input.operationId === 'getSurveillanceMediaViewerWorkspace' || input.operationId === 'getSurveillanceCctvViewerWorkspace') {
    return 'surveillance:live-view';
  }
  if (input.operationId === 'getSurveillanceMediaViewerPlayback') return 'surveillance:playback';
  if (input.operationId === 'createSurveillanceMediaSnapshot') return 'surveillance:media-snapshot';
  if (input.operationId === 'createSurveillanceMediaExport' || input.operationId === 'createSurveillanceMediaShareLink') {
    return 'surveillance:media-export';
  }
  if (input.path.includes('/viewer/snapshot')) return 'surveillance:media-snapshot';
  if (input.path.includes('/viewer/')) return input.method === 'GET' ? 'surveillance:live-view' : 'surveillance:media-export';
  if (input.method === 'PATCH' || input.method === 'POST') {
    if (input.path.includes('/alert-rules/')) return 'surveillance:alert-rule-edit';
    if (input.path.includes('/retention-policies/') || input.path.includes('/privileged-config/')) {
      return 'surveillance:sensitive-read';
    }
    return 'surveillance:device-manage';
  }
  if (input.operationId === 'getSurveillanceVendorIntegrationWorkspace' || input.path.includes('/integration/contracts')) {
    return 'surveillance:admin-read';
  }
  if (input.operationId === 'getSurveillanceIoTKpiPack' || input.path.includes('/kpi-pack')) {
    return 'surveillance:health-read';
  }
  if (input.path.includes('/health/') || input.operationId === 'getSurveillanceHealthWorkspace') {
    return 'surveillance:health-read';
  }
  if (input.path.includes('/cameras/') || input.path.includes('/devices/') || input.path.includes('/mapping/')) {
    return 'surveillance:device-read';
  }
  if (input.path.includes('/monitoring/') || input.path.includes('/readiness') || input.path.includes('/alerting/')) {
    return 'surveillance:health-read';
  }
  return 'surveillance:health-read';
}

export const surveillanceFrontendRoutePermissions = {
  iotMonitoring: 'surveillance:health-read',
  cctvViewer: 'surveillance:live-view',
  cctvRegistry: 'surveillance:device-read',
  cctvCameraDetail: 'surveillance:device-read',
  iotRegistry: 'surveillance:device-read',
  iotDeviceDetail: 'surveillance:device-read',
  surveillanceZoneMapping: 'surveillance:device-read',
  surveillanceHealth: 'surveillance:health-read',
  surveillanceAlerting: 'surveillance:health-read',
} as const satisfies Record<string, Permission>;

export type SurveillanceFrontendRouteId = keyof typeof surveillanceFrontendRoutePermissions;

export function surveillanceRoutePermission(routeId: string): Permission | undefined {
  if (!(routeId in surveillanceFrontendRoutePermissions)) return undefined;
  return surveillanceFrontendRoutePermissions[routeId as SurveillanceFrontendRouteId];
}

export function canRoleEditSurveillanceRoute(role: Role, routeId: string): boolean {
  switch (routeId) {
    case 'cctvRegistry':
    case 'cctvCameraDetail':
    case 'iotRegistry':
    case 'iotDeviceDetail':
    case 'surveillanceZoneMapping':
      return hasPermission(role, 'surveillance:device-manage');
    case 'surveillanceAlerting':
      return hasPermission(role, 'surveillance:alert-rule-edit');
    case 'iotMonitoring':
    case 'surveillanceHealth':
      return hasPermission(role, 'surveillance:admin-read');
    default:
      return false;
  }
}

export const surveillanceRbacSchemaVersion = 'trackmind.surveillance-iot-rbac.v1' as const;
