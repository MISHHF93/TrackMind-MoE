import { normalizeRole, type Role } from '@trackmind/shared';
import { canRoleViewPrivacyScope } from '@trackmind/shared';
import type { EquineRequestActor, FilteredHorseProfile, HorseModel } from './types.js';

const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;

function canonicalRole(actor: EquineRequestActor): Role {
  return normalizeRole(actor.role) ?? 'staff-limited';
}

export function canEditVeterinary(actor: EquineRequestActor): boolean {
  return canonicalRole(actor) === 'veterinarian';
}

export function canEditEligibility(actor: EquineRequestActor): boolean {
  return canonicalRole(actor) === 'steward';
}

export function assertHorseAccess(horse: HorseModel, actor: EquineRequestActor): void {
  const role = canonicalRole(actor);
  const legacyRole = actor.role?.toLowerCase();
  if (legacyRole === 'owner' || (role === 'staff-limited' && actor.ownerId)) {
    if (!actor.ownerId) {
      throw new Error('Owner can only access owned horses');
    }
    if (!horse.ownershipHistory.some((owner) => owner.owner_id === actor.ownerId && !owner.ownership_period.to)) {
      throw new Error('Owner can only access owned horses');
    }
  }
  if (role === 'horse-operations-coordinator') {
    if (!actor.trainerId || !horse.trainerIds.includes(actor.trainerId)) {
      throw new Error('Horse operations coordinator can only access assigned horses');
    }
  }
}

export function filterHorseProfile(horse: HorseModel, actor: EquineRequestActor): FilteredHorseProfile {
  assertHorseAccess(horse, actor);
  const role = canonicalRole(actor);
  const base = { horseId: horse.identity.horseId, role: actor.role, identity: { horseId: horse.identity.horseId, name: horse.identity.name }, privacy: { scope: actor.role, redactedFields: [] as string[], reason: '' } };

  if (role === 'veterinarian' || canRoleViewPrivacyScope(role, 'veterinary-confidential')) {
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
  if (role === 'steward') {
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
  if (role === 'horse-operations-coordinator') {
    return {
      ...base,
      identity: { ...base.identity, microchip: horse.identity.microchip, registrationNumber: horse.identity.registrationNumber },
      racingCareer: clone(horse.racingCareer),
      welfare: { wellnessScores: horse.welfare.wellnessScores.slice(-1), retirementStatus: horse.welfare.retirementStatus, transportLogs: clone(horse.welfare.transportLogs) },
      eligibility: { eligibilityFlags: horse.eligibility.eligibilityFlags.filter((flag) => flag.includes('exam') || flag.includes('trainer-notice')), raceRestrictions: [...horse.eligibility.raceRestrictions], scratchStatus: horse.eligibility.scratchStatus },
      veterinary: 'redacted',
      privacy: { scope: actor.role, redactedFields: ['diagnosis', 'medication_history', 'injury_reports'], reason: 'Horse operations coordinator sees assigned horse operational notices and required exams only.' },
    };
  }
  if (role === 'staff-limited' && actor.ownerId) {
    return {
      ...base,
      identity: { ...base.identity, breed: horse.identity.breed, registrationNumber: horse.identity.registrationNumber, pedigree: horse.identity.pedigree },
      racingCareer: clone(horse.racingCareer),
      welfare: { wellnessScores: horse.welfare.wellnessScores.slice(-1), retirementStatus: horse.welfare.retirementStatus },
      veterinary: 'redacted',
      privacy: { scope: actor.role, redactedFields: ['diagnosis', 'medication_history', 'injury_reports', 'eligibility.internal-flags'], reason: 'Owner sees basic wellness and competition results without diagnosis.' },
    };
  }
  if (role === 'read-only-auditor') {
    return {
      ...base,
      identity: { horseId: horse.identity.horseId, breed: horse.identity.breed },
      racingCareer: { starts: horse.racingCareer.starts, finishes: [], earnings: horse.racingCareer.earnings, classLevels: [...horse.racingCareer.classLevels] },
      veterinary: 'redacted',
      eligibility: { hisaCompliance: horse.eligibility.hisaCompliance, scratchStatus: horse.eligibility.scratchStatus, eligibilityFlags: [...horse.eligibility.eligibilityFlags], updatedAt: horse.eligibility.updatedAt },
      audit: { available: true, anonymized: true },
      privacy: { scope: actor.role, redactedFields: ['name', 'owner identity', 'trainer identity', 'medical detail'], reason: 'Auditor view prioritizes audit log and anonymized aggregates.' },
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
