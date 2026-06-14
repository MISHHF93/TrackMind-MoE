# Tier 9 Unified Data Model

The Tier 9 Unified Data Model is a metadata contract for how TrackMind Unified Schema and Universal Artifact records move through the eventual data estate. It does not provision databases or claim production persistence. The current implementation exposes canonical descriptors for Data Lake, Feature Store, Knowledge Graph, Digital Twin Graph, Event Store, and Audit Store targets, plus a Universal Artifact storage adapter layer for Event Store, Audit Store, Digital Twin Store, Knowledge Graph, Feature Store, Document Store, and Data Lake targets.

Each descriptor records:

- `storeId` and `storeType`
- tenant and racetrack scope
- source domains and record types
- retention and legal hold posture
- governance controls and access expectations
- event, audit, Digital Twin, AI feature, and AI recommendation lineage links
- runtime facade status with `backingDependency: "none"`

TUS asset and twin views, shared domain entities, feature records, Nexus events, audit ledger entries, approvals, workflows, and AI recommendations all map to at least one canonical store. Universal Artifact descriptors add read-only routing metadata, tenant partition hints, retention hints, privacy/sensitivity flags, compliance mappings, and graph nodes/edges for artifacts without adding write clients or storage execution endpoints. Event and audit lineage remains mandatory for regulated records, Digital Twin lineage is required for stateful operational entities, feature lineage is required for AI feature and recommendation records, document lineage is required for evidence packages, and recommendation lineage is required for AI recommendation entities.

The runtime API exposes this as read-only metadata at `/api/v1/tus/data-model`.
