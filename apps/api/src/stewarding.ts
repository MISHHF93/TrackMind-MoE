export interface StewardInquiry {
  id: string;
  raceId: string;
  openedAt: string;
  objections: string[];
  videoClips: Array<{ uri: string; startTimecode: string; endTimecode: string }>;
  involvedHorses: string[];
  ruleReferences: Array<{ rulebook: string; section: string; citation: string }>;
  stewardNotes: string[];
  decisionDraft?: string;
  finalDecision?: string;
  appealPackageUrl?: string;
}

export function exportAppealPackage(inquiry: StewardInquiry) {
  return {
    inquiryId: inquiry.id,
    raceId: inquiry.raceId,
    generatedAt: new Date().toISOString(),
    contents: {
      videoClips: inquiry.videoClips,
      ruleReferences: inquiry.ruleReferences,
      notes: inquiry.stewardNotes,
      decisionDraft: inquiry.decisionDraft,
      finalDecision: inquiry.finalDecision,
    },
  };
}
