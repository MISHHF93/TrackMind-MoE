from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="TrackMind MoE Expert Agents", version="0.1.0")

ExpertDomain = Literal[
    "RaceOps",
    "Stewarding",
    "EquineSafety",
    "VetCompliance",
    "TrackSurface",
    "WeatherEnvironment",
    "WageringIntegrity",
    "TicketingFanExperience",
    "SecuritySOC",
    "FacilitiesIoT",
    "FinanceRevenue",
    "LegalRegulatory",
    "ResponsibleAIGovernor",
]

EXPERTS: set[str] = set(ExpertDomain.__args__)  # type: ignore[attr-defined]


class AgentRequest(BaseModel):
    request: str = Field(min_length=1, max_length=8192)
    context: dict[str, object] = Field(default_factory=dict)


class ApprovalRequirement(BaseModel):
    required: bool
    policy: str
    requirementId: str | None = None
    workflowId: str | None = None


class AuditReference(BaseModel):
    auditIds: list[str] = Field(default_factory=list)
    eventIds: list[str] = Field(default_factory=list)
    digitalTwinRefs: list[str] = Field(default_factory=list)
    approvalReference: str | None = None


class ExpertRecommendation(BaseModel):
    domain: str
    recommendationId: str
    confidence: float = Field(ge=0.0, le=1.0)
    recommendation: str
    evidence: list[str] = Field(min_length=1)
    modelVersion: str
    generatedAt: str
    approvalRequirement: ApprovalRequirement
    auditReference: AuditReference
    requiredApprovals: list[str] = Field(default_factory=list)


class RulebookDocument(BaseModel):
    source_type: Literal["HISA", "ARCI", "local-commission", "track-SOP", "emergency-plan", "internal-policy"]
    title: str = Field(min_length=1, max_length=256)
    text: str = Field(min_length=1, max_length=20000)


class RulebookQuestion(BaseModel):
    question: str = Field(min_length=1, max_length=4096)
    documents: list[RulebookDocument] = Field(default_factory=list, max_length=10)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@app.post("/experts/{domain}", response_model=ExpertRecommendation)
def expert(domain: str, body: AgentRequest) -> ExpertRecommendation:
    if domain not in EXPERTS:
        raise HTTPException(status_code=404, detail="unknown expert")
    recommendation_id = f"rec-{uuid4()}"
    audit_id = f"audit-{uuid4()}"
    event_id = f"event-{uuid4()}"
    approval_reference = f"approval-required-{recommendation_id}"
    return ExpertRecommendation(
        domain=domain,
        recommendationId=recommendation_id,
        confidence=0.7,
        recommendation="Human-reviewed stub recommendation from the requested expert domain.",
        evidence=[f"expert:{domain}", "stub-response", f"request:{body.request[:64]}"],
        modelVersion="trackmind-agent-stub-v0.1.0",
        generatedAt=now_iso(),
        approvalRequirement=ApprovalRequirement(required=True, policy="human-review-required", requirementId=approval_reference),
        auditReference=AuditReference(auditIds=[audit_id], eventIds=[event_id], digitalTwinRefs=[], approvalReference=approval_reference),
        requiredApprovals=["human-review"],
    )


@app.post("/rag/ingest")
def rag_ingest(document: RulebookDocument) -> dict[str, object]:
    return {"accepted": True, "sourceType": document.source_type, "title": document.title, "characters": len(document.text)}


@app.post("/rag/answer")
def rag_answer(body: RulebookQuestion) -> dict[str, object]:
    if not body.documents:
        return {"answer": "insufficient evidence", "citations": [], "reason": "No rulebook documents were supplied."}
    citations = [{"sourceType": doc.source_type, "title": doc.title, "quote": doc.text[:160]} for doc in body.documents[:3]]
    return {"answer": "citation-required placeholder answer; verify with human compliance owner", "citations": citations}
