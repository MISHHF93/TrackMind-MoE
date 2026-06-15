BEGIN;

LOAD 'age';
SET search_path = ag_catalog, trackmind, public;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ag_catalog.ag_graph WHERE name = 'trackmind_digital_twin') THEN
    PERFORM ag_catalog.create_graph('trackmind_digital_twin');
  END IF;
END;
$$;

RESET search_path;

CREATE TABLE trackmind.age_graph_sync_checkpoint (
  checkpoint_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_name text NOT NULL DEFAULT 'trackmind_digital_twin',
  last_event_id uuid,
  last_synced_at timestamptz,
  created_by text NOT NULL DEFAULT 'system',
  approved_by text,
  approval_timestamp timestamptz,
  immutable_hash_chain text NOT NULL DEFAULT trackmind.hash_payload('', '{"checkpoint":"age_graph_sync"}'::jsonb),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE trackmind.age_graph_sync_checkpoint IS
  'Tracks external or job-driven synchronization from event-sourced PostgreSQL projections into Apache AGE graph trackmind_digital_twin.';

CREATE VIEW trackmind.age_vertex_upsert_statements AS
SELECT
  p.aggregate_id,
  p.twin_id,
  p.entity_type,
  format(
    'MERGE (n:%I {twin_id: %L}) SET n.aggregate_id = %L, n.version = %s, n.state = %L',
    p.entity_type::text,
    p.twin_id,
    p.aggregate_id::text,
    p.version,
    p.current_state::text
  ) AS cypher
FROM trackmind.digital_twin_projection p;

CREATE VIEW trackmind.age_relationship_upsert_statements AS
SELECT
  h.aggregate_id AS source_aggregate_id,
  h.trainer_aggregate_id AS target_aggregate_id,
  'TRAINED_BY' AS relationship_type,
  format(
    'MATCH (h:Horse {twin_id: %L}), (p:Person {twin_id: %L}) MERGE (h)-[:TRAINED_BY]->(p)',
    h.twin_id,
    p.twin_id
  ) AS cypher
FROM trackmind.horses h
JOIN trackmind.persons p ON p.aggregate_id = h.trainer_aggregate_id
WHERE h.trainer_aggregate_id IS NOT NULL
UNION ALL
SELECT
  r.aggregate_id,
  rt.aggregate_id,
  'HELD_AT',
  format(
    'MATCH (race:Race {twin_id: %L}), (track:Racetrack {twin_id: %L}) MERGE (race)-[:HELD_AT]->(track)',
    r.twin_id,
    rt.twin_id
  )
FROM trackmind.races r
JOIN trackmind.racetracks rt ON rt.aggregate_id = r.racetrack_aggregate_id
UNION ALL
SELECT
  i.aggregate_id,
  rz.aggregate_id,
  'OCCURRED_IN',
  format(
    'MATCH (incident:Incident {twin_id: %L}), (zone:RestrictedZone {twin_id: %L}) MERGE (incident)-[:OCCURRED_IN]->(zone)',
    i.twin_id,
    rz.twin_id
  )
FROM trackmind.incidents i
JOIN trackmind.restricted_zones rz ON rz.aggregate_id = i.restricted_zone_aggregate_id
WHERE i.restricted_zone_aggregate_id IS NOT NULL
UNION ALL
SELECT
  s.aggregate_id,
  rz.aggregate_id,
  'MONITORS',
  format(
    'MATCH (sensor:Sensor {twin_id: %L}), (zone:RestrictedZone {twin_id: %L}) MERGE (sensor)-[:MONITORS]->(zone)',
    s.twin_id,
    rz.twin_id
  )
FROM trackmind.sensors s
JOIN trackmind.restricted_zones rz ON rz.aggregate_id = s.restricted_zone_aggregate_id
WHERE s.restricted_zone_aggregate_id IS NOT NULL
UNION ALL
SELECT
  c.aggregate_id,
  rz.aggregate_id,
  'OBSERVES',
  format(
    'MATCH (camera:Camera {twin_id: %L}), (zone:RestrictedZone {twin_id: %L}) MERGE (camera)-[:OBSERVES]->(zone)',
    c.twin_id,
    rz.twin_id
  )
FROM trackmind.cameras c
JOIN trackmind.restricted_zones rz ON rz.aggregate_id = c.restricted_zone_aggregate_id
WHERE c.restricted_zone_aggregate_id IS NOT NULL;

CREATE TRIGGER age_graph_sync_checkpoint_immutable
BEFORE UPDATE OR DELETE ON trackmind.age_graph_sync_checkpoint
FOR EACH ROW EXECUTE FUNCTION trackmind.prevent_update_or_delete();

INSERT INTO trackmind.schema_migrations(version, description)
VALUES ('003', 'Apache AGE graph bootstrap and Cypher synchronization views')
ON CONFLICT (version) DO NOTHING;

COMMIT;
