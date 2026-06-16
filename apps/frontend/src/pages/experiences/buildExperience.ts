import type { ExperienceLane, ExperienceRecord, ExperienceStage, WorkspaceExperience } from '../../domain/experienceModel';
import { emptyExperience, panelToRecord } from '../../domain/experienceModel';
import { operatingModule, recordWiringForPanel } from '../../domain/operatingSystem';
import type { WorkspacePanel, WorkspaceViewModel } from '../../domain/workspaceModel';
import type { AppRoute } from '../../routes/routes';

type Focus = { label: string; value: string } | undefined;

function wiredRecord(route: AppRoute, panel: WorkspacePanel, data: WorkspaceViewModel, highlight: boolean): ExperienceRecord {
  const module = operatingModule(route.id);
  const wiring = recordWiringForPanel(route, panel.status, panel.evidence, data.source);
  return panelToRecord(panel, highlight, wiring, `Operator focus: ${module.operatorRole}. Review only; protected actions stay in backend approval workflows.`);
}

function mapPanels(route: AppRoute, panels: WorkspacePanel[], data: WorkspaceViewModel, focus: Focus): ExperienceRecord[] {
  return highlightRecords(panels.map((panel) => wiredRecord(route, panel, data, false)), focus);
}

function lane(id: string, kind: ExperienceLane['kind'], title: string, description: string, records: ExperienceRecord[]): ExperienceLane {
  return { id, kind, title, description, records };
}

function stage(id: string, label: string, laneIds: string[]): ExperienceStage {
  return { id, label, laneIds };
}

function matchesFocus(record: ExperienceRecord, focus: Focus): boolean {
  if (!focus?.value) return false;
  const needle = focus.value.toLowerCase();
  return record.id.toLowerCase().includes(needle)
    || record.title.toLowerCase().includes(needle)
    || record.summary.toLowerCase().includes(needle);
}

function highlightRecords(records: ExperienceRecord[], focus: Focus): ExperienceRecord[] {
  return records.map((record) => ({ ...record, highlight: matchesFocus(record, focus) }));
}

function panelsByPrefix(panels: WorkspacePanel[], prefix: string): WorkspacePanel[] {
  return panels.filter((panel) => panel.id.startsWith(prefix) || panel.title.toLowerCase().includes(prefix.toLowerCase()));
}

function buildRaceDayExperience(route: AppRoute, panels: WorkspacePanel[], data: WorkspaceViewModel, focus: Focus): WorkspaceExperience {
  const racePanels = panels.filter((panel) => panel.body.includes('readiness at') || panel.title.startsWith('Race '));
  const warningPanels = panels.filter((panel) => panel.title.includes('warning'));
  const controlPanels = panels.filter((panel) => panel.title.includes('Locked control'));
  const surfacePanels = panels.filter((panel) => panel.body.includes('surface sector'));
  const trackPanels = panels.filter((panel) => panel.id.includes('track') || panel.title.includes('Track configuration'));
  const lanes: ExperienceLane[] = [
    lane('race-readiness', 'readiness', 'Race readiness board', 'Post-time readiness, warnings, and locked approval controls before the race office clears the card.', highlightRecords([...racePanels, ...warningPanels, ...controlPanels].map((panel) => wiredRecord(route, panel, data, false)), focus)),
    lane('surface-gate', 'operations', 'Surface and gate review', 'Surface intelligence sectors and starting-gate configuration from the track read model.', highlightRecords([...surfacePanels, ...trackPanels].map((panel) => wiredRecord(route, panel, data, false)), focus)),
  ].filter((entry) => entry.records.length > 0);
  return {
    headline: 'Race-day operating board',
    subheadline: 'Walk readiness, surface, gate, and approval posture in order. Every control below is review-only.',
    stages: [
      stage('readiness', 'Readiness', ['race-readiness']),
      stage('surface', 'Surface & gate', ['surface-gate']),
    ],
    lanes,
  };
}

function buildEquineExperience(route: AppRoute, panels: WorkspacePanel[], data: WorkspaceViewModel, focus: Focus): WorkspaceExperience {
  const horsePanels = panels.filter((panel) => !panel.id.startsWith('Barn ') && !panel.title.startsWith('Barn '));
  const barnPanels = panels.filter((panel) => panel.title.startsWith('Barn ') || panel.id.startsWith('barn-'));
  const lanes: ExperienceLane[] = [
    lane('horse-profile', 'catalog', 'Horse profile and eligibility', 'Lifecycle, welfare, eligibility, trainer context, and activity history for the active horse record.', highlightRecords(horsePanels.map((panel) => wiredRecord(route, panel, data, false)), focus)),
    lane('barn-ops', 'operations', 'Barn readiness', 'Barn occupancy, restrictions, and readiness posture from barn operations.', highlightRecords(barnPanels.map((panel) => wiredRecord(route, panel, data, false)), focus)),
  ].filter((entry) => entry.records.length > 0);
  return {
    headline: 'Equine and barn review',
    subheadline: 'Review horse welfare, eligibility, and barn readiness without exposing protected veterinary clearance actions.',
    stages: [
      stage('horse', 'Horse profile', ['horse-profile']),
      stage('barn', 'Barn operations', ['barn-ops']),
    ],
    lanes,
  };
}

function buildApprovalsExperience(route: AppRoute, panels: WorkspacePanel[], data: WorkspaceViewModel, focus: Focus): WorkspaceExperience {
  return {
    headline: 'Approval review queue',
    subheadline: 'Human approvers inspect protected-action requests, escalation posture, and evidence before any backend workflow proceeds.',
    stages: [stage('queue', 'Queue', ['approval-queue'])],
    lanes: [
      lane('approval-queue', 'governance', 'Pending and recent requests', 'View-only approval records returned by the approvals service.', mapPanels(route, panels, data, focus)),
    ],
  };
}

function buildIncidentsExperience(route: AppRoute, panels: WorkspacePanel[], data: WorkspaceViewModel, focus: Focus): WorkspaceExperience {
  const incidentPanels = panels.filter((panel) => !panel.body.includes('resource is'));
  const resourcePanels = panels.filter((panel) => panel.body.includes('resource is'));
  return {
    headline: 'Incident command posture',
    subheadline: 'Review emergency signals, incident metadata, and response resources. Human operators retain command authority.',
    stages: [
      stage('incidents', 'Incidents', ['incident-board']),
      stage('resources', 'Resources', ['response-resources']),
    ],
    lanes: [
      lane('incident-board', 'operations', 'Incident board', 'Security and emergency incident signals with audit references.', highlightRecords(incidentPanels.map((panel) => wiredRecord(route, panel, data, false)), focus)),
      lane('response-resources', 'readiness', 'Response resources', 'Available emergency resources and zone coverage.', highlightRecords(resourcePanels.map((panel) => wiredRecord(route, panel, data, false)), focus)),
    ].filter((entry) => entry.records.length > 0),
  };
}

function buildComplianceExperience(route: AppRoute, panels: WorkspacePanel[], data: WorkspaceViewModel, focus: Focus): WorkspaceExperience {
  const frameworkPanels = panels.filter((panel) => panel.body.includes('authority reference'));
  const controlPanels = panels.filter((panel) => !panel.body.includes('authority reference'));
  return {
    headline: 'Compliance control library',
    subheadline: 'Map frameworks, controls, and internal readiness without claiming external certification.',
    stages: [
      stage('frameworks', 'Frameworks', ['frameworks']),
      stage('controls', 'Controls', ['controls']),
    ],
    lanes: [
      lane('frameworks', 'catalog', 'Framework posture', 'Framework authority references and candidate evidence artifacts.', highlightRecords(frameworkPanels.map((panel) => wiredRecord(route, panel, data, false)), focus)),
      lane('controls', 'evidence', 'Control mappings', 'Mapped controls, obligations, and evidence references.', highlightRecords(controlPanels.map((panel) => wiredRecord(route, panel, data, false)), focus)),
    ].filter((entry) => entry.records.length > 0),
  };
}

function buildSecurityExperience(route: AppRoute, panels: WorkspacePanel[], data: WorkspaceViewModel, focus: Focus): WorkspaceExperience {
  const incidentPanels = panels.filter((panel) => panel.body.includes('incident'));
  const cameraPanels = panels.filter((panel) => panel.body.includes('camera'));
  return {
    headline: 'Security review workspace',
    subheadline: 'Masked security incidents, camera health, and investigation references for authorized review roles.',
    stages: [
      stage('incidents', 'Incidents', ['security-incidents']),
      stage('cameras', 'Cameras', ['camera-health']),
    ],
    lanes: [
      lane('security-incidents', 'operations', 'Security incidents', 'Incident queue with zone, severity, and audit linkage.', highlightRecords(incidentPanels.map((panel) => wiredRecord(route, panel, data, false)), focus)),
      lane('camera-health', 'readiness', 'Camera health', 'Camera heartbeat and zone coverage metadata.', highlightRecords(cameraPanels.map((panel) => wiredRecord(route, panel, data, false)), focus)),
    ].filter((entry) => entry.records.length > 0),
  };
}

function buildFacilitiesExperience(route: AppRoute, panels: WorkspacePanel[], data: WorkspaceViewModel, focus: Focus): WorkspaceExperience {
  const assetPanels = panels.filter((panel) => panel.body.includes('asset health'));
  const workOrderPanels = panels.filter((panel) => panel.body.includes('work order'));
  return {
    headline: 'Facilities readiness desk',
    subheadline: 'Track assets, inspections, work orders, and return-to-service approval boundaries from the maintenance service.',
    stages: [
      stage('assets', 'Assets', ['asset-health']),
      stage('work', 'Work orders', ['work-orders']),
    ],
    lanes: [
      lane('asset-health', 'readiness', 'Asset health', 'Asset readiness, predicted failure risk, and digital twin references.', highlightRecords(assetPanels.map((panel) => wiredRecord(route, panel, data, false)), focus)),
      lane('work-orders', 'operations', 'Work orders', 'Maintenance work orders with approval and workflow references.', highlightRecords(workOrderPanels.map((panel) => wiredRecord(route, panel, data, false)), focus)),
    ].filter((entry) => entry.records.length > 0),
  };
}

function buildTicketingExperience(route: AppRoute, panels: WorkspacePanel[], data: WorkspaceViewModel, focus: Focus): WorkspaceExperience {
  return {
    headline: 'Ticketing operations desk',
    subheadline: 'Review ticket state, active face value, and race-day coverage without payment capture controls.',
    stages: [stage('tickets', 'Tickets', ['ticket-ledger'])],
    lanes: [
      lane('ticket-ledger', 'catalog', 'Active ticket ledger', 'Ticket records with status, race-day linkage, and audit context.', mapPanels(route, panels, data, focus)),
    ],
  };
}

function buildFinanceExperience(route: AppRoute, panels: WorkspacePanel[], data: WorkspaceViewModel, focus: Focus): WorkspaceExperience {
  return {
    headline: 'Finance and payout review',
    subheadline: 'Inspect payout records, dual-control posture, and protected payout boundaries.',
    stages: [stage('payouts', 'Payouts', ['payout-queue'])],
    lanes: [
      lane('payout-queue', 'governance', 'Payout queue', 'Released and pending payout metadata with approval references.', mapPanels(route, panels, data, focus)),
    ],
  };
}

function buildFederationExperience(route: AppRoute, panels: WorkspacePanel[], data: WorkspaceViewModel, focus: Focus): WorkspaceExperience {
  const profilePanels = panels.filter((panel) => panel.title.includes('federation profile'));
  const boundaryPanels = panels.filter((panel) => !panel.title.includes('federation profile'));
  return {
    headline: 'Federation readiness compare',
    subheadline: 'Aggregate, anonymized racetrack readiness without raw cross-track record exposure.',
    stages: [
      stage('profiles', 'Profiles', ['profiles']),
      stage('policy', 'Policy', ['policy-boundary']),
    ],
    lanes: [
      lane('profiles', 'catalog', 'Federation profiles', 'Track-scope federation readiness and residency metadata.', highlightRecords(profilePanels.map((panel) => wiredRecord(route, panel, data, false)), focus)),
      lane('policy-boundary', 'boundary', 'Sharing boundary', 'Aggregate sharing categories and prohibited field policy.', highlightRecords(boundaryPanels.map((panel) => wiredRecord(route, panel, data, false)), focus)),
    ].filter((entry) => entry.records.length > 0),
  };
}

function buildDataHubExperience(route: AppRoute, panels: WorkspacePanel[], data: WorkspaceViewModel, focus: Focus): WorkspaceExperience {
  const providerPanels = panels.filter((panel) => panel.body.includes('provider') || panel.title.includes('Provider'));
  const qualityPanels = panels.filter((panel) => panel.title.includes('quality') || panel.body.includes('quality'));
  const boundaryPanels = panelsByPrefix(panels, 'data-hub');
  const otherPanels = panels.filter((panel) => !providerPanels.includes(panel) && !qualityPanels.includes(panel) && !boundaryPanels.includes(panel));
  return {
    headline: 'Racing data governance hub',
    subheadline: 'Provider readiness, lineage, quality, export controls, and license posture without live provider pulls.',
    stages: [
      stage('providers', 'Providers', ['providers']),
      stage('quality', 'Quality', ['quality']),
      stage('boundary', 'Controls', ['boundary']),
    ],
    lanes: [
      lane('providers', 'catalog', 'Provider readiness', 'Licensed provider operational status and connector posture.', highlightRecords(providerPanels.map((panel) => wiredRecord(route, panel, data, false)), focus)),
      lane('quality', 'evidence', 'Quality and lineage', 'Data quality reports, lineage references, and entity resolution notes.', highlightRecords(qualityPanels.map((panel) => wiredRecord(route, panel, data, false)), focus)),
      lane('boundary', 'boundary', 'Export and license controls', 'Export controls, review actions, and integration boundary copy.', highlightRecords([...boundaryPanels, ...otherPanels].map((panel) => wiredRecord(route, panel, data, false)), focus)),
    ].filter((entry) => entry.records.length > 0),
  };
}

function buildAuditExperience(route: AppRoute, panels: WorkspacePanel[], data: WorkspaceViewModel, focus: Focus): WorkspaceExperience {
  return {
    headline: 'Audit evidence ledger',
    subheadline: 'Immutable audit events with hash references, actor linkage, and approval context.',
    stages: [stage('ledger', 'Ledger', ['audit-ledger'])],
    lanes: [
      lane('audit-ledger', 'evidence', 'Audit event ledger', 'Chronological audit events with integrity references.', mapPanels(route, panels, data, focus)),
    ],
  };
}

function buildAdminExperience(route: AppRoute, panels: WorkspacePanel[], data: WorkspaceViewModel, focus: Focus): WorkspaceExperience {
  const servicePanels = panels.filter((panel) => panel.body.includes('service-health'));
  const boundaryPanels = panels.filter((panel) => panel.title.includes('Deployment'));
  return {
    headline: 'Service status console',
    subheadline: 'Reference platform health, dependency declarations, and deployment boundary assumptions.',
    stages: [
      stage('services', 'Services', ['service-health']),
      stage('boundary', 'Boundary', ['deployment-boundary']),
    ],
    lanes: [
      lane('service-health', 'readiness', 'Service health', 'Facade service records, latency, and dependency status.', highlightRecords(servicePanels.map((panel) => wiredRecord(route, panel, data, false)), focus)),
      lane('deployment-boundary', 'boundary', 'Deployment boundary', 'Declared deployment assumptions and non-attestation copy.', highlightRecords(boundaryPanels.map((panel) => wiredRecord(route, panel, data, false)), focus)),
    ].filter((entry) => entry.records.length > 0),
  };
}

function buildSettingsExperience(route: AppRoute, panels: WorkspacePanel[], data: WorkspaceViewModel, focus: Focus): WorkspaceExperience {
  const policyPanels = panels.filter((panel) => panel.title.includes('policy'));
  const mappingPanels = panels.filter((panel) => !panel.title.includes('policy'));
  return {
    headline: 'AI guardrails console',
    subheadline: 'Read-only AI policy, protected actions, evidence requirements, and human approval mappings.',
    stages: [
      stage('policy', 'Policy', ['ai-policy']),
      stage('mapping', 'Mappings', ['governance-mapping']),
    ],
    lanes: [
      lane('ai-policy', 'boundary', 'Advisory-only policy', 'Allowed activities, draft-only posture, and protected execution boundaries.', highlightRecords(policyPanels.map((panel) => wiredRecord(route, panel, data, false)), focus)),
      lane('governance-mapping', 'governance', 'Governance mappings', 'Framework control mappings and required evidence references.', highlightRecords(mappingPanels.map((panel) => wiredRecord(route, panel, data, false)), focus)),
    ].filter((entry) => entry.records.length > 0),
  };
}

function buildDefaultExperience(route: AppRoute, routeLabel: string, panels: WorkspacePanel[], data: WorkspaceViewModel, focus: Focus): WorkspaceExperience {
  return {
    headline: routeLabel,
    subheadline: 'Review service-backed records, evidence, and governance boundaries for this workspace.',
    stages: [stage('records', 'Records', ['workspace-records'])],
    lanes: [
      lane('workspace-records', 'catalog', 'Workspace records', 'Records returned by the active route adapter.', mapPanels(route, panels, data, focus)),
    ],
  };
}

export function buildRouteExperience(route: AppRoute, data: WorkspaceViewModel, focus: Focus): WorkspaceExperience {
  const panels = Array.isArray(data.panels) ? data.panels : [];
  const module = operatingModule(route.id);
  switch (route.id) {
    case 'raceDay': return buildRaceDayExperience(route, panels, data, focus);
    case 'equine': return buildEquineExperience(route, panels, data, focus);
    case 'approvals': return buildApprovalsExperience(route, panels, data, focus);
    case 'incidents': return buildIncidentsExperience(route, panels, data, focus);
    case 'compliance': return buildComplianceExperience(route, panels, data, focus);
    case 'security': return buildSecurityExperience(route, panels, data, focus);
    case 'facilities': return buildFacilitiesExperience(route, panels, data, focus);
    case 'ticketing': return buildTicketingExperience(route, panels, data, focus);
    case 'finance': return buildFinanceExperience(route, panels, data, focus);
    case 'federation': return buildFederationExperience(route, panels, data, focus);
    case 'dataHub': return buildDataHubExperience(route, panels, data, focus);
    case 'audit': return buildAuditExperience(route, panels, data, focus);
    case 'admin': return buildAdminExperience(route, panels, data, focus);
    case 'settings': return buildSettingsExperience(route, panels, data, focus);
    case 'dashboard': return emptyExperience(module.mission, module.functionalToday);
  }
}

export function filterExperienceByStage(experience: WorkspaceExperience, stageId: string | undefined): WorkspaceExperience {
  if (!stageId) return experience;
  const stage = experience.stages.find((entry) => entry.id === stageId);
  if (!stage) return experience;
  const laneIds = new Set(stage.laneIds);
  return { ...experience, lanes: experience.lanes.filter((laneEntry) => laneIds.has(laneEntry.id)) };
}

export function experienceFromViewModel(route: AppRoute, data: WorkspaceViewModel, focus: Focus, stageId?: string): WorkspaceExperience {
  return filterExperienceByStage(buildRouteExperience(route, data, focus), stageId);
}
