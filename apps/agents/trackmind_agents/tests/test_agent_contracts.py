from fastapi.testclient import TestClient

from apps.agents.trackmind_agents.main import app


client = TestClient(app)


def test_expert_recommendation_contains_required_governance_metadata():
    response = client.post("/experts/Stewarding", json={"request": "Review paddock incident report"})

    assert response.status_code == 200
    body = response.json()
    assert body["recommendationId"].startswith("rec-")
    assert body["confidence"] == 0.7
    assert body["evidence"]
    assert body["modelVersion"] == "trackmind-agent-stub-v0.1.0"
    assert body["generatedAt"].endswith("Z")
    assert body["approvalRequirement"]["required"] is True
    assert body["approvalRequirement"]["policy"] == "human-review-required"
    assert body["auditReference"]["auditIds"]
    assert body["auditReference"]["eventIds"]
    assert body["auditReference"]["approvalReference"] == body["approvalRequirement"]["requirementId"]
    assert body["requiredApprovals"] == ["human-review"]


def test_unknown_expert_domain_is_rejected():
    response = client.post("/experts/Unknown", json={"request": "Review incident"})

    assert response.status_code == 404


def test_rag_ingest_rejects_unbounded_documents():
    response = client.post(
        "/rag/ingest",
        json={"source_type": "HISA", "title": "x", "text": "x" * 20001},
    )

    assert response.status_code == 422
