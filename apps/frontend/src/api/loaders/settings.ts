import type {
  AIControlPlaneModelRegistryDto,
  AIControlPlanePolicyDto,
  AIControlPlaneRecommendationDto,
  AIControlPlaneWorkspaceDto,
} from '@trackmind/shared';
import { getJson } from '../client';
import { apiPaths } from '../paths';
import type { ConsoleAdvisory, ConsolePayload, OpsPosture, QueueItem } from '../../design/opsTypes';
import { enrichConsoleWithSharedContext, loadSharedContext } from './commonContext';
import { countBarChart, postureBreakdownDonut } from './charts';
import { settingsGovernanceLanes } from './lifecycle';
import { countMetric, navAction, requireReady, textMetric } from './util';

function settingsAction(label: string, focus: string, detail: string, tone: 'primary' | 'secondary' | 'critical' = 'secondary') {
  return navAction(label, `/settings?focus=${encodeURIComponent(focus)}`, detail, tone);
}

function advisoryFromBlockedAction(item: AIControlPlaneRecommendationDto): ConsoleAdvisory {
  const id = item.recommendationId ?? item.id ?? 'blocked-action';
  const risk = item.risk?.level ?? item.riskLevel;
  return {
    id,
    recommendation: item.recommendation ?? item.governorDecision?.reason ?? `Blocked protected action: ${item.action}.`,
    posture: risk === 'critical' ? 'critical' : risk === 'high' ? 'watch' : 'blocked',
    requiresApproval: true,
    actions: [
      settingsAction('Review blocked action', 'blocked-actions', 'Inspect governor-blocked protected action attempts.', 'primary'),
      settingsAction('Review policy mapping', 'policy', 'Review protected-action policy boundaries.'),
    ],
  };
}

function recommendationPosture(item: AIControlPlaneRecommendationDto): OpsPosture {
  const risk = item.risk?.level ?? item.riskLevel;
  if (risk === 'critical') return 'critical';
  if (risk === 'high') return 'watch';
  return 'advisory';
}

export async function loadSettingsConsole(): Promise<ConsolePayload> {
  const [policy, workspace, models, blockedActions, events, shared] = await Promise.all([
    getJson<AIControlPlanePolicyDto>(apiPaths.settings.policy),
    getJson<AIControlPlaneWorkspaceDto>(apiPaths.settings.workspace),
    getJson<AIControlPlaneModelRegistryDto>(apiPaths.settings.models),
    getJson<AIControlPlaneRecommendationDto[]>(apiPaths.settings.blockedActions),
    getJson<AIControlPlaneWorkspaceDto['events']>(apiPaths.settings.events),
    loadSharedContext('settings'),
  ]);

  const policyData = requireReady(policy, 'AI control-plane policy');
  const workspaceData = workspace.status === 'ready' ? workspace.data : undefined;
  const modelRegistry = models.status === 'ready' ? models.data : workspaceData?.modelRegistry;
  const blockedData = blockedActions.status === 'ready' || blockedActions.status === 'empty'
    ? (Array.isArray(blockedActions.data) ? blockedActions.data : [])
    : (workspaceData?.blockedActions ?? []);
  const eventData = events.status === 'ready' && Array.isArray(events.data)
    ? events.data
    : (workspaceData?.events ?? []);
  const recommendationCatalog = workspaceData?.recommendations ?? [];
  const protectedActions = Array.isArray(policyData.protectedActions) ? policyData.protectedActions : [];
  const governanceMapping = Array.isArray(policyData.governanceMapping) ? policyData.governanceMapping : [];
  const expertModules = modelRegistry?.expertModules ?? workspaceData?.expertModules ?? [];

  const contextDegraded = [
    ...(workspace.status === 'error' ? [`AI control plane workspace (${apiPaths.settings.workspace}): ${workspace.message ?? workspace.status}`] : []),
    ...(models.status === 'error' ? [`AI model registry (${apiPaths.settings.models}): ${models.message ?? models.status}`] : []),
    ...(blockedActions.status === 'error' ? [`Blocked actions (${apiPaths.settings.blockedActions}): ${blockedActions.message ?? blockedActions.status}`] : []),
    ...(events.status === 'error' ? [`Governance events (${apiPaths.settings.events}): ${events.message ?? events.status}`] : []),
  ];

  const blockedItems: QueueItem[] = blockedData.slice(0, 6).map((item) => ({
    id: item.recommendationId ?? item.id ?? 'blocked-action',
    title: item.action ?? 'Blocked protected action',
    summary: `${item.target ?? 'unknown target'} — ${item.governorDecision?.reason ?? 'Governor blocked autonomous execution; human approval required.'}`,
    posture: recommendationPosture(item),
    evidence: Array.isArray(item.evidence) ? item.evidence : [],
    actions: [
      settingsAction('Review blocked action', 'blocked-actions', 'Inspect governor-blocked protected action posture.', 'primary'),
      settingsAction('Review policy mapping', 'policy', 'Review protected-action policy and human approval mappings.'),
    ],
  }));

  const policyItems: QueueItem[] = protectedActions.slice(0, 6).map((action, index) => ({
    id: `protected-action-${index + 1}`,
    title: action,
    summary: 'Protected action requiring human approval before backend workflow execution.',
    posture: 'blocked' as const,
    evidence: Array.isArray(policyData.requiredEvidence) ? policyData.requiredEvidence : [],
    actions: [
      settingsAction('Review protected actions', 'policy', 'Review protected-action policy boundaries.', 'primary'),
      settingsAction('Review approval mappings', 'policy', 'Review human approval mappings for protected actions.'),
    ],
  }));

  const modelItems: QueueItem[] = expertModules.slice(0, 4).map((module) => ({
    id: module.id,
    title: module.name,
    summary: `${module.owner} expert module on ${module.modelVersionId}; restricted actions remain governor-blocked.`,
    posture: 'advisory' as const,
    evidence: Array.isArray(module.digitalTwinRefs) ? module.digitalTwinRefs : [],
    actions: [
      settingsAction('Review model registry', 'models', 'Inspect routed expert modules and model versions.'),
      settingsAction('Review feature store', 'models', 'Review feature store lineage and evidence references.'),
    ],
  }));

  const governanceEventItems: QueueItem[] = eventData.slice(0, 4).map((event) => ({
    id: event.id,
    title: event.type,
    summary: `${event.subjectId} governance event at ${event.timestamp}; review-only control-plane telemetry.`,
    posture: 'advisory' as const,
    evidence: Array.isArray(event.evidence) ? event.evidence : [],
    actions: [
      settingsAction('Review governance events', 'governance-events', 'Inspect control-plane governance event stream.'),
      settingsAction('Review policy mapping', 'policy', 'Review framework control mappings tied to governance events.'),
    ],
  }));

  const mappingItems: QueueItem[] = governanceMapping.slice(0, 3).map((mapping, index) => ({
    id: `governance-mapping-${index + 1}`,
    title: mapping.framework,
    summary: `${mapping.controls.length} mapped controls with policy evidence references.`,
    posture: 'advisory' as const,
    evidence: mapping.evidence,
    actions: [
      settingsAction('Review governance mapping', 'policy', 'Review framework control mappings from the AI control-plane policy.'),
      settingsAction('Review required evidence', 'policy', 'Review required evidence references for protected actions.'),
    ],
  }));

  const localAdvisories = [
    ...recommendationCatalog.slice(0, 4).map((item) => ({
      id: item.recommendationId ?? item.id ?? 'settings-advisory',
      recommendation: item.recommendation ?? 'AI recommendation pending review.',
      posture: recommendationPosture(item),
      requiresApproval: item.approvalRequirement?.required !== false,
      actions: [
        settingsAction('Review recommendation queue', 'recommendations', 'Inspect active AI recommendation catalog.'),
        settingsAction('Review policy mapping', 'policy', 'Review protected-action policy boundaries.'),
      ],
    })),
    ...blockedData.slice(0, 4).map(advisoryFromBlockedAction),
  ];

  const posture: OpsPosture = blockedData.length > 0 ? 'blocked' : protectedActions.length ? 'watch' : 'ready';

  const base: ConsolePayload = {
    routeId: 'settings',
    title: 'AI Guardrails',
    mission: 'Review read-only AI guardrails, protected actions, evidence requirements, and human approval mappings.',
    posture,
    postureLabel: blockedData.length > 0 ? 'Governor blocked actions' : 'Advisory-only posture',
    generatedAt: workspaceData?.generatedAt,
    source: policy.source,
    primaryActions: [
      settingsAction('Review protected actions', 'policy', 'Review protected-action policy and human approval mappings.', 'primary'),
      settingsAction('Review blocked actions', 'blocked-actions', 'Inspect governor-blocked protected action attempts.', blockedData.length ? 'critical' : 'secondary'),
      settingsAction('Review model registry', 'models', 'Inspect routed expert modules and model versions.'),
    ],
    lifecycleLanes: settingsGovernanceLanes(recommendationCatalog, blockedData, settingsAction),
    charts: [
      postureBreakdownDonut(
        'settings-blocked-recommendations-donut',
        'Blocked vs recommendations',
        {
          Blocked: blockedData.length,
          Recommendations: recommendationCatalog.length,
        },
        {
          Blocked: 'blocked',
          Recommendations: 'advisory',
        },
        settingsAction('Review blocked actions', 'blocked-actions', 'Inspect governor-blocked protected action attempts.', blockedData.length ? 'critical' : 'secondary'),
      ),
      countBarChart(
        'settings-expert-modules-bar',
        'Expert modules',
        'Routed expert modules in the AI control plane.',
        expertModules.slice(0, 8).map((module) => ({
          id: module.id,
          label: module.name,
          value: module.restrictedActions.length || 1,
          posture: module.restrictedActions.length ? 'watch' : 'advisory',
          detail: module.owner,
        })),
        'restricted',
        settingsAction('Review model registry', 'models', 'Inspect routed expert modules and model versions.'),
      ),
    ],
    queues: [
      {
        id: 'settings-blocked-actions',
        title: 'Governor-blocked actions',
        description: 'Protected action attempts blocked by the AI governor; execution remains backend-governed.',
        items: blockedItems.length ? blockedItems : [{
          id: 'settings-blocked-empty',
          title: 'No blocked actions reported',
          summary: 'Control plane reports no governor-blocked protected action attempts for this scope.',
          posture: 'ready',
          evidence: [apiPaths.settings.blockedActions],
          actions: [settingsAction('Review policy mapping', 'policy', 'Review protected-action policy boundaries.')],
        }],
      },
      {
        id: 'settings-protected-actions',
        title: 'Protected action policy',
        description: 'Actions that require human approval before backend workflow execution.',
        items: policyItems.length ? policyItems : [{
          id: 'settings-policy-empty',
          title: policyData.policyId,
          summary: 'Review advisory-only AI control-plane policy posture.',
          posture: 'advisory',
          evidence: [policyData.policyId],
          actions: [settingsAction('Review policy mapping', 'policy', 'Review protected-action policy boundaries.', 'primary')],
        }],
      },
      {
        id: 'settings-model-registry',
        title: 'Expert modules and models',
        description: 'Routed expert modules, model versions, and feature-store references.',
        items: modelItems.length ? modelItems : [{
          id: 'settings-models-empty',
          title: 'Model registry unavailable',
          summary: 'Model registry metadata is unavailable for this scope; policy review remains available.',
          posture: 'watch',
          evidence: [apiPaths.settings.models],
          actions: [settingsAction('Review policy mapping', 'policy', 'Review protected-action policy boundaries.')],
        }],
      },
      {
        id: 'settings-governance-events',
        title: 'Governance events',
        description: 'Control-plane governance events for review-only operator visibility.',
        items: governanceEventItems.length ? governanceEventItems : mappingItems,
      },
    ],
    metrics: [
      textMetric(
        'Protected execution posture',
        policyData.executionEndpointsAvailable ? 'Declared by API' : 'Unavailable',
        'Protected execution is not exposed from this frontend; draft/evaluate review endpoints are backend-governed.',
        policyData.executionEndpointsAvailable ? 'watch' : 'ready',
      ),
      countMetric('Protected actions', protectedActions.length, 'Actions that require human approval'),
      countMetric('Expert modules', expertModules.length, 'Routed expert modules in the control plane'),
      countMetric('Blocked actions', blockedData.length, 'Governor-blocked protected action attempts', blockedData.length ? 'critical' : 'ready'),
      countMetric('Governance events', eventData.length, 'Control-plane governance events'),
    ],
    advisories: localAdvisories,
    contextDegraded: [...contextDegraded, ...shared.contextDegraded],
  };

  return enrichConsoleWithSharedContext(base, shared, { skipApprovalQueue: true, skipSharedAdvisories: true });
}
