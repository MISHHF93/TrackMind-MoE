import type { Role } from '@trackmind/shared';
import {
  createPlatformReadAdapter,
  createRaceOperationsService,
  type RaceOperationsService,
} from '@trackmind/race-operations-service';
import { CentralizedApprovalService } from './approvals.js';
import { RaceOperationsPlatform, type RaceTelemetrySignal } from './raceOperationsPlatform.js';

export type { RaceOperationsService };

export function createServiceBackedRaceOperations(timestamp: string): {
  platform: RaceOperationsPlatform;
  service: RaceOperationsService;
  workspace: ReturnType<RaceOperationsService['raceOfficeWorkspace']>;
} {
  const platform = new RaceOperationsPlatform({ approvalService: new CentralizedApprovalService(), tenantId: 'trackmind' });
  const actor = { id: 'racing-secretary-live', roles: ['horse-operations-coordinator'] as Role[], human: true };
  const raceDate = timestamp.slice(0, 10);
  const meet = platform.createMeet({
    id: 'meet-2026',
    name: 'TrackMind Service-Backed Meet',
    trackId: 'main-track',
    startsOn: raceDate,
    endsOn: raceDate,
    status: 'open',
    officialConfig: {
      stewards: ['steward-live'],
      racingSecretary: actor.id,
      commission: 'state-racing-commission',
      rulesVersion: '2026.06',
      scratchDeadlineMinutes: 45,
      maxFieldSize: 14,
    },
  }, actor);
  const day = platform.createRaceDay({
    id: 'day-live',
    meetId: meet.id,
    trackId: meet.trackId,
    raceDate,
    status: 'entries-open',
  }, actor);
  const race = platform.createRaceCard(day.id, {
    id: 'race-7',
    trackId: meet.trackId,
    raceDate,
    raceNumber: 7,
    scheduledPostTime: timestamp,
    conditions: {
      surface: 'dirt',
      distanceFurlongs: 8,
      classLevel: 'Allowance',
      purse: 85000,
      eligibility: ['three-year-olds-and-up'],
      medicationRules: ['HISA medication controls'],
      surfaceRequirements: ['track-superintendent-clearance'],
    },
  }, actor);
  platform.addEntry(race.id, { id: 'entry-rail-runner', horseId: 'horse-1', trainerId: 'trainer-1', ownerId: 'owner-1' }, actor.id);
  platform.addEntry(race.id, { id: 'entry-turn-signal', horseId: 'horse-2', trainerId: 'trainer-2', ownerId: 'owner-2' }, actor.id);
  platform.declareEntry(race.id, 'entry-rail-runner', 'jockey-1', 124, actor.id);
  platform.declareEntry(race.id, 'entry-turn-signal', 'jockey-2', 122, actor.id);
  platform.closeDeclarations(race.id, actor.id);
  platform.drawPostPositions(race.id, 7, actor.id);
  platform.assignGates(race.id, 'G', 'starter-live');
  platform.coordinateStaffing(race.id, {
    stewards: ['steward-live'],
    veterinarians: ['vet-live'],
    gateCrew: ['gate-crew-alpha'],
    outriders: ['outrider-1'],
    trackMaintenance: ['surface-team-alpha'],
    security: ['security-post-1'],
  }, 'operations');
  platform.allocateResources(race.id, [
    { id: 'resource-gate-main', type: 'starting-gate', zone: 'backstretch', status: 'allocated' },
    { id: 'resource-ambulance-eq', type: 'ambulance', zone: 'track', status: 'standby' },
    { id: 'resource-camera-headon', type: 'camera', zone: 'finish', status: 'allocated' },
  ], 'operations');
  const telemetry: RaceTelemetrySignal[] = [
    { streamId: 'gate-status', type: 'gate', observedAt: timestamp, healthy: true, value: 'locked' },
    { streamId: 'surface-condition', type: 'surface', observedAt: timestamp, healthy: true, value: 'good' },
    { streamId: 'weather', type: 'weather', observedAt: timestamp, healthy: true, value: 'clear' },
  ];
  platform.assessReadiness(race.id, telemetry, 'operations');
  const service = createRaceOperationsService({
    readPort: createPlatformReadAdapter(platform),
    tenantId: 'trackmind',
    clock: () => timestamp,
  });
  return { platform, service, workspace: service.raceOfficeWorkspace(timestamp, false) };
}

export function createRaceOperationsServiceFromPlatform(platform: RaceOperationsPlatform, tenantId = 'trackmind') {
  return createRaceOperationsService({
    readPort: createPlatformReadAdapter(platform),
    tenantId,
  });
}
