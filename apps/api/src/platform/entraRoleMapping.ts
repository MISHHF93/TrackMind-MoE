import type { EntraRoleMappingDto, EntraRoleMappingEntryDto } from '@trackmind/shared';
import { normalizeRole, roles, type Role } from '@trackmind/shared';

const now = () => new Date().toISOString();

const defaultMappings: EntraRoleMappingEntryDto[] = [
  { entraAppRole: 'PlatformSuperAdmin', trackmindRole: 'platform-super-admin' },
  { entraAppRole: 'OrganizationAdmin', trackmindRole: 'organization-admin' },
  { entraAppRole: 'Steward', trackmindRole: 'steward' },
  { entraAppRole: 'Veterinarian', trackmindRole: 'veterinarian' },
  { entraAppRole: 'RaceDayManager', trackmindRole: 'race-day-operations-manager' },
  { entraAppRole: 'FacilitiesManager', trackmindRole: 'facilities-manager' },
  { entraAppRole: 'FinanceManager', trackmindRole: 'finance-manager' },
  { entraAppRole: 'Auditor', trackmindRole: 'read-only-auditor' },
  { entraGroupId: 'grp-stewards', trackmindRole: 'steward' },
  { entraGroupId: 'grp-vets', trackmindRole: 'veterinarian' },
];

function parseMappingsFromEnv(): EntraRoleMappingEntryDto[] | undefined {
  const raw = process.env.TRACKMIND_ENTRA_ROLE_MAPPING;
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    return parsed.filter((entry): entry is EntraRoleMappingEntryDto => (
      typeof entry === 'object' && entry !== null && typeof (entry as EntraRoleMappingEntryDto).trackmindRole === 'string'
    ));
  } catch {
    return undefined;
  }
}

export function loadEntraRoleMapping(tenantId = 'trackmind'): EntraRoleMappingDto {
  return {
    generatedAt: now(),
    tenantId,
    mappings: parseMappingsFromEnv() ?? defaultMappings,
    mock: false,
  };
}

export function mapEntraClaimsToRoles(input: {
  groups?: string[];
  roles?: string[];
  tenantId?: string;
}): Role[] {
  const mapping = loadEntraRoleMapping(input.tenantId);
  const resolved = new Set<Role>();
  for (const entry of mapping.mappings) {
    const canonical = normalizeRole(entry.trackmindRole);
    if (!canonical || !roles.includes(canonical)) continue;
    if (entry.entraGroupId && input.groups?.includes(entry.entraGroupId)) resolved.add(canonical);
    if (entry.entraAppRole && input.roles?.includes(entry.entraAppRole)) resolved.add(canonical);
  }
  return [...resolved];
}

export interface EntraTokenClaims {
  oid?: string;
  sub?: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  groups?: string[];
  roles?: string[];
  tid?: string;
}

export function decodeJwtPayload(token: string): EntraTokenClaims | undefined {
  const parts = token.split('.');
  if (parts.length < 2) return undefined;
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json) as EntraTokenClaims;
  } catch {
    return undefined;
  }
}
