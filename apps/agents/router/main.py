from __future__ import annotations

import asyncio
import json
import math
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

try:  # Optional dependency. Health reports degraded when unavailable.
    from sentence_transformers import SentenceTransformer  # type: ignore
except Exception:  # pragma: no cover - depends on runtime image
    SentenceTransformer = None  # type: ignore

try:
    from transformers import pipeline as hf_pipeline  # type: ignore
except Exception:  # pragma: no cover - depends on runtime image
    hf_pipeline = None  # type: ignore

try:
    from rapidfuzz import fuzz  # type: ignore
except Exception:  # pragma: no cover - depends on runtime image
    fuzz = None  # type: ignore

try:
    from litellm import acompletion  # type: ignore
except Exception:  # pragma: no cover - depends on runtime image
    acompletion = None  # type: ignore

try:
    import onnxruntime as ort  # type: ignore
except Exception:  # pragma: no cover - depends on runtime image
    ort = None  # type: ignore

try:
    import yaml  # type: ignore
except Exception:  # pragma: no cover - depends on runtime image
    yaml = None  # type: ignore

try:
    from .phase_router import RUST_AVAILABLE as PHASE_ROUTER_NATIVE
    from .phase_router import load_imbalance, phase_topk, should_phase_route, uniform_dispatch
except Exception:  # pragma: no cover - defensive import path
    PHASE_ROUTER_NATIVE = False
    load_imbalance = None  # type: ignore
    phase_topk = None  # type: ignore
    should_phase_route = None  # type: ignore
    uniform_dispatch = None  # type: ignore

from .cascade_router import CascadeRouterConfig, CascadingMoERouter, ExpertUtilizationMonitor, UtilizationHealth
from .expert_parallel import ExpertParallelConfig, ExpertParallelDispatcher


APP_DIR = Path(__file__).resolve().parent
CONFIG_PATH = APP_DIR / "config.json"
POLICY_DIR = APP_DIR / "policies"

DomainId = Literal[
    "stewarding",
    "veterinary",
    "security",
    "ticketing",
    "finance",
    "racing_operations",
    "responsible_ai_governor",
]

BackendType = Literal["external_litellm", "ollama", "onnx"]


MessageRole = Literal["system", "developer", "user", "assistant", "tool"]
MessageContent = str | list[dict[str, Any]] | None


class ChatMessage(BaseModel):
    role: MessageRole = "user"
    content: MessageContent


class ChatCompletionMetadata(BaseModel):
    approval_token: str | None = Field(default=None, max_length=512)
    evidence_links: list[str] = Field(default_factory=list, max_length=20)
    approved_by: str | None = Field(default=None, max_length=128)
    approval_timestamp: str | None = Field(default=None, max_length=64)
    approval_verified: bool = False
    candidate_domains: list[DomainId] = Field(default_factory=list, max_length=7)


class ChatCompletionRequest(BaseModel):
    model: str | None = None
    messages: list[ChatMessage] = Field(min_length=1, max_length=32)
    temperature: float = Field(default=0.2, ge=0.0, le=2.0)
    stream: bool = False
    metadata: ChatCompletionMetadata = Field(default_factory=ChatCompletionMetadata)


class ClassifyRequest(BaseModel):
    request: str = Field(min_length=1, max_length=8192)
    context: dict[str, Any] = Field(default_factory=dict)
    candidate_domains: list[DomainId] = Field(default_factory=list, max_length=7)
    approval_token: str | None = Field(default=None, max_length=512)
    evidence_links: list[str] = Field(default_factory=list, max_length=20)


class RouteCandidate(BaseModel):
    expert: str
    confidence: float
    tier: str
    reason: str


class ComplianceDecision(BaseModel):
    requires_human_approval: bool
    blocked: bool
    escalation_required: bool
    escalation_reason: str | None = None
    policy_ids: list[str] = Field(default_factory=list)
    symbolic_violations: list[str] = Field(default_factory=list)
    uncertainty: dict[str, Any] = Field(default_factory=dict)


class ClassifyResponse(BaseModel):
    expert: str
    backend: str
    confidence: float
    tier: str
    candidates: list[RouteCandidate]
    compliance: ComplianceDecision
    degraded_components: list[str] = Field(default_factory=list)
    router_health: dict[str, Any] = Field(default_factory=dict)


class ChatCompletionResponseMessage(BaseModel):
    role: Literal["assistant"] = "assistant"
    content: str


class ChatCompletionChoice(BaseModel):
    index: int
    message: ChatCompletionResponseMessage
    finish_reason: str


class ChatCompletionUsage(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ChatCompletionResponse(BaseModel):
    id: str
    object: Literal["chat.completion"]
    created: int
    model: str
    choices: list[ChatCompletionChoice]
    usage: ChatCompletionUsage
    router: ClassifyResponse


@dataclass
class ComponentState:
    status: Literal["healthy", "degraded", "unavailable"] = "healthy"
    detail: str = "ok"


@dataclass
class RouterRuntime:
    config: dict[str, Any]
    policies: list[dict[str, Any]]
    components: dict[str, ComponentState] = field(default_factory=dict)
    embedding_model: Any = None
    classifier_model: Any = None
    semantic_vectors: dict[str, list[list[float]]] = field(default_factory=dict)
    onnx_sessions: dict[str, Any] = field(default_factory=dict)
    expert_loads: dict[str, int] = field(default_factory=dict)
    expert_utilization_monitor: ExpertUtilizationMonitor | None = None


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


DEFAULT_POLICIES: list[dict[str, Any]] = [
    {
        "id": "criterion-1-human-governance",
        "criterion": 1,
        "name": "Human Governance",
        "requires_human_approval_for_risk": ["high", "critical"],
        "high_risk_action_keywords": [
            "start race",
            "open gate",
            "override steward",
            "dispatch emergency",
            "release restricted zone",
            "refund payout",
            "change odds",
            "mutate digital twin",
        ],
    },
    {
        "id": "criterion-5-symbolic-validation",
        "criterion": 5,
        "name": "Symbolic-Subsymbolic Integration",
        "forbidden_autonomous_actions": [
            "open starting gate",
            "approve disqualification",
            "administer medication",
            "dispatch law enforcement",
            "issue payout",
            "unlock restricted zone",
        ],
    },
    {
        "id": "criterion-6-epistemic-prudence",
        "criterion": 6,
        "name": "Epistemic Prudence",
        "min_confidence": 0.58,
        "min_margin": 0.08,
    },
]


def load_policies() -> tuple[list[dict[str, Any]], ComponentState]:
    policies: list[dict[str, Any]] = []
    if yaml is None:
        return DEFAULT_POLICIES, ComponentState("degraded", "PyYAML unavailable; using built-in mandatory policies")
    try:
        for path in sorted(POLICY_DIR.glob("*.yaml")):
            with path.open("r", encoding="utf-8") as handle:
                document = yaml.safe_load(handle) or {}
            if isinstance(document, dict):
                policies.append(document)
        return (policies or DEFAULT_POLICIES), ComponentState("healthy", f"loaded {len(policies or DEFAULT_POLICIES)} policies")
    except Exception as exc:  # pragma: no cover - defensive startup path
        return DEFAULT_POLICIES, ComponentState("degraded", f"policy load failed: {exc}")


def create_runtime() -> RouterRuntime:
    config = load_json(CONFIG_PATH)
    policies, policy_state = load_policies()
    components = {
        "semantic_embedding": ComponentState(
            "healthy" if SentenceTransformer else "degraded",
            "sentence-transformers available" if SentenceTransformer else "sentence-transformers unavailable",
        ),
        "ml_classifier": ComponentState(
            "healthy" if hf_pipeline else "degraded",
            "transformers pipeline available" if hf_pipeline else "transformers unavailable",
        ),
        "keyword_fallback": ComponentState(
            "healthy" if fuzz else "degraded",
            "RapidFuzz available" if fuzz else "RapidFuzz unavailable; using substring scorer",
        ),
        "policy_engine": policy_state,
        "litellm": ComponentState("healthy" if acompletion else "degraded", "LiteLLM available" if acompletion else "LiteLLM unavailable"),
        "onnxruntime": ComponentState("healthy" if ort else "degraded", "ONNX Runtime available" if ort else "ONNX Runtime unavailable"),
        "phase_router": ComponentState(
            "healthy" if phase_topk and uniform_dispatch else "degraded",
            "Rust native phase router available" if PHASE_ROUTER_NATIVE else "Python phase router fallback active",
        ),
        "learned_router": ComponentState("healthy", "learned top-k router base with auxiliary load-balancing loss configured"),
        "rmoe_gru_router": ComponentState("healthy", "recurrent MoE GRU fallback configured"),
        "sinkhorn_router": ComponentState("healthy", "Sinkhorn balancing fallback configured for collapse recovery"),
        "expert_parallel": ComponentState("healthy", "expert parallel all-to-all dispatcher configured with local simulation fallback"),
    }
    runtime = RouterRuntime(config=config, policies=policies, components=components)
    runtime.expert_loads = {expert_id: 0 for expert_id in config.get("experts", {})}
    monitor_config = config.get("router", {}).get("utilization_monitor", {})
    runtime.expert_utilization_monitor = ExpertUtilizationMonitor(
        list(config.get("experts", {})),
        collapse_fraction=float(monitor_config.get("collapse_fraction", 0.65)),
        min_active_fraction=float(monitor_config.get("min_active_fraction", 0.5)),
        min_observations=int(monitor_config.get("min_observations", 8)),
        window_size=int(monitor_config.get("window_size", 256)),
    )
    return runtime


runtime = create_runtime()
app = FastAPI(title="TrackMind MoE Agent Router", version="0.1.0")


def content_to_text(content: MessageContent) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    parts: list[str] = []
    for item in content:
        if not isinstance(item, dict):
            continue
        if item.get("type") == "text" and isinstance(item.get("text"), str):
            parts.append(item["text"])
        elif isinstance(item.get("content"), str):
            parts.append(item["content"])
    return "\n".join(parts)


def latest_user_text(messages: list[ChatMessage]) -> str:
    for message in reversed(messages):
        if message.role == "user":
            return content_to_text(message.content)
    return content_to_text(messages[-1].content)


def normalize_vector(vector: Any) -> list[float]:
    if hasattr(vector, "tolist"):
        vector = vector.tolist()
    return [float(value) for value in vector]


def cosine(a: list[float], b: list[float]) -> float:
    numerator = sum(x * y for x, y in zip(a, b))
    denom_a = math.sqrt(sum(x * x for x in a))
    denom_b = math.sqrt(sum(y * y for y in b))
    if denom_a == 0 or denom_b == 0:
        return 0.0
    return max(0.0, min(1.0, numerator / (denom_a * denom_b)))


async def ensure_embedding_model() -> Any:
    if runtime.embedding_model is not None:
        return runtime.embedding_model
    if SentenceTransformer is None:
        raise RuntimeError("sentence-transformers is unavailable")
    model_name = runtime.config["router"]["semantic_model"]
    runtime.embedding_model = await asyncio.to_thread(SentenceTransformer, model_name)
    return runtime.embedding_model


async def semantic_candidates(text: str, allowed_domains: set[str]) -> list[RouteCandidate]:
    model = await ensure_embedding_model()
    examples_by_domain = {
        expert_id: expert.get("routing_examples", [])
        for expert_id, expert in runtime.config["experts"].items()
        if not allowed_domains or expert_id in allowed_domains
    }
    for expert_id, examples in examples_by_domain.items():
        if expert_id not in runtime.semantic_vectors:
            vectors = await asyncio.to_thread(model.encode, examples)
            runtime.semantic_vectors[expert_id] = [normalize_vector(vector) for vector in vectors]

    query_vector = normalize_vector((await asyncio.to_thread(model.encode, [text]))[0])
    candidates: list[RouteCandidate] = []
    for expert_id, vectors in runtime.semantic_vectors.items():
        if allowed_domains and expert_id not in allowed_domains:
            continue
        if not vectors:
            continue
        score = max(cosine(query_vector, vector) for vector in vectors)
        candidates.append(RouteCandidate(expert=expert_id, confidence=score, tier="semantic_embedding", reason="multi-vector all-MiniLM-L6-v2 similarity"))
    return sorted(candidates, key=lambda item: item.confidence, reverse=True)


async def ensure_classifier_model() -> Any:
    if runtime.classifier_model is not None:
        return runtime.classifier_model
    if hf_pipeline is None:
        raise RuntimeError("transformers is unavailable")
    classifier_config = runtime.config["router"]["classifier"]
    runtime.classifier_model = await asyncio.to_thread(
        hf_pipeline,
        "text-classification",
        model=classifier_config["model"],
        top_k=None,
    )
    return runtime.classifier_model


async def classifier_candidates(text: str, allowed_domains: set[str]) -> list[RouteCandidate]:
    model = await ensure_classifier_model()
    labels = runtime.config["router"]["classifier"].get("label_map", {})
    raw_result = await asyncio.to_thread(model, text)
    rows = raw_result[0] if raw_result and isinstance(raw_result[0], list) else raw_result
    candidates: list[RouteCandidate] = []
    for row in rows:
        expert_id = labels.get(row.get("label"), str(row.get("label", "")).lower())
        if allowed_domains and expert_id not in allowed_domains:
            continue
        if expert_id in runtime.config["experts"]:
            candidates.append(RouteCandidate(expert=expert_id, confidence=float(row.get("score", 0.0)), tier="ml_classifier", reason="fine-tuned racing-domain BERT classifier"))
    return sorted(candidates, key=lambda item: item.confidence, reverse=True)


def simple_keyword_score(text: str, keyword: str) -> float:
    text_lower = text.lower()
    keyword_lower = keyword.lower()
    if keyword_lower in text_lower:
        return 1.0
    text_terms = set(text_lower.replace("-", " ").split())
    keyword_terms = set(keyword_lower.replace("-", " ").split())
    if not keyword_terms:
        return 0.0
    return len(text_terms.intersection(keyword_terms)) / len(keyword_terms)


def keyword_candidates(text: str, allowed_domains: set[str]) -> list[RouteCandidate]:
    candidates: list[RouteCandidate] = []
    for expert_id, expert in runtime.config["experts"].items():
        if allowed_domains and expert_id not in allowed_domains:
            continue
        keywords = expert.get("keywords", [])
        if fuzz:
            score = max((fuzz.token_set_ratio(text, keyword) / 100 for keyword in keywords), default=0.0)
        else:
            score = max((simple_keyword_score(text, keyword) for keyword in keywords), default=0.0)
        candidates.append(RouteCandidate(expert=expert_id, confidence=float(score), tier="keyword_fallback", reason="RapidFuzz domain keyword dictionary" if fuzz else "substring keyword dictionary"))
    return sorted(candidates, key=lambda item: item.confidence, reverse=True)


def detect_high_risk(text: str, expert_id: str) -> tuple[bool, list[str]]:
    text_lower = text.lower()
    matches: list[str] = []
    for policy in runtime.policies:
        for keyword in policy.get("high_risk_action_keywords", []):
            if keyword.lower() in text_lower:
                matches.append(f"{policy.get('id')}:{keyword}")
    expert = runtime.config["experts"].get(expert_id, {})
    if expert.get("risk_level") in {"high", "critical"}:
        matches.append(f"expert-risk:{expert_id}:{expert.get('risk_level')}")
    return bool(matches), matches


def symbolic_violations(text: str) -> list[str]:
    text_lower = text.lower()
    violations: list[str] = []
    for policy in runtime.policies:
        for action in policy.get("forbidden_autonomous_actions", []):
            if action.lower() in text_lower:
                violations.append(f"{policy.get('id')}:{action}")
    return violations


def uncertainty_policy(candidates: list[RouteCandidate]) -> dict[str, Any]:
    prudence_policy = next((policy for policy in runtime.policies if policy.get("criterion") == 6), {})
    min_confidence = float(prudence_policy.get("min_confidence", runtime.config["router"].get("uncertainty_threshold", 0.58)))
    min_margin = float(prudence_policy.get("min_margin", 0.08))
    top = candidates[0].confidence if candidates else 0.0
    second = candidates[1].confidence if len(candidates) > 1 else 0.0
    return {
        "confidence": top,
        "runner_up_confidence": second,
        "margin": top - second,
        "min_confidence": min_confidence,
        "min_margin": min_margin,
        "uncertain": top < min_confidence or (len(candidates) > 1 and top - second < min_margin),
    }


def phase_router_config() -> dict[str, Any]:
    return runtime.config.get("router", {}).get("phase_router", {})


def learned_router_config() -> dict[str, Any]:
    return runtime.config.get("router", {}).get("learned_router", {})


def cascade_router_config() -> dict[str, Any]:
    return runtime.config.get("router", {}).get("cascade_router", {})


def utilization_monitor_config() -> dict[str, Any]:
    return runtime.config.get("router", {}).get("utilization_monitor", {})


def expert_parallel_config() -> dict[str, Any]:
    return runtime.config.get("router", {}).get("expert_parallel", {})


def candidate_score_row(candidates: list[RouteCandidate], expert_order: list[str]) -> list[float]:
    scores_by_expert = {candidate.expert: candidate.confidence for candidate in candidates}
    return [float(scores_by_expert.get(expert_id, 0.0)) for expert_id in expert_order]


def health_to_dict(health_state: UtilizationHealth) -> dict[str, Any]:
    return {
        "total_assignments": health_state.total_assignments,
        "expert_loads": health_state.expert_loads,
        "active_expert_fraction": round(health_state.active_expert_fraction, 4),
        "max_expert_fraction": round(health_state.max_expert_fraction, 4),
        "entropy": round(health_state.entropy, 4),
        "normalized_entropy": round(health_state.normalized_entropy, 4),
        "collapsed": health_state.collapsed,
        "reason": health_state.reason,
    }


def adjusted_cascade_scores(candidates: list[RouteCandidate], expert_order: list[str], utilization: UtilizationHealth) -> list[list[float]]:
    row = candidate_score_row(candidates, expert_order)
    if not utilization.collapsed or utilization.total_assignments <= 0:
        return [row]
    adjusted: list[float] = []
    for expert_id, score in zip(expert_order, row):
        load_fraction = utilization.expert_loads.get(expert_id, 0) / utilization.total_assignments
        adjusted.append(max(0.0, float(score) - load_fraction))
    if any(value > 0 for value in adjusted):
        return [adjusted]
    inverse_load = [
        1.0 - (utilization.expert_loads.get(expert_id, 0) / utilization.total_assignments)
        for expert_id in expert_order
    ]
    if any(value > 0 for value in inverse_load):
        return [inverse_load]
    return [row]


def maybe_cascade_route(candidates: list[RouteCandidate], selected: RouteCandidate, allowed_domains: set[str]) -> tuple[RouteCandidate, dict[str, Any]]:
    config = cascade_router_config()
    if not config.get("enabled", True):
        health_state = runtime.expert_utilization_monitor.health(runtime.expert_loads) if runtime.expert_utilization_monitor else UtilizationHealth(0, {}, 0.0, 0.0, 0.0, 1.0, False, "disabled")
        return selected, {"tier": "disabled", "utilization": health_to_dict(health_state)}

    expert_order = [
        expert_id
        for expert_id in runtime.config["experts"]
        if not allowed_domains or expert_id in allowed_domains
    ]
    if len(expert_order) < 2:
        health_state = runtime.expert_utilization_monitor.health(runtime.expert_loads) if runtime.expert_utilization_monitor else UtilizationHealth(0, {}, 0.0, 0.0, 0.0, 1.0, False, "insufficient experts")
        return selected, {"tier": "disabled", "utilization": health_to_dict(health_state)}

    monitor = runtime.expert_utilization_monitor or ExpertUtilizationMonitor(expert_order)
    health_state = monitor.health(runtime.expert_loads)
    feature_rows = adjusted_cascade_scores(candidates, expert_order, health_state)
    cascade = CascadingMoERouter(
        CascadeRouterConfig(
            n_features=len(expert_order),
            expert_ids=expert_order,
            top_k=min(int(config.get("top_k", 1)), len(expert_order)),
            primary_confidence_threshold=float(config.get("primary_confidence_threshold", 0.45)),
            secondary_confidence_threshold=float(config.get("secondary_confidence_threshold", 0.34)),
            primary_aux_loss_threshold=float(config.get("primary_aux_loss_threshold", 1.25)),
            sinkhorn_iterations=int(config.get("sinkhorn_iterations", 16)),
        ),
        monitor=monitor,
    )
    result = cascade.route(feature_rows, sequence=feature_rows, extra_loads=runtime.expert_loads, record_utilization=False)
    assigned_expert = result.assignments[0][0] if result.assignments and result.assignments[0] else selected.expert
    confidence = next((candidate.confidence for candidate in candidates if candidate.expert == assigned_expert), max(result.confidence, default=selected.confidence))
    candidate = RouteCandidate(
        expert=assigned_expert,
        confidence=confidence,
        tier=result.tier,
        reason=result.reason,
    )
    return candidate, {
        "tier": result.tier,
        "reason": result.reason,
        "loads": result.loads,
        "confidence": result.confidence,
        "utilization": health_to_dict(result.utilization or health_state),
    }


def maybe_phase_route(candidates: list[RouteCandidate], selected: RouteCandidate, allowed_domains: set[str]) -> tuple[RouteCandidate, dict[str, Any] | None]:
    config = phase_router_config()
    if not config.get("enabled", True) or phase_topk is None or should_phase_route is None or load_imbalance is None:
        return selected, None

    expert_order = [
        expert_id
        for expert_id in runtime.config["experts"]
        if not allowed_domains or expert_id in allowed_domains
    ]
    if len(expert_order) < 2:
        return selected, None

    loads = [runtime.expert_loads.get(expert_id, 0) for expert_id in expert_order]
    threshold = int(config.get("imbalance_threshold", 2))
    if not should_phase_route(loads, threshold=threshold):
        return selected, None

    n_tokens = max(int(config.get("n_tokens", 8192)), 1)
    k = min(int(config.get("k", 2)), len(expert_order))
    base_density = float(config.get("base_density", 0.3))
    row = candidate_score_row(candidates, expert_order)
    if not any(score > 0 for score in row):
        return selected, None
    scores = [row[:] for _ in range(n_tokens)]
    result = phase_topk(scores, k=k, base_density=base_density)
    token_index = sum(loads) % n_tokens
    assigned_indices = result["assignments"][token_index]
    assigned_expert = next((expert_order[index] for index in assigned_indices if index < len(expert_order)), selected.expert)
    assigned_score = next((candidate.confidence for candidate in candidates if candidate.expert == assigned_expert), selected.confidence)
    phase_candidate = RouteCandidate(
        expert=assigned_expert,
        confidence=assigned_score,
        tier="phase_topk",
        reason=f"phase routing fallback after load imbalance {load_imbalance(loads)}",
    )
    result["expert_order"] = expert_order
    result["token_index"] = token_index
    result["prior_loads"] = dict(zip(expert_order, loads))
    return phase_candidate, result


def record_expert_load(expert_id: str) -> None:
    runtime.expert_loads[expert_id] = runtime.expert_loads.get(expert_id, 0) + 1


def validate_approval_token(approval_token: str | None, evidence_links: list[str], context: dict[str, Any]) -> bool:
    # Until the central approval service verifier is wired into the router,
    # caller-supplied approval metadata is not enough to unlock protected work.
    return False


def evaluate_compliance(text: str, expert_id: str, candidates: list[RouteCandidate], approval_token: str | None, evidence_links: list[str], context: dict[str, Any]) -> ComplianceDecision:
    high_risk, risk_matches = detect_high_risk(text, expert_id)
    violations = symbolic_violations(text)
    uncertainty = uncertainty_policy(candidates)
    requires_approval = high_risk or bool(violations)
    has_approval = validate_approval_token(approval_token, evidence_links, context)
    escalation_required = bool(uncertainty["uncertain"])
    policy_ids = sorted({str(policy.get("id")) for policy in runtime.policies if policy.get("id")})
    return ComplianceDecision(
        requires_human_approval=requires_approval,
        blocked=(requires_approval and not has_approval) or bool(violations),
        escalation_required=escalation_required,
        escalation_reason="uncertain routing confidence or narrow domain margin" if escalation_required else None,
        policy_ids=policy_ids,
        symbolic_violations=violations + risk_matches,
        uncertainty=uncertainty,
    )


async def classify_request(body: ClassifyRequest) -> ClassifyResponse:
    allowed_domains = set(body.candidate_domains)
    degraded: list[str] = []
    threshold_semantic = float(runtime.config["router"].get("semantic_threshold", 0.62))
    threshold_classifier = float(runtime.config["router"].get("classifier_threshold", 0.52))

    candidates: list[RouteCandidate] = []
    try:
        candidates = await semantic_candidates(body.request, allowed_domains)
    except Exception as exc:
        runtime.components["semantic_embedding"] = ComponentState("degraded", str(exc))
        degraded.append("semantic_embedding")

    if not candidates or candidates[0].confidence < threshold_semantic:
        try:
            classifier = await classifier_candidates(body.request, allowed_domains)
            if classifier and (not candidates or classifier[0].confidence >= threshold_classifier):
                candidates = classifier + [candidate for candidate in candidates if candidate.expert != classifier[0].expert]
        except Exception as exc:
            runtime.components["ml_classifier"] = ComponentState("degraded", str(exc))
            degraded.append("ml_classifier")

    if not candidates or candidates[0].confidence < threshold_classifier:
        fallback = keyword_candidates(body.request, allowed_domains)
        candidates = fallback + [candidate for candidate in candidates if candidate.expert not in {item.expert for item in fallback}]

    candidates = sorted(candidates, key=lambda item: item.confidence, reverse=True)
    selected = candidates[0] if candidates else RouteCandidate(expert="responsible_ai_governor", confidence=0.0, tier="keyword_fallback", reason="no routing signal")
    selected, cascade_health = maybe_cascade_route(candidates, selected, allowed_domains)
    if cascade_health.get("tier") != "sinkhorn":
        selected, phase_result = maybe_phase_route(candidates, selected, allowed_domains)
    else:
        phase_result = None
    if phase_result:
        candidates = [selected] + [candidate for candidate in candidates if candidate.expert != selected.expert]
    elif selected.expert not in {candidate.expert for candidate in candidates[:1]}:
        candidates = [selected] + [candidate for candidate in candidates if candidate.expert != selected.expert]
    if uncertainty_policy(candidates)["uncertain"] and runtime.config["router"].get("escalate_uncertain_to_governor", True):
        selected = RouteCandidate(
            expert="responsible_ai_governor",
            confidence=selected.confidence,
            tier=selected.tier,
            reason=f"epistemic prudence escalation from {selected.expert}",
        )

    compliance = evaluate_compliance(body.request, selected.expert, candidates, body.approval_token, body.evidence_links, body.context)
    expert = runtime.config["experts"][selected.expert]
    record_expert_load(selected.expert)
    return ClassifyResponse(
        expert=selected.expert,
        backend=expert["backend"],
        confidence=round(selected.confidence, 4),
        tier=selected.tier,
        candidates=candidates[:5],
        compliance=compliance,
        degraded_components=sorted(set(degraded)),
        router_health={
            "cascade": cascade_health,
            "phase_router_applied": bool(phase_result),
            "phase_router": phase_result,
        },
    )


async def call_litellm_backend(expert: dict[str, Any], messages: list[ChatMessage], temperature: float) -> str:
    if acompletion is None:
        return "LiteLLM backend is configured but unavailable in this runtime. Human review is required before relying on this response."
    response = await acompletion(
        model=expert["model"],
        messages=[{"role": message.role, "content": message.content} for message in messages],
        temperature=temperature,
    )
    return response["choices"][0]["message"]["content"]


def post_json(url: str, payload: dict[str, Any], timeout: float) -> dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers={"content-type": "application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310 - operator-configured local Ollama endpoint
        return json.loads(response.read().decode("utf-8"))


async def call_ollama_backend(expert: dict[str, Any], messages: list[ChatMessage]) -> str:
    endpoint = expert.get("endpoint", "http://127.0.0.1:11434")
    payload = {
        "model": expert["model"],
        "messages": [message.dict() for message in messages],
        "stream": False,
    }
    try:
        response = await asyncio.to_thread(post_json, f"{endpoint.rstrip('/')}/api/chat", payload, float(expert.get("timeout_seconds", 15)))
        return response.get("message", {}).get("content", "Ollama returned no message content.")
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        return f"Ollama backend unavailable or degraded: {exc}. Escalate to human rulebook reviewer."


async def call_onnx_backend(expert: dict[str, Any], prompt: str) -> str:
    if ort is None:
        return "ONNX expert selected, but ONNX Runtime is unavailable. Escalate specialized task to human operator."
    model_path = expert.get("model_path")
    if not model_path:
        return "ONNX expert selected, but no model_path is configured."
    if model_path not in runtime.onnx_sessions:
        runtime.onnx_sessions[model_path] = await asyncio.to_thread(ort.InferenceSession, model_path)
    return f"ONNX expert {expert.get('id', 'custom')} is ready for specialized inference. Prompt length={len(prompt)}."


async def invoke_expert(route: ClassifyResponse, messages: list[ChatMessage], temperature: float) -> str:
    expert = runtime.config["experts"][route.expert]
    backend_type: BackendType = expert["backend_type"]
    if backend_type == "external_litellm":
        return await call_litellm_backend(expert, messages, temperature)
    if backend_type == "ollama":
        return await call_ollama_backend(expert, messages)
    if backend_type == "onnx":
        return await call_onnx_backend(expert, latest_user_text(messages))
    return "No supported backend type configured for selected expert."


def chat_completion_response(model: str, content: str, route: ClassifyResponse) -> dict[str, Any]:
    now = int(time.time())
    return {
        "id": f"chatcmpl-trackmind-{uuid4()}",
        "object": "chat.completion",
        "created": now,
        "model": model,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": content,
                },
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        },
        "router": route.dict(),
    }


def openai_error_response(status_code: int, message: str, code: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"message": message, "type": "invalid_request_error" if status_code < 500 else "service_error", "code": code}},
    )


@app.post("/router/classify", response_model=ClassifyResponse)
async def classify_endpoint(body: ClassifyRequest) -> ClassifyResponse:
    return await classify_request(body)


@app.post("/v1/chat/completions", response_model=ChatCompletionResponse)
async def chat_completions(body: ChatCompletionRequest) -> dict[str, Any] | JSONResponse:
    if body.stream:
        return openai_error_response(400, "stream=true is not supported by this router yet", "stream_not_supported")
    prompt = latest_user_text(body.messages)
    route = await classify_request(
        ClassifyRequest(
            request=prompt,
            context=body.metadata.dict(),
            candidate_domains=body.metadata.candidate_domains,
            approval_token=body.metadata.approval_token,
            evidence_links=body.metadata.evidence_links,
        )
    )
    model = body.model or runtime.config["experts"][route.expert]["model"]
    if route.compliance.blocked:
        content = (
            "HITL approval gate required. The router blocked autonomous execution because the request is high-risk, "
            "symbolically disallowed, or lacks approval evidence. Submit approval_token and evidence_links metadata "
            "after human governance review."
        )
        return chat_completion_response(model, content, route)
    if route.compliance.escalation_required:
        governance_message = ChatMessage(
            role="system",
            content="Epistemic prudence escalation: answer conservatively, cite uncertainty, and recommend human review.",
        )
        try:
            content = await invoke_expert(route, [governance_message, *body.messages], body.temperature)
        except Exception as exc:  # pragma: no cover - backend dependent
            return openai_error_response(503, f"Expert backend unavailable: {exc}", "backend_unavailable")
        return chat_completion_response(model, content, route)
    try:
        content = await invoke_expert(route, body.messages, body.temperature)
    except Exception as exc:  # pragma: no cover - backend dependent
        return openai_error_response(503, f"Expert backend unavailable: {exc}", "backend_unavailable")
    return chat_completion_response(model, content, route)


@app.get("/health")
def health() -> dict[str, Any]:
    backends: dict[str, Any] = {}
    for expert_id, expert in runtime.config["experts"].items():
        backend_type = expert.get("backend_type")
        if backend_type == "external_litellm":
            status = "healthy" if acompletion else "degraded"
            detail = "LiteLLM wrapper available" if acompletion else "LiteLLM package unavailable"
        elif backend_type == "ollama":
            status = "unknown"
            detail = f"Ollama endpoint configured at {expert.get('endpoint')}"
        elif backend_type == "onnx":
            status = "healthy" if ort else "degraded"
            detail = "ONNX Runtime available" if ort else "ONNX Runtime package unavailable"
        else:
            status = "degraded"
            detail = "unsupported backend type"
        backends[expert_id] = {"backend_type": backend_type, "status": status, "detail": detail}

    components = {name: state.__dict__ for name, state in runtime.components.items()}
    degraded = [
        name
        for name, state in runtime.components.items()
        if state.status in {"degraded", "unavailable"}
    ]
    expert_ids = list(runtime.config["experts"])
    utilization = (
        runtime.expert_utilization_monitor.health(runtime.expert_loads)
        if runtime.expert_utilization_monitor
        else UtilizationHealth(0, {}, 0.0, 0.0, 0.0, 1.0, False, "monitor unavailable")
    )
    ep_config = expert_parallel_config()
    parallel_plan = ExpertParallelDispatcher(
        ExpertParallelConfig(
            expert_ids=expert_ids,
            world_size=max(1, int(ep_config.get("world_size", 1))),
            local_rank=int(ep_config.get("local_rank", 0)),
            backend=str(ep_config.get("backend", "nccl")),
            enable_distributed=bool(ep_config.get("enable_distributed", True)),
        )
    ).plan
    return {
        "ok": True,
        "service": "trackmind-moe-router",
        "status": "degraded" if degraded or utilization.collapsed else "healthy",
        "architecture": "semantic/classifier signals -> learned -> rmoe_gru -> sinkhorn",
        "components": components,
        "backends": backends,
        "expert_utilization": health_to_dict(utilization),
        "cascade_router": {
            "config": cascade_router_config(),
            "fallback_on_collapse": "sinkhorn",
        },
        "phase_router": {
            "native": PHASE_ROUTER_NATIVE,
            "config": phase_router_config(),
            "expert_loads": runtime.expert_loads,
            "load_imbalance": load_imbalance(runtime.expert_loads.values()) if load_imbalance else None,
        },
        "learned_router": {
            "config": learned_router_config(),
        },
        "expert_parallel": {
            "config": ep_config,
            "plan": parallel_plan.__dict__,
        },
        "degraded_components": degraded,
        "policies_loaded": [policy.get("id") for policy in runtime.policies],
    }
