CREATE CONSTRAINT horse_id IF NOT EXISTS FOR (h:Horse) REQUIRE h.id IS UNIQUE;
CREATE CONSTRAINT jockey_id IF NOT EXISTS FOR (j:Jockey) REQUIRE j.id IS UNIQUE;
CREATE CONSTRAINT trainer_id IF NOT EXISTS FOR (t:Trainer) REQUIRE t.id IS UNIQUE;
CREATE CONSTRAINT race_id IF NOT EXISTS FOR (r:Race) REQUIRE r.id IS UNIQUE;
CREATE CONSTRAINT steward_id IF NOT EXISTS FOR (s:Steward) REQUIRE s.id IS UNIQUE;
CREATE CONSTRAINT facility_id IF NOT EXISTS FOR (f:Facility) REQUIRE f.id IS UNIQUE;
CREATE CONSTRAINT sensor_id IF NOT EXISTS FOR (s:Sensor) REQUIRE s.id IS UNIQUE;
CREATE CONSTRAINT incident_id IF NOT EXISTS FOR (i:Incident) REQUIRE i.id IS UNIQUE;
CREATE CONSTRAINT regulation_id IF NOT EXISTS FOR (r:Regulation) REQUIRE r.id IS UNIQUE;

// Core relationships:
// (:Horse)-[:TRAINED_BY]->(:Trainer), (:Horse)-[:RIDDEN_BY]->(:Jockey), (:Horse)-[:ENTERED_IN]->(:Race)
// (:Race)-[:HELD_AT]->(:Facility), (:Race)-[:OFFICIATED_BY]->(:Steward), (:Sensor)-[:MONITORS]->(:Facility)
// (:Incident)-[:INVOLVES]->(:Horse|Race|Facility|Sensor), (:Incident)-[:GOVERNED_BY]->(:Regulation)
// (:Steward)-[:ISSUED_DECISION]->(:Incident), (:Regulation)-[:APPLIES_TO]->(:Race|Facility|Incident)
