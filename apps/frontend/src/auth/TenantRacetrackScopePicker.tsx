import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown } from 'lucide-react';
import type { ReactElement } from 'react';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { usePlatformScopeOptions } from '@/hooks/usePlatformScopeOptions';
import { Button } from '@/design/components/button';

function scopeLabel(options: { id: string; label: string }[], id: string): string {
  return options.find((option) => option.id === id)?.label ?? id;
}

export function TenantRacetrackScopePicker(): ReactElement {
  const { session, setScope } = useTenantSession();
  const { tenants, racetracks } = usePlatformScopeOptions();
  const tenantRacetracks = racetracks.filter((racetrack) => racetrack.tenantId === session.tenantId);

  return (
    <div className="hidden md:flex items-center gap-2 text-xs">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="chrome" size="sm" className="gap-1 h-7 px-2 text-xs">
            Tenant <strong>{scopeLabel(tenants, session.tenantId)}</strong>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="z-50 min-w-[14rem] rounded-md border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg" align="start">
            {tenants.map((tenant) => (
              <DropdownMenu.Item
                key={tenant.id}
                className="cursor-pointer rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-[var(--muted)] data-[highlighted]:bg-[var(--muted)]"
                onSelect={() => {
                  const nextRacetracks = racetracks.filter((racetrack) => racetrack.tenantId === tenant.id);
                  const racetrackId = nextRacetracks.some((racetrack) => racetrack.id === session.racetrackId)
                    ? session.racetrackId
                    : nextRacetracks[0]?.id ?? session.racetrackId;
                  setScope({
                    tenantId: tenant.id,
                    organizationId: tenant.organizationId,
                    racetrackId,
                  });
                }}
              >
                {tenant.label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="chrome" size="sm" className="gap-1 h-7 px-2 text-xs">
            Racetrack <strong>{scopeLabel(tenantRacetracks, session.racetrackId)}</strong>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="z-50 min-w-[12rem] rounded-md border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg" align="start">
            {tenantRacetracks.map((racetrack) => (
              <DropdownMenu.Item
                key={racetrack.id}
                className="cursor-pointer rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-[var(--muted)] data-[highlighted]:bg-[var(--muted)]"
                onSelect={() => setScope({ racetrackId: racetrack.id, organizationId: racetrack.organizationId })}
              >
                {racetrack.label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
