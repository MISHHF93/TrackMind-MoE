# Data Governance (AI Act Article 10)

## Dataset Provenance

- `surface-readings-v5`: surface telemetry, maintenance logs, and weather observations.
- `rulebook-rag-index`: ARCI, HISA, and local racing commission materials.

## Bias Checks

- Surface section coverage is checked for overrepresentation during wet-condition events.
- Rulebook jurisdiction freshness is reviewed monthly to avoid stale local-rule answers.

## Representativeness

The data governance report at `/api/v1/compliance/data-governance` tracks provenance, bias checks, representativeness notes, and limitations for each dataset used by AI recommendations.
