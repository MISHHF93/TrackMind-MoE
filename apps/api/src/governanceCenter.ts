export interface GovernanceArtifact { id: string; kind: 'model-version' | 'prompt' | 'recommendation' | 'approval' | 'override' | 'audit-artifact' | 'compliance-control'; actor: string; timestamp: string; evidence: string[] }
export class ResponsibleAIGovernanceCenter {
  private readonly artifacts: GovernanceArtifact[] = [];
  record(artifact: GovernanceArtifact) { this.artifacts.push({ ...artifact, evidence: [...artifact.evidence] }); return artifact; }
  timeline() { return this.artifacts.map((artifact) => ({ ...artifact, evidence: [...artifact.evidence] })).sort((a, b) => a.timestamp.localeCompare(b.timestamp)); }
  byKind(kind: GovernanceArtifact['kind']) { return this.timeline().filter((artifact) => artifact.kind === kind); }
}
