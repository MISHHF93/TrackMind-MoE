import type { EquineRequestActor, FilteredHorseProfile, HorseModel } from './types.js';

const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;

export function canEditVeterinary(actor: EquineRequestActor): boolean {
  return actor.role === 'veterinarian';
}

export function canEditEligibility(actor: EquineRequestActor): boolean {
  return actor.role === 'steward';
}

export function assertHorseAccess(horse: HorseModel, actor: EquineRequestActor): void {
  if (actor.role === 'trainer') {
    if (!actor.trainerId || !horse.trainerIds.includes(actor.trainerId)) throw new Error('Trainer can only access assigned horses');
  }
  if (actor.role === 'owner') {
    if (!actor.ownerId || !horse.ownershipHistory.some((owner) => owner.owner_id === actor.ownerId && !owner.ownership_period.to)) throw new Error('Owner can only access owned horses');
  }
}

export function filterHorseProfile(horse: HorseModel, actor: EquineRequestActor): FilteredHorseProfile {
  assertHorseAccess(horse, actor);
  const base = { horseId: horse.identity.horseId, role: actor.role, identity: { horseId: horse.identity.horseId, name: horse.identity.name }, privacy: { scope: actor.role, redactedFields: [] as string[], reason: '' } };
  if (actor.role === 'veterinarian') {
    return {
      ...base,
      identity: clone(horse.identity),
      ownershipHistory: clone(horse.ownershipHistory),
      racingCareer: clone(horse.racingCareer),
      veterinary: clone(horse.veterinary),
      welfare: clone(horse.welfare),
      eligibility: clone(horse.eligibility),
      audit: { available: true, anonymized: false },
      privacy: { scope: actor.role, redactedFields: [], reason: 'Veterinarian has full medical access and may add veterinary records.' },
    };
  }
  if (actor.role === 'steward') {
    return {
      ...base,
      identity: { ...base.identity, registrationNumber: horse.identity.registrationNumber },
      racingCareer: clone(horse.racingCareer),
      veterinary: 'redacted',
      eligibility: { hisaCompliance: horse.eligibility.hisaCompliance, scratchStatus: horse.eligibility.scratchStatus, eligibilityFlags: [...horse.eligibility.eligibilityFlags], raceRestrictions: [...horse.eligibility.raceRestrictions], updatedAt: horse.eligibility.updatedAt },
      audit: { available: true, anonymized: false },
      privacy: { scope: actor.role, redactedFields: ['veterinary.examination_records', 'veterinary.medication_history', 'veterinary.injury_reports.diagnosis'], reason: 'Steward view includes eligibility flags and race restrictions but no medical details.' },
    };
  }
  if (actor.role === 'trainer') {
    return {
      ...base,
      identity: { ...base.identity, microchip: horse.identity.microchip, registrationNumber: horse.identity.registrationNumber },
      racingCareer: clone(horse.racingCareer),
      welfare: { wellnessScores: horse.welfare.wellnessScores.slice(-1), retirementStatus: horse.welfare.retirementStatus, transportLogs: clone(horse.welfare.transportLogs) },
      eligibility: { eligibilityFlags: horse.eligibility.eligibilityFlags.filter((flag) => flag.includes('exam') || flag.includes('trainer-notice')), raceRestrictions: [...horse.eligibility.raceRestrictions], scratchStatus: horse.eligibility.scratchStatus },
      veterinary: 'redacted',
      privacy: { scope: actor.role, redactedFields: ['diagnosis', 'medication_history', 'injury_reports'], reason: 'Trainer sees assigned horse operational notices and required exams only.' },
    };
  }
  if (actor.role === 'owner') {
    return {
      ...base,
      identity: { ...base.identity, breed: horse.identity.breed, registrationNumber: horse.identity.registrationNumber, pedigree: horse.identity.pedigree },
      racingCareer: clone(horse.racingCareer),
      welfare: { wellnessScores: horse.welfare.wellnessScores.slice(-1), retirementStatus: horse.welfare.retirementStatus },
      veterinary: 'redacted',
      privacy: { scope: actor.role, redactedFields: ['diagnosis', 'medication_history', 'injury_reports', 'eligibility.internal-flags'], reason: 'Owner sees basic wellness and competition results without diagnosis.' },
    };
  }
  if (actor.role === 'regulator') {
    return {
      ...base,
      identity: { horseId: horse.identity.horseId, breed: horse.identity.breed },
      racingCareer: { starts: horse.racingCareer.starts, finishes: [], earnings: horse.racingCareer.earnings, classLevels: [...horse.racingCareer.classLevels] },
      veterinary: 'redacted',
      eligibility: { hisaCompliance: horse.eligibility.hisaCompliance, scratchStatus: horse.eligibility.scratchStatus, eligibilityFlags: [...horse.eligibility.eligibilityFlags], updatedAt: horse.eligibility.updatedAt },
      audit: { available: true, anonymized: true },
      privacy: { scope: actor.role, redactedFields: ['name', 'owner identity', 'trainer identity', 'medical detail'], reason: 'Regulator view prioritizes audit log and anonymized aggregates.' },
    };
  }
  return {
    ...base,
    identity: { name: horse.identity.name, breed: horse.identity.breed, pedigree: horse.identity.pedigree },
    racingCareer: clone(horse.racingCareer),
    veterinary: 'redacted',
    privacy: { scope: 'public', redactedFields: ['microchip', 'registrationNumber', 'ownership', 'veterinary', 'eligibility', 'welfare detail'], reason: 'Public view includes name, pedigree, and race history only.' },
  };
}
