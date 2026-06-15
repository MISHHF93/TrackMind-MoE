from fastapi.testclient import TestClient

from apps.agents.trackmind_agents.main import app


client = TestClient(app)


def test_expert_recommendation_contains_required_governance_metadata():
    response = client.post("/experts/Stewarding", json={"request": "Review paddock incident report"})

    assert response.status_code == 200
    body = response.json()
    assert body["schemaVersion"] == "trackmind.domain-kernel.v1"
    assert body["entityKind"] == "ai-recommendation"
    assert body["tenantId"] == "trackmind"
    assert body["racetrackId"] == "main-track"
    assert body["recommendationId"].startswith("rec-")
    assert body["confidence"]["raw"] == 0.7
    assert body["confidence"]["calibrated"] == body["confidenceValue"]
    assert body["confidence"]["band"] == "medium"
    assert body["target"]["tenantId"] == body["tenantId"]
    assert body["evidence"]
    assert body["evidencePackage"]["evidencePackageId"].startswith("evidence-package:")
    assert body["evidencePackage"]["evidence"]
    assert body["modelVersion"] == "trackmind-agent-stub-v0.1.0"
    assert body["generatedAt"].endswith("Z")
    assert body["riskLevel"] == "medium"
    assert body["approvalRequirement"]["required"] is True
    assert body["approvalRequirement"]["policy"] == "human-review-required"
    assert body["approvalRequirement"]["requiredApproverRoles"] == ["human-review"]
    assert body["auditReference"]["auditIds"]
    assert body["auditReference"]["eventIds"]
    assert body["auditReference"]["approvalReference"] == body["approvalRequirement"]["requirementId"]
    assert body["auditReference"]["correlationId"] == body["recommendationId"]
    assert body["requiredApprovals"] == ["human-review"]
    assert body["advisoryOnly"] is True
    assert body["executionAllowed"] is False
    assert body["blockedAutonomousExecution"] is True


def test_unknown_expert_domain_is_rejected():
    response = client.post("/experts/Unknown", json={"request": "Review incident"})

    assert response.status_code == 404


def test_kpi_context_export_is_metadata_only_for_agents():
    context = {
        "kpiId": "kpi-race-day-operations",
        "domain": "race-day-operations",
        "name": "Race-day readiness score",
        "description": "Readiness score derived from governed event metadata.",
        "currentValue": 87,
        "unit": "score",
        "trend": "flat",
        "status": "watch",
        "confidence": 0.82,
        "dataQualityScore": 0.79,
        "sourceSummary": "2 event refs; 1 entity refs; deterministic seeded facade calculation",
        "allowedUse": ["generate advisory recommendations"],
        "prohibitedUse": ["modify KPI values", "execute regulated actions", "bypass human approval", "expose raw cross-track records"],
        "approvalSensitivity": "regulated-advisory-only",
        "lastCalculatedAt": "2026-06-15T05:00:00.000Z",
    }

    response = client.post("/kpi-context/validate", json={"contexts": [context]})

    assert response.status_code == 200
    body = response.json()
    assert body["accepted"] is True
    assert body["contextCount"] == 1
    assert body["mutationAllowed"] is False
    assert body["regulatedExecutionAllowed"] is False
    assert "modify KPI values" in body["prohibitedUse"]
    assert "execute regulated actions" in body["prohibitedUse"]
    assert "expose raw cross-track records" in body["prohibitedUse"]


def test_kpi_context_rejects_missing_execution_guardrails():
    context = {
        "kpiId": "kpi-race-day-operations",
        "domain": "race-day-operations",
        "name": "Race-day readiness score",
        "description": "Unsafe context",
        "currentValue": 87,
        "unit": "score",
        "trend": "flat",
        "status": "watch",
        "confidence": 0.82,
        "dataQualityScore": 0.79,
        "sourceSummary": "source refs",
        "allowedUse": ["generate advisory recommendations"],
        "prohibitedUse": ["modify KPI values"],
        "approvalSensitivity": "regulated-advisory-only",
        "lastCalculatedAt": "2026-06-15T05:00:00.000Z",
    }

    response = client.post("/kpi-context/validate", json={"contexts": [context]})

    assert response.status_code == 422


def test_kpi_context_rejects_allowed_protected_actions():
    context = {
        "kpiId": "kpi-race-day-operations",
        "domain": "race-day-operations",
        "name": "Race-day readiness score",
        "description": "Unsafe context",
        "currentValue": 87,
        "unit": "score",
        "trend": "flat",
        "status": "watch",
        "confidence": 0.82,
        "dataQualityScore": 0.79,
        "sourceSummary": "source refs",
        "allowedUse": ["generate advisory recommendations", "execute regulated actions"],
        "prohibitedUse": ["modify KPI values", "execute regulated actions", "bypass human approval", "expose raw cross-track records"],
        "approvalSensitivity": "regulated-advisory-only",
        "lastCalculatedAt": "2026-06-15T05:00:00.000Z",
    }

    response = client.post("/kpi-context/validate", json={"contexts": [context]})

    assert response.status_code == 422


def test_rag_ingest_rejects_unbounded_documents():
    response = client.post(
        "/rag/ingest",
        json={"source_type": "HISA", "title": "x", "text": "x" * 20001},
    )

    assert response.status_code == 422
