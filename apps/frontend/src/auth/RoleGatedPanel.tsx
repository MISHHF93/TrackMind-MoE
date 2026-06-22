import type { ReactElement, ReactNode } from 'react';
import type { DomainRouteId } from '@/domain/support';
import { useRouteAccess } from '@/domain/routeAccess';
import { EmptyState } from '@/design/components/states';

export function RoleGatedPanel({
  routeId,
  mode = 'view',
  children,
  label,
}: {
  routeId: DomainRouteId;
  mode?: 'view' | 'edit';
  children: ReactNode;
  label?: string;
}): ReactElement {
  const access = useRouteAccess(routeId);
  const allowed = mode === 'edit' ? access.canEdit && !access.isReadOnly : access.canView;
  if (!allowed) {
    return (
      <EmptyState
        title="Access restricted"
        description={label ?? `Your active persona cannot ${mode} this workspace section.`}
      />
    );
  }
  return <>{children}</>;
}
