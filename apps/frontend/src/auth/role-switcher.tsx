import { assignableRoles, functionalCategoryForRole, roleRegistry, type Role } from '@trackmind/shared';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown } from 'lucide-react';
import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { roleDisplayName } from '@/domain/support';
import { Button } from '@/design/components/button';

const categoryLabels: Record<string, string> = {
  'system-admin': 'System Administration',
  operational: 'Race-Day Operations',
  'medical-welfare': 'Equine & Welfare',
  compliance: 'Compliance & Audit',
  finance: 'Finance & Commerce',
  executive: 'Executive & Analytics',
};

export function RoleSwitcher(): ReactElement {
  const { session, setRole } = useTenantSession();

  const grouped = useMemo(() => {
    const map = new Map<string, Role[]>();
    for (const role of assignableRoles) {
      const category = functionalCategoryForRole(role);
      const list = map.get(category) ?? [];
      list.push(role);
      map.set(category, list);
    }
    return [...map.entries()];
  }, []);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          {roleDisplayName(session.role)}
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="z-50 max-h-[24rem] min-w-[14rem] overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg" align="end">
          {grouped.map(([category, roleList]) => (
            <div key={category}>
              <DropdownMenu.Label className="px-2 py-1 text-xs font-medium text-[var(--muted-foreground)]">
                {categoryLabels[category] ?? category}
              </DropdownMenu.Label>
              {roleList.map((role) => (
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
            </div>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
