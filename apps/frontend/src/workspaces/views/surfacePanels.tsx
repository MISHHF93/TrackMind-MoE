import type { ReactElement } from 'react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { Button } from '@/design/components/button';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { feedData, numericField } from '../feedUtils';
import { GovernedActionDialog } from '@/features/approvals/GovernedActionDialog';
import { requestSurfaceOperationalAction } from '@/api/mutations';
import type { WorkspaceAction } from '@/design/components/workspace';

export function SurfacePanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; action?: WorkspaceAction }>({ open: false });
  const surface = feedData<Record<string, unknown>>(results, '/surface-intelligence/workspace');
  const measurements = extractArray<Record<string, unknown>>(feedData(results, '/track-surface/measurements'));
  const sectors = extractArray<Record<string, unknown>>(surface, 'sectors');
  const anomalies = extractArray<Record<string, unknown>>(surface, 'anomalies');
  const recommendations = extractArray<Record<string, unknown>>(surface, 'recommendations');
  const weather = surface && typeof surface.weatherObservation === 'object' ? surface.weatherObservation as Record<string, unknown> : undefined;
  const score = numericField(surface, 'overallScore');

  const surfaceActionMutation = useMutation({
    mutationFn: (input: { action: string; sectorId: string; reason: string }) =>
      requestSurfaceOperationalAction(input),
    onSuccess: (response) => {
      setMessage(typeof response === 'object' && response && 'message' in response
        ? String((response as { message?: string }).message)
        : 'Surface operational action requested.');
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  return (
    <div className="space-y-4">
      <SectionPanel title="Surface actions" description="Approval-gated maintenance and configuration actions.">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="governance"
            onClick={() => setDialog({
              open: true,
              action: {
                id: 'surface-irrigation',
                label: 'Request irrigation',
                protectedAction: 'surface-irrigation',
                target: 'far-turn',
                approvalApi: 'controlled-actions',
              },
            })}
          >
            Request irrigation approval
          </Button>
          <Button
            size="sm"
            variant="governance"
            onClick={() => setDialog({
              open: true,
              action: {
                id: 'track-closure',
                label: 'Track closure',
                protectedAction: 'track-closure',
                target: 'main-track',
                approvalApi: 'controlled-actions',
              },
            })}
          >
            Request track closure
          </Button>
          {message ? <p className="text-xs text-[var(--muted-foreground)] w-full">{message}</p> : null}
        </div>
      </SectionPanel>
      <KpiStrip
        items={[
          { id: 'score', label: 'Overall surface score', value: score != null ? String(score) : '—' },
          { id: 'readings', label: 'Live readings', value: String(measurements.length) },
          { id: 'sectors', label: 'Sectors monitored', value: String(sectors.length) },
          { id: 'anomalies', label: 'Anomalies', value: String(anomalies.length), status: anomalies.length ? 'warning' : 'nominal' },
          { id: 'weather', label: 'Weather', value: weather ? String(weather.condition ?? weather.summary ?? 'Observed') : '—' },
        ]}
      />
      <SectionPanel title="Sector conditions" description="Moisture, compaction, and risk by track sector.">
        <RecordTable
          columns={[
            { key: 'sector', label: 'Sector' },
            { key: 'moisture', label: 'Moisture' },
            { key: 'risk', label: 'Risk' },
            { key: 'status', label: 'Status' },
          ]}
          rows={mapRecords(sectors, (s) => ({
            sector: String(s.sectorId ?? s.name ?? s.id ?? '—'),
            moisture: String(s.moisture ?? s.moistureMm ?? '—'),
            risk: String(s.risk ?? s.riskLevel ?? '—'),
            status: String(s.status ?? '—'),
          }))}
        />
      </SectionPanel>
      <SectionPanel title="Live surface measurements" description="Sector moisture and compaction from /track-surface/measurements.">
        <RecordTable
          columns={[
            { key: 'sector', label: 'Sector' },
            { key: 'moisture', label: 'Moisture' },
            { key: 'compaction', label: 'Compaction' },
            { key: 'measuredAt', label: 'Measured' },
          ]}
          rows={mapRecords(measurements, (m) => ({
            sector: String(m.sectorId ?? '—'),
            moisture: m.moisture != null ? String(m.moisture) : '—',
            compaction: m.compaction != null ? String(m.compaction) : '—',
            measuredAt: String(m.measuredAt ?? '—'),
          }))}
          emptyLabel="No live surface measurements returned."
        />
      </SectionPanel>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Surface anomalies">
          <RecordTable
            columns={[
              { key: 'title', label: 'Anomaly' },
              { key: 'severity', label: 'Severity' },
              { key: 'sector', label: 'Sector' },
            ]}
            rows={mapRecords(anomalies, (a) => ({
              title: String(a.title ?? a.summary ?? '—'),
              severity: String(a.severity ?? '—'),
              sector: String(a.sectorId ?? '—'),
            }))}
          />
        </SectionPanel>
        <SectionPanel title="Maintenance recommendations" description="Approval-gated surface actions.">
          <div className="space-y-2">
            {recommendations.slice(0, 6).map((rec) => {
              const sectorId = String(rec.sectorId ?? 'far-turn');
              const action = String(rec.action ?? rec.title ?? 'surface-rolling');
              return (
                <div key={String(rec.id ?? action)} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] p-2">
                  <div>
                    <p className="text-sm font-medium">{action}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{String(rec.detail ?? rec.rationale ?? rec.executionState ?? '')}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="governance"
                    disabled={surfaceActionMutation.isPending}
                    onClick={() => surfaceActionMutation.mutate({
                      action,
                      sectorId,
                      reason: `Operator requested ${action} from surface recommendations`,
                    })}
                  >
                    Request action
                  </Button>
                </div>
              );
            })}
            {recommendations.length === 0 ? (
              <RecordTable
                columns={[
                  { key: 'action', label: 'Action' },
                  { key: 'state', label: 'State' },
                  { key: 'detail', label: 'Detail' },
                ]}
                rows={[]}
                emptyLabel="No maintenance recommendations returned."
              />
            ) : null}
          </div>
        </SectionPanel>
      </div>
      {dialog.action?.protectedAction ? (
        <GovernedActionDialog
          open={dialog.open}
          onOpenChange={(open) => setDialog({ open, action: open ? dialog.action : undefined })}
          title={dialog.action.label}
          description={dialog.action.detail ?? 'Request human approval for this surface action.'}
          protectedAction={dialog.action.protectedAction}
          target={dialog.action.target ?? 'far-turn'}
          approvalApi={dialog.action.approvalApi}
        />
      ) : null}
    </div>
  );
}
