import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const migrationsDir = resolve(import.meta.dirname, '..', 'db', 'migrations');
const seedsDir = resolve(import.meta.dirname, '..', 'db', 'seeds');
const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
const migrationPattern = /^(\d{3})_[a-z0-9]+(?:_[a-z0-9]+)*\.sql$/;
const seen = new Set();

for (const [index, file] of files.entries()) {
  const match = file.match(migrationPattern);
  if (!match) throw new Error(`Migration filename is not canonical: ${file}`);

  const ordinal = Number(match[1]);
  const expected = index + 1;
  if (seen.has(ordinal)) throw new Error(`Duplicate migration ordinal: ${match[1]}`);
  if (ordinal !== expected) {
    throw new Error(`Migration sequence gap: expected ${String(expected).padStart(3, '0')} but found ${match[1]} in ${file}`);
  }
  seen.add(ordinal);
}

if (files.length === 0) throw new Error('No SQL migrations found.');

const canonicalDatabaseDesign = await readFile(resolve(migrationsDir, '012_canonical_database_design.sql'), 'utf8');
const canonicalAIGovernance = await readFile(resolve(migrationsDir, '013_canonical_ai_governance.sql'), 'utf8');
for (const required of [
  'normalize_canonical_event_storage',
  'digital_twin_projection_scope_twin_idx',
  'racetracks_tenant_racetrack_id_idx',
  'persons_scope_person_id_idx',
  'horses_scope_horse_id_idx',
  'races_scope_race_id_idx',
  'restricted_zones_scope_zone_id_idx',
  'sensors_scope_sensor_id_idx',
  'cameras_scope_camera_id_idx',
  'incidents_scope_incident_id_idx',
  'current_race_state_scope_status_idx',
  'horse_location_history_scope_horse_idx',
  'security_zone_occupancy_scope_observed_idx',
  'kpi_scope_key',
  'approval_required_actions_scope_request_idx',
  'CREATE TABLE IF NOT EXISTS trackmind.race_meets',
  'CREATE TABLE IF NOT EXISTS trackmind.race_days',
  'CREATE TABLE IF NOT EXISTS trackmind.race_entries',
  'CREATE TABLE IF NOT EXISTS trackmind.horse_owner_links',
  'CREATE TABLE IF NOT EXISTS trackmind.horse_veterinarian_links',
  'CREATE TABLE IF NOT EXISTS trackmind.steward_panels',
  'CREATE TABLE IF NOT EXISTS trackmind.barns',
  'CREATE TABLE IF NOT EXISTS trackmind.stalls',
  'CREATE TABLE IF NOT EXISTS trackmind.assets',
]) {
  if (!canonicalDatabaseDesign.includes(required)) {
    throw new Error(`Canonical database design migration is missing required contract: ${required}`);
  }
}

for (const forbidden of [
  /payload->>'raceId'\)::uuid/,
  /payload->>'horseId'\)::uuid/,
  /payload->>'incidentId'\)::uuid/,
  /zone_id text PRIMARY KEY/,
  /race_id uuid PRIMARY KEY/,
]) {
  if (forbidden.test(canonicalDatabaseDesign)) {
    throw new Error(`Canonical database design migration contains forbidden legacy projection pattern: ${forbidden}`);
  }
}

for (const required of [
  'BEGIN;',
  'CREATE TABLE IF NOT EXISTS trackmind.ai_recommendations',
  'CREATE TABLE IF NOT EXISTS trackmind.ai_evidence_packages',
  'CREATE TABLE IF NOT EXISTS trackmind.ai_governor_reviews',
  'CREATE TABLE IF NOT EXISTS trackmind.ai_blocked_execution_logs',
  "CHECK (jsonb_typeof(confidence) = 'object')",
  "CHECK (jsonb_typeof(approval_requirement) = 'object')",
  "CHECK (jsonb_typeof(audit_reference) = 'object')",
  "CHECK (jsonb_array_length(coalesce(audit_reference->'auditIds', '[]'::jsonb)) > 0)",
  "CHECK (jsonb_array_length(coalesce(audit_reference->'eventIds', '[]'::jsonb)) > 0)",
  'advisory_only boolean NOT NULL DEFAULT true CHECK (advisory_only = true)',
  'execution_allowed boolean NOT NULL DEFAULT false CHECK (execution_allowed = false)',
  'blocked_autonomous_execution boolean NOT NULL DEFAULT true CHECK (blocked_autonomous_execution = true)',
  'can_execute boolean NOT NULL DEFAULT false CHECK (can_execute = false)',
  'ai_recommendations_scope_generated_idx',
  'DROP VIEW IF EXISTS trackmind.resticted_zones',
  "INSERT INTO trackmind.schema_migrations(version, description)\nVALUES ('013'",
  'COMMIT;',
]) {
  if (!canonicalAIGovernance.includes(required)) {
    throw new Error(`Canonical AI governance migration is missing required contract: ${required}`);
  }
}

for (const forbidden of [
  /execution_allowed[^\n,;]*DEFAULT true/i,
  /can_execute[^\n,;]*DEFAULT true/i,
  /advisory_only[^\n,;]*DEFAULT false/i,
]) {
  if (forbidden.test(canonicalAIGovernance)) {
    throw new Error(`Canonical AI governance migration contains forbidden autonomous execution pattern: ${forbidden}`);
  }
}

const seed = await readFile(resolve(seedsDir, '001_seed.sql'), 'utf8');
for (const legacyEventType of ['RacetrackCreated', 'PersonCreated', 'HorseCreated', 'RaceCreated', 'RestrictedZoneCreated', 'SensorCreated', 'CameraCreated', 'IncidentCreated']) {
  if (seed.includes(legacyEventType)) {
    throw new Error(`Seed data uses legacy non-canonical event type: ${legacyEventType}`);
  }
}
for (const canonicalEventType of ['racetrack.profile.created.v1', 'person.profile.created.v1', 'horse.profile.created.v1', 'race.card.created.v1', 'security.zone.created.v1', 'asset.sensor.created.v1', 'asset.camera.created.v1', 'incident.case.reported.v1']) {
  if (!seed.includes(canonicalEventType)) {
    throw new Error(`Seed data is missing canonical event type: ${canonicalEventType}`);
  }
}

console.log(`Validated ${files.length} canonical migration file(s) and database design contracts.`);
