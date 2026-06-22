import {
  operationalEvidenceLinkKindOptions,
  parseOperationalEvidenceLinks,
  serializeOperationalEvidenceLinks,
  type ComplianceEvidenceLinkTarget,
} from '@trackmind/shared';
import { Link2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { EntityRelationshipPicker } from './EntityRelationshipPicker';
import { TextAreaInput } from './TextAreaInput';
import { OperationalFieldHint, type OperationalControlProps } from './_shared';

const kindToEntityPicker = {
  incident: 'incident',
  approval: 'approval',
  'kpi-definition': 'kpi-definition',
} as const;

export function EvidenceLinkSelector({
  id,
  value,
  onChange,
  disabled,
  className,
  allowAdvancedPaste = true,
  fieldLabel = 'Evidence links',
}: OperationalControlProps & {
  value: string | ComplianceEvidenceLinkTarget[];
  onChange: (value: string) => void;
  allowAdvancedPaste?: boolean;
  fieldLabel?: string;
}): ReactElement {
  const targets = useMemo(() => parseOperationalEvidenceLinks(value), [value]);
  const textValue = typeof value === 'string' ? value : serializeOperationalEvidenceLinks(targets);

  const appendTarget = (kind: keyof typeof kindToEntityPicker, targetId: string, label?: string) => {
    const next: ComplianceEvidenceLinkTarget = {
      targetKind: kind === 'kpi-definition' ? 'kpi-definition' : kind,
      targetId,
      label,
    };
    const merged = [...targets.filter((entry) => !(entry.targetKind === next.targetKind && entry.targetId === next.targetId)), next];
    onChange(serializeOperationalEvidenceLinks(merged));
  };

  return (
    <div className={cn('grid gap-3', className)} role="group" aria-label={fieldLabel}>
      <div className="grid gap-2 md:grid-cols-2">
        {(Object.entries(kindToEntityPicker) as Array<[keyof typeof kindToEntityPicker, string]>).map(([kind, pickerKind]) => {
          const subLabelId = id ? `${id}-${kind}-label` : undefined;
          const kindLabel = operationalEvidenceLinkKindOptions().find((entry) => entry.kind === kind)?.label ?? kind;
          return (
          <div key={kind} className="grid gap-1">
            <span id={subLabelId} className="text-xs font-medium text-[var(--muted-foreground)]">
              Link {kindLabel}
            </span>
            <EntityRelationshipPicker
              kind={pickerKind as 'incident' | 'approval' | 'kpi-definition'}
              value=""
              disabled={disabled}
              aria-labelledby={subLabelId}
              onChange={(targetId, item) => appendTarget(kind, targetId, item?.label)}
            />
          </div>
          );
        })}
      </div>
      {allowAdvancedPaste ? (
        <TextAreaInput
          id={id}
          rows={3}
          disabled={disabled}
          placeholder="kind:id:optional-label (one per line)"
          value={textValue}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}
      {targets.length > 0 ? (
        <ul className="grid gap-1 text-xs">
          {targets.map((target) => (
            <li key={`${target.targetKind}:${target.targetId}`} className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
              <Link2 className="h-3 w-3" aria-hidden />
              <span>{target.label ?? target.targetId}</span>
              <span className="text-[var(--border)]">·</span>
              <span>{target.targetKind}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <OperationalFieldHint>Linked evidence targets are validated against compliance link kinds on submit.</OperationalFieldHint>
    </div>
  );
}
