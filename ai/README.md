# AI and Mixture-of-Experts

TrackMind Nexus uses a governed MoE architecture. The router selects expert agents for safety, stewarding, operations, security, facilities, finance, fan experience, and compliance. Expert outputs are recommendations with evidence and confidence, not autonomous regulated decisions.

## Required artifacts

- Model cards and prompt cards.
- Offline and online evaluation results.
- Policy gate definitions.
- Human approval workflow integration.
- Full audit lineage for recommendations and downstream actions.

## Current artifacts

- `model-cards/surface-advisor-v2.md`
- `prompt-cards/surface-intervention-v4.md`
- `evaluations/surface-advisor-v2-readiness.md`

These files document the current seeded Surface Advisor implementation. They are readiness artifacts for contract, backend, and frontend integration; they are not production certification or evidence of a deployed trained model.
