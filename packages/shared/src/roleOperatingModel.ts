import type { KPIDomain } from './kpiArtifacts.js';
import type {
  ProtectedAction,
  Role,
  RoleScope,
} from './accessControl.js';
import { roles } from './accessControl.js';
import { canRoleEditSurveillanceRoute, surveillanceFrontendRoutePermissions } from './surveillanceIoTRbac.js';
import type { VeterinaryPrivacyScope } from './veterinaryOperations.js';

export type DomainRouteId =
  | 'dashboard'
  | 'raceDay'
  | 'equine'
  | 'approvals'
  | 'incidents'
  | 'compliance'
  | 'security'
  | 'facilities'
  | 'ticketing'
  | 'finance'
  | 'federation'
  | 'dataHub'
  | 'audit'
  | 'admin'
  | 'iotMonitoring'
  | 'cctvRegistry'
  | 'cctvViewer'
  | 'cctvCameraDetail'
  | 'iotRegistry'
  | 'iotDeviceDetail'
  | 'surveillanceZoneMapping'
  | 'surveillanceHealth'
  | 'surveillanceAlerting'
  | 'settings'
  | 'stewarding'
  | 'workforce'
  | 'digitalTwin'
  | 'surface'
  | 'emergency'
  | 'analytics'
  | 'fanExperience'
  | 'notifications'
  | 'account';

export type NavigationGroup =
  | 'Command'
  | 'Race Operations'
  | 'Safety & Facilities'
  | 'Governance'
  | 'Business Controls'
  | 'Data Governance'
  | 'Platform'
  | 'System Status';

export type SensitivityLevel =
  | 'public'
  | 'operational'
  | 'medical'
  | 'financial'
  | 'disciplinary'
  | 'security-sensitive'
  | 'compliance'
  | 'support-governed';

export type FunctionalCategory =
  | 'operational'
  | 'executive'
  | 'medical-welfare'
  | 'compliance'
  | 'finance'
  | 'system-admin';

export interface RoleCapabilityBinding {
  role: Role;
  scope: RoleScope;
  category: FunctionalCategory;
  homeRouteId: DomainRouteId;
  navigationGroupOrder: NavigationGroup[];
  viewerRoutes: DomainRouteId[];
  editorRoutes: DomainRouteId[];
  approverActions: ProtectedAction[];
  adminRoutes: DomainRouteId[];
  exportRoutes: DomainRouteId[];
  kpiDomains: KPIDomain[];
  auditVisibility: 'none' | 'read' | 'export';
  notificationChannels: string[];
  quickActions: string[];
  privacyScopes: VeterinaryPrivacyScope[];
}

const allRoutes: DomainRouteId[] = [
  'dashboard', 'raceDay', 'equine', 'approvals', 'incidents', 'compliance', 'security',
  'facilities', 'ticketing', 'finance', 'federation', 'dataHub', 'audit', 'admin', 'iotMonitoring', 'cctvRegistry', 'cctvViewer', 'cctvCameraDetail', 'iotRegistry', 'iotDeviceDetail', 'surveillanceZoneMapping', 'surveillanceHealth', 'surveillanceAlerting',
  'settings', 'stewarding', 'workforce', 'digitalTwin', 'surface', 'emergency',
  'analytics', 'fanExperience', 'notifications', 'account',
];

const bind = (binding: RoleCapabilityBinding): RoleCapabilityBinding => binding;

export const roleCapabilityBindings: Record<Role, RoleCapabilityBinding> = {
  'platform-super-admin': bind({
    role: 'platform-super-admin',
    scope: 'platform',
    category: 'system-admin',
    homeRouteId: 'admin',
    navigationGroupOrder: ['System Status', 'Platform', 'Governance', 'Command', 'Race Operations', 'Safety & Facilities', 'Business Controls', 'Data Governance'],
    viewerRoutes: allRoutes,
    editorRoutes: allRoutes,
    approverActions: [],
    adminRoutes: ['admin', 'iotMonitoring', 'settings'],
    exportRoutes: ['audit', 'compliance', 'dataHub', 'federation'],
    kpiDomains: ['system-health', 'tenant-operations', 'deployment-readiness', 'audit-integrity', 'surveillance-iot'],
    auditVisibility: 'export',
    notificationChannels: ['platform', 'security', 'compliance', 'operations'],
    quickActions: ['platform-health', 'tenant-management', 'feature-flags'],
    privacyScopes: ['public', 'racing-officials', 'care-team', 'regulator', 'veterinary-confidential'],
  }),
  'organization-admin': bind({
    role: 'organization-admin',
    scope: 'organization',
    category: 'system-admin',
    homeRouteId: 'analytics',
    navigationGroupOrder: ['Command', 'Governance', 'System Status', 'Race Operations', 'Business Controls', 'Data Governance'],
    viewerRoutes: ['dashboard', 'admin', 'iotMonitoring', 'cctvRegistry', 'cctvViewer', 'cctvCameraDetail', 'iotRegistry', 'iotDeviceDetail', 'surveillanceZoneMapping', 'surveillanceHealth', 'surveillanceAlerting', 'analytics', 'compliance', 'audit', 'approvals', 'finance', 'federation', 'dataHub', 'notifications'],
    editorRoutes: ['admin', 'iotMonitoring', 'cctvRegistry', 'cctvCameraDetail', 'iotRegistry', 'iotDeviceDetail', 'surveillanceZoneMapping', 'surveillanceHealth', 'surveillanceAlerting', 'approvals'],
    approverActions: ['kpi-threshold-change', 'compliance-filing-approval'],
    adminRoutes: ['admin', 'iotMonitoring'],
    exportRoutes: ['audit', 'compliance'],
    kpiDomains: ['tenant-operations', 'multi-track-federation', 'approval-workflows', 'surveillance-iot'],
    auditVisibility: 'export',
    notificationChannels: ['organization', 'compliance', 'executive'],
    quickActions: ['user-management', 'module-enablement'],
    privacyScopes: ['public', 'racing-officials', 'care-team', 'regulator'],
  }),
  'racetrack-admin': bind({
    role: 'racetrack-admin',
    scope: 'racetrack',
    category: 'system-admin',
    homeRouteId: 'dashboard',
    navigationGroupOrder: ['Command', 'Race Operations', 'Safety & Facilities', 'Governance', 'Business Controls'],
    viewerRoutes: ['dashboard', 'raceDay', 'equine', 'stewarding', 'surface', 'approvals', 'incidents', 'emergency', 'security', 'facilities', 'workforce', 'compliance', 'audit', 'notifications', 'analytics', 'iotMonitoring', 'cctvRegistry', 'cctvViewer', 'cctvCameraDetail', 'iotRegistry', 'iotDeviceDetail', 'surveillanceZoneMapping', 'surveillanceHealth', 'surveillanceAlerting'],
    editorRoutes: ['dashboard', 'raceDay', 'facilities', 'approvals', 'cctvRegistry', 'cctvCameraDetail', 'iotRegistry', 'iotDeviceDetail', 'surveillanceZoneMapping', 'surveillanceHealth'],
    approverActions: ['facility-maintenance-execution', 'kpi-threshold-change'],
    adminRoutes: ['dashboard'],
    exportRoutes: ['audit'],
    kpiDomains: ['tenant-operations', 'race-day-operations', 'facilities', 'approval-workflows', 'surveillance-iot'],
    auditVisibility: 'export',
    notificationChannels: ['racetrack', 'operations', 'compliance'],
    quickActions: ['race-day-readiness', 'user-assignments'],
    privacyScopes: ['public', 'racing-officials', 'care-team'],
  }),
  'race-day-operations-manager': bind({
    role: 'race-day-operations-manager',
    scope: 'racetrack',
    category: 'operational',
    homeRouteId: 'raceDay',
    navigationGroupOrder: ['Race Operations', 'Command', 'Safety & Facilities', 'Governance'],
    viewerRoutes: ['raceDay', 'dashboard', 'surface', 'stewarding', 'equine', 'approvals', 'incidents', 'emergency', 'notifications', 'iotMonitoring', 'cctvViewer', 'surveillanceHealth'],
    editorRoutes: ['raceDay', 'incidents', 'approvals'],
    approverActions: ['race-start', 'race-stop', 'emergency-action', 'race-status-change'],
    adminRoutes: [],
    exportRoutes: [],
    kpiDomains: ['race-day-operations', 'starting-gate-operations', 'paddock-operations', 'approval-workflows', 'safety-incidents'],
    auditVisibility: 'read',
    notificationChannels: ['race-day', 'incidents', 'approvals'],
    quickActions: ['race-start-approval', 'scratch-approval', 'open-approvals'],
    privacyScopes: ['public', 'racing-officials'],
  }),
  steward: bind({
    role: 'steward',
    scope: 'racetrack',
    category: 'operational',
    homeRouteId: 'stewarding',
    navigationGroupOrder: ['Race Operations', 'Governance', 'Command'],
    viewerRoutes: ['stewarding', 'raceDay', 'equine', 'approvals', 'audit', 'incidents', 'dashboard', 'notifications'],
    editorRoutes: ['stewarding', 'approvals'],
    approverActions: ['race-start', 'official-results', 'disciplinary-decision', 'steward-decision', 'steward-ruling', 'scratch-horse'],
    adminRoutes: [],
    exportRoutes: ['audit'],
    kpiDomains: ['steward-operations', 'stewarding', 'approval-workflows', 'safety-incidents'],
    auditVisibility: 'read',
    notificationChannels: ['stewarding', 'incidents', 'approvals'],
    quickActions: ['steward-inquiry', 'open-approvals'],
    privacyScopes: ['public', 'racing-officials', 'regulator'],
  }),
  'starter-official': bind({
    role: 'starter-official',
    scope: 'racetrack',
    category: 'operational',
    homeRouteId: 'raceDay',
    navigationGroupOrder: ['Race Operations', 'Command'],
    viewerRoutes: ['raceDay', 'surface', 'approvals', 'notifications'],
    editorRoutes: ['raceDay'],
    approverActions: ['starting-gate-move', 'race-status-change'],
    adminRoutes: [],
    exportRoutes: [],
    kpiDomains: ['starting-gate-operations', 'race-day-operations'],
    auditVisibility: 'none',
    notificationChannels: ['race-day', 'gate-readiness'],
    quickActions: ['gate-readiness', 'race-start-approval'],
    privacyScopes: ['public', 'racing-officials'],
  }),
  'paddock-official': bind({
    role: 'paddock-official',
    scope: 'racetrack',
    category: 'operational',
    homeRouteId: 'raceDay',
    navigationGroupOrder: ['Race Operations'],
    viewerRoutes: ['raceDay', 'equine', 'notifications'],
    editorRoutes: ['raceDay', 'equine'],
    approverActions: [],
    adminRoutes: [],
    exportRoutes: [],
    kpiDomains: ['paddock-operations', 'equine-welfare'],
    auditVisibility: 'none',
    notificationChannels: ['paddock', 'equine'],
    quickActions: ['paddock-check-in', 'readiness-update'],
    privacyScopes: ['public', 'racing-officials'],
  }),
  'equine-welfare-officer': bind({
    role: 'equine-welfare-officer',
    scope: 'racetrack',
    category: 'medical-welfare',
    homeRouteId: 'equine',
    navigationGroupOrder: ['Race Operations', 'Governance'],
    viewerRoutes: ['equine', 'raceDay', 'approvals', 'notifications'],
    editorRoutes: ['equine'],
    approverActions: [],
    adminRoutes: [],
    exportRoutes: [],
    kpiDomains: ['equine-welfare', 'equine-intelligence', 'veterinary-privacy'],
    auditVisibility: 'read',
    notificationChannels: ['welfare', 'equine'],
    quickActions: ['welfare-observation', 'follow-up-request'],
    privacyScopes: ['public', 'racing-officials', 'care-team'],
  }),
  veterinarian: bind({
    role: 'veterinarian',
    scope: 'racetrack',
    category: 'medical-welfare',
    homeRouteId: 'equine',
    navigationGroupOrder: ['Race Operations', 'Governance'],
    viewerRoutes: ['equine', 'raceDay', 'approvals', 'audit', 'notifications'],
    editorRoutes: ['equine', 'approvals'],
    approverActions: ['clear-vet-flag', 'veterinary-clearance', 'medication-decision', 'scratch-horse'],
    adminRoutes: [],
    exportRoutes: [],
    kpiDomains: ['veterinary-operations', 'equine-welfare', 'veterinary-privacy'],
    auditVisibility: 'read',
    notificationChannels: ['veterinary', 'welfare', 'approvals'],
    quickActions: ['vet-examination', 'clearance-request'],
    privacyScopes: ['public', 'racing-officials', 'care-team', 'veterinary-confidential'],
  }),
  'horse-operations-coordinator': bind({
    role: 'horse-operations-coordinator',
    scope: 'racetrack',
    category: 'operational',
    homeRouteId: 'equine',
    navigationGroupOrder: ['Race Operations', 'Data Governance'],
    viewerRoutes: ['equine', 'raceDay', 'dataHub', 'approvals', 'notifications'],
    editorRoutes: ['equine', 'raceDay'],
    approverActions: ['race-office-configuration', 'scratch-horse'],
    adminRoutes: [],
    exportRoutes: [],
    kpiDomains: ['trainer-management', 'jockey-management', 'racing-calendar', 'paddock-operations'],
    auditVisibility: 'read',
    notificationChannels: ['horse-ops', 'entries'],
    quickActions: ['horse-entry', 'trainer-assignment'],
    privacyScopes: ['public', 'racing-officials'],
  }),
  'security-manager': bind({
    role: 'security-manager',
    scope: 'racetrack',
    category: 'operational',
    homeRouteId: 'security',
    navigationGroupOrder: ['Safety & Facilities', 'Governance', 'Command'],
    viewerRoutes: ['security', 'incidents', 'emergency', 'iotMonitoring', 'cctvRegistry', 'cctvViewer', 'cctvCameraDetail', 'iotRegistry', 'iotDeviceDetail', 'surveillanceZoneMapping', 'surveillanceHealth', 'surveillanceAlerting', 'audit', 'approvals', 'notifications'],
    editorRoutes: ['security', 'incidents', 'emergency', 'cctvRegistry', 'cctvCameraDetail', 'iotRegistry', 'iotDeviceDetail', 'surveillanceZoneMapping', 'surveillanceHealth', 'surveillanceAlerting'],
    approverActions: ['emergency-action', 'safety-critical-control'],
    adminRoutes: [],
    exportRoutes: ['audit', 'security'],
    kpiDomains: ['security', 'safety-incidents', 'surveillance-iot'],
    auditVisibility: 'export',
    notificationChannels: ['security', 'incidents', 'alerts'],
    quickActions: ['security-incident', 'escalation-request'],
    privacyScopes: ['public'],
  }),
  'facilities-manager': bind({
    role: 'facilities-manager',
    scope: 'racetrack',
    category: 'operational',
    homeRouteId: 'facilities',
    navigationGroupOrder: ['Safety & Facilities', 'Race Operations'],
    viewerRoutes: ['facilities', 'surface', 'digitalTwin', 'approvals', 'notifications', 'iotMonitoring', 'cctvRegistry', 'cctvCameraDetail', 'iotRegistry', 'iotDeviceDetail', 'surveillanceZoneMapping', 'surveillanceHealth', 'surveillanceAlerting'],
    editorRoutes: ['facilities', 'surface', 'cctvRegistry', 'cctvCameraDetail', 'iotRegistry', 'iotDeviceDetail', 'surveillanceZoneMapping', 'surveillanceHealth'],
    approverActions: ['facility-maintenance-execution', 'surface-irrigation', 'track-closure', 'track-reopen'],
    adminRoutes: [],
    exportRoutes: [],
    kpiDomains: ['facilities', 'surface-intelligence', 'tenant-operations', 'surveillance-iot'],
    auditVisibility: 'read',
    notificationChannels: ['facilities', 'maintenance'],
    quickActions: ['maintenance-approval', 'inspection'],
    privacyScopes: ['public', 'racing-officials'],
  }),
  'compliance-officer': bind({
    role: 'compliance-officer',
    scope: 'organization',
    category: 'compliance',
    homeRouteId: 'compliance',
    navigationGroupOrder: ['Governance', 'Data Governance', 'Command'],
    viewerRoutes: ['compliance', 'audit', 'approvals', 'security', 'federation', 'dataHub', 'dashboard', 'notifications', 'iotMonitoring', 'surveillanceHealth'],
    editorRoutes: ['compliance', 'approvals'],
    approverActions: ['compliance-filing-approval', 'payout', 'disciplinary-decision'],
    adminRoutes: ['compliance'],
    exportRoutes: ['audit', 'compliance', 'federation'],
    kpiDomains: ['compliance', 'audit-integrity', 'approval-workflows', 'multi-track-federation', 'surveillance-iot'],
    auditVisibility: 'export',
    notificationChannels: ['compliance', 'audit', 'approvals'],
    quickActions: ['evidence-upload', 'audit-export'],
    privacyScopes: ['public', 'racing-officials', 'care-team', 'regulator', 'veterinary-confidential'],
  }),
  'finance-manager': bind({
    role: 'finance-manager',
    scope: 'racetrack',
    category: 'finance',
    homeRouteId: 'finance',
    navigationGroupOrder: ['Business Controls', 'Governance'],
    viewerRoutes: ['finance', 'ticketing', 'approvals', 'audit', 'notifications'],
    editorRoutes: ['finance', 'approvals'],
    approverActions: ['payout'],
    adminRoutes: [],
    exportRoutes: ['audit'],
    kpiDomains: ['finance', 'ticketing'],
    auditVisibility: 'read',
    notificationChannels: ['finance', 'approvals'],
    quickActions: ['payout-approval'],
    privacyScopes: ['public'],
  }),
  'ticketing-fan-manager': bind({
    role: 'ticketing-fan-manager',
    scope: 'racetrack',
    category: 'operational',
    homeRouteId: 'fanExperience',
    navigationGroupOrder: ['Business Controls', 'Command'],
    viewerRoutes: ['fanExperience', 'ticketing', 'analytics', 'notifications'],
    editorRoutes: ['fanExperience', 'ticketing'],
    approverActions: [],
    adminRoutes: [],
    exportRoutes: [],
    kpiDomains: ['ticketing', 'fan-experience'],
    auditVisibility: 'none',
    notificationChannels: ['ticketing', 'fan-experience'],
    quickActions: ['attendance-update'],
    privacyScopes: ['public'],
  }),
  executive: bind({
    role: 'executive',
    scope: 'organization',
    category: 'executive',
    homeRouteId: 'analytics',
    navigationGroupOrder: ['Command', 'Governance', 'Business Controls'],
    viewerRoutes: ['analytics', 'dashboard', 'compliance', 'finance', 'incidents', 'audit', 'federation', 'notifications'],
    editorRoutes: [],
    approverActions: ['payout'],
    adminRoutes: [],
    exportRoutes: ['audit'],
    kpiDomains: ['tenant-operations', 'finance', 'compliance', 'safety-incidents', 'multi-track-federation', 'surveillance-iot'],
    auditVisibility: 'read',
    notificationChannels: ['executive', 'incidents', 'compliance'],
    quickActions: ['executive-scorecard'],
    privacyScopes: ['public', 'racing-officials', 'regulator'],
  }),
  'read-only-auditor': bind({
    role: 'read-only-auditor',
    scope: 'federation',
    category: 'compliance',
    homeRouteId: 'audit',
    navigationGroupOrder: ['Governance', 'Data Governance'],
    viewerRoutes: ['audit', 'compliance', 'stewarding', 'security', 'federation', 'dataHub', 'analytics', 'iotMonitoring', 'surveillanceHealth', 'surveillanceAlerting', 'cctvRegistry', 'iotRegistry', 'surveillanceZoneMapping'],
    editorRoutes: [],
    approverActions: [],
    adminRoutes: [],
    exportRoutes: ['audit', 'compliance', 'federation', 'dataHub'],
    kpiDomains: ['audit-integrity', 'compliance', 'data-quality', 'surveillance-iot'],
    auditVisibility: 'export',
    notificationChannels: ['audit', 'compliance'],
    quickActions: ['evidence-export'],
    privacyScopes: ['public', 'racing-officials', 'regulator'],
  }),
  'data-analytics-user': bind({
    role: 'data-analytics-user',
    scope: 'racetrack',
    category: 'executive',
    homeRouteId: 'analytics',
    navigationGroupOrder: ['Data Governance', 'Command'],
    viewerRoutes: ['analytics', 'dataHub', 'federation', 'dashboard'],
    editorRoutes: [],
    approverActions: [],
    adminRoutes: [],
    exportRoutes: ['dataHub'],
    kpiDomains: ['data-quality', 'racing-data-hub', 'ai-governance'],
    auditVisibility: 'none',
    notificationChannels: ['analytics', 'data-quality'],
    quickActions: ['trend-report'],
    privacyScopes: ['public'],
  }),
  'support-operator': bind({
    role: 'support-operator',
    scope: 'platform',
    category: 'system-admin',
    homeRouteId: 'admin',
    navigationGroupOrder: ['System Status', 'Platform'],
    viewerRoutes: ['admin', 'notifications', 'audit', 'dashboard'],
    editorRoutes: [],
    approverActions: [],
    adminRoutes: [],
    exportRoutes: [],
    kpiDomains: ['system-health', 'deployment-readiness'],
    auditVisibility: 'read',
    notificationChannels: ['support', 'platform'],
    quickActions: ['tenant-diagnostics'],
    privacyScopes: ['public'],
  }),
  'staff-limited': bind({
    role: 'staff-limited',
    scope: 'racetrack',
    category: 'operational',
    homeRouteId: 'dashboard',
    navigationGroupOrder: ['Command'],
    viewerRoutes: ['dashboard', 'notifications'],
    editorRoutes: [],
    approverActions: [],
    adminRoutes: [],
    exportRoutes: [],
    kpiDomains: ['race-day-operations'],
    auditVisibility: 'none',
    notificationChannels: ['assigned-tasks'],
    quickActions: [],
    privacyScopes: ['public'],
  }),
  'ai-safety-agent': bind({
    role: 'ai-safety-agent',
    scope: 'platform',
    category: 'system-admin',
    homeRouteId: 'settings',
    navigationGroupOrder: ['Governance'],
    viewerRoutes: ['settings', 'approvals', 'dashboard'],
    editorRoutes: [],
    approverActions: [],
    adminRoutes: [],
    exportRoutes: [],
    kpiDomains: ['ai-governance'],
    auditVisibility: 'read',
    notificationChannels: ['ai-governance'],
    quickActions: [],
    privacyScopes: ['public'],
  }),
};

export function homeRouteForRole(role: Role): DomainRouteId {
  return roleCapabilityBindings[role]?.homeRouteId ?? 'dashboard';
}

export function homePathForRole(role: Role): string {
  const routePaths: Record<DomainRouteId, string> = {
    dashboard: '/dashboard',
    raceDay: '/race-day',
    equine: '/equine',
    approvals: '/approvals',
    incidents: '/incidents',
    compliance: '/compliance',
    security: '/security',
    facilities: '/facilities',
    ticketing: '/ticketing',
    finance: '/finance',
    federation: '/federation',
    dataHub: '/data-hub',
    audit: '/audit',
    admin: '/admin',
    iotMonitoring: '/iot-monitoring',
    cctvRegistry: '/cctv-registry',
    cctvViewer: '/cctv-viewer',
    cctvCameraDetail: '/cctv-registry/cameras/:cameraId',
    iotRegistry: '/iot-registry',
    iotDeviceDetail: '/iot-registry/devices/:deviceId',
    surveillanceZoneMapping: '/surveillance-zone-mapping',
    surveillanceHealth: '/surveillance-health',
    surveillanceAlerting: '/surveillance-alerting',
    settings: '/settings',
    stewarding: '/stewarding',
    workforce: '/workforce',
    digitalTwin: '/digital-twin',
    surface: '/surface',
    emergency: '/emergency',
    analytics: '/analytics',
    fanExperience: '/fan-experience',
    notifications: '/notifications',
    account: '/account',
  };
  return routePaths[homeRouteForRole(role)] ?? '/dashboard';
}

export function visibleKpiDomainsForRole(role: Role): KPIDomain[] {
  return roleCapabilityBindings[role]?.kpiDomains ?? [];
}

export function canRoleViewRoute(role: Role, routeId: DomainRouteId): boolean {
  if (routeId === 'account') return true;
  return roleCapabilityBindings[role]?.viewerRoutes.includes(routeId) ?? false;
}

export function canRoleEditRoute(role: Role, routeId: DomainRouteId): boolean {
  if (routeId in surveillanceFrontendRoutePermissions) {
    return canRoleEditSurveillanceRoute(role, routeId);
  }
  return roleCapabilityBindings[role]?.editorRoutes.includes(routeId) ?? false;
}

export function navigationGroupOrderForRole(role: Role): NavigationGroup[] {
  return roleCapabilityBindings[role]?.navigationGroupOrder ?? ['Command'];
}

export function quickActionsForRole(role: Role): string[] {
  return roleCapabilityBindings[role]?.quickActions ?? [];
}

export function notificationChannelsForRole(role: Role): string[] {
  return roleCapabilityBindings[role]?.notificationChannels ?? [];
}

export function canRolePerformAction(role: Role, action: ProtectedAction): boolean {
  const binding = roleCapabilityBindings[role];
  if (!binding) return false;
  return binding.approverActions.includes(action) || binding.editorRoutes.length > 0;
}

export function rolesForAuditExport(scope: RoleScope): Role[] {
  return (roles as readonly Role[]).filter((role) => {
    const binding = roleCapabilityBindings[role];
    return binding.auditVisibility === 'export' && binding.scope === scope;
  });
}

export function functionalCategoryForRole(role: Role): FunctionalCategory {
  return roleCapabilityBindings[role]?.category ?? 'operational';
}

export function viewerRolesForRoute(routeId: DomainRouteId): Role[] {
  if (routeId === 'account') return [...roles];
  return (roles as readonly Role[]).filter((role) => canRoleViewRoute(role, routeId));
}
