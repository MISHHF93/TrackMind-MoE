import type { EligibilityStatus, HisaComplianceVerification, HorseModel } from './types.js';

export interface EligibilityDecision {
  eligible: boolean;
  status: EligibilityStatus;
  failedRules: string[];
  warnings: string[];
}

export class EquineEligibilityEngine {
  evaluate(horse: HorseModel, at = new Date().toISOString()): EligibilityDecision {
    const failedRules: string[] = [];
    const warnings: string[] = [];
    const hisa = this.verifyHisaCompliance(horse, at);
    if (!hisa.compliant) failedRules.push(...hisa.failedRules);
    for (const period of horse.eligibility.medicationWithdrawalPeriods) {
      if (!period.cleared) failedRules.push(`withdrawal:${period.medication}`);
    }
    if (horse.eligibility.scratchStatus === 'scratched') failedRules.push('scratch-status');
    if (horse.welfare.retirementStatus !== 'active') failedRules.push('retirement-status');
    if (horse.welfare.wellnessScores.at(-1)?.score !== undefined && horse.welfare.wellnessScores.at(-1)!.score < 70) warnings.push('wellness-watch');
    return {
      eligible: failedRules.length === 0,
      failedRules,
      warnings,
      status: {
        ...horse.eligibility,
        eligibilityFlags: [...new Set([...horse.eligibility.eligibilityFlags, ...failedRules, ...warnings])],
        updatedAt: at,
      },
    };
  }

  requireStewardApproval(input: { approvalId?: string; approverId?: string; approvalTimestamp?: string }): void {
    if (!input.approvalId || !input.approverId || !input.approvalTimestamp) throw new Error('Eligibility changes require steward approval metadata');
  }

  verifyHisaCompliance(horse: HorseModel, at = new Date().toISOString()): HisaComplianceVerification {
    const latestWellness = horse.welfare.wellnessScores.at(-1)?.score;
    const checks = [
      {
        ruleId: 'hisa-registration-status',
        description: 'Horse must have HISA-compliant registration and microchip identity.',
        passed: horse.eligibility.hisaCompliance === 'compliant' && Boolean(horse.identity.registrationNumber && horse.identity.microchip),
        evidenceLinks: [`registration://${horse.identity.registrationNumber}`, `microchip://${horse.identity.microchip}`],
      },
      {
        ruleId: 'hisa-medication-withdrawal-clear',
        description: 'Medication withdrawal periods must have explicit clearance before eligibility changes.',
        passed: horse.eligibility.medicationWithdrawalPeriods.every((period) => period.cleared),
        evidenceLinks: horse.eligibility.medicationWithdrawalPeriods.map((period) => `medication://${period.medication}/withdrawal/${period.withdrawalUntil}`),
      },
      {
        ruleId: 'hisa-not-scratched',
        description: 'Scratched horses are not eligible to start.',
        passed: horse.eligibility.scratchStatus !== 'scratched',
        evidenceLinks: [`scratch-status://${horse.eligibility.scratchStatus}`],
      },
      {
        ruleId: 'hisa-active-welfare-status',
        description: 'Horse must be active with acceptable latest wellness score.',
        passed: horse.welfare.retirementStatus === 'active' && (latestWellness === undefined || latestWellness >= 70),
        evidenceLinks: [`retirement://${horse.welfare.retirementStatus}`, ...(latestWellness === undefined ? [] : [`wellness-score://${latestWellness}`])],
      },
    ];
    const failedRules = checks.filter((check) => !check.passed).map((check) => check.ruleId);
    return {
      horseId: horse.identity.horseId,
      verifiedAt: at,
      compliant: failedRules.length === 0,
      checks,
      failedRules,
      approvalRequiredForEligibilityChange: true,
    };
  }
}
