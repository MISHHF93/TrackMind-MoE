from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="TrackMind MoE Expert Agents", version="0.1.0")
DOMAIN_KERNEL_SCHEMA_VERSION = "trackmind.domain-kernel.v1"
DEFAULT_TENANT_ID = "trackmind"
DEFAULT_RACETRACK_ID = "main-track"

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
    "MaintenanceOps",
    "FinanceRevenue",
    "LegalRegulatory",
    "ResponsibleAIGovernor",
    "ExecutiveDecisionSupport",
]

EXPERTS: set[str] = set(ExpertDomain.__args__)  # type: ignore[attr-defined]
KPIDomain = Literal[
    "race-day-operations",
    "equine-welfare",
    "safety-incidents",
    "stewarding",
    "compliance",
    "security",
    "facilities",
    "ticketing",
    "finance",
    "fan-experience",
    "racing-data-hub",
    "multi-track-federation",
    "ai-governance",
    "audit-integrity",
    "approval-workflows",
    "tenant-operations",
    "system-health",
    "data-quality",
    "veterinary-privacy",
    "deployment-readiness",
]
KPITrend = Literal["up", "down", "flat", "insufficient-history"]
KPIStatus = Literal["nominal", "watch", "warning", "critical", "blocked", "readiness-only"]
KPIApprovalSensitivity = Literal["none", "approval-visible", "approval-required-for-threshold-change", "regulated-advisory-only"]
KPI_ALLOWED_USES = {"generate advisory recommendations", "explain KPI drivers", "identify evidence gaps"}
KPI_REQUIRED_PROHIBITED_USES = {"modify KPI values", "execute regulated actions", "bypass human approval", "expose raw cross-track records"}


class AgentRequest(BaseModel):
    request: str = Field(min_length=1, max_length=8192)
    context: dict[str, object] = Field(default_factory=dict)


class ApprovalRequirement(BaseModel):
    required: bool
    policy: str
    requiredApproverRoles: list[str] = Field(default_factory=list)
    requirementId: str | None = None
    workflowId: str | None = None


class AuditReference(BaseModel):
    auditIds: list[str] = Field(default_factory=list)
    eventIds: list[str] = Field(default_factory=list)
    digitalTwinRefs: list[str] = Field(default_factory=list)
    approvalReference: str | None = None
    correlationId: str
    integrityRef: str | None = None


class EvidenceReference(BaseModel):
    evidenceId: str
    kind: Literal["event", "audit", "digital-twin", "telemetry", "approval", "document", "model", "policy"]
    source: str
    uri: str | None = None
    description: str | None = None
    collectedAt: str | None = None


class EvidencePackage(BaseModel):
    evidencePackageId: str
    evidence: list[EvidenceReference] = Field(min_length=1)
    lineage: list[str] = Field(min_length=1)
    hash: str | None = None


class ConfidenceScore(BaseModel):
    raw: float = Field(ge=0.0, le=1.0)
    calibrated: float = Field(ge=0.0, le=1.0)
    band: Literal["low", "medium", "high"]
    drivers: list[str] = Field(min_length=1)


class ExpertRecommendation(BaseModel):
    schemaVersion: Literal["trackmind.domain-kernel.v1"] = DOMAIN_KERNEL_SCHEMA_VERSION
    entityKind: Literal["ai-recommendation"] = "ai-recommendation"
    tenantId: str = DEFAULT_TENANT_ID
    racetrackId: str = DEFAULT_RACETRACK_ID
    domain: str
    recommendationId: str
    confidence: ConfidenceScore
    confidenceValue: float = Field(ge=0.0, le=1.0)
    recommendation: str
    target: dict[str, str] = Field(default_factory=dict)
    evidence: list[str] = Field(min_length=1)
    evidencePackage: EvidencePackage
    modelVersion: str
    generatedAt: str
    riskLevel: Literal["low", "medium", "high", "critical"]
    approvalRequirement: ApprovalRequirement
    auditReference: AuditReference
    requiredApprovals: list[str] = Field(default_factory=list)
    advisoryOnly: Literal[True] = True
    executionAllowed: Literal[False] = False
    blockedAutonomousExecution: Literal[True] = True


class ModelReadableKPIContext(BaseModel):
    kpiId: str = Field(min_length=1)
    domain: KPIDomain
    name: str = Field(min_length=1)
    description: str = Field(min_length=1)
    currentValue: float
    unit: str = Field(min_length=1)
    trend: KPITrend
    status: KPIStatus
    confidence: float = Field(ge=0.0, le=1.0)
    dataQualityScore: float = Field(ge=0.0, le=1.0)
    sourceSummary: str = Field(min_length=1)
    allowedUse: list[str] = Field(min_length=1)
    prohibitedUse: list[str] = Field(min_length=1)
    approvalSensitivity: KPIApprovalSensitivity
    lastCalculatedAt: str = Field(min_length=1)


class KPIContextValidationRequest(BaseModel):
    contexts: list[ModelReadableKPIContext] = Field(default_factory=list, max_length=100)


class KPIContextValidationResponse(BaseModel):
    accepted: bool
    contextCount: int
    allowedUse: list[str]
    prohibitedUse: list[str]
    mutationAllowed: Literal[False]
    regulatedExecutionAllowed: Literal[False]


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
    evidence_refs = [f"expert:{domain}", "stub-response", f"request:{body.request[:64]}"]
    evidence_package_id = f"evidence-package:{recommendation_id}"
    return ExpertRecommendation(
        domain=domain,
        recommendationId=recommendation_id,
        target={"id": f"expert:{domain}", "kind": "ai-recommendation", "tenantId": DEFAULT_TENANT_ID},
        confidence=ConfidenceScore(raw=0.7, calibrated=0.68, band="medium", drivers=["stub-expert", "human-review-required"]),
        confidenceValue=0.68,
        recommendation="Human-reviewed stub recommendation from the requested expert domain.",
        evidence=evidence_refs,
        evidencePackage=EvidencePackage(
            evidencePackageId=evidence_package_id,
            evidence=[
                EvidenceReference(evidenceId=evidence_id, kind="document", source=evidence_id.split(":")[0])
                for evidence_id in evidence_refs
            ],
            lineage=[f"agent-domain:{domain}", "model:trackmind-agent-stub-v0.1.0", "prompt:stub"],
            hash=f"sha256:{recommendation_id}:{'|'.join(evidence_refs)}",
        ),
        modelVersion="trackmind-agent-stub-v0.1.0",
        generatedAt=now_iso(),
        riskLevel="medium",
        approvalRequirement=ApprovalRequirement(required=True, policy="human-review-required", requiredApproverRoles=["human-review"], requirementId=approval_reference),
        auditReference=AuditReference(auditIds=[audit_id], eventIds=[event_id], digitalTwinRefs=[], approvalReference=approval_reference, correlationId=recommendation_id, integrityRef=evidence_package_id),
        requiredApprovals=["human-review"],
    )


@app.post("/kpi-context/validate", response_model=KPIContextValidationResponse)
def validate_kpi_context(body: KPIContextValidationRequest) -> KPIContextValidationResponse:
    for context in body.contexts:
        prohibited_use = set(context.prohibitedUse)
        allowed_use = set(context.allowedUse)
        missing_prohibited_use = KPI_REQUIRED_PROHIBITED_USES.difference(prohibited_use)
        unsafe_allowed_use = KPI_REQUIRED_PROHIBITED_USES.intersection(allowed_use)
        unknown_allowed_use = allowed_use.difference(KPI_ALLOWED_USES)
        if missing_prohibited_use:
            raise HTTPException(status_code=422, detail=f"KPI context missing prohibited uses: {sorted(missing_prohibited_use)}")
        if unsafe_allowed_use:
            raise HTTPException(status_code=422, detail=f"KPI context allowed prohibited uses: {sorted(unsafe_allowed_use)}")
        if unknown_allowed_use:
            raise HTTPException(status_code=422, detail=f"KPI context allowed uses are not governed: {sorted(unknown_allowed_use)}")
    return KPIContextValidationResponse(
        accepted=True,
        contextCount=len(body.contexts),
        allowedUse=sorted(KPI_ALLOWED_USES),
        prohibitedUse=sorted(KPI_REQUIRED_PROHIBITED_USES),
        mutationAllowed=False,
        regulatedExecutionAllowed=False,
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
