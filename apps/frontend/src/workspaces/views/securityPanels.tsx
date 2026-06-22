import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/design/components/badge';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { Button } from '@/design/components/button';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { useIncidentTimelineStream } from '@/hooks/useIncidentTimelineStream';
import { feedData } from '../feedUtils';
import { activateEmergencyWorkflow, completeEmergencyCommunication, scheduleEmergencyDrill, completeEmergencyDrill, createEmergencyAfterActionReport, completeEmergencyChecklistItem, patchSecurityEscalation } from '@/api/mutations';
import { getJson } from '@/api/client';
import { apiPaths } from '@/api/paths';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { EntityFormAction } from '@/features/data-entry/TrackMindFormDialog';
import { IncidentIntakeConsole } from '@/features/incident-intake/IncidentIntakeConsole';
import { SecurityEventEntryConsole } from '@/features/security-events/SecurityEventEntryConsole';

function securityData(results: WorkspaceDataResult[]) {
  return feedData<Record<string, unknown>>(results, '/security-operations/workspace');
}

export function SecurityPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const data = securityData(results);
  const zonesLive = feedData<Record<string, unknown>>(results, '/security-operations/zones/live');
  const cameraReadiness = feedData<Record<string, unknown>>(results, '/security-operations/cameras/readiness');
  const sensorReadiness = feedData<Record<string, unknown>>(results, '/security-operations/sensors/readiness');
  const securityKpis = feedData<Record<string, unknown>>(results, '/security-operations/kpis');
  const incidents = extractArray<Record<string, unknown>>(data, 'incidents');
  const cameras = extractArray<Record<string, unknown>>(data, 'cameras');
  const access = extractArray<Record<string, unknown>>(data, 'accessEvents');
  const escalations = extractArray<Record<string, unknown>>(data, 'escalations');
  const liveZones = extractArray<Record<string, unknown>>(zonesLive, 'zones');
  const cameraItems = extractArray<Record<string, unknown>>(cameraReadiness, 'items');
  const sensorItems = extractArray<Record<string, unknown>>(sensorReadiness, 'items');
  const kpiItems = extractArray<Record<string, unknown>>(securityKpis, 'kpis');
  const dashboard = (data?.dashboard ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <SecurityEventEntryConsole
        accessEvents={access}
        incidents={incidents}
        escalations={escalations}
      />
      <KpiStrip
        items={[
          { id: 'coverage', label: 'Security coverage', value: `${String(securityKpis?.coveragePercent ?? '—')}%`, status: Number(securityKpis?.coveragePercent ?? 100) < 90 ? 'warning' : 'nominal' },
          { id: 'incidents', label: 'Active incidents', value: String(incidents.length), status: incidents.length ? 'warning' : 'nominal' },
          { id: 'cameras', label: 'Camera readiness', value: `${String(cameraReadiness?.score ?? '—')}%` },
          { id: 'access', label: 'Access events', value: String(access.length) },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Incidents">
          <RecordTable
            columns={[
              { key: 'title', label: 'Incident' },
              { key: 'severity', label: 'Severity' },
              { key: 'zone', label: 'Zone' },
            ]}
            rows={mapRecords(incidents, (i) => ({
              title: String(i.title ?? i.summary ?? i.id ?? '—'),
              severity: String(i.severity ?? '—'),
              zone: String(i.zoneId ?? i.zone ?? '—'),
            }))}
          />
        </SectionPanel>
        <SectionPanel title="Camera health">
          <RecordTable
            columns={[
              { key: 'camera', label: 'Camera' },
              { key: 'zone', label: 'Zone' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(cameras, (c) => ({
              camera: String(c.cameraId ?? c.id ?? c.name ?? '—'),
              zone: String(c.zoneId ?? '—'),
              status: String(c.status ?? c.health ?? '—'),
            }))}
          />
        </SectionPanel>
      </div>
      <SectionPanel title="Recent access events">
        <RecordTable
          columns={[
            { key: 'time', label: 'Time' },
            { key: 'person', label: 'Person' },
            { key: 'zone', label: 'Zone' },
            { key: 'result', label: 'Result' },
          ]}
          rows={mapRecords(access, (a) => ({
            time: String(a.occurredAt ?? a.timestamp ?? '—'),
            person: String(a.personDisplayName ?? a.personId ?? a.credentialId ?? '—'),
            zone: String(a.zoneId ?? '—'),
            result: String(a.result ?? a.decision ?? '—'),
          }))}
        />
      </SectionPanel>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Live zone monitoring" description="Restricted zone occupancy from CQRS projections.">
          <RecordTable
            columns={[
              { key: 'zone', label: 'Zone' },
              { key: 'occupancy', label: 'Occupancy' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(liveZones, (z) => ({
              zone: String(z.name ?? z.zoneId ?? '—'),
              occupancy: String(z.occupancy ?? '—'),
              status: String(z.status ?? '—'),
            }))}
          />
        </SectionPanel>
        <SectionPanel title="Integration readiness" description="Camera and sensor adapter readiness for vendor webhooks.">
          <RecordTable
            columns={[
              { key: 'asset', label: 'Asset' },
              { key: 'type', label: 'Type' },
              { key: 'status', label: 'Status' },
            ]}
            rows={[
              ...mapRecords(cameraItems, (item) => ({
                asset: String(item.label ?? item.id ?? '—'),
                type: 'camera',
                status: String(item.integrationStatus ?? item.health ?? '—'),
              })),
              ...mapRecords(sensorItems, (item) => ({
                asset: String(item.label ?? item.id ?? '—'),
                type: 'sensor',
                status: String(item.integrationStatus ?? item.health ?? '—'),
              })),
            ]}
          />
        </SectionPanel>
      </div>
      <SectionPanel title="Security KPI pack" description="Projected security KPIs from zones, cameras, sensors, and incidents.">
        <RecordTable
          columns={[
            { key: 'kpi', label: 'KPI' },
            { key: 'value', label: 'Value' },
            { key: 'unit', label: 'Unit' },
          ]}
          rows={mapRecords(kpiItems.length ? kpiItems : [{ label: 'Restricted zone events', value: dashboard.restrictedZoneEvents, unit: 'count' }], (k) => ({
            kpi: String(k.label ?? k.kpiId ?? '—'),
            value: String(k.value ?? '—'),
            unit: String(k.unit ?? '—'),
          }))}
        />
      </SectionPanel>
      {escalations.length > 0 ? (
        <EscalationActionsPanel escalations={escalations} />
      ) : null}
    </div>
  );
}

function EscalationActionsPanel({ escalations }: { escalations: Record<string, unknown>[] }): ReactElement {
  const queryClient = useQueryClient();
  const { session } = useTenantSession();
  const [message, setMessage] = useState<string | null>(null);
  const ackMutation = useMutation({
    mutationFn: (escalationId: string) => patchSecurityEscalation({
      escalationId,
      assignee: `${session.role}-operator`,
      status: 'acknowledged',
    }),
    onSuccess: () => {
      setMessage('Escalation acknowledged.');
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  return (
    <SectionPanel title="Open escalations" description="Acknowledge and assign security escalations.">
      <div className="space-y-2">
        {escalations.slice(0, 6).map((flow) => {
          const id = String(flow.id ?? '');
          return (
            <div key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] p-2">
              <div>
                <p className="text-sm font-medium">{String(flow.title ?? flow.summary ?? id)}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{String(flow.status ?? flow.state ?? 'open')}</p>
              </div>
              <Button size="sm" variant="governance" disabled={!id || ackMutation.isPending} onClick={() => ackMutation.mutate(id)}>
                Acknowledge
              </Button>
            </div>
          );
        })}
        {message ? <p className="text-xs text-[var(--muted-foreground)]">{message}</p> : null}
      </div>
    </SectionPanel>
  );
}

export function IncidentPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const { session } = useTenantSession();
  const uniqueIncidents = useMemo(() => {
    const listData = feedData<unknown>(results, apiPaths.incidents.list);
    const platformIncidents = extractArray<Record<string, unknown>>(listData);
    const seen = new Set<string>();
    return platformIncidents.filter((incident) => {
      const id = String(incident.id ?? '');
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [results]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const focusedIncidentId = selectedIncidentId ?? String(uniqueIncidents[0]?.id ?? 'inc-1');

  const security = securityData(results);
  const emergency = feedData<Record<string, unknown>>(results, '/emergency-operations/workspace');
  const investigations = extractArray<Record<string, unknown>>(security, 'investigations');
  const emergencyStatus = String(emergency?.activeEmergencyStatus ?? 'nominal');

  const incidentDetailQuery = useQuery({
    queryKey: ['incident-detail', focusedIncidentId, session.sessionKey],
    queryFn: async () => {
      const result = await getJson<Record<string, unknown>>(apiPaths.incidents.detail(focusedIncidentId));
      return result.status === 'ready' ? result.data : undefined;
    },
    enabled: Boolean(focusedIncidentId),
    refetchInterval: 15_000,
  });

  const {
    timeline: streamedTimeline,
    status: timelineStreamStatus,
    revision: timelineRevision,
  } = useIncidentTimelineStream(focusedIncidentId);

  const timelineEntries: Record<string, unknown>[] = streamedTimeline?.entries?.length
    ? streamedTimeline.entries.map((entry) => ({ ...entry }))
    : extractArray<Record<string, unknown>>(incidentDetailQuery.data, 'timeline');
  const liveTimeline = timelineEntries;
  const focusedIncident = uniqueIncidents.find((incident) => String(incident.id) === focusedIncidentId)
    ?? incidentDetailQuery.data;

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Emergency posture</p>
          <p className="text-xs text-[var(--muted-foreground)]">Combined security and emergency operations feeds</p>
        </div>
        <Badge variant={emergencyStatus.includes('active') ? 'critical' : 'nominal'}>{emergencyStatus}</Badge>
      </div>
      <KpiStrip
        items={[
          { id: 'open', label: 'Platform incidents', value: String(uniqueIncidents.length), status: uniqueIncidents.length ? 'warning' : 'nominal' },
          { id: 'timeline', label: 'Timeline entries', value: String(liveTimeline.length) },
          { id: 'status', label: 'Focused status', value: String(focusedIncident?.status ?? '—') },
        ]}
      />
      <IncidentIntakeConsole
        incidents={uniqueIncidents}
        timelineEntries={liveTimeline}
        focusedIncidentId={focusedIncidentId}
        onFocusIncident={setSelectedIncidentId}
      />
      <SectionPanel title="Legacy data entry" description="Domain-specific incident forms retained for backward compatibility.">
        <div className="flex flex-wrap gap-2">
          <EntityFormAction entityKind="facilities-incident" label="Facilities incident (legacy)" variant="outline" />
        </div>
      </SectionPanel>
      <SectionPanel title="Incident command board" description="Lifecycle incidents from /incidents with SSE timeline subscription.">
        {uniqueIncidents.length > 1 ? (
          <label className="mb-3 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            Focus incident
            <select
              className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-sm text-[var(--foreground)]"
              value={focusedIncidentId}
              onChange={(event) => setSelectedIncidentId(event.target.value)}
            >
              {uniqueIncidents.map((incident) => (
                <option key={String(incident.id)} value={String(incident.id)}>
                  {String(incident.title ?? incident.id)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <RecordTable
          columns={[
            { key: 'incident', label: 'Incident' },
            { key: 'severity', label: 'Severity' },
            { key: 'status', label: 'Status' },
          ]}
          rows={mapRecords(uniqueIncidents, (i) => ({
            incident: String(i.title ?? i.id ?? '—'),
            severity: String(i.severity ?? '—'),
            status: String(i.status ?? '—'),
          }))}
        />
      </SectionPanel>
      <SectionPanel
        title="Live incident timeline"
        description={`SSE /incidents/${focusedIncidentId}/timeline/stream (${timelineStreamStatus}${timelineRevision != null ? `, rev ${timelineRevision}` : ''}).`}
      >
        <RecordTable
          columns={[
            { key: 'time', label: 'Time' },
            { key: 'action', label: 'Action' },
            { key: 'actor', label: 'Actor' },
            { key: 'note', label: 'Note' },
          ]}
          rows={mapRecords(liveTimeline, (entry) => ({
            time: String(entry.at ?? '—'),
            action: String(entry.action ?? '—'),
            actor: String(entry.actor ?? '—'),
            note: String(entry.note ?? '—'),
          }))}
          emptyLabel={timelineStreamStatus === 'connecting' ? 'Connecting to incident timeline stream…' : 'No timeline entries returned for the focused incident.'}
        />
      </SectionPanel>
      <SectionPanel title="Investigations">
        <RecordTable
          columns={[
            { key: 'id', label: 'Investigation' },
            { key: 'lead', label: 'Lead' },
            { key: 'status', label: 'Status' },
          ]}
          rows={mapRecords(investigations, (i) => ({
            id: String(i.id ?? '—'),
            lead: String(i.lead ?? i.assignee ?? '—'),
            status: String(i.status ?? '—'),
          }))}
        />
      </SectionPanel>
    </div>
  );
}

export function EmergencyPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const queryClient = useQueryClient();
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const emergency = feedData<Record<string, unknown>>(results, '/emergency-operations/workspace');
  const checklist = extractArray<Record<string, unknown>>(emergency, 'checklist');
  const comms = extractArray<Record<string, unknown>>(emergency, 'communicationLog');
  const roles = extractArray<Record<string, unknown>>(emergency, 'commandRoles');
  const drills = extractArray<Record<string, unknown>>(emergency, 'drills');
  const afterActionReports = extractArray<Record<string, unknown>>(emergency, 'afterActionReports');
  const approvalPosture = emergency?.approvalPosture as { target?: string } | undefined;
  const activeWorkflowId = String(approvalPosture?.target && approvalPosture.target !== 'no-active-emergency' ? approvalPosture.target : 'wf-fire-1');
  const pendingComm = comms.find((item) => !item.completed);
  const pendingDrill = drills.find((item) => !item.completedAt);
  const commanderAssignee = String(roles.find((role) => role.role === 'incident-commander')?.assignee ?? 'Avery Chen');

  const invalidateWorkspace = () => void queryClient.invalidateQueries({ queryKey: ['workspace'] });
  const onMutationMessage = (response: unknown, fallback: string) => {
    if (typeof response === 'object' && response && 'message' in response) {
      const posture = (response as { approvalPosture?: { mode?: string } }).approvalPosture?.mode;
      const base = String((response as { message?: string }).message);
      setActionMessage(posture ? `${base} (${posture})` : base);
    } else {
      setActionMessage(fallback);
    }
    invalidateWorkspace();
  };

  const activateWorkflow = useMutation({
    mutationFn: () =>
      activateEmergencyWorkflow({
        id: `wf-drill-${Date.now()}`,
        planId: 'plan-weather',
        scenario: 'severe-weather',
        severity: 'major',
        location: 'Grandstand shelter level',
        activatedBy: commanderAssignee,
        roles: ['platform-super-admin', 'race-day-operations-manager'],
      }),
    onSuccess: (response) => onMutationMessage(response, 'Emergency workflow activated.'),
    onError: (error: Error) => setActionMessage(error.message),
  });

  const completeCommunication = useMutation({
    mutationFn: () =>
      completeEmergencyCommunication(activeWorkflowId, {
        itemId: String(pendingComm?.id ?? 'comm-radio'),
        actor: commanderAssignee,
      }),
    onSuccess: (response) => onMutationMessage(response, 'Emergency communication recorded.'),
    onError: (error: Error) => setActionMessage(error.message),
  });

  const scheduleDrill = useMutation({
    mutationFn: () =>
      scheduleEmergencyDrill({
        id: `drill-${Date.now()}`,
        scenario: 'severe-weather',
        participants: ['ops', 'security', 'facilities'],
      }),
    onSuccess: (response) => onMutationMessage(response, 'Emergency drill scheduled.'),
    onError: (error: Error) => setActionMessage(error.message),
  });

  const finishDrill = useMutation({
    mutationFn: () =>
      completeEmergencyDrill(String(pendingDrill?.id ?? 'drill-weather-1'), {
        actor: commanderAssignee,
        workflowId: activeWorkflowId,
        observations: ['Command log reconciled with digital twin'],
      }),
    onSuccess: (response) => onMutationMessage(response, 'Emergency drill completed.'),
    onError: (error: Error) => setActionMessage(error.message),
  });

  const createAfterAction = useMutation({
    mutationFn: () =>
      createEmergencyAfterActionReport({
        incidentId: 'inc-100',
        actor: commanderAssignee,
        workflowId: activeWorkflowId,
        findings: [{ finding: 'Communications checklist reviewed under incident command', severity: 'major', owner: 'safety' }],
      }),
    onSuccess: (response) => onMutationMessage(response, 'After-action report created.'),
    onError: (error: Error) => setActionMessage(error.message),
  });

  const completeChecklistMutation = useMutation({
    mutationFn: (itemId: string) => completeEmergencyChecklistItem({
      itemId,
      workflowId: activeWorkflowId,
      actor: commanderAssignee,
    }),
    onSuccess: (response) => onMutationMessage(response, 'Checklist item marked complete.'),
    onError: (error: Error) => setActionMessage(error.message),
  });

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'status', label: 'Emergency status', value: String(emergency?.activeEmergencyStatus ?? 'standby') },
          { id: 'checklist', label: 'Checklist items', value: String(checklist.length) },
          { id: 'roles', label: 'Command roles', value: String(roles.length) },
        ]}
      />
      <SectionPanel title="Incident command activation" description="Human-governed emergency workflow activation; AI cannot block life-safety actions. Post-action evidence is recorded without blocking response.">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="governance"
            disabled={activateWorkflow.isPending}
            onClick={() => {
              setActionMessage(null);
              activateWorkflow.mutate();
            }}
          >
            Activate severe-weather workflow
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!pendingComm || completeCommunication.isPending}
            onClick={() => {
              setActionMessage(null);
              completeCommunication.mutate();
            }}
          >
            Complete next communication
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={scheduleDrill.isPending}
            onClick={() => {
              setActionMessage(null);
              scheduleDrill.mutate();
            }}
          >
            Schedule drill
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!pendingDrill || finishDrill.isPending}
            onClick={() => {
              setActionMessage(null);
              finishDrill.mutate();
            }}
          >
            Complete drill
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={createAfterAction.isPending}
            onClick={() => {
              setActionMessage(null);
              createAfterAction.mutate();
            }}
          >
            Create after-action report
          </Button>
          {actionMessage ? <p className="text-xs text-[var(--muted-foreground)]">{actionMessage}</p> : null}
        </div>
      </SectionPanel>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Emergency checklist">
          <div className="space-y-2">
            {checklist.slice(0, 8).map((c) => {
              const itemId = String(c.id ?? c.item ?? '');
              const completed = Boolean(c.completed) || String(c.status).toLowerCase() === 'done';
              return (
                <div key={itemId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] p-2">
                  <div>
                    <p className="text-sm font-medium">{String(c.title ?? c.item ?? itemId)}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{String(c.owner ?? c.role ?? '—')} · {String(c.status ?? (completed ? 'done' : 'open'))}</p>
                  </div>
                  {!completed ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={completeChecklistMutation.isPending}
                      onClick={() => completeChecklistMutation.mutate(itemId)}
                    >
                      Mark complete
                    </Button>
                  ) : (
                    <Badge variant="nominal">done</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </SectionPanel>
        <SectionPanel title="Command roles">
          <RecordTable
            columns={[
              { key: 'role', label: 'Role' },
              { key: 'assignee', label: 'Assignee' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(roles, (r) => ({
              role: String(r.role ?? r.title ?? '—'),
              assignee: String(r.assignee ?? r.personId ?? '—'),
              status: String(r.status ?? '—'),
            }))}
          />
        </SectionPanel>
      </div>
      <SectionPanel title="Communications log">
        <RecordTable
          columns={[
            { key: 'time', label: 'Time' },
            { key: 'audience', label: 'Audience' },
            { key: 'message', label: 'Message' },
            { key: 'status', label: 'Status' },
          ]}
          rows={mapRecords(comms, (c) => ({
            time: String(c.completedAt ?? c.timestamp ?? '—'),
            audience: String(c.audience ?? c.channel ?? '—'),
            message: String(c.message ?? c.summary ?? '—'),
            status: String(c.completed ? 'complete' : 'pending'),
          }))}
        />
      </SectionPanel>
      <SectionPanel title="Drills and after-action evidence">
        <RecordTable
          columns={[
            { key: 'id', label: 'Record' },
            { key: 'type', label: 'Type' },
            { key: 'status', label: 'Status' },
          ]}
          rows={[
            ...mapRecords(drills, (drill) => ({
              id: String(drill.id ?? '—'),
              type: 'drill',
              status: String(drill.completedAt ? 'completed' : 'scheduled'),
            })),
            ...mapRecords(afterActionReports, (report) => ({
              id: String(report.incidentId ?? '—'),
              type: 'after-action',
              status: 'evidence-recorded',
            })),
          ]}
        />
      </SectionPanel>
    </div>
  );
}
