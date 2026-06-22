import type {
  DataEntryEntityKind,
  DataEntryFormMode,
  DataQualityIssue,
  DataQualityReferenceCatalog,
} from '@trackmind/shared';
import {
  buildReferenceCatalogFromWorkspace,
  dataQualityIssuesToFieldErrors,
  validateDataEntryWithQuality,
} from '@trackmind/shared';
import { useCallback, useMemo, useState } from 'react';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { validateDataQuality } from '@/api/dataQualityValidation';

export interface UseDataQualityValidationOptions {
  entityKind: DataEntryEntityKind;
  mode?: DataEntryFormMode;
  values: Record<string, unknown>;
  baseline?: Record<string, unknown>;
  references?: DataQualityReferenceCatalog;
  workspaceCatalog?: Parameters<typeof buildReferenceCatalogFromWorkspace>[0];
  useServer?: boolean;
}

export function useDataQualityValidation(options: UseDataQualityValidationOptions) {
  const { session } = useTenantSession();
  const mode = options.mode ?? 'create';
  const references = useMemo(
    () => options.references ?? (options.workspaceCatalog ? buildReferenceCatalogFromWorkspace(options.workspaceCatalog) : undefined),
    [options.references, options.workspaceCatalog],
  );

  const [issues, setIssues] = useState<DataQualityIssue[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [validating, setValidating] = useState(false);

  const validateLocal = useCallback(() => {
    const result = validateDataEntryWithQuality(options.entityKind, options.values, {
      scope: {
        tenantId: session.tenantId,
        racetrackId: session.racetrackId,
        actorId: `${session.role}-operator`,
        role: session.role,
      },
      mode,
      role: session.role,
      references,
      baseline: options.baseline,
    });
    setIssues(result.issues);
    setErrors(result.errors);
    return result;
  }, [mode, options.baseline, options.entityKind, options.values, references, session.racetrackId, session.role, session.tenantId]);

  const validate = useCallback(async () => {
    if (!options.useServer) return validateLocal();
    setValidating(true);
    try {
      const result = await validateDataQuality({
        entityKind: options.entityKind,
        mode,
        values: options.values,
        references,
        baseline: options.baseline,
      });
      setIssues(result.issues);
      setErrors(result.errors);
      return result;
    } finally {
      setValidating(false);
    }
  }, [mode, options.baseline, options.entityKind, options.useServer, options.values, references, validateLocal]);

  const fieldErrors = useMemo(() => dataQualityIssuesToFieldErrors(issues), [issues]);
  const warnings = useMemo(() => issues.filter((issue) => issue.severity === 'warning'), [issues]);
  const blockingIssues = useMemo(() => issues.filter((issue) => issue.severity === 'error'), [issues]);

  return {
    issues,
    errors,
    fieldErrors,
    warnings,
    blockingIssues,
    validating,
    references,
    validate,
    validateLocal,
  };
}
