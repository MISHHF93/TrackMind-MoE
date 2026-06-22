import { roleRegistry, type Role } from '@trackmind/shared';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown } from 'lucide-react';
import type { ReactElement } from 'react';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { roleDisplayName } from '@/domain/support';
import { Button } from '@/design/components/button';

export function AssignedRolePicker(): ReactElement {
  const { session, setRole } = useTenantSession();
  const assignedRoles = (session.assignedRoles?.length ? session.assignedRoles : [session.role]) as Role[];

  if (assignedRoles.length <= 1) {
    return (
      <Button variant="outline" size="sm" className="gap-1" disabled>
        {roleDisplayName(session.role)}
      </Button>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          {roleDisplayName(session.role)}
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="z-50 min-w-[14rem] rounded-md border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg" align="end">
          <DropdownMenu.Label className="px-2 py-1 text-xs font-medium text-[var(--muted-foreground)]">
            Assigned personas
          </DropdownMenu.Label>
          {assignedRoles.map((role) => (
            <DropdownMenu.Item
              key={role}
              className="cursor-pointer rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-[var(--muted)] data-[highlighted]:bg-[var(--muted)]"
              onSelect={() => setRole(role)}
            >
              <span className="block">{roleDisplayName(role)}</span>
              {roleRegistry[role]?.privileged ? (
                <span className="text-xs text-[var(--muted-foreground)]">privileged</span>
              ) : null}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
