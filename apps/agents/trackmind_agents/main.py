from typing import Literal

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
    request: str = Field(min_length=1)
    context: dict = Field(default_factory=dict)


class RulebookDocument(BaseModel):
    source_type: Literal["HISA", "ARCI", "local-commission", "track-SOP", "emergency-plan", "internal-policy"]
    title: str
    text: str


class RulebookQuestion(BaseModel):
    question: str
    documents: list[RulebookDocument] = Field(default_factory=list)


@app.post("/experts/{domain}")
def expert(domain: str, body: AgentRequest):
    if domain not in EXPERTS:
        raise HTTPException(status_code=404, detail="unknown expert")
    return {
        "domain": domain,
        "confidence": 0.7,
        "recommendation": "Human-reviewed stub recommendation from the requested expert domain.",
        "evidence": [f"expert:{domain}", "stub-response"],
        "requiredApprovals": [],
    }


@app.post("/rag/ingest")
def rag_ingest(document: RulebookDocument):
    return {"accepted": True, "sourceType": document.source_type, "title": document.title, "characters": len(document.text)}


@app.post("/rag/answer")
def rag_answer(body: RulebookQuestion):
    if not body.documents:
        return {"answer": "insufficient evidence", "citations": [], "reason": "No rulebook documents were supplied."}
    citations = [{"sourceType": doc.source_type, "title": doc.title, "quote": doc.text[:160]} for doc in body.documents[:3]]
    return {"answer": "citation-required placeholder answer; verify with human compliance owner", "citations": citations}
