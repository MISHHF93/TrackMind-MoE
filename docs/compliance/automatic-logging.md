# Automatic Logging (AI Act Article 12)

Every AI recommendation must log:

- `model_id`
- inference timestamp
- action and target
- confidence
- evidence links
- human-readable rationale
- machine-readable JSON payload

The report is exposed at `/api/v1/compliance/automatic-logging` and backed by an immutable audit chain.
