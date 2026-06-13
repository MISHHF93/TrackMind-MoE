export type EmergencyScenario =
  | 'severe-weather'
  | 'medical-emergency'
  | 'fire-incident'
  | 'infrastructure-failure'
  | 'evacuation'
  | 'security-incident'
  | 'business-continuity'
  | 'disaster-recovery';

export type IncidentSeverity = 'watch' | 'minor' | 'major' | 'critical';

export interface OperationalSystemLink {
  system: string;
  status: 'online' | 'degraded' | 'offline';
  dataFeeds: string[];
}

export interface DigitalTwinImpact {
  assetId: string;
  zone: string;
  risk: IncidentSeverity;
  dependencies?: string[];
}

export interface EmergencyIncidentInput {
  id: string;
  scenario: EmergencyScenario;
  severity: IncidentSeverity;
  location: string;
  reportedAt: string;
  affectedAssets: DigitalTwinImpact[];
  systems: OperationalSystemLink[];
  populationAtRisk?: number;
}

export interface ContinuityPlan {
  id: string;
  name: string;
  criticalProcesses: string[];
  recoveryTimeObjectiveMinutes: number;
  recoveryPointObjectiveMinutes: number;
  alternateSites: string[];
  manualWorkarounds: string[];
}

const commandByScenario: Record<EmergencyScenario, string> = {
  'severe-weather': 'incident-commander-weather-ops',
  'medical-emergency': 'medical-branch-director',
  'fire-incident': 'fire-safety-incident-commander',
  'infrastructure-failure': 'facilities-branch-director',
  evacuation: 'public-safety-incident-commander',
  'security-incident': 'security-operations-commander',
  'business-continuity': 'continuity-manager',
  'disaster-recovery': 'technology-recovery-lead',
};

const workflowByScenario: Record<EmergencyScenario, string[]> = {
  'severe-weather': ['monitor nws alerts', 'pause exposed operations', 'shelter horses and guests', 'inspect surface', 'resume by approval'],
  'medical-emergency': ['triage patient', 'dispatch ems and veterinarian if needed', 'secure access lane', 'document treatment', 'family or owner notification'],
  'fire-incident': ['activate alarm', 'dispatch fire brigade', 'isolate utilities', 'evacuate affected zone', 'all-clear inspection'],
  'infrastructure-failure': ['isolate failed asset', 'switch to redundant service', 'dispatch maintenance', 'validate life safety systems', 'restore normal operations'],
  evacuation: ['open evacuation routes', 'stage transportation', 'account for people and horses', 'communicate assembly areas', 'controlled re-entry'],
  'security-incident': ['lock down affected zone', 'notify law enforcement', 'preserve evidence', 'screen access points', 'return to normal posture'],
  'business-continuity': ['activate continuity team', 'prioritize critical processes', 'move to alternate work mode', 'track service levels', 'demobilize'],
  'disaster-recovery': ['declare dr event', 'restore priority platforms', 'validate data integrity', 'fail back services', 'complete recovery report'],
};

export class EmergencyOperationsPlatform {
  private incidents = new Map<string, EmergencyIncidentInput>();
  private plans = new Map<string, ContinuityPlan>();

  registerContinuityPlan(plan: ContinuityPlan) {
    this.plans.set(plan.id, plan);
    return { ...plan, tested: false, governance: ['ISO 22301', 'NIMS/ICS', 'local emergency action plan'] };
  }

  openIncident(input: EmergencyIncidentInput) {
    this.incidents.set(input.id, input);
    const offlineSystems = input.systems.filter((system) => system.status !== 'online').map((system) => system.system);
    return {
      incidentId: input.id,
      scenario: input.scenario,
      severity: input.severity,
      incidentCommander: commandByScenario[input.scenario],
      commandStructure: ['incident commander', 'safety officer', 'public information officer', 'operations', 'planning', 'logistics', 'finance/admin'],
      workflows: workflowByScenario[input.scenario],
      communicationChannels: ['mass-notification', 'radio-ops', 'executive-briefing', 'public-address', 'regulator-update'],
      integratedSystems: input.systems.map((system) => system.system),
      degradedSystems: offlineSystems,
      twinImpactMap: input.affectedAssets,
      evacuationRequired: input.scenario === 'evacuation' || input.severity === 'critical' || (input.populationAtRisk ?? 0) > 500,
      resourceRequests: this.resourcePlan(input),
    };
  }

  runSimulationExercise(id: string, scenario: EmergencyScenario, participants: string[]) {
    return {
      id,
      scenario,
      participants,
      injects: workflowByScenario[scenario].map((step, index) => ({ minute: index * 10, prompt: step })),
      successCriteria: ['notifications under 5 minutes', 'asset status reconciled with digital twin', 'command log complete', 'recovery objectives met'],
    };
  }

  afterActionReport(incidentId: string, observations: Array<{ finding: string; severity: IncidentSeverity; owner: string }>) {
    const incident = this.incidents.get(incidentId);
    if (!incident) throw new Error(`Unknown incident: ${incidentId}`);
    return {
      incidentId,
      scenario: incident.scenario,
      timelineEntries: workflowByScenario[incident.scenario].length,
      findings: observations,
      correctiveActions: observations.map((observation, index) => ({ id: `${incidentId}-ca-${index + 1}`, owner: observation.owner, action: `Resolve: ${observation.finding}`, dueDays: observation.severity === 'critical' ? 7 : 30 })),
      evidencePackage: ['command-log', 'communications-transcript', 'digital-twin-state-history', 'resource-ledger'],
    };
  }

  continuityStatus() {
    return [...this.plans.values()].map((plan) => ({ planId: plan.id, name: plan.name, criticalProcesses: plan.criticalProcesses.length, rtoMinutes: plan.recoveryTimeObjectiveMinutes, rpoMinutes: plan.recoveryPointObjectiveMinutes, ready: plan.alternateSites.length > 0 && plan.manualWorkarounds.length > 0 }));
  }

  private resourcePlan(input: EmergencyIncidentInput) {
    const base = ['incident command post', 'first-aid kits', 'radios', 'access-control staff'];
    const scenarioResources: Record<EmergencyScenario, string[]> = {
      'severe-weather': ['weather radar feed', 'surface inspection crew', 'shelter capacity'],
      'medical-emergency': ['ems unit', 'veterinary response', 'stretcher cart'],
      'fire-incident': ['fire extinguishers', 'utility shutoff team', 'mutual-aid fire department'],
      'infrastructure-failure': ['generator', 'maintenance crew', 'spare parts cache'],
      evacuation: ['buses', 'horse transport', 'assembly-area marshals'],
      'security-incident': ['law enforcement liaison', 'camera review team', 'perimeter barriers'],
      'business-continuity': ['alternate workspace', 'manual forms', 'vendor contact bridge'],
      'disaster-recovery': ['backup restore team', 'clean-room credentials', 'network failover'],
    };
    return [...base, ...scenarioResources[input.scenario]];
  }
}

export function buildEmergencyOperationsBlueprint(systems: OperationalSystemLink[], assets: DigitalTwinImpact[]) {
  return {
    supportedScenarios: Object.keys(commandByScenario) as EmergencyScenario[],
    operationalIntegrations: systems.map((system) => ({ ...system, monitored: true })),
    digitalTwinAssets: assets,
    minimumCapabilities: ['incident command', 'resource management', 'communications', 'evacuation routing', 'continuity planning', 'disaster recovery', 'simulation exercises', 'after-action reporting'],
  };
}
