BEGIN;

INSERT INTO trackmind.dtdl_models (
  model_id,
  entity_type,
  display_name,
  definition,
  created_by,
  approved_by,
  approval_timestamp,
  immutable_hash_chain
) VALUES
  (
    'dtmi:trackmind:Horse;3',
    'Horse',
    'Horse',
    '{"@context":["dtmi:dtdl:context;3"],"@id":"dtmi:trackmind:Horse;3","@type":"Interface","displayName":"Horse","contents":[{"@type":"Property","name":"registered_name","schema":"string"},{"@type":"Property","name":"welfare_status","schema":"string"},{"@type":"Relationship","name":"trainedBy","target":"dtmi:trackmind:Person;3"}]}'::jsonb,
    'seed-loader',
    'chief-steward',
    '2026-06-14T00:00:00Z',
    trackmind.hash_payload('GENESIS', '{"model":"Horse"}'::jsonb, '2026-06-14T00:00:00Z')
  ),
  (
    'dtmi:trackmind:Person;3',
    'Person',
    'Person',
    '{"@context":["dtmi:dtdl:context;3"],"@id":"dtmi:trackmind:Person;3","@type":"Interface","displayName":"Person","contents":[{"@type":"Property","name":"display_name","schema":"string"},{"@type":"Property","name":"roles","schema":{"@type":"Array","elementSchema":"string"}}]}'::jsonb,
    'seed-loader',
    'chief-steward',
    '2026-06-14T00:00:00Z',
    trackmind.hash_payload('GENESIS', '{"model":"Person"}'::jsonb, '2026-06-14T00:00:00Z')
  ),
  (
    'dtmi:trackmind:Racetrack;3',
    'Racetrack',
    'Racetrack',
    '{"@context":["dtmi:dtdl:context;3"],"@id":"dtmi:trackmind:Racetrack;3","@type":"Interface","displayName":"Racetrack","contents":[{"@type":"Property","name":"name","schema":"string"},{"@type":"Property","name":"timezone","schema":"string"}]}'::jsonb,
    'seed-loader',
    'chief-steward',
    '2026-06-14T00:00:00Z',
    trackmind.hash_payload('GENESIS', '{"model":"Racetrack"}'::jsonb, '2026-06-14T00:00:00Z')
  ),
  (
    'dtmi:trackmind:Race;3',
    'Race',
    'Race',
    '{"@context":["dtmi:dtdl:context;3"],"@id":"dtmi:trackmind:Race;3","@type":"Interface","displayName":"Race","contents":[{"@type":"Property","name":"race_number","schema":"integer"},{"@type":"Relationship","name":"heldAt","target":"dtmi:trackmind:Racetrack;3"}]}'::jsonb,
    'seed-loader',
    'chief-steward',
    '2026-06-14T00:00:00Z',
    trackmind.hash_payload('GENESIS', '{"model":"Race"}'::jsonb, '2026-06-14T00:00:00Z')
  ),
  (
    'dtmi:trackmind:Incident;3',
    'Incident',
    'Incident',
    '{"@context":["dtmi:dtdl:context;3"],"@id":"dtmi:trackmind:Incident;3","@type":"Interface","displayName":"Incident","contents":[{"@type":"Property","name":"severity","schema":"string"},{"@type":"Property","name":"status","schema":"string"}]}'::jsonb,
    'seed-loader',
    'chief-steward',
    '2026-06-14T00:00:00Z',
    trackmind.hash_payload('GENESIS', '{"model":"Incident"}'::jsonb, '2026-06-14T00:00:00Z')
  ),
  (
    'dtmi:trackmind:RestrictedZone;3',
    'RestrictedZone',
    'Restricted Zone',
    '{"@context":["dtmi:dtdl:context;3"],"@id":"dtmi:trackmind:RestrictedZone;3","@type":"Interface","displayName":"RestrictedZone","contents":[{"@type":"Property","name":"zone_code","schema":"string"},{"@type":"Property","name":"active","schema":"boolean"}]}'::jsonb,
    'seed-loader',
    'chief-steward',
    '2026-06-14T00:00:00Z',
    trackmind.hash_payload('GENESIS', '{"model":"RestrictedZone"}'::jsonb, '2026-06-14T00:00:00Z')
  ),
  (
    'dtmi:trackmind:Sensor;3',
    'Sensor',
    'Sensor',
    '{"@context":["dtmi:dtdl:context;3"],"@id":"dtmi:trackmind:Sensor;3","@type":"Interface","displayName":"Sensor","contents":[{"@type":"Property","name":"sensor_code","schema":"string"},{"@type":"Property","name":"sensor_type","schema":"string"}]}'::jsonb,
    'seed-loader',
    'chief-steward',
    '2026-06-14T00:00:00Z',
    trackmind.hash_payload('GENESIS', '{"model":"Sensor"}'::jsonb, '2026-06-14T00:00:00Z')
  ),
  (
    'dtmi:trackmind:Camera;3',
    'Camera',
    'Camera',
    '{"@context":["dtmi:dtdl:context;3"],"@id":"dtmi:trackmind:Camera;3","@type":"Interface","displayName":"Camera","contents":[{"@type":"Property","name":"camera_code","schema":"string"},{"@type":"Property","name":"status","schema":"string"}]}'::jsonb,
    'seed-loader',
    'chief-steward',
    '2026-06-14T00:00:00Z',
    trackmind.hash_payload('GENESIS', '{"model":"Camera"}'::jsonb, '2026-06-14T00:00:00Z')
  )
ON CONFLICT (model_id) DO NOTHING;

INSERT INTO trackmind.events(event_id, aggregate_id, event_type, payload, "timestamp", source_service, visibility, created_by, approved_by, approval_timestamp)
VALUES
  ('90000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'racetrack.profile.created.v1', '{"entity_type":"Racetrack","twin_id":"twin:racetrack:demo-park","dtdl_model_id":"dtmi:trackmind:Racetrack;3","state":{"name":"Demo Park","timezone":"America/New_York","commission_name":"Demo Racing Commission","geojson":{"type":"Feature","properties":{"track":"Demo Park"}}}}'::jsonb, '2026-06-14T00:01:00Z', 'seed-service', 'racing-officials', 'seed-loader', 'chief-steward', '2026-06-14T00:01:00Z'),
  ('90000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'person.profile.created.v1', '{"entity_type":"Person","twin_id":"twin:person:casey-trainer","dtdl_model_id":"dtmi:trackmind:Person;3","state":{"display_name":"Casey Trainer","roles":["trainer"],"license_number":"T-100","organization":"Demo Stable","credential_status":"active"}}'::jsonb, '2026-06-14T00:02:00Z', 'seed-service', 'racing-officials', 'seed-loader', 'chief-steward', '2026-06-14T00:02:00Z'),
  ('90000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'person.profile.created.v1', '{"entity_type":"Person","twin_id":"twin:person:alex-rider","dtdl_model_id":"dtmi:trackmind:Person;3","state":{"display_name":"Alex Rider","roles":["jockey"],"license_number":"J-100","organization":"Demo Jockey Guild","credential_status":"active"}}'::jsonb, '2026-06-14T00:03:00Z', 'seed-service', 'racing-officials', 'seed-loader', 'chief-steward', '2026-06-14T00:03:00Z'),
  ('90000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003', 'person.profile.created.v1', '{"entity_type":"Person","twin_id":"twin:person:jordan-steward","dtdl_model_id":"dtmi:trackmind:Person;3","state":{"display_name":"Jordan Steward","roles":["official"],"license_number":"S-100","organization":"Demo Racing Commission","credential_status":"active"}}'::jsonb, '2026-06-14T00:04:00Z', 'seed-service', 'racing-officials', 'seed-loader', 'chief-steward', '2026-06-14T00:04:00Z'),
  ('90000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001', 'horse.profile.created.v1', '{"entity_type":"Horse","twin_id":"twin:horse:safety-first","dtdl_model_id":"dtmi:trackmind:Horse;3","state":{"registered_name":"Safety First","microchip_id":"985141000000001","foaled":"2021-04-01","welfare_status":"active","trainer_twin_id":"twin:person:casey-trainer"}}'::jsonb, '2026-06-14T00:05:00Z', 'seed-service', 'racing-officials', 'seed-loader', 'chief-steward', '2026-06-14T00:05:00Z'),
  ('90000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000001', 'race.card.created.v1', '{"entity_type":"Race","twin_id":"twin:race:demo-park:2026-06-14:1","dtdl_model_id":"dtmi:trackmind:Race;3","state":{"racetrack_twin_id":"twin:racetrack:demo-park","race_number":1,"race_date":"2026-06-14","status":"scheduled","distance_meters":1600}}'::jsonb, '2026-06-14T00:06:00Z', 'seed-service', 'racing-officials', 'seed-loader', 'chief-steward', '2026-06-14T00:06:00Z'),
  ('90000000-0000-0000-0000-000000000007', '50000000-0000-0000-0000-000000000001', 'security.zone.created.v1', '{"entity_type":"RestrictedZone","twin_id":"twin:zone:demo-park:paddock","dtdl_model_id":"dtmi:trackmind:RestrictedZone;3","state":{"racetrack_twin_id":"twin:racetrack:demo-park","zone_code":"PADDOCK","name":"Paddock Restricted Zone","boundary_geojson":{"type":"Polygon","coordinates":[]},"access_policy":{"roles":["official","trainer"],"approvalRequiredForOverride":true},"active":true}}'::jsonb, '2026-06-14T00:07:00Z', 'seed-service', 'racing-officials', 'seed-loader', 'chief-steward', '2026-06-14T00:07:00Z'),
  ('90000000-0000-0000-0000-000000000008', '60000000-0000-0000-0000-000000000001', 'asset.sensor.created.v1', '{"entity_type":"Sensor","twin_id":"twin:sensor:surface-1","dtdl_model_id":"dtmi:trackmind:Sensor;3","state":{"racetrack_twin_id":"twin:racetrack:demo-park","sensor_code":"surface-1","sensor_type":"surface-moisture","location":{"sector":"far-turn"},"status":"online","restricted_zone_twin_id":"twin:zone:demo-park:paddock"}}'::jsonb, '2026-06-14T00:08:00Z', 'seed-service', 'racing-officials', 'seed-loader', 'chief-steward', '2026-06-14T00:08:00Z'),
  ('90000000-0000-0000-0000-000000000009', '70000000-0000-0000-0000-000000000001', 'asset.camera.created.v1', '{"entity_type":"Camera","twin_id":"twin:camera:paddock-1","dtdl_model_id":"dtmi:trackmind:Camera;3","state":{"racetrack_twin_id":"twin:racetrack:demo-park","camera_code":"paddock-1","stream_uri":"rtsp://example.invalid/paddock-1","field_of_view":{"sector":"paddock"},"status":"online","restricted_zone_twin_id":"twin:zone:demo-park:paddock"}}'::jsonb, '2026-06-14T00:09:00Z', 'seed-service', 'racing-officials', 'seed-loader', 'chief-steward', '2026-06-14T00:09:00Z'),
  ('90000000-0000-0000-0000-000000000010', '80000000-0000-0000-0000-000000000001', 'incident.case.reported.v1', '{"entity_type":"Incident","twin_id":"twin:incident:paddock-access-1","dtdl_model_id":"dtmi:trackmind:Incident;3","state":{"racetrack_twin_id":"twin:racetrack:demo-park","race_twin_id":"twin:race:demo-park:2026-06-14:1","restricted_zone_twin_id":"twin:zone:demo-park:paddock","severity":"warning","status":"open","occurred_at":"2026-06-14T00:10:00Z","summary":"Unapproved paddock access attempt detected.","evidence_links":["eventhub://trackmind-events/paddock-access-1","camera://paddock-1/clip-001"]}}'::jsonb, '2026-06-14T00:10:00Z', 'seed-service', 'stewards', 'seed-loader', 'chief-steward', '2026-06-14T00:10:00Z')
ON CONFLICT (event_id) DO NOTHING;

INSERT INTO trackmind.racetracks(aggregate_id, twin_id, name, timezone, commission_name, geojson, created_by, approved_by, approval_timestamp, immutable_hash_chain)
SELECT aggregate_id, twin_id, current_state->>'name', current_state->>'timezone', current_state->>'commission_name', current_state->'geojson', created_by, approved_by, approval_timestamp, immutable_hash_chain
FROM trackmind.digital_twin_projection
WHERE aggregate_id = '10000000-0000-0000-0000-000000000001'
ON CONFLICT (aggregate_id) DO NOTHING;

INSERT INTO trackmind.persons(aggregate_id, twin_id, display_name, roles, license_number, organization, credential_status, created_by, approved_by, approval_timestamp, immutable_hash_chain)
SELECT
  aggregate_id,
  twin_id,
  current_state->>'display_name',
  ARRAY(SELECT jsonb_array_elements_text(current_state->'roles')::trackmind.person_role),
  current_state->>'license_number',
  current_state->>'organization',
  current_state->>'credential_status',
  created_by,
  approved_by,
  approval_timestamp,
  immutable_hash_chain
FROM trackmind.digital_twin_projection
WHERE entity_type = 'Person'
ON CONFLICT (aggregate_id) DO NOTHING;

INSERT INTO trackmind.horses(aggregate_id, twin_id, registered_name, microchip_id, foaled, welfare_status, trainer_aggregate_id, created_by, approved_by, approval_timestamp, immutable_hash_chain)
SELECT h.aggregate_id, h.twin_id, h.current_state->>'registered_name', h.current_state->>'microchip_id', (h.current_state->>'foaled')::date, h.current_state->>'welfare_status', trainer.aggregate_id, h.created_by, h.approved_by, h.approval_timestamp, h.immutable_hash_chain
FROM trackmind.digital_twin_projection h
LEFT JOIN trackmind.digital_twin_projection trainer ON trainer.twin_id = h.current_state->>'trainer_twin_id'
WHERE h.aggregate_id = '30000000-0000-0000-0000-000000000001'
ON CONFLICT (aggregate_id) DO NOTHING;

INSERT INTO trackmind.races(aggregate_id, twin_id, racetrack_aggregate_id, race_number, race_date, status, distance_meters, created_by, approved_by, approval_timestamp, immutable_hash_chain)
SELECT r.aggregate_id, r.twin_id, track.aggregate_id, (r.current_state->>'race_number')::int, (r.current_state->>'race_date')::date, r.current_state->>'status', (r.current_state->>'distance_meters')::int, r.created_by, r.approved_by, r.approval_timestamp, r.immutable_hash_chain
FROM trackmind.digital_twin_projection r
JOIN trackmind.digital_twin_projection track ON track.twin_id = r.current_state->>'racetrack_twin_id'
WHERE r.aggregate_id = '40000000-0000-0000-0000-000000000001'
ON CONFLICT (aggregate_id) DO NOTHING;

INSERT INTO trackmind.restricted_zones(aggregate_id, twin_id, racetrack_aggregate_id, zone_code, name, boundary_geojson, access_policy, active, created_by, approved_by, approval_timestamp, immutable_hash_chain)
SELECT z.aggregate_id, z.twin_id, track.aggregate_id, z.current_state->>'zone_code', z.current_state->>'name', z.current_state->'boundary_geojson', z.current_state->'access_policy', (z.current_state->>'active')::boolean, z.created_by, z.approved_by, z.approval_timestamp, z.immutable_hash_chain
FROM trackmind.digital_twin_projection z
JOIN trackmind.digital_twin_projection track ON track.twin_id = z.current_state->>'racetrack_twin_id'
WHERE z.aggregate_id = '50000000-0000-0000-0000-000000000001'
ON CONFLICT (aggregate_id) DO NOTHING;

INSERT INTO trackmind.sensors(aggregate_id, twin_id, racetrack_aggregate_id, sensor_code, sensor_type, location, status, restricted_zone_aggregate_id, created_by, approved_by, approval_timestamp, immutable_hash_chain)
SELECT s.aggregate_id, s.twin_id, track.aggregate_id, s.current_state->>'sensor_code', s.current_state->>'sensor_type', s.current_state->'location', s.current_state->>'status', zone.aggregate_id, s.created_by, s.approved_by, s.approval_timestamp, s.immutable_hash_chain
FROM trackmind.digital_twin_projection s
JOIN trackmind.digital_twin_projection track ON track.twin_id = s.current_state->>'racetrack_twin_id'
LEFT JOIN trackmind.digital_twin_projection zone ON zone.twin_id = s.current_state->>'restricted_zone_twin_id'
WHERE s.aggregate_id = '60000000-0000-0000-0000-000000000001'
ON CONFLICT (aggregate_id) DO NOTHING;

INSERT INTO trackmind.cameras(aggregate_id, twin_id, racetrack_aggregate_id, camera_code, stream_uri, field_of_view, status, restricted_zone_aggregate_id, created_by, approved_by, approval_timestamp, immutable_hash_chain)
SELECT c.aggregate_id, c.twin_id, track.aggregate_id, c.current_state->>'camera_code', c.current_state->>'stream_uri', c.current_state->'field_of_view', c.current_state->>'status', zone.aggregate_id, c.created_by, c.approved_by, c.approval_timestamp, c.immutable_hash_chain
FROM trackmind.digital_twin_projection c
JOIN trackmind.digital_twin_projection track ON track.twin_id = c.current_state->>'racetrack_twin_id'
LEFT JOIN trackmind.digital_twin_projection zone ON zone.twin_id = c.current_state->>'restricted_zone_twin_id'
WHERE c.aggregate_id = '70000000-0000-0000-0000-000000000001'
ON CONFLICT (aggregate_id) DO NOTHING;

INSERT INTO trackmind.incidents(aggregate_id, twin_id, racetrack_aggregate_id, race_aggregate_id, restricted_zone_aggregate_id, severity, status, occurred_at, summary, evidence_links, created_by, approved_by, approval_timestamp, immutable_hash_chain)
SELECT i.aggregate_id, i.twin_id, track.aggregate_id, race.aggregate_id, zone.aggregate_id, i.current_state->>'severity', i.current_state->>'status', (i.current_state->>'occurred_at')::timestamptz, i.current_state->>'summary', i.current_state->'evidence_links', i.created_by, i.approved_by, i.approval_timestamp, i.immutable_hash_chain
FROM trackmind.digital_twin_projection i
LEFT JOIN trackmind.digital_twin_projection track ON track.twin_id = i.current_state->>'racetrack_twin_id'
LEFT JOIN trackmind.digital_twin_projection race ON race.twin_id = i.current_state->>'race_twin_id'
LEFT JOIN trackmind.digital_twin_projection zone ON zone.twin_id = i.current_state->>'restricted_zone_twin_id'
WHERE i.aggregate_id = '80000000-0000-0000-0000-000000000001'
ON CONFLICT (aggregate_id) DO NOTHING;

INSERT INTO trackmind.approval_required_actions(action_id, aggregate_id, action_type, requested_payload, reason, status, evidence_links, requested_by, created_by, immutable_hash_chain, source_service)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  'restricted-zone-access-policy-change',
  '{"zone_code":"PADDOCK","requestedChange":{"addRole":"emergency-response"},"safeForAutonomousExecution":false}'::jsonb,
  'Restricted zone access policy changes require human approval and evidence review.',
  'pending',
  '["eventhub://trackmind-events/paddock-access-1","camera://paddock-1/clip-001"]'::jsonb,
  'jordan-steward',
  'seed-loader',
  trackmind.hash_payload('GENESIS', '{"approval":"restricted-zone-access-policy-change"}'::jsonb, '2026-06-14T00:11:00Z'),
  'seed-service'
)
ON CONFLICT (action_id) DO NOTHING;

INSERT INTO trackmind.approval_action_events(approval_event_id, action_id, status, actor, decision_reason, evidence_links, created_by, immutable_hash_chain, occurred_at)
VALUES (
  'a1000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'pending',
  'jordan-steward',
  'Queued for human review before restricted zone policy mutation.',
  '["eventhub://trackmind-events/paddock-access-1","camera://paddock-1/clip-001"]'::jsonb,
  'seed-loader',
  trackmind.hash_payload('GENESIS', '{"approval_event":"pending"}'::jsonb, '2026-06-14T00:11:00Z'),
  '2026-06-14T00:11:00Z'
)
ON CONFLICT (approval_event_id) DO NOTHING;

SELECT trackmind.refresh_current_state_views();

COMMIT;
