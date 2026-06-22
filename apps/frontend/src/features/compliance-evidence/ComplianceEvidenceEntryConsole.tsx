import type { ComplianceEvidenceEntryMode, ComplianceEvidenceLinkTargetKind } from '@trackmind/shared';
import {
  complianceEvidenceLinkTargetKinds,
  defaultComplianceEvidenceSeed,
  fieldsForComplianceEvidenceEntryMode,
} from '@trackmind/shared';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SectionPanel } from '@/design/components/section-panel';
import { Button } from '@/design/components/button';
import { RecordTable, mapRecords } from '@/design/components/record-table';
import { FormMessage } from '@/design/components/form-field';
import { cn } from '@/lib/utils';
import { TrackMindFormDialog } from '@/features/data-entry/TrackMindFormDialog';
import { ComplianceEvidenceRegistryTable } from './ComplianceEvidenceRegistryTable';
import { useTenantSession } from '@/auth/TenantSessionProvider';

const entryModeLabels: Record<ComplianceEvidenceEntryMode, { label: string; description: string }> = {
  quick: {
    label: 'Quick capture',
    description: 'Title, control, domain, type, source, and link targets — optimized for auditors on walkthrough.',
  },
  full: {
    label: 'Full record',
    description: 'Adds review status, approval/audit linkage, retention metadata, and review workflow trigger.',
  },
};

const linkPresetExamples: Record<ComplianceEvidenceLinkTargetKind, string> = {
  incident: 'incident:inc-1',
  approval: 'approval:approval-race-start',
  control: 'control:ctrl-1',
  audit: 'audit:audit-incident-1',
  'kpi-definition': 'kpi-definition:kpi-compliance',
  'regulatory-workflow': 'regulatory-workflow:compliance-evidence-review',
};

export function ComplianceEvidenceEntryConsole({
  controls,
  evidenceRecords,
  evidencePackages,
  selectedControlId,
  onSelectControl,
  className,
}: {
  controls: Record<string, unknown>[];
  evidenceRecords: Record<string, unknown>[];
  evidencePackages: Record<string, unknown>[];
  selectedControlId?: string;
  onSelectControl?: (controlId: string) => void;
  className?: string;
}): ReactElement {
  const { session } = useTenantSession();
  const queryClient = useQueryClient();
  const [entryMode, setEntryMode] = useState<ComplianceEvidenceEntryMode>('quick');
  const [linkKind, setLinkKind] = useState<ComplianceEvidenceLinkTargetKind>('control');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const actorId = `${session.role}-operator`;
  const resolvedControlId = selectedControlId
    ?? String(controls[0]?.id ?? controls[0]?.controlId ?? 'ctrl-security-audit');

  const seed = useMemo(
    () => ({
      ...defaultComplianceEvidenceSeed(resolvedControlId, actorId),
      entryMode,
      linkTargets: linkPresetExamples[linkKind],
    }),
    [entryMode, resolvedControlId, actorId, linkKind],
  );

  const visibleFieldHint = fieldsForComplianceEvidenceEntryMode(entryMode).join(', ');

  return (
    <div className={cn('space-y-4', className)}>
      <SectionPanel
        title="Compliance evidence entry"
        description="Structured evidence with control mapping, link targets, retention metadata, and immutable audit linkage."
      >
        <div className="rounded-md border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-2 text-xs text-[var(--muted-foreground)]">
          Evidence is append-only. Link to incidents, approvals, controls, audits, KPI definitions, and regulatory workflows — not unstructured notes alone.
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Evidence entry mode">
          {(Object.keys(entryModeLabels) as ComplianceEvidenceEntryMode[]).map((mode) => (
            <Button
              key={mode}
              size="sm"
              aria-pressed={entryMode === mode}
              className="min-h-10 touch-manipulation"
              variant={entryMode === mode ? 'governance' : 'outline'}
              onClick={() => setEntryMode(mode)}
            >
              {entryModeLabels[mode].label}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">{entryModeLabels[entryMode].description}</p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">Fields: {visibleFieldHint}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {complianceEvidenceLinkTargetKinds.map((entry) => (
            <Button
              key={entry.kind}
              size="sm"
              variant={linkKind === entry.kind ? 'default' : 'outline'}
              title={entry.description}
              onClick={() => setLinkKind(entry.kind)}
            >
              Link {entry.label}
            </Button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {controls.slice(0, 6).map((control) => {
            const controlId = String(control.id ?? control.controlId ?? '');
            return (
              <Button
                key={controlId}
                size="sm"
                variant={resolvedControlId === controlId ? 'secondary' : 'outline'}
                onClick={() => onSelectControl?.(controlId)}
              >
                {controlId}
              </Button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="governance"
            onClick={() => {
              setMessage(null);
              setDialogOpen(true);
            }}
          >
            {entryMode === 'quick' ? 'Capture evidence' : 'Full evidence record'}
          </Button>
        </div>

        {message ? (
          <div className="mt-3">
            <FormMessage message={message} tone="muted" />
          </div>
        ) : null}

        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          Actor: {session.role} · Control: {resolvedControlId} · Link preset: {linkPresetExamples[linkKind]}
        </p>
      </SectionPanel>

      <SectionPanel title="Evidence registry" description="Structured compliance evidence — inline review status and notes where safe.">
        <ComplianceEvidenceRegistryTable records={evidenceRecords} actorId={actorId} />
      </SectionPanel>

      <SectionPanel title="Evidence packages" description="Sealed packages aggregate linked evidence for internal review.">
        <RecordTable
          columns={[
            { key: 'title', label: 'Package' },
            { key: 'controls', label: 'Controls' },
            { key: 'readiness', label: 'Readiness' },
            { key: 'sealed', label: 'Sealed' },
          ]}
          rows={mapRecords(evidencePackages.slice(0, 8), (pkg) => ({
            title: String(pkg.title ?? pkg.id ?? '—'),
            controls: Array.isArray(pkg.controlIds) ? pkg.controlIds.join(', ') : '—',
            readiness: String(pkg.readiness ?? '—'),
            sealed: pkg.sealed === true ? 'yes' : 'no',
          }))}
          emptyLabel="No evidence packages generated yet."
        />
      </SectionPanel>

      <TrackMindFormDialog
        entityKind="compliance-evidence"
        mode="create"
        seed={seed}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={entryMode === 'quick' ? 'Quick evidence capture' : 'Full compliance evidence record'}
        description="Evidence is hashed, audit-linked, and attached to declared targets for follow-up and review."
        submitLabel="Record evidence"
        onSubmitted={(result) => {
          setMessage(result.message ?? 'Compliance evidence recorded.');
          void queryClient.invalidateQueries({ queryKey: ['workspace'] });
          setDialogOpen(false);
        }}
      />
    </div>
  );
}
