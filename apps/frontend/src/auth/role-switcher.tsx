import { roles, type Role } from '@trackmind/shared';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown } from 'lucide-react';
import type { ReactElement } from 'react';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { roleDisplayName } from '@/domain/support';
import { Button } from '@/design/components/button';

export function RoleSwitcher(): ReactElement {
  const { session, setRole } = useTenantSession();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          {roleDisplayName(session.role)}
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="z-50 min-w-[12rem] rounded-md border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg" align="end">
          {roles.map((role: Role) => (
            <DropdownMenu.Item
              key={role}
              className="cursor-pointer rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-[var(--muted)] data-[highlighted]:bg-[var(--muted)]"
              onSelect={() => setRole(role)}
            >
              {roleDisplayName(role)}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
