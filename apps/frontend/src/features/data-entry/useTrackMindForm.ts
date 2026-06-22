import type {
  DataEntryDraftRecord,
  DataEntryDraftStatus,
  DataEntryEntityKind,
  DataEntryFieldDefinition,
  DataEntryFormMode,
  DataQualityIssue,
  DataQualityReferenceCatalog,
  DataQualityValidationResult,
} from '@trackmind/shared';
import {
  buildLocalDraftEnvelope,
  computeBaselineFingerprint,
  dataQualityIssuesToFieldErrors,
  detectDirtyState,
  detectDraftBaselineConflict,
  draftSessionKey,
  extractRecordVersion,
  filterVisibleFields,
  getDataEntryFormDefinition,
  getDefaultFormValues,
  parseLocalDraftEnvelope,
  pickRecoverableDraft,
  validateDataEntryForm,
  validateDataEntryWithQuality,
} from '@trackmind/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteDataEntryDraft,
  listDataEntryDrafts,
  restoreDataEntryDraft,
  saveDataEntryDraft,
} from '@/api/dataEntry';
import { useTenantSession } from '@/auth/TenantSessionProvider';

export interface UseTrackMindFormOptions {
  entityKind: DataEntryEntityKind;
  mode?: DataEntryFormMode;
  recordId?: string;
  seed?: Record<string, unknown>;
  autosave?: boolean;
  draftStorage?: 'local' | 'server' | 'both';
  /** When true, scan for recoverable drafts on mount. */
  recoverOnMount?: boolean;
  /** Reference catalog for stale-reference and conflict checks. */
  qualityReferences?: DataQualityReferenceCatalog;
  /** Enable shared data-quality validation layer (local). */
  qualityValidation?: boolean;
}

export function useTrackMindForm(options: UseTrackMindFormOptions) {
  const { session } = useTenantSession();
  const mode = options.mode ?? 'create';
  const definition = useMemo(
    () => getDataEntryFormDefinition(options.entityKind, mode),
    [options.entityKind, mode],
  );
  const visibleFields = useMemo(
    () => filterVisibleFields(definition, session.role),
    [definition, session.role],
  );
  const baseline = useMemo(
    () => getDefaultFormValues(options.entityKind, mode, options.seed ?? {}),
    [options.entityKind, mode, options.seed],
  );
  const baselineFingerprint = useMemo(() => computeBaselineFingerprint(baseline), [baseline]);
  const recordVersion = useMemo(() => extractRecordVersion(baseline), [baseline]);

  const sessionKey = useMemo(
    () => draftSessionKey(
      options.entityKind,
      mode,
      options.recordId,
      session.tenantId,
      `${session.role}-operator`,
    ),
    [mode, options.entityKind, options.recordId, session.role, session.tenantId],
  );

  const [values, setValues] = useState<Record<string, unknown>>(baseline);
  const [errors, setErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [qualityIssues, setQualityIssues] = useState<DataQualityIssue[]>([]);
  const [draftId, setDraftId] = useState<string | undefined>();
  const [draftStatus, setDraftStatus] = useState<DataEntryDraftStatus | undefined>();
  const [recoverableDraft, setRecoverableDraft] = useState<DataEntryDraftRecord | null>(null);
  const [conflictReason, setConflictReason] = useState<string | undefined>();
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | undefined>();
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [recoveryChecked, setRecoveryChecked] = useState(false);
  const dirtyState = useMemo(() => detectDirtyState(values, baseline), [values, baseline]);
  const autosaveEnabled = options.autosave ?? definition.autosave.enabled;
  const autosaveTimer = useRef<number | undefined>(undefined);
  const initialBaselineFingerprint = useRef(baselineFingerprint);

  const writeLocalDraft = useCallback((nextValues: Record<string, unknown>, status: DataEntryDraftStatus, nextDraftId?: string) => {
    if (typeof window === 'undefined' || !definition.draft.enabled) return;
    const envelope = buildLocalDraftEnvelope({
      entityKind: options.entityKind,
      mode,
      recordId: options.recordId,
      values: nextValues,
      baseline,
      draftId: nextDraftId ?? draftId,
      status,
    });
    window.localStorage.setItem(sessionKey, JSON.stringify(envelope));
  }, [baseline, definition.draft.enabled, draftId, mode, options.entityKind, options.recordId, sessionKey]);

  const clearLocalDraft = useCallback(() => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(sessionKey);
  }, [sessionKey]);

  const setFieldValue = useCallback((path: string, value: unknown) => {
    setValues((current) => ({ ...current, [path]: value }));
    setFieldErrors((current) => {
      if (!current[path]) return current;
      const next = { ...current };
      delete next[path];
      return next;
    });
  }, []);

  const resetForm = useCallback((nextSeed?: Record<string, unknown>) => {
    const nextBaseline = getDefaultFormValues(options.entityKind, mode, nextSeed ?? options.seed ?? {});
    setValues(nextBaseline);
    setErrors([]);
    setFieldErrors({});
    setQualityIssues([]);
    setDraftId(undefined);
    setDraftStatus(undefined);
    setConflictReason(undefined);
    setRecoverableDraft(null);
    setDraftUpdatedAt(undefined);
    setAutosaveStatus('idle');
    clearLocalDraft();
  }, [clearLocalDraft, mode, options.entityKind, options.seed]);

  const validate = useCallback(() => {
    const result = options.qualityValidation || options.qualityReferences
      ? validateDataEntryWithQuality(options.entityKind, values, {
          scope: {
            tenantId: session.tenantId,
            racetrackId: session.racetrackId,
            actorId: `${session.role}-operator`,
            role: session.role,
          },
          mode,
          role: session.role,
          references: options.qualityReferences,
          baseline,
        })
      : validateDataEntryForm(options.entityKind, values, { mode, role: session.role });
    setErrors(result.errors);
    const nextFieldErrors = dataQualityIssuesToFieldErrors(
      'issues' in result ? (result as DataQualityValidationResult).issues : [],
    );
    for (const error of result.errors) {
      const match = error.match(/^[^.]+\.([^ ]+)/);
      if (match?.[1] && !nextFieldErrors[match[1]]) nextFieldErrors[match[1]] = error;
    }
    setFieldErrors(nextFieldErrors);
    setQualityIssues('issues' in result ? (result as DataQualityValidationResult).issues : []);
    return result;
  }, [baseline, mode, options.entityKind, options.qualityReferences, options.qualityValidation, session.racetrackId, session.role, session.tenantId, values]);

  const persistDraft = useCallback(async (explicit = false) => {
    if (!definition.draft.enabled) return;
    const storage = options.draftStorage ?? definition.draft.storage;
    setAutosaveStatus('saving');
    try {
      let nextDraftId = draftId;
      let nextStatus: DataEntryDraftStatus = explicit ? 'draft' : 'autosaved';

      if (storage === 'local' || storage === 'both') {
        writeLocalDraft(values, nextStatus, nextDraftId);
      }
      if (storage === 'server' || storage === 'both') {
        const draft = await saveDataEntryDraft({
          entityKind: options.entityKind,
          mode,
          values,
          draftId: nextDraftId,
          recordId: options.recordId,
          status: nextStatus,
          baseline,
          explicit,
          currentBaselineFingerprint: baselineFingerprint,
          currentRecordVersion: recordVersion.baseRecordVersion,
          currentRecordUpdatedAt: recordVersion.baseRecordUpdatedAt,
        });
        nextDraftId = draft.draftId;
        nextStatus = draft.status;
        if (draft.conflictReason) setConflictReason(draft.conflictReason);
      }

      setDraftId(nextDraftId);
      setDraftStatus(nextStatus);
      setDraftUpdatedAt(new Date().toISOString());
      setAutosaveStatus('saved');
    } catch {
      setAutosaveStatus('error');
    }
  }, [baseline, baselineFingerprint, definition.draft, draftId, mode, options.draftStorage, options.entityKind, options.recordId, recordVersion.baseRecordUpdatedAt, recordVersion.baseRecordVersion, values, writeLocalDraft]);

  const restoreDraftSession = useCallback((draft: DataEntryDraftRecord | { values: Record<string, unknown>; draftId?: string }) => {
    setValues({ ...baseline, ...draft.values });
    setDraftId(draft.draftId);
    setDraftStatus('restored');
    setRecoverableDraft(null);
    setDraftUpdatedAt(new Date().toISOString());
    writeLocalDraft({ ...baseline, ...draft.values }, 'restored', draft.draftId);
  }, [baseline, writeLocalDraft]);

  const discardDraftSession = useCallback(async () => {
    if (draftId) {
      try {
        await deleteDataEntryDraft(draftId);
      } catch {
        // local-only drafts may not exist server-side
      }
    }
    clearLocalDraft();
    resetForm(options.seed);
  }, [clearLocalDraft, draftId, options.seed, resetForm]);

  const reloadFromBaseline = useCallback(() => {
    setValues(baseline);
    setConflictReason(undefined);
    setDraftStatus(undefined);
  }, [baseline]);

  useEffect(() => {
    if (recoveryChecked || !definition.draft.enabled || options.recoverOnMount === false) return;

    const runRecovery = async () => {
      const storage = options.draftStorage ?? definition.draft.storage;
      let candidate: DataEntryDraftRecord | undefined;

      if (storage === 'local' || storage === 'both') {
        try {
          const raw = window.localStorage.getItem(sessionKey);
          const local = raw ? parseLocalDraftEnvelope(raw) : undefined;
          if (local) {
            candidate = {
              draftId: local.draftId ?? `local-${sessionKey}`,
              entityKind: local.entityKind,
              mode: local.mode,
              recordId: local.recordId,
              values: local.values,
              scope: {
                tenantId: session.tenantId,
                racetrackId: session.racetrackId,
                actorId: `${session.role}-operator`,
                role: session.role,
              },
              status: local.status,
              baselineFingerprint: local.baselineFingerprint,
              baseRecordVersion: local.baseRecordVersion,
              baseRecordUpdatedAt: local.baseRecordUpdatedAt,
              createdAt: local.updatedAt,
              updatedAt: local.updatedAt,
              expiresAt: local.expiresAt,
            };
          }
        } catch {
          // ignore corrupt local draft
        }
      }

      if (storage === 'server' || storage === 'both') {
        try {
          const remote = await listDataEntryDrafts({
            entityKind: options.entityKind,
            mode,
            recordId: options.recordId,
          });
          const serverCandidate = pickRecoverableDraft(remote.drafts);
          if (serverCandidate) {
            if (!candidate || Date.parse(serverCandidate.updatedAt) > Date.parse(candidate.updatedAt)) {
              candidate = serverCandidate;
            }
          }
        } catch {
          // server drafts optional when offline
        }
      }

      if (candidate) {
        const conflict = detectDraftBaselineConflict(candidate, baselineFingerprint, recordVersion);
        if (conflict.hasConflict) {
          candidate = { ...candidate, status: 'conflict', conflictReason: conflict.reason };
        }
        const hasChanges = detectDirtyState(candidate.values, baseline).isDirty;
        if (hasChanges) setRecoverableDraft(candidate);
      }
      setRecoveryChecked(true);
    };

    void runRecovery();
  }, [
    baselineFingerprint,
    definition.draft.enabled,
    definition.draft.storage,
    mode,
    options.draftStorage,
    options.entityKind,
    options.recordId,
    options.recoverOnMount,
    recordVersion,
    recoveryChecked,
    session.racetrackId,
    session.role,
    session.tenantId,
    sessionKey,
  ]);

  useEffect(() => {
    if (initialBaselineFingerprint.current === baselineFingerprint) return;
    const conflict = detectDraftBaselineConflict(
      {
        baselineFingerprint: initialBaselineFingerprint.current,
        baseRecordVersion: recordVersion.baseRecordVersion,
        baseRecordUpdatedAt: recordVersion.baseRecordUpdatedAt,
      },
      baselineFingerprint,
      recordVersion,
    );
    if (conflict.hasConflict && dirtyState.isDirty) {
      setDraftStatus('conflict');
      setConflictReason(conflict.reason);
    }
    initialBaselineFingerprint.current = baselineFingerprint;
  }, [baselineFingerprint, dirtyState.isDirty, recordVersion]);

  useEffect(() => {
    if (!autosaveEnabled || !dirtyState.isDirty || recoverableDraft) return undefined;
    window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      void persistDraft(false);
    }, definition.autosave.debounceMs || 3000);
    return () => window.clearTimeout(autosaveTimer.current);
  }, [autosaveEnabled, definition.autosave.debounceMs, dirtyState.isDirty, persistDraft, recoverableDraft, values]);

  useEffect(() => {
    if (!dirtyState.isDirty) return undefined;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirtyState.isDirty]);

  const restoreRecoverableDraft = useCallback(async () => {
    if (!recoverableDraft) return;
    if (recoverableDraft.draftId.startsWith('local-')) {
      restoreDraftSession(recoverableDraft);
      return;
    }
    try {
      const restored = await restoreDataEntryDraft(recoverableDraft.draftId);
      restoreDraftSession(restored);
    } catch {
      restoreDraftSession(recoverableDraft);
    }
  }, [recoverableDraft, restoreDraftSession]);

  return {
    definition,
    visibleFields,
    values,
    setValues,
    setFieldValue,
    errors,
    fieldErrors,
    qualityIssues,
    dirtyState,
    draftId,
    draftStatus,
    draftUpdatedAt,
    recoverableDraft,
    conflictReason,
    autosaveStatus,
    validate,
    resetForm,
    persistDraft,
    restoreRecoverableDraft,
    discardDraftSession,
    reloadFromBaseline,
    warnOnDiscard: definition.draft.warnOnDiscard !== false,
  };
}

export type TrackMindFormController = ReturnType<typeof useTrackMindForm>;

export function fieldInputId(entityKind: DataEntryEntityKind, path: string): string {
  return `${entityKind}-${path}`;
}

export function readFieldValue(field: DataEntryFieldDefinition, values: Record<string, unknown>): string | number | boolean {
  const value = values[field.path];
  if (field.type === 'checkbox') return Boolean(value);
  if (field.type === 'number') return typeof value === 'number' ? value : value != null ? String(value) : '';
  return value != null ? String(value) : '';
}
