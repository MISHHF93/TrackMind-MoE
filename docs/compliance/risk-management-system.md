# Risk Management System (AI Act Article 9)

## Hazard And Mitigation Matrix

| Hazard ID | Hazard | Severity | Mitigations | Residual Risk |
| --- | --- | --- | --- | --- |
| hazard-autonomous-race-start | AI recommendation could trigger race start without human approval. | Critical | C1 autonomous mutation denial, approval ID required, 120-second approval timer. | Low |
| hazard-vet-privacy-leak | Veterinary records exposed to unauthorized roles. | High | Role-filtered equine view, audit access logs, least-privilege API policy. | Low |
| hazard-uncertain-recommendation | Low-confidence recommendation presented as operationally ready. | High | C6 uncertainty escalation, confidence threshold, request-more-evidence workflow. | Medium |

Risk controls are enforced through `/api/v1/compliance/risk-management` and the Trustworthy Orchestration policy engine.
