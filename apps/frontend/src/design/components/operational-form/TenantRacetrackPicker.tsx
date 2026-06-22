import { canOverrideOperationalScope } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { usePlatformScopeOptions } from '@/hooks/usePlatformScopeOptions';
import { cn } from '@/lib/utils';
import { SearchableSelect } from './SearchableSelect';
import { operationalControlClassName, type OperationalControlProps } from './_shared';

export type TenantRacetrackPickerScope = 'tenant' | 'racetrack';

export function TenantRacetrackPicker({
  id,
  scope,
  value,
  onChange,
  disabled,
  className,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}: OperationalControlProps & {
  scope: TenantRacetrackPickerScope;
  value: string;
  onChange: (value: string) => void;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}): ReactElement {
  const { session } = useTenantSession();
  const { tenants, racetracks } = usePlatformScopeOptions();
  const canOverride = canOverrideOperationalScope(session.role);

  const options = useMemo(() => {
    if (scope === 'tenant') {
      return tenants.map((tenant) => ({ value: tenant.id, label: tenant.label }));
    }
    const tenantId = session.tenantId;
    return racetracks
      .filter((racetrack) => racetrack.tenantId === tenantId)
      .map((racetrack) => ({ value: racetrack.id, label: racetrack.label }));
  }, [scope, tenants, racetracks, session.tenantId]);

  const effectiveValue = value || (scope === 'tenant' ? session.tenantId : session.racetrackId);
  const readOnlyLabel = options.find((option) => option.value === effectiveValue)?.label ?? effectiveValue;

  if (!canOverride || disabled) {
    return (
      <div
        id={id}
        role="textbox"
        aria-readonly="true"
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        tabIndex={0}
        className={cn(operationalControlClassName, 'text-[var(--muted-foreground)]', className)}
      >
        {readOnlyLabel}
      </div>
    );
  }

  return (
    <SearchableSelect
      id={id}
      value={effectiveValue}
      options={options}
      onChange={onChange}
      disabled={disabled}
      className={className}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      placeholder={scope === 'tenant' ? 'Select tenant…' : 'Select racetrack…'}
    />
  );
}
