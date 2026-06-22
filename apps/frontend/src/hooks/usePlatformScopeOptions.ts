import { useQuery } from '@tanstack/react-query';
import type { RacetrackDto, TenantDto } from '@trackmind/shared';
import { getJson } from '@/api/client';
import { apiPaths } from '@/api/paths';
import {
  operatorRacetracksByTenant,
  operatorTenantOptions,
  type OperatorScopeOption,
} from '@/domain/support';

export interface RacetrackScopeOption extends OperatorScopeOption {
  tenantId: string;
}

function staticRacetracks(): RacetrackScopeOption[] {
  return Object.entries(operatorRacetracksByTenant).flatMap(([tenantId, racetracks]) =>
    racetracks.map((racetrack) => ({ ...racetrack, tenantId })),
  );
}

function toTenantOptions(tenants: TenantDto[]): OperatorScopeOption[] {
  return tenants.map((tenant) => ({
    id: tenant.id,
    label: tenant.name,
    organizationId: tenant.organizationId,
  }));
}

function toRacetrackOptions(racetracks: RacetrackDto[]): RacetrackScopeOption[] {
  return racetracks.map((racetrack) => ({
    id: racetrack.id,
    label: racetrack.name,
    organizationId: racetrack.organizationId,
    tenantId: racetrack.tenantId,
  }));
}

export function usePlatformScopeOptions() {
  const tenantsQuery = useQuery({
    queryKey: ['platform-scope', 'tenants'],
    queryFn: async () => {
      const result = await getJson<TenantDto[]>(apiPaths.admin.tenants);
      if (result.status === 'ready' && Array.isArray(result.data) && result.data.length > 0) {
        return toTenantOptions(result.data);
      }
      return operatorTenantOptions;
    },
    staleTime: 60_000,
    retry: 1,
  });

  const racetracksQuery = useQuery({
    queryKey: ['platform-scope', 'racetracks'],
    queryFn: async () => {
      const result = await getJson<RacetrackDto[]>(apiPaths.admin.racetracks);
      if (result.status === 'ready' && Array.isArray(result.data) && result.data.length > 0) {
        return toRacetrackOptions(result.data);
      }
      return staticRacetracks();
    },
    staleTime: 60_000,
    retry: 1,
  });

  return {
    tenants: tenantsQuery.data ?? operatorTenantOptions,
    racetracks: racetracksQuery.data ?? staticRacetracks(),
    isLoading: tenantsQuery.isLoading || racetracksQuery.isLoading,
  };
}
